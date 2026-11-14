import 'server-only';
import { createAdminClient } from '@/lib/server/supabase/admin';
import { accountToday, shiftReportDay } from '@/lib/shared/reports/dates';
import { asRecord } from '@/lib/shared/utils/format';
import { assertSimulationEnabled } from '@/lib/server/integrations/simulation/meta';
import { META_NORMALIZATION_VERSION } from '../meta/normalization';

/** Roll out only with the resource migration and updated worker installed. */
export const resourceRefreshEnabled = () => process.env.DEEPVISOR_RESOURCE_REFRESH === 'true';
export type ResourceScope = { businessId: string; integrationId: string; adAccountId: string; allowSimulation?: boolean };
export type ResourceResult = { status: 'queued' | 'running' | 'skipped'; reason: string; jobId?: string; revision?: number };
export const SUPPORTED_SNAPSHOT_BREAKDOWNS = ['age_gender', 'country', 'region', 'publisher_platform', 'impression_device'] as const;
export type SnapshotBreakdown = typeof SUPPORTED_SNAPSHOT_BREAKDOWNS[number];
export function performanceRange(timezone: string | null, source: 'app_visit' | 'scheduled_refresh', now = new Date()) {
  const today = accountToday(timezone, now);
  if (!today) throw new Error('Advertiser timezone unavailable');
  return { since: shiftReportDay(today, source === 'app_visit' ? -1 : -6), until: today };
}
export type EventObject = { id: string; level: 'campaign' | 'adset' | 'ad' | 'creative' };
export async function requestResource(scope: ResourceScope, kind: 'performance' | 'audience' | 'maintenance' | 'events', query: { since: string; until: string; source: string; breakdown?: SnapshotBreakdown; objects?: EventObject[] }): Promise<ResourceResult> {
  if (!resourceRefreshEnabled()) return { status: 'skipped', reason: 'disabled' };
  if (scope.allowSimulation) assertSimulationEnabled();
  const { data, error } = await createAdminClient().rpc('request_account_resource', {
    p_business: scope.businessId, p_integration: scope.integrationId, p_account: scope.adAccountId,
    p_kind: kind, p_query: { ...query, version: META_NORMALIZATION_VERSION }, p_allow_simulation: scope.allowSimulation ?? false,
  });
  if (error) throw error;
  const row = asRecord(data);
  if (!['queued', 'running', 'skipped'].includes(String(row.status))) throw new Error('Invalid resource response');
  return row as ResourceResult;
}
export async function requestRecentPerformance(scope: ResourceScope, source: 'app_visit' | 'scheduled_refresh') {
  const { data, error } = await createAdminClient().from('ad_accounts').select('timezone').eq('id', scope.adAccountId).eq('business_id', scope.businessId).single();
  if (error) throw error;
  const range=performanceRange(data.timezone, source);
  const result=await requestResource(scope, 'performance', { ...range, source });
  if (['retry_limit','not_connected','reauthentication_required','simulation_disabled','initial_sync_required'].includes(result.reason)) return result;
  // Dimensions/hourly are maintained independently. Refresh older attribution once per day.
  const db=createAdminClient();
  const policy=await db.from('business_data_policies').select('daily_history_days').eq('business_id',scope.businessId).maybeSingle();
  if(policy.error)throw policy.error;
  const since=shiftReportDay(range.until,-Math.min(29,Math.max(1,policy.data?.daily_history_days??30)-1));
  const correction=await db.from('account_sync_jobs').select('id').eq('ad_account_id',scope.adAccountId).eq('business_id',scope.businessId)
    .eq('status','completed').neq('sync_type','resource_refresh').lte('requested_start_date',since)
    .gte('finished_at',new Date(Date.now()-86400000).toISOString()).limit(1).maybeSingle();
  if(correction.error)throw correction.error;
  const maintenance=await requestResource(scope,'maintenance',{since:correction.data?shiftReportDay(range.until,-Math.min(6,Math.max(1,policy.data?.daily_history_days??30)-1)):since,until:range.until,source});
  return result.jobId ? result : maintenance.jobId ? maintenance : result;
}

/**
 * A provider event (verified webhook) asks for a status/issue re-read of the hierarchy through the
 * same queue as every other trigger. `objects` narrows the read; null means read everything.
 * It never reads or rewrites performance facts.
 */
export async function requestAccountEvents(scope: ResourceScope, objects: EventObject[] | null): Promise<ResourceResult> {
  if (!resourceRefreshEnabled()) return { status: 'skipped', reason: 'disabled' };
  const { data, error } = await createAdminClient().from('ad_accounts').select('timezone').eq('id', scope.adAccountId).eq('business_id', scope.businessId).single();
  if (error) throw error;
  const today = accountToday(data.timezone);
  if (!today) return { status: 'skipped', reason: 'timezone_unavailable' };
  return requestResource(scope, 'events', { since: today, until: today, source: 'webhook', ...(objects ? { objects } : {}) });
}
