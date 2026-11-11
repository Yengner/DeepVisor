import 'server-only';
import { z } from 'zod';
import { createAdminClient } from '@/lib/server/supabase/admin';
import { currentSyncLease } from '@/lib/server/supabase/syncLeaseContext';
import { accountToday, shiftReportDay } from '@/lib/shared/reports/dates';
import { fetchMetaCollection } from '../meta/client';
import { resourceRefreshEnabled } from './coordinator';
import { normalize, learningLabel, readInsightActions } from './insightModel';
import type { MetaRow } from './insightModel';

const metric = z.number().finite().nonnegative().nullable();
const row = z.object({ entity_id: z.string(), externalId: z.string(), day: z.string(), currency_code: z.string().nullable(),
  publisher: z.string(), label: z.string(), spend: metric, impressions: metric, clicks: metric, reach: metric,
  inline_link_clicks: metric, leads: metric, messages: metric, calls: metric });
export async function readSavedInsights(businessId: string, accountId: string) {
  const { data, error } = await createAdminClient().from('account_insight_snapshots').select('dataset,payload,retrieved_at,coverage_start,coverage_end')
    .eq('business_id', businessId).eq('ad_account_id', accountId);
  if (error) throw error;
  const dataset = (name: string) => {
    const saved = data.find(r => r.dataset === name);
    if (!saved) return null;
    const rows = z.array(row).max(100000).parse(saved.payload);
    if (rows.some(r => r.day < saved.coverage_start || r.day > saved.coverage_end)) throw new Error('Invalid saved insight coverage');
    return rows;
  };
  const times = Object.fromEntries(data.map(r => [r.dataset, r.retrieved_at]));
  const learning = data.find(r => r.dataset === 'learning');
  return { daily: dataset('daily'), audience: dataset('audience'), hourly: dataset('hourly'),
    learning: learning ? z.record(z.string(), z.string()).parse(learning.payload) : {},
    fetchedAt: times.daily ?? '', audienceFetchedAt: times.audience ?? '', hourlyFetchedAt: times.hourly ?? '', source: 'stored' as const };
}

/** Optional queries run only inside an existing fenced maintenance/manual job and its shared API budget. */
export async function syncSavedInsights(jobId: string, accessToken: string) {
  if (!resourceRefreshEnabled()) return;
  const lease = currentSyncLease();
  if (!lease || lease.jobId !== jobId) throw new Error('Insight refresh requires a claimed worker');
  const db = createAdminClient();
  const job = await db.from('account_sync_jobs').select('id,business_id,ad_account_id,lease_generation').eq('id', jobId).eq('status', 'running').single();
  if (job.error) throw job.error;
  if (job.data.lease_generation !== lease.generation) throw new Error('Expired insight writer lease');
  const account = await db.from('ad_accounts').select('external_account_id,currency_code,timezone').eq('id', job.data.ad_account_id).eq('business_id', job.data.business_id).single();
  if (account.error) throw account.error;
  const policy = await db.from('business_data_policies').select('daily_history_days,audience_history_days,hourly_history_days,allowed_breakdowns').eq('business_id', job.data.business_id).maybeSingle();
  if (policy.error) throw policy.error;
  const today = accountToday(account.data.timezone);
  const currency = account.data.currency_code;
  if (!today || !currency) return;
  const path = `act_${account.data.external_account_id.replace(/^act_/, '')}`;
  const allowed = (key: string) => !policy.data || policy.data.allowed_breakdowns.includes(key);
  const publish = async (dataset: string, payload: ReturnType<typeof normalize> | Record<string, string>, since: string) => {
    const result = await db.rpc('publish_account_insights', { p_job: jobId, p_generation: lease.generation, p_dataset: dataset, p_payload: payload, p_since: since, p_until: today });
    if (result.error) throw result.error;
  };
  const read = async (breakdowns: string, level: string, since: string, hourly: boolean) => {
    const rows = await readInsightActions(includeActions => fetchMetaCollection<MetaRow>({ path: `${path}/insights`, accessToken, maxRows: 100000,
      params: { fields: `date_start,${level === 'adset' ? 'adset_id,' : ''}spend,impressions,clicks${includeActions ? ',actions' : ''}`, level, time_increment: 1,
        time_range: JSON.stringify({ since, until: today }), breakdowns, limit: 500 } }), hourly);
    if (rows.length > 100000) throw new Error('Insight row budget exceeded');
    return normalize(breakdowns.includes('publisher_platform') ? rows : rows.map(r => ({ ...r, publisher_platform: 'combined-only' })), currency, hourly);
  };
  // Optional source failure preserves its previous complete batch and retrieval time.
  // No synthetic daily observations are manufactured from summarized audience snapshots.
  for (const spec of [
    { key: 'daily', level: 'adset', breakdown: 'publisher_platform', fallback: '', days: Math.min(60, policy.data?.daily_history_days ?? 60), enabled: allowed('publisher_platform') },
    { key: 'audience', level: 'account', breakdown: 'publisher_platform,age,gender', fallback: 'age,gender', days: Math.min(30, policy.data?.audience_history_days ?? 30), enabled: allowed('age_gender') },
    { key: 'hourly', level: 'account', breakdown: 'publisher_platform,hourly_stats_aggregated_by_advertiser_time_zone', fallback: 'hourly_stats_aggregated_by_advertiser_time_zone', days: Math.min(30, policy.data?.hourly_history_days ?? 30), enabled: true },
  ]) {
    if (!spec.enabled || spec.days < 1) continue;
    const since = shiftReportDay(today, -(spec.days - 1));
    try {
      let rows;
      try { rows = await read(!allowed('publisher_platform') && spec.fallback ? spec.fallback : spec.breakdown, spec.level, since, spec.key === 'hourly'); }
      catch { if (!spec.fallback) continue; rows = await read(spec.fallback, spec.level, since, spec.key === 'hourly'); }
      await publish(spec.key, rows, since);
    } catch { console.warn('Optional Meta insight dataset not refreshed', { dataset: spec.key }); }
  }
  try {
    const rows = await fetchMetaCollection<{ id: string; learning_stage_info?: unknown }>({ path: `${path}/adsets`, accessToken, params: { fields: 'id,learning_stage_info', limit: 100 } });
    await publish('learning', Object.fromEntries(rows.map(r => [r.id, learningLabel(r.learning_stage_info)])), today);
  } catch { /* Native learning status is optional; never inferred. */ }
}
