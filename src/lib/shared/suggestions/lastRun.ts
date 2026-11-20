import { reportDayCount } from '@/lib/shared/reports/dates';

/**
 * Where a rerun plan starts: what the ad actually did last time and how it was set up. Plain
 * arithmetic over saved data, no AI. Amounts are in major units of the account currency.
 */
export type DaySpend = { day: string; spend: number | null };

/** Quiet days allowed inside one run (Meta sometimes spends nothing on a day mid-run). */
export const RUN_GAP_DAYS = 2;
export const USUAL_DAYS = 7;
export const MAX_PLAN_DAYS = 90;

export type LastRun = {
  firstDay: string;
  lastDay: string;
  /** Calendar days from the first to the last day with spend, inclusive. */
  days: number;
  spend: number;
  /** Spend per calendar day of the run. */
  perDay: number;
};

/**
 * The most recent run: the latest stretch of days with spend, joined across gaps of at most
 * RUN_GAP_DAYS quiet days. Null when no day had spend.
 */
export function lastRun(rows: DaySpend[], gap = RUN_GAP_DAYS): LastRun | null {
  const spent = rows.filter(r => r.spend !== null && r.spend > 0).sort((a, b) => a.day.localeCompare(b.day));
  if (spent.length === 0) return null;
  let first = spent.length - 1;
  while (first > 0 && reportDayCount(spent[first - 1].day, spent[first].day) - 2 <= gap) first -= 1;
  const run = spent.slice(first);
  const firstDay = run[0].day, lastDay = run[run.length - 1].day;
  const days = reportDayCount(firstDay, lastDay);
  const spend = run.reduce((sum, r) => sum + (r.spend ?? 0), 0);
  return { firstDay, lastDay, days, spend, perDay: spend / days };
}

/** How the ad (or its campaign, when the campaign holds the budget) was set up. */
export type BudgetSetup = {
  dailyBudget: number | null;
  lifetimeBudget: number | null;
  /** Whole days between its scheduled start and end, when it had an end date. */
  scheduledDays: number | null;
};

export type BudgetSource = 'daily' | 'lifetime' | 'actual' | 'account';
export type DaysSource = 'schedule' | 'actual' | 'owner' | 'usual';
export type RerunDefaults = {
  dailyBudget: number | null;
  budgetSource: BudgetSource | null;
  days: number;
  daysSource: DaysSource;
};

const usableDays = (days: number | null | undefined) => typeof days === 'number' && Number.isInteger(days) && days >= 1 && days <= MAX_PLAN_DAYS;
/** Whole currency units read best on the stepper; never below 1. */
const roundBudget = (value: number) => Math.max(1, Math.round(value));

/**
 * Starting plan, first rule that applies.
 * Days: scheduled run length → how long it actually ran last time → the owner's usual run length → 7.
 * Daily budget: its daily budget → lifetime budget ÷ scheduled days → what it actually spent per
 * day last time → the account's average spend per spending day.
 */
export function rerunDefaults(input: { setup: BudgetSetup; run: LastRun | null; ownerDays: number | null; accountPerDay: number | null }): RerunDefaults {
  const { setup, run } = input;
  const days: Pick<RerunDefaults, 'days' | 'daysSource'> =
    usableDays(setup.scheduledDays) ? { days: setup.scheduledDays!, daysSource: 'schedule' }
    : run && usableDays(run.days) ? { days: run.days, daysSource: 'actual' }
    : usableDays(input.ownerDays) ? { days: input.ownerDays!, daysSource: 'owner' }
    : { days: USUAL_DAYS, daysSource: 'usual' };

  const budget: Pick<RerunDefaults, 'dailyBudget' | 'budgetSource'> =
    setup.dailyBudget !== null && setup.dailyBudget > 0 ? { dailyBudget: setup.dailyBudget, budgetSource: 'daily' }
    : setup.lifetimeBudget !== null && setup.lifetimeBudget > 0 && usableDays(setup.scheduledDays)
      ? { dailyBudget: roundBudget(setup.lifetimeBudget / setup.scheduledDays!), budgetSource: 'lifetime' }
    : run && run.perDay > 0 ? { dailyBudget: roundBudget(run.perDay), budgetSource: 'actual' }
    : input.accountPerDay !== null && input.accountPerDay > 0 ? { dailyBudget: roundBudget(input.accountPerDay), budgetSource: 'account' }
    : { dailyBudget: null, budgetSource: null };

  return { ...budget, ...days };
}

/** Whole days between two schedule timestamps (ISO with offset); null when unusable or open-ended. */
export function scheduledDays(start: unknown, end: unknown): number | null {
  if (typeof start !== 'string' || typeof end !== 'string') return null;
  const ms = Date.parse(end) - Date.parse(start);
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const days = Math.round(ms / 86_400_000);
  return days >= 1 ? days : null;
}

/** Account average spend per day that had any spend, from per-day totals. Null with no spend. */
export function averagePerSpendingDay(rows: DaySpend[]): number | null {
  const totals = new Map<string, number>();
  for (const r of rows) if (r.spend !== null && r.spend > 0) totals.set(r.day, (totals.get(r.day) ?? 0) + r.spend);
  if (totals.size === 0) return null;
  return [...totals.values()].reduce((a, b) => a + b, 0) / totals.size;
}
