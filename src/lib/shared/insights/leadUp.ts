import { shiftReportDay } from '@/lib/shared/reports/dates';

/** Same evidence bar as Reports' matched-day comparison. */
export const MIN_LEAD_UP_DAYS = 3;
type Day = { day: string; spend: number | null; results: number | null };
export interface LeadUpTotals { spend: number; results: number; cpr: number | null }
export interface LeadUp {
  recent: LeadUpTotals; prior: LeadUpTotals; matchedDays: number; windowDays: number;
  recentFrom: string; recentTo: string; priorFrom: string; priorTo: string;
  resultsChange: number | null; spendChange: number | null;
}

/**
 * How the affected advertising was doing before a change: the `windowDays` completed days before
 * the change day against the same number of days before those. Days pair by offset and count only
 * when both sides have spend and results, so a gap is never compared as zero. Too few matched
 * days returns null rather than a weak claim. Saved cards hold no days after the change.
 */
export function leadUp(days: Day[], changeDay: string, windowDays = 7): LeadUp | null {
  const byDay = new Map(days.filter(d => d.spend !== null && d.results !== null).map(d => [d.day, d]));
  const recentFrom = shiftReportDay(changeDay, -windowDays), priorFrom = shiftReportDay(changeDay, -2 * windowDays);
  const recent: Day[] = [], prior: Day[] = [];
  for (let offset = 0; offset < windowDays; offset += 1) {
    const r = byDay.get(shiftReportDay(recentFrom, offset)), p = byDay.get(shiftReportDay(priorFrom, offset));
    if (r && p) { recent.push(r); prior.push(p); }
  }
  if (recent.length < MIN_LEAD_UP_DAYS) return null;
  const total = (rows: Day[]): LeadUpTotals => {
    const spend = rows.reduce((s, d) => s + d.spend!, 0), results = rows.reduce((s, d) => s + d.results!, 0);
    return { spend, results, cpr: results > 0 ? spend / results : null };
  };
  const a = total(recent), b = total(prior);
  return {
    recent: a, prior: b, matchedDays: recent.length, windowDays,
    recentFrom, recentTo: shiftReportDay(changeDay, -1), priorFrom, priorTo: shiftReportDay(recentFrom, -1),
    resultsChange: b.results > 0 ? (a.results - b.results) / b.results * 100 : null,
    spendChange: b.spend > 0 ? (a.spend - b.spend) / b.spend * 100 : null,
  };
}
