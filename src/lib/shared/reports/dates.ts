import type { ReportQueryInput } from '@/lib/server/reports/types';

const DAY = 86_400_000;
export function isReportDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function shiftReportDay(day: string, offset: number): string {
  return new Date(new Date(`${day}T00:00:00Z`).getTime() + offset * DAY).toISOString().slice(0, 10);
}
export function reportDayCount(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY) + 1;
}
export function accountToday(timezone: string | null | undefined, now = new Date()): string | null {
  if (!timezone) return null;
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(now);
    const part = (name: string) => parts.find(p => p.type === name)?.value;
    return `${part('year')}-${part('month')}-${part('day')}`;
  } catch { return null; }
}
export function completedReportRange(today: string, days: number) {
  return { dateFrom: shiftReportDay(today, -days), dateTo: shiftReportDay(today, -1) };
}
export function previousReportRange(query: Pick<ReportQueryInput, 'dateFrom' | 'dateTo'>) {
  return {
    dateFrom: shiftReportDay(query.dateFrom, -reportDayCount(query.dateFrom, query.dateTo)),
    dateTo: shiftReportDay(query.dateFrom, -1),
  };
}
export function resolveReportDates(query: ReportQueryInput, timezones: Array<string | null>, now = new Date()) {
  if (!isReportDate(query.dateFrom) || !isReportDate(query.dateTo) || query.dateFrom > query.dateTo) throw new Error('Invalid report date range.');
  const zones = [...new Set(timezones)];
  const timezone = zones.length === 1 && accountToday(zones[0], now) ? zones[0] : null;
  const today = accountToday(timezone, now);
  if (query.presetDays && !today && timezones.length > 0) {
    throw new Error('Choose explicit report dates: a single valid account timezone is required for completed-day presets.');
  }
  const resolved = query.presetDays && today
    ? { ...query, ...completedReportRange(today, query.presetDays) }
    : { ...query };
  const partialDay = today !== null && resolved.dateFrom <= today && resolved.dateTo >= today;
  const reason = resolved.rangeMode === 'max' ? 'Max history has no equivalent previous period.'
    : !today ? 'Account timezone is unknown or mixed.'
    : resolved.dateTo >= today ? 'Comparison requires completed advertiser-local days.' : null;
  if (reason) resolved.compareMode = 'none';
  return { query: resolved, timezone, today, partialDay, comparisonDisabledReason: reason };
}
