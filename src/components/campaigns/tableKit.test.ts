import { describe, expect, it } from 'vitest';
import { costAbove, costBenchmarks, formatPercent, humanizeObjective, lastActivity, nextSort, rowMetrics, sortRows, type RowMetrics } from './tableKit';

describe('rowMetrics', () => {
  it('keeps missing observations null instead of zero', () => {
    const m = rowMetrics({ spend: '0', leads: 0, impressions: 0, ctr: null, metricsAvailable: false });
    expect(m).toMatchObject({ available: false, spend: null, results: null, impressions: null, costPerResult: null, ctr: null });
  });

  it('recomputes cost per result from aggregates and parses string metrics', () => {
    const m = rowMetrics({ spend: '222.34', leads: 4, messages: '20', calls: null, ctr: '5.1561', impressions: '8262' });
    expect(m.results).toBe(24);
    expect(m.costPerResult).toBeCloseTo(9.264, 3);
    expect(m.impressions).toBe(8262);
    expect(formatPercent(m.ctr)).toBe('5.16%');
  });

  it('does not divide by zero results', () => {
    expect(rowMetrics({ spend: 10, leads: 0 }).costPerResult).toBeNull();
  });
});

describe('lastActivity', () => {
  const now = new Date('2026-11-12T18:00:00Z');
  it('reads "Today" for a reported day on or after the account today', () => {
    expect(lastActivity('Nov 16, 2026', '2026-11-16', 'UTC', now)).toBe('Today');
    expect(lastActivity('Nov 12, 2026', '2026-11-12', 'UTC', now)).toBe('Today');
  });
  it('uses the account timezone for the boundary', () => {
    // 18:00 UTC on Nov 12 is still Nov 12 in Los Angeles, so Nov 13 is in the future → Today.
    expect(lastActivity('Nov 11, 2026', '2026-11-11', 'America/Los_Angeles', now)).toBe('Nov 11, 2026');
  });
  it('keeps past days and falls back without a timezone', () => {
    expect(lastActivity('Oct 1, 2026', '2026-10-01', 'UTC', now)).toBe('Oct 1, 2026');
    expect(lastActivity('Nov 16, 2026', '2026-11-16', null, now)).toBe('Nov 16, 2026');
    expect(lastActivity('', null, 'UTC', now)).toBe('—');
  });
});

describe('humanizeObjective', () => {
  it('maps Meta enums to readable labels', () => {
    expect(humanizeObjective('OUTCOME_LEADS')).toBe('Leads');
    expect(humanizeObjective('CONVERSATIONS')).toBe('Conversations');
    expect(humanizeObjective('SOME_NEW_GOAL')).toBe('Some new goal');
    expect(humanizeObjective('UNKNOWN')).toBe('—');
    expect(humanizeObjective(null)).toBe('—');
  });
});


const m = (spend: number | null, results: number | null, extra: Partial<RowMetrics> = {}): RowMetrics => ({
  available: spend != null, spend, results, costPerResult: spend != null && results ? spend / results : null,
  ctr: null, cpc: null, cpm: null, impressions: null, clicks: null, linkClicks: null, leads: null, messages: null, ...extra,
});

describe('sorting', () => {
  it('cycles desc → asc → default for metrics and asc first for names', () => {
    expect(nextSort(null, 'spend')).toEqual({ key: 'spend', dir: 'desc' });
    expect(nextSort({ key: 'spend', dir: 'desc' }, 'spend')).toEqual({ key: 'spend', dir: 'asc' });
    expect(nextSort({ key: 'spend', dir: 'asc' }, 'spend')).toBeNull();
    expect(nextSort(null, 'name')).toEqual({ key: 'name', dir: 'asc' });
    expect(nextSort({ key: 'spend', dir: 'asc' }, 'ctr')).toEqual({ key: 'ctr', dir: 'desc' });
  });

  it('keeps missing values last in both directions and preserves default order', () => {
    const rows = [
      { name: 'b', metrics: m(10, 2) },
      { name: 'none', metrics: m(null, null) },
      { name: 'a', metrics: m(30, 3) },
    ];
    const pick = (r: (typeof rows)[number]) => r;
    expect(sortRows(rows, { key: 'costPerResult', dir: 'desc' }, pick).map(r => r.name)).toEqual(['a', 'b', 'none']);
    expect(sortRows(rows, { key: 'costPerResult', dir: 'asc' }, pick).map(r => r.name)).toEqual(['b', 'a', 'none']);
    expect(sortRows(rows, null, pick)).toBe(rows);
    expect(sortRows(rows, { key: 'name', dir: 'asc' }, pick).map(r => r.name)).toEqual(['a', 'b', 'none']);
  });
});

describe('cost per result comparison', () => {
  const group = (r: { g: string }) => r.g;
  it('pools spend and results per group, never averaging ratios', () => {
    const rows = [{ g: 'Leads', metrics: m(90, 10) }, { g: 'Leads', metrics: m(10, 10) }];
    const b = costBenchmarks(rows, r => r.metrics, group, g => g).get('Leads');
    expect(b?.costPerResult).toBe(5); // 100 / 20, not mean(9, 1)
    expect(costAbove(rows[0].metrics, b)).toBe(80);
    expect(costAbove(rows[1].metrics, b)).toBeNull();
  });

  it('withholds the comparison without enough peers or evidence', () => {
    const lone = costBenchmarks([{ g: 'x', metrics: m(50, 20) }], r => r.metrics, group, g => g);
    expect(lone.size).toBe(0);
    const thin = costBenchmarks([{ g: 'x', metrics: m(5, 2) }, { g: 'x', metrics: m(5, 3) }], r => r.metrics, group, g => g);
    expect(thin.size).toBe(0);
    const bench = { costPerResult: 1, peers: 3, label: 'x' };
    expect(costAbove(m(40, 4), bench)).toBeNull(); // below minimum row results
  });

  it('does not compare across groups', () => {
    const rows = [
      { g: 'Leads', metrics: m(100, 10) }, { g: 'Leads', metrics: m(100, 10) },
      { g: 'Sales', metrics: m(500, 10) }, { g: 'Sales', metrics: m(500, 10) },
    ];
    const b = costBenchmarks(rows, r => r.metrics, group, g => g);
    expect(costAbove(rows[2].metrics, b.get('Sales'))).toBeNull();
  });
});
