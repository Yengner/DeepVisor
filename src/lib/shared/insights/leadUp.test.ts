import { describe, expect, it } from 'vitest';
import { leadUp, MIN_LEAD_UP_DAYS } from './leadUp';

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
