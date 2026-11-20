import { shiftReportDay } from '@/lib/shared/reports/dates';
import { profileSpendLimit } from '@/lib/shared/campaigns/budgetGuardrail';
import type { ResultKind } from '@/lib/shared/performance/resultChannel';
import { restartForecast, type Forecast, type SuggestionMedia, type SuggestionStats, type WeekResult } from './idle';

/**
 * "Run this ad again" plan page: the owner picks a daily budget and a number of days; the page
 * works out the dates, the total and an estimate from their own weeks. Pure rules, no AI.
 */
export const RERUN_DAY_CHOICES = [3, 7, 14] as const;
export const RERUN_MIN_DAYS = 1;
export const RERUN_MAX_DAYS = 90;
/** Smallest daily budget a draft accepts (major units), same as the draft builder. */
export const RERUN_MIN_DAILY = 1;
/** A budget this many times last time's is "much more than before": results rarely grow as fast. */
export const RERUN_BIG_JUMP = 2;

/** Everything the plan page needs, loaded and scoped on the server. Amounts in major units. */
export type RerunPlanData = {
  adSetId: string;
  adSetName: string;
  media: SuggestionMedia | null;
  stats: SuggestionStats | null;
  resultKind: ResultKind;
  currency: string;
  /** Account-local today; the plan starts tomorrow. */
  today: string;
  /** Last time's daily budget, the starting point. */
  previousDailyBudget: number;
  weeks: WeekResult[];
  /** Top of the saved monthly budget range, when one is saved; drafts above the limit are refused. */
  monthlyCap: number | null;
  maxDaily: number;
};

export type RerunPlan = {
  /** Account-local days the ad runs, first and last (inclusive). */
  startDay: string;
  lastDay: string;
  total: number;
  forecast: Forecast | null;
  /** Spend above this is refused by the draft builder; null when no monthly budget is saved. */
  limit: number | null;
  overLimit: boolean;
  bigJump: boolean;
  /** Why the plan cannot be prepared as it stands, if it cannot. */
  problem: 'budget-low' | 'budget-high' | 'days' | 'over-limit' | null;
};

export function validDays(days: number) {
  return Number.isInteger(days) && days >= RERUN_MIN_DAYS && days <= RERUN_MAX_DAYS;
}

/** The plan for a daily budget and number of days, computed exactly as the draft will be made. */
export function rerunPlan(data: Pick<RerunPlanData, 'today' | 'previousDailyBudget' | 'weeks' | 'monthlyCap' | 'maxDaily'>, dailyBudget: number, days: number): RerunPlan {
  const daysOk = validDays(days);
  const budgetOk = Number.isFinite(dailyBudget) && dailyBudget >= RERUN_MIN_DAILY && dailyBudget <= data.maxDaily;
  const startDay = shiftReportDay(data.today, 1);
  const lastDay = shiftReportDay(startDay, Math.max(daysOk ? days : 1, 1) - 1);
  const total = budgetOk && daysOk ? dailyBudget * days : 0;
  const limit = data.monthlyCap !== null && daysOk ? profileSpendLimit(data.monthlyCap, days) : null;
  const overLimit = limit !== null && total > limit;
  const problem = !budgetOk ? (Number.isFinite(dailyBudget) && dailyBudget > data.maxDaily ? 'budget-high' : 'budget-low')
    : !daysOk ? 'days' : overLimit ? 'over-limit' : null;
  return {
    startDay,
    lastDay,
    total,
    forecast: budgetOk && daysOk ? restartForecast({ dailyBudget, days, weeks: data.weeks }) : null,
    limit,
    overLimit,
    bigJump: budgetOk && dailyBudget > data.previousDailyBudget * RERUN_BIG_JUMP,
    problem,
  };
}
