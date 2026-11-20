import 'server-only';
import type { AssistantAccess } from '@/lib/server/intelligence/assistant/access';
import { getMonthlyBudgetUpperBound, MAX_DAILY_CAMPAIGN_BUDGET } from '@/lib/server/campaigns/budgetGuardrails';
import { dayIn } from '@/lib/shared/time/zone';
import type { RerunPlanData } from '@/lib/shared/suggestions/rerun';
import { restartSourceDetails } from './idle';

const META_ID = /^\d{1,30}$/;

export type RestartSource = { adSetId: string; campaignId: string; name: string; destinationType: string | null; sourceAdId: string };

/**
 * The ad set (in the selected account, not deleted or archived) and its latest live ad to copy.
 * Null when the ad set or every ad in it is gone. Used by the plan page and the prepare action.
 */
export async function findRestartSource(scope: Pick<AssistantAccess, 'db' | 'account'>, adSetId: unknown): Promise<RestartSource | null> {
  if (typeof adSetId !== 'string' || !META_ID.test(adSetId)) return null;
  const { data: adSet, error } = await scope.db.from('adset_dims').select('external_id, campaign_external_id, name, status, raw')
    .eq('ad_account_id', scope.account.id).eq('external_id', adSetId).maybeSingle();
  if (error) throw error;
  if (!adSet?.campaign_external_id || /deleted|archived/i.test(adSet.status ?? '')) return null;
  const { data: ads, error: adError } = await scope.db.from('ad_dims').select('external_id, status')
    .eq('ad_account_id', scope.account.id).eq('adset_external_id', adSetId).not('external_id', 'is', null)
    .order('created_time', { ascending: false, nullsFirst: false }).limit(5);
  if (adError) throw adError;
  const ad = ads?.find(a => !/deleted|archived/i.test(a.status ?? ''));
  if (!ad?.external_id) return null;
  const raw = adSet.raw && typeof adSet.raw === 'object' ? adSet.raw as Record<string, unknown> : {};
  return {
    adSetId,
    campaignId: adSet.campaign_external_id,
    name: adSet.name ?? 'Ad set',
    destinationType: typeof raw.destination_type === 'string' ? raw.destination_type : null,
    sourceAdId: ad.external_id,
  };
}

export type RerunPlanLoad =
  | { kind: 'ready'; data: RerunPlanData }
  /** The ad set or its ads are gone. */
  | { kind: 'gone' }
  /** No budget, no past spend and no account spend to start from, or no currency/timezone. */
  | { kind: 'noBudget' };

/** Everything the "Run this ad again" page shows, read from saved data only (nothing sent to Meta). */
export async function loadRerunPlan(scope: AssistantAccess, adSetId: unknown): Promise<RerunPlanLoad> {
  const source = await findRestartSource(scope, adSetId);
  if (!source) return { kind: 'gone' };
  const zone = scope.account.timezone, currency = scope.account.currency_code;
  if (!zone || !currency) return { kind: 'noBudget' };
  const today = dayIn(zone);
  const [{ setup, run, start, history, media }, profile] = await Promise.all([
    restartSourceDetails(scope.db, { businessId: scope.businessId, accountId: scope.account.id, currency, today }, source),
    scope.db.from('business_profiles').select('monthly_budget').eq('id', scope.businessId).maybeSingle(),
  ]);
  if (profile.error) throw profile.error;
  if (start.dailyBudget === null || start.budgetSource === null) return { kind: 'noBudget' };
  return {
    kind: 'ready',
    data: {
      adSetId: source.adSetId,
      adSetName: source.name,
      media,
      stats: history.stats,
      resultKind: history.result?.kind ?? 'results',
      currency,
      today,
      start: { dailyBudget: start.dailyBudget, days: start.days, budgetSource: start.budgetSource, daysSource: start.daysSource },
      setup,
      run,
      weeks: history.weeks,
      monthlyCap: getMonthlyBudgetUpperBound(profile.data?.monthly_budget),
      maxDaily: MAX_DAILY_CAMPAIGN_BUDGET,
    },
  };
}
