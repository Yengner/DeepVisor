import type { ReportMetricTotals } from './types';
import { isReportDate, reportDayCount, shiftReportDay } from './dates';

/** Fewer matched days than this is too little evidence for a period-over-period change. */
export const MIN_MATCHED_DAYS = 3;

export type ComparisonBasis = 'full' | 'matched_days';

export interface ComparisonMatch {
  basis: ComparisonBasis | null;
  /** Days (by offset from each period's start) that have records in both periods. */
  currentDays: Set<string>;
  previousDays: Set<string>;
  matchedDays: number;
  expectedDays: number;
  reason: string | null;
}

/**
 * Pair the selected and previous periods day-by-day (offset from each period's start).
 * Full coverage on both sides compares everything; otherwise only offsets observed in BOTH
 * periods are compared, so a gap on either side is never treated as zero.
 */
export function matchComparisonDays(
  currentObserved: string[],
  previousObserved: string[],
  current: { dateFrom: string; dateTo: string },
  previous: { dateFrom: string; dateTo: string },
): ComparisonMatch {
  const expectedDays = reportDayCount(current.dateFrom, current.dateTo);
  const inRange = (days: string[], from: string, to: string) => new Set(days.filter(d => isReportDate(d) && d >= from && d <= to));
  const cur = inRange(currentObserved, current.dateFrom, current.dateTo);
  const prev = inRange(previousObserved, previous.dateFrom, previous.dateTo);
  const currentDays = new Set<string>(), previousDays = new Set<string>();
  for (let offset = 0; offset < expectedDays; offset += 1) {
    const c = shiftReportDay(current.dateFrom, offset), p = shiftReportDay(previous.dateFrom, offset);
    if (cur.has(c) && prev.has(p)) { currentDays.add(c); previousDays.add(p); }
  }
  const matchedDays = currentDays.size;
  if (matchedDays === expectedDays) return { basis: 'full', currentDays, previousDays, matchedDays, expectedDays, reason: null };
  if (matchedDays >= MIN_MATCHED_DAYS) return { basis: 'matched_days', currentDays, previousDays, matchedDays, expectedDays, reason: null };
  const reason = !prev.size
    ? 'Comparison unavailable: the previous period has no saved records.'
    : matchedDays === 0
      ? 'Comparison unavailable: no day has saved records in both periods.'
      : `Comparison unavailable: only ${matchedDays} ${matchedDays === 1 ? 'day has' : 'days have'} saved records in both periods (at least ${MIN_MATCHED_DAYS} needed).`;
  return { basis: null, currentDays, previousDays, matchedDays, expectedDays, reason };
}

/** The selected-period totals a change is measured from: the matched days when comparison is partial. */
export function comparisonBaseTotals(payload: {
  summary: ReportMetricTotals;
  comparison: { currentComparableTotals?: ReportMetricTotals | null };
}): ReportMetricTotals {
  return payload.comparison.currentComparableTotals ?? payload.summary;
}

/** Short label for a delta, e.g. "vs previous" or "vs same 5 days before". */
export function comparisonLabel(comparison: { basis?: ComparisonBasis | null; matchedDays?: number | null }): string {
  return comparison.basis === 'matched_days' && comparison.matchedDays
    ? `on ${comparison.matchedDays} matched days`
    : 'vs previous';
}
