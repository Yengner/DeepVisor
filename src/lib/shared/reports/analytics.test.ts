import { describe, expect, it } from 'vitest';
import { buildReportFixture } from './fixtures';
import { buildSnapshotBreakdown, snapshotMetric, snapshotWindows, BREAKDOWN_METRICS } from './breakdowns';
import { PERFORMANCE_METRICS } from './performance';
import { buildTimeAnalysis } from './timeAnalysis';
import { advertisingGroups, advertisingMetricValue, reportDrilldownHref, sortAdvertising } from './advertising';
import { filterFindings, findingEvidence } from './findings';
const window = '2026-10-01 / 2026-10-07';
describe('snapshot analytical models', () => {
  it.each(BREAKDOWN_METRICS)('computes %s from complete source inputs', metric => {
    const source = buildReportFixture().surface.measurements!.filter(r => r.breakdownType === 'age_gender');
    const expected = { spend: 1120, impressions: 9100, clicks: 245, conversion: 112, ctr: 245 / 9100 * 100, cpc: 1120 / 245, cpm: 1120 / 9100 * 1000, costPerResult: 10, reach: null };
    const actual = snapshotMetric(source, metric);
    if (expected[metric] == null) expect(actual).toBeNull(); else expect(actual).toBeCloseTo(expected[metric]!, 10);
  });
  it('groups age and gender independently and sums only the selected window', () => {
    const p = buildReportFixture(), row = p.surface.measurements![0];
    p.surface.measurements!.push({ ...row, dimension2: { key: 'gender', value: 'male' }, values: { spend: 200, impressions: 1000, clicks: 20, conversion: 10 } });
    p.surface.measurements!.push({ ...row, dateFrom: '2026-09-01', dateTo: '2026-09-07', values: { spend: 9999 } });
    expect(snapshotWindows(p.surface, 'age_gender')).toEqual(['2026-09-01 / 2026-09-07', window]);
    expect(buildSnapshotBreakdown(p.surface, 'age_gender', 'spend', window, 'age').items.map(r => [r.label, r.value])).toEqual([['25-34', 1000], ['35-44', 320]]);
    expect(buildSnapshotBreakdown(p.surface, 'age_gender', 'spend', window, 'gender').items.map(r => [r.label, r.value])).toEqual([['female', 800], ['male', 520]]);
  });
  it('keeps unknown-window sources separate and does not infer boundaries from sync timestamps', () => {
    const p = buildReportFixture(), row = p.surface.measurements![0];
    p.surface.measurements = [{ ...row, dateFrom: null }, { ...row, dateTo: '2026-02-30' }];
    const model = buildSnapshotBreakdown(p.surface, 'age_gender', 'spend', 'Coverage unknown', 'age');
    expect(model.items).toHaveLength(2);
    expect(model.items.map(r => r.value)).toEqual([800, 800]);
  });
  it('keeps countries, regions, placements and devices independent', () => {
    const p = buildReportFixture();
    expect(buildSnapshotBreakdown(p.surface, 'country', 'spend', window).items.map(r => r.value)).toEqual([800, 320]);
    expect(buildSnapshotBreakdown(p.surface, 'region', 'conversion', window).items.map(r => r.value)).toEqual([80, 32]);
    expect(buildSnapshotBreakdown(p.surface, 'platform_position', 'clicks', window).items.map(r => r.value)).toEqual([180, 65]);
    expect(buildSnapshotBreakdown(p.surface, 'impression_device', 'clicks', window).items.map(r => r.value)).toEqual([200, 45]);
  });
  it('never fabricates delivery-only results even if legacy input contains zeros', () => {
    const p = buildReportFixture();
    p.surface.measurements!.filter(r => r.breakdownType === 'platform_position').forEach(r => { r.values.conversion = 0; });
    expect(buildSnapshotBreakdown(p.surface, 'platform_position', 'conversion', window).items.every(r => r.value == null)).toBe(true);
  });
  it('preserves zero, missing measurements, zero denominators and mixed currency', () => {
    const p = buildReportFixture(), row = p.surface.measurements![0];
    expect(snapshotMetric([{ ...row, values: { spend: 0 } }], 'spend')).toBe(0);
    expect(snapshotMetric([{ ...row, values: { spend: 0, clicks: 0 } }], 'cpc')).toBeNull();
    expect(snapshotMetric([row, { ...row, values: { spend: null } }], 'spend')).toBeNull();
    expect(snapshotMetric([row, { ...row, currencyCode: 'EUR' }], 'spend')).toBeNull();
    expect(snapshotMetric([row, { ...row, currencyCode: 'EUR' }], 'clicks')).toBe(360);
    p.surface.measurements![1].currencyCode = 'EUR';
    expect(buildSnapshotBreakdown(p.surface, 'age_gender', 'spend', window).items.every(r => r.value == null)).toBe(true);
  });
  it('does not replace unavailable demographics with unrelated geography', () => {
    const p = buildReportFixture('missing-demographics');
    expect(buildSnapshotBreakdown(p.surface, 'age_gender', 'spend', window).items).toEqual([]);
  });
});
describe('hourly metric and observation semantics', () => {
  it.each(PERFORMANCE_METRICS)('calculates hourly %s from the corresponding observation inputs', metric => {
    const cells = buildTimeAnalysis(buildReportFixture().surface, metric, 'total', 'USD');
    const expected = { spend: 20, conversion: 2, costPerResult: 10, impressions: 500, clicks: 10, linkClicks: 5, ctr: 2, cpc: 2, cpm: 40 };
    expect(cells.find(c => c.day === 3 && c.hour === 9)?.value).toBe(expected[metric]);
  });

  it('derives advertiser weekday from the source calendar date and shows exact observations', () => {
    const p = buildReportFixture(), cells = buildTimeAnalysis(p.surface, 'clicks', 'total', 'USD');
    expect(cells.find(c => c.day === 3 && c.hour === 9)).toMatchObject({ value: 10, observations: 1, dates: ['2026-10-08'] });
    expect(cells.find(c => c.day === 0 && c.hour === 9)?.value).toBeNull();
  });
  it('uses observed-date averages and aggregate ratios, not averages of percentages', () => {
    const p = buildReportFixture(), point = p.surface.hourlyTrendExpanded[0];
    p.surface.hourlyTrendExpanded.push({ ...point, dayKey: '2026-10-15', impressions: 1500, clicks: 90, spend: 180, results: 18 });
    expect(buildTimeAnalysis(p.surface, 'clicks', 'average', 'USD').find(c => c.day === 3 && c.hour === 9)?.value).toBe(50);
    expect(buildTimeAnalysis(p.surface, 'ctr', 'average', 'USD').find(c => c.day === 3 && c.hour === 9)?.value).toBe(5);
    expect(buildTimeAnalysis(p.surface, 'costPerResult', 'total', 'USD').find(c => c.day === 3 && c.hour === 9)?.value).toBe(10);
  });
  it('withholds unavailable monetary metrics but retains observed zero results', () => {
    const p = buildReportFixture(); p.surface.hourlyTrendExpanded[0].results = 0;
    expect(buildTimeAnalysis(p.surface, 'spend', 'total', 'MIXED').every(c => c.value == null)).toBe(true);
    expect(buildTimeAnalysis(p.surface, 'conversion', 'total', 'USD').find(c => c.day === 3 && c.hour === 9)?.value).toBe(0);
    expect(buildTimeAnalysis(p.surface, 'costPerResult', 'total', 'USD').find(c => c.day === 3 && c.hour === 9)?.value).toBeNull();
  });
});
describe('advertising and evidence models', () => {
  it('sorts by the explicit metric, keeps unknown values last and preserves historical paused entities', () => {
    const row = buildReportFixture().breakdown.rows[0];
    const rows = [{ ...row, id: 'unknown', unavailable: { conversion: 'Missing' } }, { ...row, id: 'large', conversion: 10 }, { ...row, id: 'small', conversion: 2 }];
    expect(sortAdvertising(rows, 'conversion', true, '', 'USD').map(r => r.id)).toEqual(['small', 'large', 'unknown']);
    expect(sortAdvertising(rows, 'conversion', false, '', 'USD').map(r => r.id)).toEqual(['large', 'small', 'unknown']);
    expect(sortAdvertising(rows, 'conversion', false, 'does not exist', 'USD')).toEqual([]);
    expect(advertisingMetricValue(row, 'spend', 'MIXED')).toBeNull();
    expect(advertisingGroups(buildReportFixture()).find(g => g.key === 'ads')?.rows).toHaveLength(2);
  });
  it('preserves demo isolation, dates and section on drilldowns and rejects unsafe links', () => {
    expect(reportDrilldownHref('/reports?ad_id=x&date_from=2026-10-01', true)).toBe('/reports?ad_id=x&date_from=2026-10-01&demo=1#advertising');
    expect(reportDrilldownHref('//evil.example', false)).toBeNull();
    expect(reportDrilldownHref('javascript:alert(1)', false)).toBeNull();
  });
  it('uses saved numerical evidence and source windows, never detection timestamps for coverage', () => {
    const f = buildReportFixture().findings[0];
    expect(findingEvidence(f).window).toBe('2026-10-01 – 2026-10-07');
    expect(findingEvidence({ ...f, metricSnapshot: { spend: 0, ctr: Number.NaN } })).toEqual({ window: 'Measurement window unknown', metrics: [{ key: 'spend', label: 'Spend', value: 0 }] });
    expect(filterFindings([f], 'warning', 'all')).toEqual([f]);
    expect(filterFindings([f], 'critical', 'all')).toEqual([]);
  });
});
