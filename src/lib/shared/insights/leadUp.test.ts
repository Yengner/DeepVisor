import { describe, expect, it } from 'vitest';
import { leadUp, leadUpTrend, MIN_LEAD_UP_DAYS } from './leadUp';

const day = (d: string, spend: number | null, results: number | null) => ({ day: d, spend, results });
const span = (from: number, to: number, spend: number, results: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => day(`2026-11-${String(from + i).padStart(2, '0')}`, spend, results));

describe('leadUp', () => {
  it('compares the week before the change with the week before that', () => {
    const result = leadUp([...span(1, 7, 10, 2), ...span(8, 14, 12, 1)], '2026-11-15')!;
    expect(result).toMatchObject({ matchedDays: 7, recentFrom: '2026-11-08', recentTo: '2026-11-14', priorFrom: '2026-11-01', priorTo: '2026-11-07' });
    expect(result.recent).toEqual({ spend: 84, results: 7, cpr: 12 });
    expect(result.prior).toEqual({ spend: 70, results: 14, cpr: 5 });
    expect(result.resultsChange).toBe(-50);
    expect(result.spendChange).toBeCloseTo(20);
  });
  it('pairs only days observed on both sides; gaps are not zero', () => {
    const days = [...span(1, 7, 10, 2), ...span(8, 14, 10, 2)].filter(d => !['2026-11-09', '2026-11-03'].includes(d.day));
    expect(leadUp(days, '2026-11-15')!.matchedDays).toBe(5);
  });
  it('ignores days with unavailable values and needs enough matched days', () => {
    const days = [...span(1, 7, 10, 2), ...span(8, 14, 10, 2).map((d, i) => i < 5 ? { ...d, results: null } : d)];
    expect(leadUp(days, '2026-11-15')).toBeNull();
    expect(MIN_LEAD_UP_DAYS).toBe(3);
  });
  it('leaves the change unavailable when the earlier week had no results or spend', () => {
    const result = leadUp([...span(1, 7, 0, 0), ...span(8, 14, 10, 2)], '2026-11-15')!;
    expect(result.resultsChange).toBeNull();
    expect(result.spendChange).toBeNull();
    expect(result.prior.cpr).toBeNull();
  });
});

describe('leadUpTrend', () => {
  const base = { matchedDays: 7, windowDays: 7, recentFrom: '2026-10-31', recentTo: '2026-11-06', priorFrom: '2026-10-24', priorTo: '2026-10-30', spendChange: 0 };
  it('reads fewer results at a higher cost as both getting worse', () => {
    const t = leadUpTrend({ ...base, prior: { spend: 168, results: 24, cpr: 7 }, recent: { spend: 204, results: 12, cpr: 17 }, resultsChange: -50 });
    expect(t).toMatchObject({ results: 'fewer', cost: 'higher' });
    expect(t.costChange).toBeCloseTo(142.86, 1);
  });
  it('treats small moves as steady', () => {
    expect(leadUpTrend({ ...base, prior: { spend: 100, results: 20, cpr: 5 }, recent: { spend: 104, results: 21, cpr: 104 / 21 }, resultsChange: 5 })).toMatchObject({ results: 'steady', cost: 'steady' });
  });
  it('has no cost direction when one side had no results', () => {
    expect(leadUpTrend({ ...base, prior: { spend: 50, results: 0, cpr: null }, recent: { spend: 60, results: 3, cpr: 20 }, resultsChange: null })).toMatchObject({ results: 'more', cost: null, costChange: null });
  });
});
