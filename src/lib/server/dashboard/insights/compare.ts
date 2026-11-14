import { shiftDay, periodRange } from '../overview/model';
import type { Period } from '../overview/types';
import type { Metrics } from '../../campaigns/exploration/types';
import { aggregate, type Insight, type Publisher } from './model';
import { runningCostPerResult } from '../overview/controlModel';
import { delta } from '../../campaigns/exploration/model';
import type { Delta } from '../../campaigns/exploration/types';

/**
 * Previous-period context for the Overview KPIs and chart. Pure: no I/O.
 *
 * - 7D/30D: the immediately preceding window of equal length, aligned day-by-day so the
 *   chart can draw it as a faint line behind the current period.
 * - Today: hourly cumulative totals for today and yesterday from the account-level hourly
 *   breakdown, plus "yesterday by this hour" for like-for-like KPI context.
 * Missing data stays null; it is never treated as zero.
 */
export type ChartMetric = 'spend' | 'results' | 'costPerResult' | 'ctr';
type Values = Record<ChartMetric, number | null>;
export type HourPoint = { hour: number; today: Values; yesterday: Values };
export type PeriodContext = {
  /** Previous-window values aligned to current chart points by index (7D/30D only). */
  previousPoints: Array<Values & { day: string }> | null;
  /** Totals of the comparison window: previous period, or yesterday through the current hour. */
  reference: Values | null;
  referenceLabel: string | null;
  /** Shown after the reference when it covers only part of the window (missing days are not zero). */
  referenceNote?: string | null;
  /** Hourly cumulative series for the Today chart. */
  hourly: HourPoint[] | null;
};

const pick = (m: Metrics): Values => ({ spend: m.spend, results: m.results, costPerResult: m.costPerResult, ctr: m.ctr });
const empty: Values = { spend: null, results: null, costPerResult: null, ctr: null };

/** Parse Meta's "HH:00:00 - HH:59:59" hourly bucket label. */
export function bucketHour(label: string): number | null {
  const match = /^(\d{2}):00:00/.exec(label);
  const hour = match ? Number(match[1]) : NaN;
  return Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : null;
}

/** Current hour (0–23) in the advertiser time zone, or null when it cannot be resolved. */
export function hourInZone(now: string, zone: string): number | null {
  try {
    const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: zone, hour: '2-digit', hourCycle: 'h23' }).format(new Date(now)));
    return Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : null;
  } catch { return null; }
}

export function previousPeriod(daily: Insight[] | null, platform: Publisher, period: Exclude<Period, 'today'>, today: string, currency: string | null) {
  if (!daily) return { previousPoints: null, reference: null, observedDays: 0, days: period === '30d' ? 30 : 7 };
  const days = period === '30d' ? 30 : 7;
  const since = periodRange(period, today).since;
  const scoped = daily.filter(r => platform === 'combined' || r.publisher === platform);
  const previousPoints = Array.from({ length: days }, (_, i) => {
    const day = shiftDay(since, i - days);
    const rows = scoped.filter(r => r.day === day);
    return { day, ...(rows.length ? pick(aggregate(rows, currency)) : empty) };
  });
  const window = scoped.filter(r => r.day >= shiftDay(since, -days) && r.day <= shiftDay(since, -1));
  // Match the chart: cost per result is a running ratio across the window.
  const observedDays = new Set(window.map(r => r.day)).size;
  return { previousPoints: runningCostPerResult(previousPoints), reference: window.length ? pick(aggregate(window, currency)) : null, observedDays, days };
}

export function hourlyToday(hourly: Insight[] | null, platform: Publisher, today: string, currentHour: number | null, currency: string | null) {
  if (!hourly || currentHour === null) return { hourly: null, reference: null };
  const yesterday = shiftDay(today, -1);
  const scoped = hourly.filter(r => platform === 'combined' || r.publisher === platform);
  const byDay = (day: string) => scoped.filter(r => r.day === day);
  const todayRows = byDay(today), yesterdayRows = byDay(yesterday);
  if (!todayRows.length && !yesterdayRows.length) return { hourly: null, reference: null };
  const through = (rows: Insight[], hour: number) => rows.filter(r => { const h = bucketHour(r.label); return h !== null && h <= hour; });
  // Cumulative totals; ratios are recomputed from the cumulative aggregates.
  const cumulative = (rows: Insight[], hour: number): Values => {
    const subset = through(rows, hour);
    return subset.length ? pick(aggregate(subset, currency)) : { ...empty, spend: 0, results: rows.length && rows.every(r => r.leads !== null) ? 0 : null };
  };
  const points: HourPoint[] = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    today: hour <= currentHour ? cumulative(todayRows, hour) : empty,
    yesterday: yesterdayRows.length ? cumulative(yesterdayRows, hour) : empty,
  }));
  return { hourly: points, reference: yesterdayRows.length ? cumulative(yesterdayRows, currentHour) : null };
}

export function periodContext(input: {
  daily: Insight[] | null; hourly: Insight[] | null; platform: Publisher; period: Period;
  today: string; now: string; zone: string; currency: string | null;
}): PeriodContext {
  if (input.period === 'today') {
    const { hourly, reference } = hourlyToday(input.hourly, input.platform, input.today, hourInZone(input.now, input.zone), input.currency);
    return { previousPoints: null, hourly, reference, referenceLabel: reference ? 'Yesterday by now' : null };
  }
  const { previousPoints, reference, observedDays, days } = previousPeriod(input.daily, input.platform, input.period, input.today, input.currency);
  return { previousPoints, hourly: null, reference, referenceLabel: reference ? `Previous ${days} days` : null,
    referenceNote: reference && observedDays < days ? `${observedDays} of ${days} days with data` : null };
}

/**
 * Today's KPI badges, measured against the same figure the card prints beside them ("Yesterday
 * by now"), so the arrow, colour and number can never disagree with the visible reference.
 * Without that hourly reference the existing daily-average comparison is kept unchanged.
 * A zero or missing base yields no badge (no invented percentage), only the printed reference.
 */
export function sameHourComparison(
  period: Period,
  metrics: Values,
  context: PeriodContext,
  fallback: { deltas: Partial<Record<ChartMetric, Delta>>; comparison: string | null },
): { deltas: Partial<Record<ChartMetric, Delta>>; comparison: string | null } {
  const reference = context.reference;
  if (period !== 'today' || !reference || !context.hourly) return fallback;
  const deltas: Partial<Record<ChartMetric, Delta>> = {};
  for (const key of ['spend', 'results', 'costPerResult', 'ctr'] as const) {
    const change = delta(key, metrics[key], reference[key]);
    if (change) deltas[key] = change;
  }
  return { deltas, comparison: 'Today so far vs yesterday through the same hour. CTR change in percentage points.' };
}
