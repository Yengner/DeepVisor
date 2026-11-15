import { describe, expect, it } from 'vitest';
import { shiftReportDay } from '@/lib/shared/reports/dates';
import { lifecycleOutcome } from './outcome';

const range = (from: string, n: number, spend: number, results: number) =>
  Array.from({ length: n }, (_, i) => ({ day: shiftReportDay(from, i), spend, results }));
const synced = (from: string, n: number) => Array.from({ length: n }, (_, i) => shiftReportDay(from, i));

describe('lifecycleOutcome', () => {
  it('waits until enough completed days have passed', () => {
    const o = lifecycleOutcome(range('2026-11-01', 7, 10, 2), '2026-11-08', '2026-11-10', []);
    expect(o.state).toBe('too-early');
    expect(o.completedDaysAfter).toBe(1);
    expect(o.after).toEqual({ from: '2026-11-09', to: '2026-11-09' });
  });

  it('compares day k after with day k before, excluding the change day', () => {
    const days = [...range('2026-11-01', 7, 10, 2), { day: '2026-11-08', spend: 999, results: 99 }, ...range('2026-11-09', 7, 20, 2)];
    const o = lifecycleOutcome(days, '2026-11-08', '2026-11-20', synced('2026-11-01', 19));
    expect(o).toMatchObject({ state: 'compared', matchedDays: 7, after: { from: '2026-11-09', to: '2026-11-15' } });
    expect(o.beforeTotals).toEqual({ spend: 70, results: 14, cpr: 5 });
    expect(o.afterTotals).toEqual({ spend: 140, results: 14, cpr: 10 });
    expect(o.spendChange).toBe(100);
    expect(o.resultsChange).toBe(0);
    expect(o.series.find(d => d.day === '2026-11-08')?.side).toBe('change');
  });

  it('only pairs days observed on both sides', () => {
    const days = [...range('2026-11-01', 7, 10, 2), ...range('2026-11-09', 4, 20, 2)];
    const o = lifecycleOutcome(days, '2026-11-08', '2026-11-20', synced('2026-11-01', 19));
    expect(o.matchedDays).toBe(4);
    expect(o.state).toBe('compared');
    // Days 1–4 after pair with days 1–4 before (Nov 4–7), not the whole week.
    expect(o.compared).toEqual({ before: { from: '2026-11-04', to: '2026-11-07' }, after: { from: '2026-11-09', to: '2026-11-12' } });
    expect(o.series.filter(d => d.paired).map(d => d.day)).toEqual(['2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12']);
  });

  it('reports no spend after a pause only when the account was synced on those days', () => {
    const days = range('2026-11-01', 7, 10, 2);
    const synced5 = lifecycleOutcome(days, '2026-11-08', '2026-11-14', synced('2026-11-09', 5));
    expect(synced5.state).toBe('no-delivery-after');
    expect(synced5.syncedDaysAfter).toBe(5);
    expect(synced5.beforeTotals?.spend).toBe(70);
    const notSynced = lifecycleOutcome(days, '2026-11-08', '2026-11-14', []);
    expect(notSynced.state).toBe('insufficient');
  });

  it('keeps unavailable values as gaps and never pairs them', () => {
    const days = [...range('2026-11-01', 7, 10, 2), ...range('2026-11-09', 7, 20, 2).map(d => ({ ...d, results: null }))];
    const o = lifecycleOutcome(days, '2026-11-08', '2026-11-20', synced('2026-11-01', 19));
    expect(o.state).toBe('insufficient');
    expect(o.series.filter(d => d.side === 'after').every(d => d.results === null)).toBe(true);
  });
});
