import { describe, expect, it } from 'vitest';
import { accountToday, completedReportRange, previousReportRange, resolveReportDates, isReportDate } from './dates';
import { snapshotCoverage, dailyCoverage, coverageLabel } from './coverage';
import { aggregateReportMetrics, reportMetricValue, reportMetricDelta, metricDirection, sourceUnavailable, formatReportMetric } from './metrics';
import { buildHourlyHeatmap } from './hourly';
import { parseReportQueryInput } from '@/lib/server/reports/query';
import type { DashboardTrendPoint } from '@/lib/server/dashboard/types';

const now = new Date('2026-03-09T02:00:00Z');
const raw = { spend: 20, impressions: 1000, clicks: 10, inline_link_clicks: 8, leads: 2, messages: 1, calls: 1, currency_code: 'USD' };
describe('advertiser-local report dates', () => {
  it('uses the advertiser day across the spring DST boundary, not UTC or browser time', () => {
    const query = parseReportQueryInput('business', {}, now);
    const result = resolveReportDates(query, ['America/New_York'], now);
    expect(result.today).toBe('2026-03-08');
    expect(result.query).toMatchObject({ dateFrom: '2026-02-06', dateTo: '2026-03-07' });
    expect(accountToday('Asia/Tokyo', now)).toBe('2026-03-09');
  });
  it.each([7, 30, 90] as const)('selects %i completed days and equivalent prior days', days => {
    const query = parseReportQueryInput('business', { preset: String(days), compare: 'previous_period' }, now);
    const result = resolveReportDates(query, ['America/New_York'], now);
    expect(result.query).toMatchObject(completedReportRange('2026-03-08', days));
    expect(previousReportRange(result.query).dateTo).toBe(new Date(Date.parse(result.query.dateFrom) - 86400000).toISOString().slice(0, 10));
    expect(result.query.compareMode).toBe('previous_period');
  });
  it('keeps completed days across fall DST', () => {
    const today = accountToday('America/New_York', new Date('2026-11-02T04:30:00Z'))!;
    expect(today).toBe('2026-11-01');
    expect(completedReportRange(today, 7)).toEqual({ dateFrom: '2026-10-25', dateTo: '2026-10-31' });
  });
  it('disables comparisons for today or future days', () => {
    const q = parseReportQueryInput('b', { date_from: '2026-03-01', date_to: '2026-03-08', compare: 'previous_period' });
    const result = resolveReportDates(q, ['America/New_York'], now);
    expect(result.partialDay).toBe(true);
    expect(result.query.compareMode).toBe('none');
    expect(result.comparisonDisabledReason).toContain('completed');
  });
  it.each(['2026-02-30', '2026-13-01', 'invalid'])('rejects invalid date %s', date => {
    expect(isReportDate(date)).toBe(false);
    expect(() => parseReportQueryInput('b', { date_from: date, date_to: '2026-03-01' })).toThrow();
  });
  it('rejects half ranges and reversed ranges', () => {
    expect(() => parseReportQueryInput('b', { date_from: '2026-03-01' })).toThrow();
    expect(() => parseReportQueryInput('b', { date_from: '2026-03-02', date_to: '2026-03-01' })).toThrow();
  });
  it('does not silently use UTC for unknown/mixed timezone presets', () => {
    const q = parseReportQueryInput('b', {});
    expect(() => resolveReportDates(q, [null])).toThrow();
    expect(() => resolveReportDates(q, ['UTC', 'America/New_York'])).toThrow();
    expect(accountToday('invalid')).toBeNull();
  });
  it('allows explicit dates with unknown timezone but disables comparison', () => {
    const q = parseReportQueryInput('b', { date_from: '2026-01-01', date_to: '2026-01-02', compare: 'previous_period' });
    expect(resolveReportDates(q, [null]).query.compareMode).toBe('none');
  });
  it('never broadens an entity selection because of a conflicting scope parameter', () => {
    expect(parseReportQueryInput('b', { scope: 'business', ad_id: 'ad,ad' })).toMatchObject({ scope: 'ad', adIds: ['ad'] });
  });
});
describe('source measurement coverage', () => {
  it('does not infer coverage from timestamps or a compatibility day column', () => {
    const row = { first_day: null, last_day: null, day: '2026-01-01', created_at: '2026-01-01', updated_at: '2026-01-31' };
    expect(snapshotCoverage([row])).toEqual({ basis: 'snapshot', state: 'unknown', dateFrom: null, dateTo: null });
  });
  it('preserves true source boundaries and distinguishes mixed windows', () => {
    const a = { first_day: '2026-01-01', last_day: '2026-01-14' };
    expect(snapshotCoverage([a, a])).toMatchObject({ state: 'available', dateFrom: '2026-01-01', dateTo: '2026-01-14' });
    const mixed = snapshotCoverage([a, { first_day: '2026-01-08', last_day: '2026-01-14' }]);
    expect(mixed).toMatchObject({ state: 'mixed', dateFrom: null, dateTo: null });
    expect(mixed.windows).toHaveLength(2);
  });
  it('one unknown source window prevents a falsely precise aggregate range', () => {
    expect(snapshotCoverage([{ first_day: '2026-01-01', last_day: '2026-01-14' }, { first_day: null, last_day: '2026-01-14' }]).state).toBe('unknown');
  });
  it('does not equate min/max days with complete daily history', () => {
    expect(dailyCoverage(['2026-01-01', '2026-01-03'], '2026-01-01', '2026-01-03')).toMatchObject({ state: 'partial', observedDays: 2, expectedDays: 3 });
    expect(dailyCoverage([], '2026-01-01', '2026-01-03').state).toBe('empty');
    expect(coverageLabel()).toContain('unknown');
  });
});
describe('aggregate metric contract', () => {
  it('recomputes ratios from totals instead of averaging daily ratios', () => {
    const totals = aggregateReportMetrics([raw, { ...raw, spend: 80, clicks: 90, impressions: 3000, leads: 6, messages: 0, calls: 0 }]);
    expect(totals).toMatchObject({ spend: 100, clicks: 100, impressions: 4000, conversion: 10, ctr: 2.5, cpc: 1, cpm: 25, costPerResult: 10 });
    expect(reportMetricValue(totals, 'reach')).toBeNull();
    expect(reportMetricValue(totals, 'frequency')).toBeNull();
  });
  it('keeps observed zero separate from missing records and invalid ratios', () => {
    const zero = aggregateReportMetrics([{ ...raw, clicks: 0, leads: 0, messages: 0, calls: 0 }]);
    expect(reportMetricValue(zero, 'conversion')).toBe(0);
    expect(reportMetricValue(zero, 'ctr')).toBe(0);
    expect(reportMetricValue(zero, 'costPerResult')).toBeNull();
    expect(reportMetricValue(zero, 'cpc')).toBeNull();
    expect(reportMetricValue(aggregateReportMetrics([]), 'conversion')).toBeNull();
  });
  it('propagates missing source inputs through dependent ratios', () => {
    const missing = aggregateReportMetrics([{ ...raw, clicks: null }]);
    expect(reportMetricValue(missing, 'ctr')).toBeNull();
    expect(reportMetricValue(missing, 'cpc')).toBeNull();
    expect(reportMetricValue(missing, 'spend')).toBe(20);
    const normalized = aggregateReportMetrics([{ ...raw, clicks: 0, unavailable: sourceUnavailable({ ...raw, clicks: null }) }]);
    expect(reportMetricValue(normalized, 'clicks')).toBeNull();
  });
  it('suppresses mixed-currency money without discarding delivery counts', () => {
    const total = aggregateReportMetrics([raw, { ...raw, currency_code: 'EUR' }]);
    expect(reportMetricValue(total, 'spend')).toBeNull();
    expect(reportMetricValue(total, 'costPerResult')).toBeNull();
    expect(reportMetricValue(total, 'impressions')).toBe(2000);
    expect(formatReportMetric(total, 'spend', 'MIXED')).toBe('—');
  });
  it('labels CTR change in percentage points and respects metric direction', () => {
    const previous = aggregateReportMetrics([raw]);
    const current = aggregateReportMetrics([{ ...raw, clicks: 20, spend: 10 }]);
    expect(reportMetricDelta(current, previous, 'ctr')).toBe(1);
    expect(reportMetricDelta(current, previous, 'spend')).toBe(-50);
    expect(metricDirection('spend', -50)).toBe('neutral');
    expect(metricDirection('costPerResult', -50)).toBe('favorable');
    expect(metricDirection('cpc', 25)).toBe('unfavorable');
  });
});
describe('hourly visualization numerical contract', () => {
  const point = (dayKey: string, clicks: number, impressions: number): DashboardTrendPoint => ({
    label: dayKey, dayKey, dayOfWeek: 0, hourOfDay: 12,
    clicks, impressions, inlineLinkClicks: 0, results: 0, spend: 10, reach: 0,
    ctr: 0, cpc: 0, cpm: 0, frequency: 0, costPerResult: 0,
  });
  it('computes observed totals, sample count and weighted CTR', () => {
    const heatmap = buildHourlyHeatmap([point('2026-01-05', 10, 100), point('2026-01-12', 20, 400)])!;
    const cell = heatmap.rows[0].cells[12];
    expect(cell).toMatchObject({ observed: true, observations: 2, metricTotal: 30, metricAverage: 15, ctr: 6, spend: 20 });
    expect(heatmap.title).not.toContain('Best');
  });
  it('distinguishes a zero observation from an absent slot', () => {
    const heatmap = buildHourlyHeatmap([point('2026-01-05', 0, 100)])!;
    expect(heatmap.rows[0].cells[12]).toMatchObject({ observed: true, metricTotal: 0 });
    expect(heatmap.rows[0].cells[13]).toMatchObject({ observed: false, observations: 0 });
    expect(buildHourlyHeatmap([])).toBeNull();
  });
});

describe('retained history without overlap', () => {
  it('never adds an ambiguous monthly rollup to daily rows from that month', async () => {
    const { nonOverlappingHistory } = await import('./history');
    const result = nonOverlappingHistory(
      [{ day: '2026-01-01', spend: 100 }, { day: '2026-02-01', spend: 50 }],
      [{ day: '2026-02-20', spend: 20 }, { day: '2026-03-01', spend: 30 }],
    );
    expect(result.rows).toEqual([{ day: '2026-01-01', spend: 100 }, { day: '2026-03-01', spend: 30 }]);
    expect(result.warnings).toEqual([expect.stringContaining('2026-02')]);
  });
});
