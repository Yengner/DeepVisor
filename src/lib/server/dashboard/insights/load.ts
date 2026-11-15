import 'server-only';
import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { createAdminClient } from '../../supabase/admin';
import { getBusinessIntegrationById, resolveIntegrationAccessToken } from '../../integrations/service';
import { fetchMetaCollection } from '../../sync/meta/client';
import { normalize, learningLabel, type Insight, type MetaRow } from './model';
import { learningSnapshot, type LearningSnapshot } from './signals';
import { readInsightActions } from '../../sync/resources/insightModel';
import { shiftDay } from '../overview/model';
import type { OverviewContext } from '../overview/load';
import { resourceRefreshEnabled } from '../../sync/resources/coordinator';
import { readSavedInsights } from '../../sync/resources/insights';

type Scope = { business: string; account: string; integration: string; external: string; currency: string; zone: string; today: string };
export type Insights = { daily: Insight[] | null; audience: Insight[] | null; hourly: Insight[] | null; learning: Record<string, string>; learningDetail?: Record<string, LearningSnapshot>; fetchedAt: string; canonicalFetchedAt?: string; audienceFetchedAt?: string; hourlyFetchedAt?: string; source: 'api' | 'stored' | 'unavailable' };
const running = new Map<string, Promise<Insights>>();
async function fetchInsights(scope: Scope): Promise<Insights> {
  const key = JSON.stringify(scope);
  const pending = running.get(key);
  if (pending) return pending;
  const work = (async () => {
    const db = createAdminClient();
    const integration = await getBusinessIntegrationById(db, { businessId: scope.business, integrationId: scope.integration });
    const account = await db.from('ad_accounts').select('external_account_id').eq('business_id', scope.business).eq('id', scope.account).single();
    if (!integration || integration.status !== 'connected' || account.error || account.data.external_account_id !== scope.external) throw new Error('INSIGHTS_UNAVAILABLE');
    const token = await resolveIntegrationAccessToken(db, integration, scope.business);
    if (!token) throw new Error('INSIGHTS_UNAVAILABLE');
    const read = async (breakdowns: string, level: string, hourly = false) => {
      try {
        const { rows, actionsRequested } = await readInsightActions(includeActions => fetchMetaCollection<MetaRow>({ path: `act_${scope.external.replace(/^act_/, '')}/insights`, accessToken: token,
          params: { fields: `date_start,${level === 'adset' ? 'adset_id,' : ''}spend,impressions,clicks${includeActions ? ',actions' : ''}`, level, time_increment: 1,
            time_range: JSON.stringify({ since: shiftDay(scope.today, breakdowns === 'publisher_platform' && level === 'adset' ? -59 : -29), until: scope.today }), breakdowns, limit: 500 } }), hourly);
        return normalize(breakdowns.includes('publisher_platform') ? rows : rows.map(r => ({ ...r, publisher_platform: 'combined-only' })), scope.currency, hourly, actionsRequested);
      } catch { return null; }
    };
    // Separate compatible datasets: never add demographic/hourly rows to daily totals.
    const fetchedAt = new Date().toISOString();
    const daily = await read('publisher_platform', 'adset');
    const audience = await read('publisher_platform,age,gender', 'account') ?? await read('age,gender', 'account');
    const hourly = await read('publisher_platform,hourly_stats_aggregated_by_advertiser_time_zone', 'account', true) ?? await read('hourly_stats_aggregated_by_advertiser_time_zone', 'account', true);
    let learning: Record<string, string> = {};
    let learningDetail: Record<string, LearningSnapshot> = {};
    try {
      const rows = await fetchMetaCollection<{ id: string; learning_stage_info?: unknown }>({ path: `act_${scope.external.replace(/^act_/, '')}/adsets`, accessToken: token, params: { fields: 'id,learning_stage_info', limit: 100 } });
      learning = Object.fromEntries(rows.map(r => [r.id, learningLabel(r.learning_stage_info)]));
      learningDetail = Object.fromEntries(rows.map(r => [r.id, learningSnapshot(r.learning_stage_info)]));
    } catch { /* Native state remains unavailable, never inferred from elapsed time. */ }
    return { daily, audience, hourly, learning, learningDetail, fetchedAt: daily !== null || audience !== null || hourly !== null ? fetchedAt : '', source: daily === null ? 'unavailable' : 'api' } as Insights;
  })();
  running.set(key, work);
  try { return await work; } finally { running.delete(key); }
}
export const loadInsights = cache(async (context: OverviewContext): Promise<Insights> => {
  const empty: Insights = { daily: null, audience: null, hourly: null, learning: {}, fetchedAt: '', source: 'unavailable' };
  if (!context.account || !context.platform || context.platform.status !== 'connected' || context.timezoneUnavailable || !context.account.currency_code) return empty;
  const scope: Scope = { business: context.businessId, account: context.account.id, integration: context.platform.id, external: context.account.external_account_id,
    currency: context.account.currency_code, zone: context.zone, today: context.today };
  try {
    // Authorized context is resolved before this call. New mode never calls Meta on render.
    if (resourceRefreshEnabled()) {
      const db = createAdminClient();
      const [saved, resource] = await Promise.all([
        readSavedInsights(scope.business, scope.account),
        db.from('account_sync_resources').select('last_success_at').eq('business_id', scope.business).eq('ad_account_id', scope.account).eq('resource_key', 'performance:v2').maybeSingle(),
      ]);
      if (resource.error) throw resource.error;
      return { ...saved, canonicalFetchedAt: [resource.data?.last_success_at, context.account.last_synced].filter((at): at is string => Boolean(at)).sort().at(-1) ?? '' };
    }
    // No cookie access or credentials in cache arguments. Reauthorize before every cache read.
    const value = await unstable_cache(() => fetchInsights(scope), ['dashboard-insights-v4', JSON.stringify(scope), 'publisher:daily:age:gender:advertiser-hour'], { revalidate: 300 })();
    return value;
  } catch { return empty; }
});
