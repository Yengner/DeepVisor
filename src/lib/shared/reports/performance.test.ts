import { describe, expect, it } from 'vitest';
import { buildReportFixture } from './fixtures';
import { buildPerformanceChart, performanceValueLabel, PERFORMANCE_METRICS } from './performance';
import { reportMetricDelta } from './metrics';

describe('Performance workspace deterministic numerical fixtures', () => {
  it('has exact aggregate totals and weighted ratios across seven observed days', () => {
    const p = buildReportFixture();
    expect(p.summary).toMatchObject({ spend: 1120, conversion: 112, impressions: 9100, clicks: 245, linkClicks: 112, costPerResult: 10 });
    expect(p.summary.ctr).toBeCloseTo(245 / 9100 * 100, 10);
    expect(p.summary.cpc).toBeCloseTo(1120 / 245, 10);
    expect(p.summary.cpm).toBeCloseTo(1120 / 9100 * 1000, 10);
    expect(reportMetricDelta(p.summary, p.comparison.previousTotals, 'spend')).toBe(60);
    expect(reportMetricDelta(p.summary, p.comparison.previousTotals, 'costPerResult')).toBe(0);
  });
  it.each(PERFORMANCE_METRICS)('plots only %s with values calculated from its own daily measurements', (metric) => {
    const p = buildReportFixture();
    const expected = { spend: 220, conversion: 22, costPerResult: 10, impressions: 1600, clicks: 50,
      linkClicks: 22, ctr: 50 / 1600 * 100, cpc: 220 / 50, cpm: 220 / 1600 * 1000 };
    const chart = buildPerformanceChart(p, metric);
    expect(chart.points).toHaveLength(7);
    expect(chart.points[6].current).toBeCloseTo(expected[metric], 10);
    expect(chart.points[6]).toMatchObject({ date: '2026-10-14', previousDate: '2026-10-07' });
    expect(chart.showPrevious).toBe(true);
  });
  it('aligns previous points by day offset despite shuffled inputs', () => {
    const p = buildReportFixture();
    p.comparison.previousSeries!.reverse();
    const chart = buildPerformanceChart(p, 'clicks');
    expect(chart.points.map(p => p.previous)).toEqual([20, 25, 30, 35, 40, 45, 50]);
  });
  it('preserves missing days as null gaps and suppresses incomplete comparisons', () => {
    const chart = buildPerformanceChart(buildReportFixture('sparse'), 'spend');
    expect(chart.points.map(p => p.current)).toEqual([100, 120, null, 160, null, 200, 220]);
    expect(chart.showPrevious).toBe(false);
    expect(chart.comparisonReason).toContain('Incomplete');
  });
  it('distinguishes an observed zero from missing and undefined ratios', () => {
    const p = buildReportFixture();
    p.series[0].conversion = 0;
    p.series[0].unavailable!.costPerResult = 'No positive denominator';
    expect(buildPerformanceChart(p, 'conversion').points[0].current).toBe(0);
    expect(buildPerformanceChart(p, 'costPerResult').points[0].current).toBe(null);
  });
  it('renders declining cost efficiency as unfavorable, not a positive increase', () => {
    const p = buildReportFixture('declining');
    expect(p.summary.conversion).toBe(49);
    expect(p.summary.costPerResult).toBeCloseTo(1120 / 49, 10);
    expect(p.kpis.find(k => k.key === 'costPerResult')?.direction).toBe('unfavorable');
    expect(buildPerformanceChart(p, 'costPerResult').points[6].current).toBe(55);
  });
  it('withholds currency metrics while retaining valid delivery metrics', () => {
    const p = buildReportFixture('mixed');
    expect(buildPerformanceChart(p, 'spend').hasData).toBe(false);
    expect(buildPerformanceChart(p, 'ctr').points[6].current).toBe(3.125);
    expect(performanceValueLabel(100, 'spend', 'MIXED')).toBe('Unavailable');
  });
  it.each(['empty', 'failed'] as const)('never plots %s measurements as zero', scenario => {
    const p = buildReportFixture(scenario), chart = buildPerformanceChart(p, 'spend');
    expect(chart.hasData).toBe(false);
    expect(chart.points.every(p => p.current === null)).toBe(true);
    expect(p.kpis.every(k => k.formattedValue === '—')).toBe(true);
    expect(p.meta.coverage?.state).toBe(scenario === 'failed' ? 'error' : 'empty');
  });
  it('refuses overlays for calendar buckets with mismatched relative measurement windows', () => {
    const p = buildReportFixture();
    p.query.groupBy = 'week';
    p.series = [{ ...p.series[0], startDate: '2026-10-05', endDate: '2026-10-11' }];
    p.comparison.previousSeries = [{ ...p.comparison.previousSeries![0], startDate: '2026-09-28', endDate: '2026-10-03' }];
    const chart = buildPerformanceChart(p, 'spend');
    expect(chart.showPrevious).toBe(false);
    expect(chart.comparisonReason).toContain('matching bucket boundaries');
    expect(chart.points[0]).toMatchObject({ date: '2026-10-08', endDate: '2026-10-11' });
  });
  it('allows matching grouped windows and clamps labels to selected dates', () => {
    const p = buildReportFixture();
    p.query.groupBy = 'week';
    p.series = [{ ...p.series[0], startDate: '2026-10-05', endDate: '2026-10-11' }];
    p.comparison.previousSeries = [{ ...p.comparison.previousSeries![0], startDate: '2026-09-28', endDate: '2026-10-04' }];
    expect(buildPerformanceChart(p, 'spend')).toMatchObject({ showPrevious: true,
      points: [{ date: '2026-10-08', endDate: '2026-10-11', previousDate: '2026-10-01', previousEndDate: '2026-10-04' }] });
  });
  it('provides reproducible fixtures and independent source snapshot boundaries', () => {
    expect(buildReportFixture()).toEqual(buildReportFixture());
    const p = buildReportFixture();
    expect(p.surface.coverage?.age_gender?.dateFrom).toBe('2026-10-01');
    expect(p.query.dateFrom).toBe('2026-10-08');
    expect(buildReportFixture('missing-demographics').surface.coverage?.age_gender.state).toBe('unknown');
  });
  it('formats currency, rates and missing values with explicit units', () => {
    expect(performanceValueLabel(10, 'spend', 'USD')).toBe('$10.00');
    expect(performanceValueLabel(3.125, 'ctr', 'USD')).toBe('3.13%');
    expect(performanceValueLabel(null, 'clicks', 'USD')).toBe('Unavailable');
  });
});
