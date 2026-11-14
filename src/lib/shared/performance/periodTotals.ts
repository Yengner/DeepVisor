import { shiftReportDay } from '@/lib/shared/reports/dates';

/**
 * Campaigns / ad sets / ads totals for a selected period. Pure: no I/O.
 *
 * Lifetime: Meta's lifetime summary is the only source for history older than the saved daily
 * window (paused 2025 campaigns), but it is refreshed only by full syncs, while daily rows are
 * refreshed continuously. So:
 *  - when the saved daily rows reach back to the summary's first day, they are the complete
 *    history and are summed directly (always current);
 *  - otherwise the summary is used, plus any daily rows dated after the summary's sync day
 *    (the sync day itself is already partly inside the summary, so it is not added twice).
 * Windows (Today / 7D / 30D) sum daily rows inside the account-local window only. An entity with
 * no rows in the window is "no delivery recorded", reported as unavailable rather than zero.
 */
export type TableRange = 'today' | '7d' | '30d' | 'lifetime';
export const TABLE_RANGES: TableRange[] = ['today', '7d', '30d', 'lifetime'];
export const parseTableRange = (value: unknown): TableRange =>
  typeof value === 'string' && (TABLE_RANGES as string[]).includes(value) ? value as TableRange : 'lifetime';

export type Totals = { spend: number; reach: number; impressions: number; clicks: number; linkClicks: number; leads: number; messages: number; calls: number };
export type DailyTotals = Totals & { day: string };
/** `lastDay` is Meta's schedule stop (not a delivery date): it is only ever shown as a schedule end. */
export type SummaryTotals = Totals & { firstDay: string | null; syncedAt: string | null; lastDay?: string | null };
export type PeriodResult = { totals: Totals; available: boolean; firstDay: string | null; lastDay: string | null; source: 'daily' | 'summary' | 'summary+daily' | 'none'; scheduleEnded?: string | null };

const zero = (): Totals => ({ spend: 0, reach: 0, impressions: 0, clicks: 0, linkClicks: 0, leads: 0, messages: 0, calls: 0 });
const add = (into: Totals, row: Totals) => {
  into.spend += row.spend; into.reach += row.reach; into.impressions += row.impressions; into.clicks += row.clicks;
  into.linkClicks += row.linkClicks; into.leads += row.leads; into.messages += row.messages; into.calls += row.calls;
  return into;
};
const span = (rows: DailyTotals[]) => {
  const days = rows.map(r => r.day).sort();
  return { firstDay: days[0] ?? null, lastDay: days.at(-1) ?? null };
};

/** Account-local calendar day of an instant; null when it cannot be resolved. */
export function localDay(at: string | null, timezone: string | null): string | null {
  if (!at || !Number.isFinite(Date.parse(at))) return null;
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: timezone ?? 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(at));
  } catch { return null; }
}

/** Inclusive account-local window for a range; null for lifetime. */
export function rangeWindow(range: TableRange, today: string): { since: string; until: string } | null {
  if (range === 'lifetime') return null;
  const days = range === 'today' ? 1 : range === '7d' ? 7 : 30;
  return { since: shiftReportDay(today, -(days - 1)), until: today };
}

export function periodTotals(input: { range: TableRange; today: string; timezone: string | null; summary: SummaryTotals | null; daily: DailyTotals[] }): PeriodResult {
  const window = rangeWindow(input.range, input.today);
  if (window) {
    const rows = input.daily.filter(r => r.day >= window.since && r.day <= window.until);
    return rows.length ? { totals: rows.reduce(add, zero()), available: true, ...span(rows), source: 'daily' } : { totals: zero(), available: false, firstDay: null, lastDay: null, source: 'none' };
  }
  const { summary, daily } = input;
  const dailySpan = span(daily);
  if (daily.length && (!summary || (summary.firstDay !== null && dailySpan.firstDay! <= summary.firstDay))) {
    return { totals: daily.reduce(add, zero()), available: true, ...dailySpan, source: 'daily' };
  }
  if (!summary) return { totals: zero(), available: false, firstDay: null, lastDay: null, source: 'none' };
  const syncedDay = localDay(summary.syncedAt, input.timezone);
  const after = syncedDay ? daily.filter(r => r.day > syncedDay) : [];
  const totals = after.reduce(add, add(zero(), summary));
  const lastDay = span(after).lastDay ?? (syncedDay && dailySpan.lastDay && dailySpan.lastDay <= syncedDay ? dailySpan.lastDay : null);
  // Without daily rows the delivery end is unknown; a past schedule stop is the only honest date.
  const scheduleEnded = !lastDay && summary.lastDay && summary.lastDay < input.today ? summary.lastDay : null;
  return { totals, available: true, firstDay: summary.firstDay, lastDay, source: after.length ? 'summary+daily' : 'summary', scheduleEnded };
}
