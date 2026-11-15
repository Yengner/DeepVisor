import { describe, expect, it } from 'vitest';
import { buildAgeGenderAudienceChart, type AudienceObservation } from './audience';
import { buildTimeAnalysis, type HourlyObservation } from './timeAnalysis';
const observation = (age: string, gender: string, spend = 20, impressions = 100, clicks = 10): AudienceObservation => ({ date: '2026-11-02', age, gender, currencyCode: 'USD', values: { spend, impressions, clicks, conversion: 2 } });
describe('demographic chart aggregation', () => {
  it('collapses unknown dimensions, orders ages and preserves every additive measurement', () => {
    const rows = [observation('65+', 'female'), observation('25-34', 'male'), observation('unknown', 'unknown'), observation('', ''), observation('unknown', 'unspecified')];
    const result = buildAgeGenderAudienceChart(rows, 'spend');
    expect(result.rows.map(r => r.label)).toEqual(['25-34', '65+', 'Unknown']);
    expect(result.rows.at(-1)).toMatchObject({ total: 60, Unknown: 60, Female: null });
    expect(result.rows.reduce((sum, r) => sum + r.total!, 0)).toBe(100);
  });
  it('supports age and gender views without adding ratios', () => {
    const rows = [observation('25-34', 'female', 10, 100, 10), observation('25-34', 'female', 20, 900, 9), observation('25-34', 'male', 20, 100, 10)];
    expect(buildAgeGenderAudienceChart(rows, 'ctr').rows[0].Female).toBe(1.9);
    expect(buildAgeGenderAudienceChart(rows, 'ctr').stacked).toBe(false);
    expect(buildAgeGenderAudienceChart(rows, 'costPerResult', 'age').rows[0].total).toBeCloseTo(50 / 6);
    expect(buildAgeGenderAudienceChart(rows, 'impressions', 'gender').rows.map(r => r.total)).toEqual([1000, 100]);
  });
  it('keeps zero distinct from unavailable and rejects mixed monetary scopes', () => {
    const row = observation('25-34', 'female', 0, 0, 0); row.values.conversion = null;
    expect(buildAgeGenderAudienceChart([row], 'spend').rows[0].Female).toBe(0);
    expect(buildAgeGenderAudienceChart([row], 'ctr').rows[0].Female).toBeNull();
    expect(buildAgeGenderAudienceChart([row], 'conversion').rows[0].Female).toBeNull();
    expect(buildAgeGenderAudienceChart([row, { ...row, currencyCode: 'EUR' }], 'spend').rows[0].total).toBeNull();
  });
});
const hour = (dayKey: string, spend = 10, clicks = 2): HourlyObservation => ({ dayKey, hourOfDay: 9, spend, impressions: 100, clicks, results: null, inlineLinkClicks: null });
describe('dated hourly delivery chart', () => {
  it('builds 168 cells and averages by distinct observed dates, not publisher row count', () => {
    const source = { hourlyTrendExpanded: [hour('2026-10-26'), hour('2026-10-26', 20), hour('2026-11-02', 30)] };
    const cells = buildTimeAnalysis(source, 'spend', 'average', 'USD');
    expect(cells).toHaveLength(168);
    expect(cells.find(c => c.key === '0:9')).toMatchObject({ value: 30, observations: 2 });
    expect(buildTimeAnalysis(source, 'ctr', 'average', 'USD').find(c => c.key === '0:9')?.value).toBe(2);
  });
  it('keeps current partial hours and missing conversions unavailable', () => {
    const source = { hourlyTrendExpanded: [hour('2026-11-04', 0, 0)] };
    expect(buildTimeAnalysis(source, 'spend', 'total', 'USD').find(c => c.key === '2:9')?.value).toBe(0);
    expect(buildTimeAnalysis(source, 'spend', 'total', 'USD').find(c => c.key === '2:10')?.value).toBeNull();
    expect(buildTimeAnalysis(source, 'conversion', 'total', 'USD').every(c => c.value === null)).toBe(true);
    expect(buildTimeAnalysis(source, 'costPerResult', 'total', 'USD').every(c => c.value === null)).toBe(true);
  });
});

describe('buildAudiencePyramid', () => {
  it('pairs female and male values per age in age order, keeping missing cells null', async () => {
    const { buildAudiencePyramid } = await import('./audience');
    const pyramid = buildAudiencePyramid([
      { key: '35-44 · female', value: 4 }, { key: '18-24 · male', value: 2 },
      { key: '18-24 · female', value: 6 }, { key: '35-44 · unknown', value: 1 },
    ])!;
    expect(pyramid.rows.map(r => r.age)).toEqual(['18-24', '35-44']);
    expect(pyramid.rows[0]).toMatchObject({ Female: { value: 6 }, Male: { value: 2 }, Unknown: null });
    expect(pyramid.rows[1].Male).toBeNull();
    expect(pyramid.max).toBe(6);
    expect(pyramid.hasUnknown).toBe(true);
  });
  it('declines labels that are not age · gender pairs', async () => {
    const { buildAudiencePyramid } = await import('./audience');
    expect(buildAudiencePyramid([{ key: '18-24 · female · ad 1', value: 1 }])).toBeNull();
  });
});
