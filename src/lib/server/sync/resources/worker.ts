import {captureMetaEvents,captureMetaLifecycle} from '@/lib/server/lifecycle/service';
import 'server-only';
import { createAdminClient } from '@/lib/server/supabase/admin';
import { getBusinessIntegrationById, resolveIntegrationAccessToken } from '@/lib/server/integrations/service';
import { readAllPages } from '@/lib/server/repositories/pagination';
import { createOrReuseQueuedSyncJob } from '@/lib/server/repositories/ad_accounts/syncState';
import type { Database, Json } from '@/lib/shared/types/supabase';
import { asRecord } from '@/lib/shared/utils/format';
import { fetchMetaCampaignPerformanceSeeds, fetchMetaAdsetPerformanceSeeds, fetchMetaAdPerformanceSeeds, fetchMetaAdsetAudienceBreakdownSeeds } from '../meta/fetch';
import { parallelTasks } from '../concurrency';
import { ResourceDeferred, withResourceBudget, resourceSignal } from './budget';
import { ensureAccountWebhooks } from '@/lib/server/webhooks/subscription';

type Job = Database['public']['Tables']['account_sync_jobs']['Row'];
type Entity = Pick<Database['public']['Tables']['ad_entities']['Row'], 'id' | 'external_id' | 'entity_level' | 'objective' | 'status' | 'campaign_id' | 'adset_id'>;
export function requireEntity(entities: Map<string, Entity>, level: string, externalId: string) {
  const entity = entities.get(`${level}:${externalId}`);
  if (!entity) throw new ResourceDeferred('hierarchy_required');
  return entity;
}
function failure(error: unknown): { reason: string; seconds: number } {
  if (error instanceof ResourceDeferred) return { reason: error.reason, seconds: error.retrySeconds };
  // Wrappers retain causes. Classify without persisting provider messages or tokens.
  if (error instanceof Error && /Unsupported audience breakdown/.test(error.message)) return {reason:'unsupported',seconds:86400};
  if (error instanceof Error && error.cause) return failure(error.cause);
  const message = error instanceof Error ? error.message : '';
  if (/code=190|code=10\b|code=200\b|expired.*token|permission/i.test(message)) return { reason: 'reauthentication_required', seconds: 86400 };
  if (/unsupported|not supported|not available.*breakdown/i.test(message)) return { reason: 'unsupported', seconds: 86400 };
  return { reason: 'provider_unavailable', seconds: 60 + Math.floor(Math.random() * 30) };
}
export async function processResourceJob(job: Job) {
  const db = createAdminClient();
  try {
    await withResourceBudget(db, job.ad_account_id, async () => {
      const integration = await getBusinessIntegrationById(db, { businessId: job.business_id, integrationId: job.platform_integration_id });
      if (!integration || integration.platformKey !== 'meta' || !['connected', 'error'].includes(integration.status)) throw new ResourceDeferred('reauthentication_required');
      const accessToken = await resolveIntegrationAccessToken(db, integration, job.business_id);
      if (!accessToken) throw new ResourceDeferred('reauthentication_required');
      const { data: account, error } = await db.from('ad_accounts').select('external_account_id,currency_code').eq('business_id', job.business_id).eq('id', job.ad_account_id).single();
      if (error) throw error;
      if (!job.requested_start_date || !job.requested_end_date) throw new Error('Missing resource dates');
      const entities = await readAllPages((from, to) => db.from('ad_entities').select('id,external_id,entity_level,objective,status,campaign_id,adset_id')
        .eq('business_id', job.business_id).eq('ad_account_id', job.ad_account_id).order('id').range(from, to), { nullDataError: 'Hierarchy unavailable' });
      const byId = new Map(entities.map(entity => [`${entity.entity_level}:${entity.external_id}`, entity]));
      const metadata = asRecord(job.metadata), query = asRecord(metadata.query);
      const input = { accessToken, adAccountExternalId: account.external_account_id, dateRange: { since: job.requested_start_date, until: job.requested_end_date } };
      // At most one check a day per account; a failure only means the account stays on polling.
      await ensureAccountWebhooks({ businessId: job.business_id, adAccountId: job.ad_account_id, externalAccountId: account.external_account_id, accessToken }).catch(() => console.warn('Meta webhook subscription check unavailable.'));
      if (metadata.resourceKind === 'events') {
        // Status and issue re-read only: no performance rows are fetched, staged or replaced.
        await captureMetaEvents(job, accessToken, account.external_account_id, query.objects);
        resourceSignal()?.throwIfAborted();
        const done = await db.rpc('complete_account_events', { p_job: job.id, p_generation: job.lease_generation });
        if (done.error) throw done.error;
        return;
      }
      let rows: Json[];
      if (metadata.resourceKind === 'performance') {
        await captureMetaLifecycle(job,accessToken,account.external_account_id).catch(()=>console.warn('Lifecycle observation unavailable; no transition inferred.'));
        const levels = await parallelTasks([
          async () => (await fetchMetaCampaignPerformanceSeeds(input)).map(seed => ({ ...seed, externalId: seed.campaignExternalId, level: 'campaign' })),
          async () => (await fetchMetaAdsetPerformanceSeeds(input)).map(seed => ({ ...seed, externalId: seed.adsetExternalId, level: 'adset' })),
          async () => (await fetchMetaAdPerformanceSeeds(input)).map(seed => ({ ...seed, externalId: seed.adExternalId, level: 'ad' })),
        ], 3);
        rows = levels.flat().map(seed => {
          const entity = requireEntity(byId, seed.level, seed.externalId);
          if (seed.currencyCode !== account.currency_code) throw new Error('Account currency changed');
          return { entity_id: entity.id, entity_level: seed.level, day: seed.day, currency_code: seed.currencyCode,
            objective: entity.objective, status: entity.status, spend: seed.spend, impressions: seed.impressions, reach: seed.reach,
            clicks: seed.clicks, inline_link_clicks: seed.inlineLinkClicks, leads: seed.leads, messages: seed.messages, calls: seed.calls };
        });
      } else {
        const seeds = await fetchMetaAdsetAudienceBreakdownSeeds({ ...input, allowedBreakdowns: [String(query.breakdown)], strictUnsupported: true });
        rows = seeds.map(seed => {
          const entity = requireEntity(byId, 'adset', seed.entityExternalId);
          if (seed.dateStart !== input.dateRange.since || seed.dateStop !== input.dateRange.until) throw new Error('Snapshot coverage mismatch');
          if (seed.currencyCode !== account.currency_code) throw new Error('Account currency changed');
          return { entity_id: entity.id, entity_level: 'adset', ad_account_id: job.ad_account_id, campaign_id: entity.campaign_id, adset_id: entity.id, ad_id: null,
            first_day: seed.dateStart, last_day: seed.dateStop, breakdown_type: seed.breakdownType,
            dimension_1_key: seed.dimension1Key, dimension_1_value: seed.dimension1Value, dimension_2_key: seed.dimension2Key, dimension_2_value: seed.dimension2Value,
            publisher_platform: seed.publisherPlatform, platform_position: seed.platformPosition, impression_device: seed.impressionDevice,
            currency_code: seed.currencyCode, spend: seed.spend, impressions: seed.impressions, reach: seed.reach, clicks: seed.clicks,
            inline_link_clicks: seed.inlineLinkClicks, leads: seed.leads, messages: seed.messages, calls: seed.calls,
            updated_at: new Date().toISOString() };
        });
      }
      if (rows.length > 100000) throw new ResourceDeferred('row_budget', 3600);
      const chunks = Math.max(1, Math.ceil(rows.length / 500));
      for (let chunk = 0; chunk < chunks; chunk++) {
        resourceSignal()?.throwIfAborted();
        const result = await db.rpc('stage_account_resource', { p_job: job.id, p_generation: job.lease_generation, p_chunk: chunk, p_rows: rows.slice(chunk * 500, (chunk + 1) * 500) });
        if (result.error) throw result.error;
      }
      resourceSignal()?.throwIfAborted();
      const published = await db.rpc('publish_account_resource', { p_job: job.id, p_generation: job.lease_generation, p_chunks: chunks });
      if (published.error) throw published.error;
    });
    return { jobId: job.id, adAccountId: job.ad_account_id, status: 'completed' as const, message: asRecord(job.metadata).resourceKind === 'events' ? 'Advertising status re-read from Meta.' : 'Requested data refreshed; Meta attribution may still change.' };
  } catch (error) {
    const { reason, seconds } = failure(error);
    const failed = await db.rpc('fail_account_resource', { p_job: job.id, p_generation: job.lease_generation, p_reason: reason, p_retry_seconds: seconds });
    if (failed.error) throw failed.error;
    if (reason === 'hierarchy_required') await createOrReuseQueuedSyncJob(db, { businessId: job.business_id, platformIntegrationId: job.platform_integration_id, adAccountId: job.ad_account_id,
      syncType: 'incremental', requestedStartDate: job.requested_start_date!, requestedEndDate: job.requested_end_date! });
    return { jobId: job.id, adAccountId: job.ad_account_id, status: 'failed' as const, message: reason };
  }
}
