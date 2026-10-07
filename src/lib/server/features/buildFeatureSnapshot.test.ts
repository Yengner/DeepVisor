import { describe, expect, it } from 'vitest';
import { buildFeatureSnapshot } from './buildFeatureSnapshot';
import type { MetaDeliveryDailyRow, MetaDeliveryUnit } from './types';

const deliveryUnit: MetaDeliveryUnit = {
  platform: 'meta', entityType: 'adset', businessId: 'business',
  adAccountId: 'account', adsetId: 'adset', currency: 'USD',
};
const asOfDay = '2026-06-30';

function dailyRows(count = 60, overrides: Partial<MetaDeliveryDailyRow> = {}): MetaDeliveryDailyRow[] {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(`${asOfDay}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() - index);
    return {
      adset_id: 'adset', day: date.toISOString().slice(0, 10),
      spend: 20, impressions: 1000, reach: 250, clicks: 50,
      inline_link_clicks: 40, leads: 2, messages: 1, calls: 1,
      ...overrides,
    };
  });
}

const build = (rows: MetaDeliveryDailyRow[]) => buildFeatureSnapshot({ deliveryUnit, asOfDay, rows });

describe('Meta delivery-unit feature snapshots', () => {
  it('aggregates totals and derives weighted rates from raw counts', () => {
    const rows = dailyRows();
    rows[0] = { ...rows[0], spend: 40, clicks: 100 };
    const snapshot = build(rows);
    expect(snapshot.schemaVersion).toBe(1);
    expect(snapshot.deliveryUnit).toEqual(deliveryUnit);
    expect(snapshot.windows.recent7d.metrics).toEqual({
      spend: 160, impressions: 7000, clicks: 400, linkClicks: 280, results: 28,
      ctr: 400 / 7000 * 100, cpc: 160 / 400, cpm: 160 / 7000 * 1000,
      costPerResult: 160 / 28, frequency: 4,
    });
    expect(snapshot.windows.recent7d.dataSufficiency.status).toBe('sufficient');
    expect(snapshot.trackingConfidence.level).toBe('high');
    expect(snapshot.creativeFatigue.elevatedFrequency).toBe(true);
  });

  it('uses inclusive, disjoint windows and excludes out-of-range facts', () => {
    const snapshot = build([...dailyRows(), ...dailyRows(1, { day: '2026-07-01', spend: 9999 }),
      ...dailyRows(1, { day: '2026-05-01', spend: 9999 })]);
    expect(snapshot.windows.recent7d).toMatchObject({ sinceDay: '2026-06-24', untilDay: asOfDay, observedDays: 7 });
    expect(snapshot.windows.previous7d).toMatchObject({ sinceDay: '2026-06-17', untilDay: '2026-06-23', observedDays: 7 });
    expect(snapshot.windows.recent30d).toMatchObject({ sinceDay: '2026-06-01', observedDays: 30 });
    expect(snapshot.windows.previous30d).toMatchObject({ sinceDay: '2026-05-02', untilDay: '2026-05-31', observedDays: 30 });
    expect(snapshot.windows.recent30d.metrics.spend).toBe(600);
    expect(snapshot.windows.previous30d.metrics.spend).toBe(600);
  });

  it('compares delivery and efficiency with the correct polarity', () => {
    const rows = dailyRows().map((row, index) => index < 7 ? { ...row, spend: 30, leads: 10 } : row);
    expect(build(rows).comparisons.recent7d).toMatchObject({
      comparable: true, deliveryTrend: 'up', efficiencyTrend: 'improving',
      spend: { deltaAbsolute: 70, deltaPercent: 50 },
      results: { direction: 'up' }, costPerResult: { direction: 'down' },
    });
    const declining = dailyRows().map((row, index) => index < 7 ? { ...row, spend: 10, leads: 0, messages: 0 } : row);
    expect(build(declining).comparisons.recent7d).toMatchObject({ deliveryTrend: 'down', efficiencyTrend: 'declining' });
    expect(build(dailyRows()).comparisons.recent30d).toMatchObject({ deliveryTrend: 'flat', efficiencyTrend: 'stable' });
  });

  it('returns unknown for empty data, not healthy zero metrics', () => {
    const snapshot = build([]);
    expect(Object.values(snapshot.windows.recent7d.metrics)).toEqual(Array(10).fill(null));
    expect(snapshot.windows.recent7d.missingDays).toBe(7);
    expect(snapshot.comparisons.recent7d).toMatchObject({ comparable: false, spend: null, deliveryTrend: 'unknown', efficiencyTrend: 'unknown' });
    expect(snapshot.trackingConfidence.level).toBe('unknown');
    expect(snapshot.creativeFatigue.elevatedFrequency).toBeNull();
  });

  it('preserves known zero totals and uses null for zero-denominator rates', () => {
    const snapshot = build(dailyRows(60, {
      spend: 0, impressions: 0, reach: 0, clicks: 0, inline_link_clicks: 0, leads: 0, messages: 0, calls: 0,
    }));
    expect(snapshot.windows.recent7d.metrics).toMatchObject({ spend: 0, results: 0, ctr: null, cpc: null, cpm: null, costPerResult: null, frequency: null });
    expect(snapshot.windows.recent7d.dataSufficiency.reasons).toEqual(['too_few_active_days', 'low_signal']);
    expect(snapshot.comparisons.recent7d.comparable).toBe(false);
  });

  it('does not interpret missing action counts or reach as zero', () => {
    const snapshot = build(dailyRows(60, { calls: undefined, reach: null }));
    expect(snapshot.windows.recent7d.metrics.results).toBeNull();
    expect(snapshot.windows.recent7d.metrics.costPerResult).toBeNull();
    expect(snapshot.windows.recent7d.metrics.frequency).toBeNull();
    expect(snapshot.windows.recent7d.dataSufficiency.reasons).toContain('missing_metrics');
    expect(snapshot.trackingConfidence.level).toBe('unknown');
  });

  it('does not compare incomplete windows or invent zero-filled days', () => {
    const snapshot = build(dailyRows(60).filter((_, index) => index !== 8));
    expect(snapshot.windows.previous7d).toMatchObject({ observedDays: 6, missingDays: 1 });
    expect(snapshot.windows.previous7d.metrics.spend).toBe(120);
    expect(snapshot.comparisons.recent7d.comparable).toBe(false);
    expect(build(dailyRows(2)).windows.recent7d.dataSufficiency.reasons).toContain('too_few_active_days');
  });

  it('reports absolute changes but null percentages for zero baselines', () => {
    const rows = dailyRows().map((row, index) => index >= 7 ? { ...row, spend: 0, leads: 0, messages: 0, calls: 0 } : row);
    expect(build(rows).comparisons.recent7d).toMatchObject({
      comparable: true, spend: { deltaAbsolute: 140, deltaPercent: null },
      results: { deltaAbsolute: 28, deltaPercent: null },
      costPerResult: null, efficiencyTrend: 'unknown',
    });
  });

  it('uses low tracking confidence for traffic without outcomes', () => {
    expect(build(dailyRows(60, { leads: 0, messages: 0, calls: 0 })).trackingConfidence.level).toBe('low');
  });

  it('marks frequency below the fatigue threshold without requiring reach for sufficiency', () => {
    expect(build(dailyRows(60, { reach: 500 })).creativeFatigue.elevatedFrequency).toBe(false);
    expect(build(dailyRows(60, { reach: null })).windows.recent7d.dataSufficiency.status).toBe('sufficient');
  });

  it('is input-order independent, immutable and JSON serializable', () => {
    const rows = dailyRows();
    const before = structuredClone(rows);
    rows.forEach(Object.freeze);
    Object.freeze(rows);
    const snapshot = build(rows);
    expect(build([...rows].reverse())).toEqual(snapshot);
    expect(rows).toEqual(before);
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
  });

  it.each([NaN, Infinity, -1])('rejects invalid normalized metrics: %s', (spend) => {
    expect(() => build(dailyRows(1, { spend }))).toThrow('Invalid feature metric');
  });

  it('rejects overflow instead of persisting non-finite numbers', () => {
    expect(() => build(dailyRows(60, { spend: Number.MAX_VALUE }))).toThrow('overflow');
  });

  it('rejects duplicates and mixed ad sets', () => {
    const rows = dailyRows(1);
    expect(() => build([...rows, ...rows])).toThrow('Duplicate');
    expect(() => build(dailyRows(1, { adset_id: 'another' }))).toThrow('different ad set');
  });

  it.each(['2026-02-30', '2026-13-01', 'not-a-date'])('rejects invalid dates: %s', (day) => {
    expect(() => build(dailyRows(1, { day }))).toThrow('Invalid feature day');
    expect(() => buildFeatureSnapshot({ deliveryUnit, asOfDay: day, rows: [] })).toThrow('Invalid feature day');
  });

  it('handles leap-day boundaries', () => {
    const snapshot = buildFeatureSnapshot({ deliveryUnit, asOfDay: '2024-03-01', rows: [] });
    expect(snapshot.windows.recent7d.sinceDay).toBe('2024-02-24');
    expect(snapshot.windows.previous7d.untilDay).toBe('2024-02-23');
  });
});
