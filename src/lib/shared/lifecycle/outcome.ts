import { shiftReportDay } from '@/lib/shared/reports/dates';

/** Same evidence bar as Reports' matched-day comparison and the card's lead-up. */
export const MIN_OUTCOME_DAYS = 3;
export const OUTCOME_WINDOW = 7;

export type OutcomeDay = { day: string; spend: number | null; results: number | null };
export interface OutcomeTotals { spend: number; results: number; cpr: number | null }
export type OutcomeState =
  /** Fewer than MIN_OUTCOME_DAYS completed days have passed since the change. */
  | 'too-early'
  /** Matched before/after days exist: changes are measured on those days only. */
  | 'compared'
  /** The ads have no rows after the change, but the account was synced on those days. */
  | 'no-delivery-after'
  /** Not enough paired evidence to say anything. */
  | 'insufficient';

export interface LifecycleOutcome {
  state: OutcomeState;
  changeDay: string;
  before: { from: string; to: string };
  after: { from: string; to: string } | null;
  completedDaysAfter: number;
  matchedDays: number;
  syncedDaysAfter: number;
  beforeTotals: OutcomeTotals | null;
  afterTotals: OutcomeTotals | null;
  resultsChange: number | null;
  spendChange: number | null;
  /** The days actually paired, when compared (a subset of the windows above). */
  compared: { before: { from: string; to: string }; after: { from: string; to: string } } | null;
  /** Every day in both windows for the chart; null values are gaps, not zero. `paired` marks compared days. */
  series: Array<OutcomeDay & { side: 'before' | 'change' | 'after'; paired: boolean }>;
}

const totals = (rows: OutcomeDay[]): OutcomeTotals => {
  const spend = rows.reduce((s, d) => s + d.spend!, 0), results = rows.reduce((s, d) => s + d.results!, 0);
  return { spend, results, cpr: results > 0 ? spend / results : null };
};
const pct = (a: number, b: number) => b > 0 ? (a - b) / b * 100 : null;

/**
 * Before vs after a lifecycle change. The change day itself is excluded (it is partly before and
 * partly after). Day k after the change pairs with day k before it, and a pair counts only when
 * both days have spend and results. After-days stop at the last completed account day.
 *
 * `syncedDays` are account days that have any saved records. When the affected ads have no rows
 * after the change but the account was synced on at least MIN_OUTCOME_DAYS of those days, the
 * absence is reported as "no spend recorded"; without that evidence it stays insufficient.
 */
export function lifecycleOutcome(days: OutcomeDay[], changeDay: string, today: string, syncedDays: string[], window = OUTCOME_WINDOW): LifecycleOutcome {
  const lastComplete = shiftReportDay(today, -1);
  const byDay = new Map(days.map(d => [d.day, d]));
  const before = { from: shiftReportDay(changeDay, -window), to: shiftReportDay(changeDay, -1) };
  const afterFrom = shiftReportDay(changeDay, 1);
  const afterTo = [shiftReportDay(changeDay, window), lastComplete].sort()[0];
  const after = afterTo >= afterFrom ? { from: afterFrom, to: afterTo } : null;
  const completedDaysAfter = after ? Math.round((Date.parse(after.to) - Date.parse(after.from)) / 86_400_000) + 1 : 0;
  const synced = new Set(syncedDays);

  const series: LifecycleOutcome['series'] = [];
  for (let d = before.from; d <= (after?.to ?? changeDay); d = shiftReportDay(d, 1)) {
    const row = byDay.get(d);
    series.push({ day: d, spend: row?.spend ?? null, results: row?.results ?? null, side: d < changeDay ? 'before' : d === changeDay ? 'change' : 'after', paired: false });
  }

  const pairedBefore: OutcomeDay[] = [], pairedAfter: OutcomeDay[] = [];
  for (let k = 0; k < completedDaysAfter; k += 1) {
    const b = byDay.get(shiftReportDay(changeDay, -(k + 1))), a = byDay.get(shiftReportDay(changeDay, k + 1));
    if (b && a && b.spend !== null && b.results !== null && a.spend !== null && a.results !== null) { pairedBefore.push(b); pairedAfter.push(a); }
  }
  const afterDays = after ? series.filter(d => d.side === 'after') : [];
  const syncedDaysAfter = afterDays.filter(d => synced.has(d.day)).length;
  const base = { changeDay, before, after, completedDaysAfter, syncedDaysAfter, series, compared: null };

  if (completedDaysAfter < MIN_OUTCOME_DAYS) {
    return { ...base, state: 'too-early', matchedDays: 0, beforeTotals: null, afterTotals: null, resultsChange: null, spendChange: null };
  }
  if (pairedAfter.length >= MIN_OUTCOME_DAYS) {
    const b = totals(pairedBefore), a = totals(pairedAfter);
    const pairedDays = new Set([...pairedBefore, ...pairedAfter].map(d => d.day));
    for (const point of series) point.paired = pairedDays.has(point.day);
    const span = (rows: OutcomeDay[]) => { const ds = rows.map(r => r.day).sort(); return { from: ds[0], to: ds.at(-1)! }; };
    return { ...base, compared: { before: span(pairedBefore), after: span(pairedAfter) }, state: 'compared', matchedDays: pairedAfter.length, beforeTotals: b, afterTotals: a, resultsChange: pct(a.results, b.results), spendChange: pct(a.spend, b.spend) };
  }
  const adRowsAfter = afterDays.filter(d => byDay.has(d.day)).length;
  const beforeObserved = series.filter(d => d.side === 'before' && d.spend !== null && d.results !== null);
  if (adRowsAfter === 0 && syncedDaysAfter >= MIN_OUTCOME_DAYS && beforeObserved.length >= MIN_OUTCOME_DAYS) {
    return { ...base, state: 'no-delivery-after', matchedDays: 0, beforeTotals: totals(beforeObserved), afterTotals: null, resultsChange: null, spendChange: null };
  }
  return { ...base, state: 'insufficient', matchedDays: pairedAfter.length, beforeTotals: null, afterTotals: null, resultsChange: null, spendChange: null };
}
