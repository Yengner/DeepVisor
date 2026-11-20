import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/shared/types/supabase';
import { readAllPages } from '@/lib/server/repositories/pagination';
import { messagingSourceCandidates } from '@/lib/server/quickAd/service';
import { chooseSourceAdSet } from '@/lib/shared/quickAd/plan';
import { minorToAmount } from '@/lib/shared/agent/facts';
import { dayIn } from '@/lib/shared/time/zone';
import { shiftReportDay } from '@/lib/shared/reports/dates';
import { weekStartOf } from '@/lib/shared/bookings/checkin';
import { idleSuggestionDue, restartForecast, RESTART_DAYS, STATS_DAYS, type IdleSuggestion, type SuggestionMedia, type SuggestionStats, type WeekResult } from '@/lib/shared/suggestions/idle';
import { aggregate, mediaFor } from '@/lib/server/campaigns/exploration/model';
import { resultDefinitionFor, type ResultDefinition } from '@/lib/shared/performance/resultChannel';

type Db = SupabaseClient<Database>;
type Input = { businessId: string; accountId: string; timezone: string; currency: string | null; today: string; activeNow: boolean | null;
  /** First popup after setup: suggest right away instead of after the 7-day idle wait. */
  welcome?: boolean };

/** Latest account-local day with ad-set spend, or null when the account never spent. */
export async function lastSpendDay(db: Db, accountId: string): Promise<string | null> {
  const { data, error } = await db.from('ad_entity_performance_daily').select('day').eq('ad_account_id', accountId)
    .eq('entity_level', 'adset').gt('spend', 0).order('day', { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data?.day ?? null;
}

/** Day of the most recent suggestion shown for this account (any member). */
async function lastSuggestedDay(db: Db, input: Input): Promise<string | null> {
  const { data, error } = await db.from('insight_presentations').select('created_at').eq('business_id', input.businessId)
    .eq('ad_account_id', input.accountId).not('payload->suggestion', 'is', null).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data ? dayIn(input.timezone, new Date(data.created_at)) : null;
}

/** Daily budget of the ad set, or of its campaign when the campaign holds the budget; major units. */
export async function sourceDailyBudget(db: Db, accountId: string, adSetId: string, campaignId: string, currency: string | null): Promise<number | null> {
  if (!currency) return null;
  const [adSet, campaign] = await Promise.all([
    db.from('adset_dims').select('raw').eq('ad_account_id', accountId).eq('external_id', adSetId).maybeSingle(),
    db.from('campaign_dims').select('raw').eq('ad_account_id', accountId).eq('external_id', campaignId).maybeSingle(),
  ]);
  if (adSet.error) throw adSet.error;
  if (campaign.error) throw campaign.error;
  const minor = (raw: unknown) => {
    const value = raw && typeof raw === 'object' ? (raw as Record<string, unknown>).daily_budget : null;
    const n = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : typeof value === 'number' ? value : NaN;
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const amount = minor(adSet.data?.raw) ?? minor(campaign.data?.raw);
  return amount === null ? null : minorToAmount(amount, currency);
}

/**
 * The ad set's saved daily rows for the last STATS_DAYS days: weekly totals for the estimate and
 * the same totals the dashboard cards show (`aggregate`). Empty when the ad set is not saved.
 */
async function adSetHistory(db: Db, input: Input, adSetId: string, destinationType: string | null): Promise<{ weeks: WeekResult[]; stats: SuggestionStats | null; result: ResultDefinition | null }> {
  const { data: entity, error } = await db.from('ad_entities').select('id').eq('business_id', input.businessId)
    .eq('ad_account_id', input.accountId).eq('entity_level', 'adset').eq('external_id', adSetId).maybeSingle();
  if (error) throw error;
  if (!entity) return { weeks: [], stats: null, result: null };
  const rows = await readAllPages((from, to) => db.from('ad_entity_performance_daily')
    .select('entity_id, day, currency_code, spend, leads, messages, calls, impressions, clicks, reach, inline_link_clicks')
    .eq('entity_id', entity.id).gte('day', shiftReportDay(input.today, -(STATS_DAYS - 1))).order('day').range(from, to), { nullDataError: 'Performance unavailable' });
  const weeks = new Map<string, WeekResult>();
  for (const r of rows) {
    const key = weekStartOf(r.day), w = weeks.get(key) ?? { spend: 0, results: 0 };
    const results = [r.leads, r.messages, r.calls].every(v => typeof v === 'number') ? r.leads! + r.messages! + r.calls! : null;
    weeks.set(key, {
      spend: w.spend === null || r.spend === null ? null : w.spend + r.spend,
      results: w.results === null || results === null ? null : w.results + results,
    });
  }
  const m = rows.length ? aggregate(rows, input.currency) : null;
  const stats: SuggestionStats | null = m ? {
    spend: m.spend, results: m.results, costPerResult: m.costPerResult, impressions: m.impressions, clicks: m.clicks,
    ctr: m.ctr, cpc: m.cpc, cpm: m.cpm, reach: m.reach, frequency: m.frequency,
  } : null;
  return { weeks: [...weeks.values()], stats, result: rows.length ? resultDefinitionFor(rows, () => destinationType) : null };
}

/** Picture of the ad set's latest ad, chosen exactly like the dashboard cards (`mediaFor`). */
async function adSetMedia(db: Db, input: Input, adSetId: string): Promise<SuggestionMedia | null> {
  const { data: ads, error } = await db.from('ad_dims').select('creative_id, status').eq('ad_account_id', input.accountId)
    .eq('adset_external_id', adSetId).not('creative_id', 'is', null).order('created_time', { ascending: false, nullsFirst: false }).limit(5);
  if (error) throw error;
  const ad = ads?.find(a => !/deleted|archived/i.test(a.status ?? '')) ?? ads?.[0];
  if (!ad?.creative_id) return null;
  const { data: creative, error: creativeError } = await db.from('ad_creatives').select('*').eq('business_id', input.businessId)
    .eq('ad_account_id', input.accountId).eq('platform_creative_id', ad.creative_id).maybeSingle();
  if (creativeError) throw creativeError;
  return creative ? mediaFor(creative) : null;
}

/**
 * The "your ads are off" suggestion for the Insights popup, or null when it is not due. Ad account
 * problems Meta reports (e.g. unpaid balance) come first: no ad is suggested until they are fixed.
 * Read-only; nothing is drafted or sent to Meta here.
 */
export async function loadIdleSuggestion(db: Db, input: Input): Promise<IdleSuggestion | null> {
  if (input.activeNow !== false) return null;
  const [spendDay, suggestedDay] = await Promise.all([lastSpendDay(db, input.accountId), lastSuggestedDay(db, input)]);
  // The welcome popup offers it right away; otherwise wait 7 days of idle, then every 14 days.
  if (input.welcome ? !spendDay : !idleSuggestionDue({ today: input.today, activeNow: input.activeNow, lastSpendDay: spendDay, lastSuggestedDay: suggestedDay })) return null;

  const account = await db.from('insight_issues').select('evidence').eq('business_id', input.businessId)
    .eq('ad_account_id', input.accountId).eq('source', 'account').is('resolved_at', null).order('opened_at', { ascending: false }).limit(1).maybeSingle();
  if (account.error) throw account.error;
  if (account.data) {
    const title = (account.data.evidence as { title?: unknown } | null)?.title;
    return { kind: 'account', lastSpendDay: spendDay!, issue: typeof title === 'string' ? title.slice(0, 120) : null };
  }

  const source = chooseSourceAdSet(await messagingSourceCandidates({ db, businessId: input.businessId, accountId: input.accountId, today: input.today }));
  if (!source) return null;
  const [dailyBudget, history, media] = await Promise.all([
    sourceDailyBudget(db, input.accountId, source.adSetId, source.campaignId, input.currency),
    adSetHistory(db, input, source.adSetId, source.destinationType),
    // A missing picture never blocks the suggestion; the card shows a placeholder.
    adSetMedia(db, input, source.adSetId).catch(() => null),
  ]);
  const weeks = history.weeks;
  return {
    kind: 'restart', lastSpendDay: spendDay!, adSetId: source.adSetId, adSetName: source.name, reason: source.reason,
    costPerResult: source.spend !== null && source.results ? source.spend / source.results : null,
    dailyBudget, days: RESTART_DAYS,
    forecast: dailyBudget === null ? null : restartForecast({ dailyBudget, days: RESTART_DAYS, weeks }),
    media, stats: history.stats, result: history.result,
  };
}
