import { z } from 'zod';
import { accountToday, isReportDate, previousReportRange, reportDayCount, shiftReportDay } from '@/lib/shared/reports/dates';
import { aggregateReportMetrics, reportMetricValue, reportMetricDelta, metricDirection, formatReportMetric } from '@/lib/shared/reports/metrics';
import type { ReportMetricInput } from '@/lib/shared/reports/metrics';
import type { ReportMetricKey, ReportMetricTotals } from '@/lib/shared/reports/types';
import { todayEligible } from '@/lib/server/dashboard/insights/comparisons';

export const analyticsArguments = z.object({
  period: z.enum(['today', 'yesterday', '7d', '30d', 'custom']),
  dateFrom: z.string().nullable(), dateTo: z.string().nullable(),
  platform: z.enum(['combined', 'facebook', 'instagram']),
  level: z.enum(['account', 'campaign', 'adset', 'ad']),
  entityId: z.string().max(255).nullable(),
  metric: z.enum(['spend', 'conversion', 'leads', 'messages', 'calls', 'impressions', 'clicks', 'ctr', 'cpc', 'cpm', 'costPerResult']),
  order: z.enum(['highest', 'lowest']),
  dimension: z.enum(['publisher_platform', 'age_gender', 'platform_position', 'country', 'region', 'hourly']),
  visual: z.boolean(),
}).strict();
export type AnalyticsArguments = z.infer<typeof analyticsArguments>;
export type Range = { dateFrom: string; dateTo: string };
export type AnalyticsRow = ReportMetricInput & { day: string | null; entity_id: string | null; updated_at: string | null; entity_name?: string | null; entity_external_id?: string | null; objective?: string | null };
export const metricKeys = ['spend', 'conversion', 'leads', 'messages', 'calls', 'impressions', 'clicks', 'ctr', 'cpc', 'cpm', 'costPerResult', 'reach', 'frequency'] as const;
export function analyticsRange(args: AnalyticsArguments, timezone: string | null, now = new Date()) {
  const today = accountToday(timezone, now);
  if (!today) throw new Error('A valid advertiser timezone is required.');
  const range = args.period === 'custom' ? { dateFrom: args.dateFrom ?? '', dateTo: args.dateTo ?? '' }
    : args.period === 'yesterday' ? { dateFrom: shiftReportDay(today, -1), dateTo: shiftReportDay(today, -1) }
    : { dateFrom: shiftReportDay(today, args.period === '30d' ? -29 : args.period === '7d' ? -6 : 0), dateTo: today };
  if (!isReportDate(range.dateFrom) || !isReportDate(range.dateTo) || range.dateFrom > range.dateTo || range.dateTo > today || reportDayCount(range.dateFrom, range.dateTo) > 90) throw new Error('Choose an ordered range of at most 90 days ending no later than today.');
  const previous = args.period === 'today' ? { dateFrom: shiftReportDay(today, -7), dateTo: shiftReportDay(today, -1) } : previousReportRange(range);
  return { ...range, previous, today, partial: range.dateTo === today };
}
export function values(totals: ReportMetricTotals) {
  return Object.fromEntries(metricKeys.map(key => [key, reportMetricValue(totals, key)])) as Record<typeof metricKeys[number], number | null>;
}
export function windowRows(rows: AnalyticsRow[], range: Range) { return rows.filter(r => r.day && r.day >= range.dateFrom && r.day <= range.dateTo); }
export function observationCoverage(rows: AnalyticsRow[], range: Range, expectedIds = [...new Set(rows.map(r => r.entity_id))]) {
  const keys = rows.map(r => `${r.entity_id}:${r.day}`);
  const expectedDays = reportDayCount(range.dateFrom, range.dateTo);
  const observedDays = new Set(rows.map(r => r.day)).size;
  return { complete: expectedIds.length > 0 && keys.length === new Set(keys).size && expectedIds.every(id => new Set(rows.filter(r => r.entity_id === id).map(r => r.day)).size === expectedDays), observedDays, expectedDays, duplicate: keys.length !== new Set(keys).size };
}
export function dailyAverage(totals: ReportMetricTotals, days: number, complete: boolean) {
  if (!complete) return null;
  const average = { ...totals };
  for (const key of ['spend', 'conversion', 'leads', 'messages', 'calls', 'impressions', 'clicks', 'linkClicks'] as const) average[key] /= days;
  // Ratios deliberately remain aggregate ratios, never means of daily ratios.
  return average;
}
export function performanceAnswer(rows: AnalyticsRow[], args: AnalyticsArguments, timezone: string, currency: string | null, now = new Date()) {
  const range = analyticsRange(args, timezone, now);
  const normalized = rows.map(r => ({ ...r, currency_code: r.currency_code === currency ? currency : null }));
  const current = windowRows(normalized, range), prior = windowRows(normalized, range.previous);
  const ids = [...new Set(rows.map(r => r.entity_id))];
  const coverage = observationCoverage(current, range, ids), baselineCoverage = observationCoverage(prior, range.previous, ids);
  const totals = aggregateReportMetrics(coverage.duplicate ? [] : current), baseline = aggregateReportMetrics(baselineCoverage.duplicate ? [] : prior);
  const dates = current.map(r => r.updated_at).filter((d): d is string => Boolean(d)).sort();
  const observedAt = dates.length === current.length ? dates[0] ?? null : null;
  const age = observedAt ? now.getTime() - Date.parse(observedAt) : NaN;
  const fresh = Number.isFinite(age) && age >= 0 && age <= (range.partial ? 600000 : 86400000);
  const eligible = args.period !== 'today' || Boolean(observedAt && todayEligible(range.today, now.toISOString(), observedAt, { timezone, cutoff: process.env.DEEPVISOR_KPI_TODAY_CUTOFF ?? '20:00' }));
  const baselineAverage = dailyAverage(baseline, reportDayCount(range.previous.dateFrom, range.previous.dateTo), baselineCoverage.complete);
  const comparisonTotals = args.period === 'today' ? baselineAverage : baseline;
  const canCompare = fresh && eligible && coverage.complete && baselineCoverage.complete && currency && rows.every(r => r.currency_code === currency);
  const changes = Object.fromEntries(metricKeys.map(key => {
    const change = canCompare ? reportMetricDelta(totals, comparisonTotals, key) : null;
    return [key, change === null ? null : { value: change, unit: key === 'ctr' ? 'pp' : '%', direction: metricDirection(key, change) }];
  }));
  const daily = Array.from({ length: reportDayCount(range.dateFrom, range.dateTo) }, (_, i) => {
    const day = shiftReportDay(range.dateFrom, i);
    return { day, ...values(aggregateReportMetrics(coverage.duplicate ? [] : current.filter(r => r.day === day))) };
  });
  return { range, currency, timezone, source: 'Stored Meta daily reporting', observedAt, stale: !fresh,
    resultDefinition: 'Results = recorded leads + messaging conversations + call actions, not appointments. These action types are shown separately and are not equivalent outcomes.',
    coverage, baselineCoverage, metrics: { ...values(totals), costPerLead: reportMetricValue(aggregateReportMetrics((coverage.duplicate ? [] : current).map(r => ({ ...r, messages: 0, calls: 0 }))), 'costPerResult') }, unavailable: totals.unavailable,
    dailyAverages: values(dailyAverage(totals, reportDayCount(range.dateFrom, range.dateTo), coverage.complete) ?? aggregateReportMetrics([])),
    baseline: { range: range.previous, totals: values(baseline), dailyAverages: baselineAverage ? values(baselineAverage) : null },
    changes, daily,
    limitation: `${range.partial ? 'Includes incomplete today; attribution may change. ' : ''}${args.period === 'today' ? 'Today compares against the previous seven completed days’ daily average only after the account-local cutoff and with fresh complete data. ' : ''}Coverage describes recorded entities only, not proof of a complete account inventory. Missing entity-days are not zero. Comparisons require complete observed coverage. Reach/frequency require a separate verified period-level measurement.`,
    cards: ['spend', 'conversion', 'costPerResult', 'ctr'].map(key => ({ label: key === 'conversion' ? 'Results' : key === 'costPerResult' ? 'Cost / result' : key === 'ctr' ? 'CTR' : 'Spend', value: formatReportMetric(totals, key as ReportMetricKey, currency), change: changes[key] })),
  };
}
