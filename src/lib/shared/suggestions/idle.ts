import { reportDayCount } from '@/lib/shared/reports/dates';
import type { ResultDefinition } from '@/lib/shared/performance/resultChannel';

/**
 * "Your ads are off" suggestion: when nothing is running, now and then offer to run the owner's
 * best ad again or try a new one, with an estimate from their own history. Pure rules only.
 */
export const IDLE_FIRST_DAYS = 7;
export const IDLE_REPEAT_DAYS = 14;
/** Weeks need this many results for their cost per result to count toward the estimate. */
export const MIN_WEEK_RESULTS = 3;
/** And at least this many such weeks, or no estimate is shown. */
export const MIN_FORECAST_WEEKS = 2;

/** Days from `from` to `to` (account-local dates); 0 on the same day. */
const daysSince = (from: string, to: string) => reportDayCount(from, to) - 1;

/**
 * Due when no ad runs now (`activeNow === false`, never unknown), the last day with spend is at
 * least 7 days ago, and no suggestion was made since then in the last 14 days. An account that
 * never spent gets no suggestion (nothing to base it on). Running ads again resets the cadence.
 */
export function idleSuggestionDue(input: { today: string; activeNow: boolean | null; lastSpendDay: string | null; lastSuggestedDay: string | null }): boolean {
  const { today, activeNow, lastSpendDay, lastSuggestedDay } = input;
  if (activeNow !== false || !lastSpendDay || lastSpendDay > today) return false;
  if (daysSince(lastSpendDay, today) < IDLE_FIRST_DAYS) return false;
  const suggestedThisIdle = lastSuggestedDay !== null && lastSuggestedDay > lastSpendDay;
  return !suggestedThisIdle || daysSince(lastSuggestedDay!, today) >= IDLE_REPEAT_DAYS;
}

export type WeekResult = { spend: number | null; results: number | null };
export type Forecast = { low: number; high: number; costLow: number; costHigh: number; weeks: number };

/**
 * Estimated results for `dailyBudget × days` from the best and worst weekly cost per result the
 * ad set actually had (weeks with spend and at least 3 results). Needs 2 such weeks; otherwise
 * null, and no number is shown. A range from the owner's own history, never a promise.
 */
export function restartForecast(input: { dailyBudget: number; days: number; weeks: WeekResult[] }): Forecast | null {
  const { dailyBudget, days } = input;
  if (!(dailyBudget > 0) || !(days > 0)) return null;
  const costs = input.weeks
    .filter(w => w.spend !== null && w.results !== null && w.spend > 0 && w.results >= MIN_WEEK_RESULTS)
    .map(w => w.spend! / w.results!);
  if (costs.length < MIN_FORECAST_WEEKS) return null;
  const costLow = Math.min(...costs), costHigh = Math.max(...costs), total = dailyBudget * days;
  return { low: Math.floor(total / costHigh), high: Math.floor(total / costLow), costLow, costHigh, weeks: costs.length };
}

/** The ad's picture, same shape and selection as the dashboard cards (`mediaFor`). */
export type SuggestionMedia = {
  creativeId: string; image: string | null; fallbackImage: string | null; fallbackImages?: string[];
  kind: 'image' | 'video' | 'carousel' | 'dynamic'; headline: string | null; text: string | null; cta: string | null;
};
/** The ad set's totals over the last STATS_DAYS days, same calculation as the dashboard (`aggregate`). */
export type SuggestionStats = Record<'spend' | 'results' | 'costPerResult' | 'impressions' | 'clicks' | 'ctr' | 'cpc' | 'cpm' | 'reach' | 'frequency', number | null>;
export const STATS_DAYS = 90;

/** Saved in the popup payload. Amounts are in major units of `currency`. */
export type IdleSuggestion =
  /** Meta reports an ad account problem (e.g. unpaid balance): fix that before any new ad. */
  | { kind: 'account'; lastSpendDay: string; issue: string | null }
  | {
    kind: 'restart';
    lastSpendDay: string;
    adSetId: string;
    adSetName: string;
    reason: 'cheapest' | 'recent';
    costPerResult: number | null;
    dailyBudget: number | null;
    days: number;
    forecast: Forecast | null;
    /** Optional so popups saved before pictures and stats were added still render. */
    media?: SuggestionMedia | null;
    stats?: SuggestionStats | null;
    result?: ResultDefinition | null;
  };
