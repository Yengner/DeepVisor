import type { ReportCoverage } from '@/lib/server/reports/types';
import { isReportDate, reportDayCount } from './dates';

type Window = { first_day: string | null; last_day: string | null };
/** Only source measurement boundaries count. Never infer them from day/created_at/updated_at. */
export function snapshotCoverage(rows: Window[]): ReportCoverage {
  if (!rows.length) return { state: 'empty', basis: 'snapshot', dateFrom: null, dateTo: null };
  if (rows.some(r => !r.first_day || !r.last_day || !isReportDate(r.first_day) ||
    !isReportDate(r.last_day) || r.first_day > r.last_day)) {
    return { state: 'unknown', basis: 'snapshot', dateFrom: null, dateTo: null };
  }
  const windows = [...new Map(rows.map(r => [`${r.first_day}:${r.last_day}`, {
    dateFrom: r.first_day!, dateTo: r.last_day!,
  }])).values()].sort((a, b) => a.dateFrom.localeCompare(b.dateFrom) || a.dateTo.localeCompare(b.dateTo));
  return {
    state: windows.length === 1 ? 'available' : 'mixed', basis: 'snapshot',
    dateFrom: windows.length === 1 ? windows[0].dateFrom : null,
    dateTo: windows.length === 1 ? windows[0].dateTo : null,
    windows,
  };
}
export function dailyCoverage(days: string[], from: string, to: string): ReportCoverage {
  const observed = [...new Set(days.filter(d => isReportDate(d) && d >= from && d <= to))].sort();
  const expectedDays = reportDayCount(from, to);
  return {
    state: !observed.length ? 'empty' : observed.length === expectedDays ? 'available' : 'partial',
    basis: 'period', dateFrom: observed[0] ?? null, dateTo: observed.at(-1) ?? null,
    observedDays: observed.length, expectedDays,
  };
}
export function coverageLabel(coverage?: ReportCoverage): string {
  if (!coverage || coverage.state === 'unknown') return 'Measurement coverage unknown';
  if (coverage.state === 'error') return 'Data could not be loaded';
  if (coverage.state === 'empty') return 'No records available';
  if (coverage.state === 'mixed') return 'Mixed snapshot coverage — inspect source windows';
  return `${coverage.dateFrom}–${coverage.dateTo}${coverage.state === 'partial' ? ' · Partial coverage' : ''}`;
}
