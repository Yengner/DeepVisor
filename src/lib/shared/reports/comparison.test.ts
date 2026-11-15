import { describe, expect, it } from 'vitest';
import { comparisonBaseTotals, comparisonLabel, matchComparisonDays, MIN_MATCHED_DAYS } from './comparison';

const current = { dateFrom: '2026-11-06', dateTo: '2026-11-12' };
const previous = { dateFrom: '2026-10-30', dateTo: '2026-11-05' };
const days = (from: string, n: number) => Array.from({ length: n }, (_, i) => new Date(Date.parse(`${from}T00:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10));

describe('matchComparisonDays', () => {
  it('compares everything when both periods are fully covered', () => {
    const match = matchComparisonDays(days('2026-11-06', 7), days('2026-10-30', 7), current, previous);
    expect(match).toMatchObject({ basis: 'full', matchedDays: 7, expectedDays: 7, reason: null });
  });

  it('pairs days by offset and keeps only days observed in both periods', () => {
    // Previous period only has records from Nov 1 (offset 2) onwards; current is missing Nov 10 (offset 4).
    const match = matchComparisonDays(
      days('2026-11-06', 7).filter(d => d !== '2026-11-10'), days('2026-11-01', 5), current, previous,
    );
    expect(match.basis).toBe('matched_days');
    expect(match.matchedDays).toBe(4);
    expect([...match.currentDays]).toEqual(['2026-11-08', '2026-11-09', '2026-11-11', '2026-11-12']);
    expect([...match.previousDays]).toEqual(['2026-11-01', '2026-11-02', '2026-11-04', '2026-11-05']);
  });

  it('refuses a comparison with too few matched days or an empty previous period', () => {
    const few = matchComparisonDays(days('2026-11-06', 7), ['2026-11-04', '2026-11-05'], current, previous);
    expect(few.basis).toBeNull();
    expect(few.reason).toContain(`at least ${MIN_MATCHED_DAYS} needed`);
    const none = matchComparisonDays(days('2026-11-06', 7), [], current, previous);
    expect(none.reason).toBe('Comparison unavailable: the previous period has no saved records.');
  });

  it('ignores records outside each period and never pairs different offsets', () => {
    const outside = matchComparisonDays(days('2026-11-06', 7), ['2026-10-29', '2026-11-06'], current, previous);
    expect(outside.reason).toBe('Comparison unavailable: the previous period has no saved records.');
    const unpaired = matchComparisonDays(['2026-11-06'], ['2026-10-31'], current, previous);
    expect(unpaired.matchedDays).toBe(0);
    expect(unpaired.reason).toBe('Comparison unavailable: no day has saved records in both periods.');
  });
});

describe('comparison helpers', () => {
  it('measures changes from matched totals when present', () => {
    const summary = { spend: 100 } as never, matched = { spend: 40 } as never;
    expect(comparisonBaseTotals({ summary, comparison: { currentComparableTotals: matched } })).toBe(matched);
    expect(comparisonBaseTotals({ summary, comparison: {} })).toBe(summary);
  });
  it('labels matched-day deltas', () => {
    expect(comparisonLabel({ basis: 'matched_days', matchedDays: 5 })).toBe('on 5 matched days');
    expect(comparisonLabel({ basis: 'full' })).toBe('vs previous');
  });
});
