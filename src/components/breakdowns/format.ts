import type { PerformanceMetric } from '@/lib/shared/reports/performance';

const MONEY = new Set<string>(['spend', 'costPerResult', 'cpc']);

export function metricText(value: number | null, metric: PerformanceMetric | string, currency: string | null, locale: string, unavailable: string): string {
  if (value === null || !Number.isFinite(value)) return unavailable;
  if (MONEY.has(metric)) return currency && currency !== 'MIXED' ? new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value) : unavailable;
  return metric === 'ctr' ? `${value.toFixed(2)}%` : value.toLocaleString(locale, { maximumFractionDigits: 2 });
}

/** "9 AM" / "9 a. m." */
export const hourText = (hour: number, locale: string) => new Intl.DateTimeFormat(locale, { hour: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, 0, 1, hour)));

/** Weekday names, Monday first. 2026-01-05 is a Monday. */
export const weekdayText = (day: number, locale: string, width: 'short' | 'long') => new Intl.DateTimeFormat(locale, { weekday: width, timeZone: 'UTC' }).format(new Date(Date.UTC(2026, 0, 5 + day)));
