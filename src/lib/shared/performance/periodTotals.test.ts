import { describe, expect, it } from 'vitest';
import { localDay, parseTableRange, periodTotals, rangeWindow, type DailyTotals, type SummaryTotals } from './periodTotals';

const t = { reach: 0, impressions: 100, clicks: 5, linkClicks: 1, leads: 0, calls: 0 };
const day = (d: string, spend: number, messages = 1): DailyTotals => ({ day: d, spend, messages, ...t });
const summary = (spend: number, messages: number, firstDay: string, syncedAt: string): SummaryTotals => ({ spend, messages, firstDay, syncedAt, ...t });
const NY = 'America/New_York';

describe('periodTotals lifetime', () => {
  it('uses the daily rows when they reach back to the start (always current)', () => {
    // Summary synced last night ($243.07); daily rows now total $250.45 from the same first day.
    const daily = [day('2026-10-28', 243.07, 26), day('2026-11-14', 7.38, 1)];
    const r = periodTotals({ range: 'lifetime', today: '2026-11-14', timezone: NY, summary: summary(243.07, 26, '2026-10-28', '2026-11-14T02:57:54Z'), daily });
    expect(r.totals.spend).toBeCloseTo(250.45, 2);
    expect(r.source).toBe('daily');
  });
  it('keeps old history from the summary and adds only days after its sync day', () => {
    // Daily rows start after the summary's first day (older history is outside the daily window).
    const daily = [day('2026-11-13', 5), day('2026-11-14', 4)];
    const r = periodTotals({ range: 'lifetime', today: '2026-11-14', timezone: NY, summary: summary(500, 52, '2025-11-01', '2026-11-14T02:57:54Z'), daily });
    // Synced at 9:57 PM Nov 13 New York time: Nov 13 is already inside the summary; only Nov 14 is added.
    expect(r.totals.spend).toBe(504);
    expect(r.source).toBe('summary+daily');
  });
  it('uses the summary alone for paused history with no daily rows', () => {
    const r = periodTotals({ range: 'lifetime', today: '2026-11-14', timezone: NY, summary: summary(499.07, 52, '2025-11-01', '2026-11-14T02:57:54Z'), daily: [] });
    expect(r).toMatchObject({ available: true, source: 'summary', lastDay: null });
    expect(r.totals.spend).toBe(499.07);
  });
  it('is unavailable with neither source', () => {
    expect(periodTotals({ range: 'lifetime', today: '2026-11-14', timezone: NY, summary: null, daily: [] }).available).toBe(false);
  });
});

describe('periodTotals windows', () => {
  const daily = [day('2026-10-20', 10), day('2026-11-08', 20), day('2026-11-14', 6)];
  it('sums only the account-local window', () => {
    expect(periodTotals({ range: 'today', today: '2026-11-14', timezone: NY, summary: null, daily }).totals.spend).toBe(6);
    expect(periodTotals({ range: '7d', today: '2026-11-14', timezone: NY, summary: null, daily }).totals.spend).toBe(26);
    expect(periodTotals({ range: '30d', today: '2026-11-14', timezone: NY, summary: null, daily }).totals.spend).toBe(36);
  });
  it('reports no rows in the window as unavailable, not zero', () => {
    expect(periodTotals({ range: '7d', today: '2026-11-30', timezone: NY, summary: null, daily })).toMatchObject({ available: false, source: 'none' });
  });
  it('matches the dashboard window boundaries', () => {
    expect(rangeWindow('7d', '2026-11-14')).toEqual({ since: '2026-11-08', until: '2026-11-14' });
    expect(rangeWindow('lifetime', '2026-11-14')).toBeNull();
  });
});

it('parses the range and resolves local days', () => {
  expect(parseTableRange('7d')).toBe('7d');
  expect(parseTableRange('bogus')).toBe('lifetime');
  expect(localDay('2026-11-14T02:57:54Z', NY)).toBe('2026-11-13');
  expect(localDay(null, NY)).toBeNull();
});

it('names a past schedule stop only when delivery dates are unknown', () => {
  const s = { ...summary(499.07, 52, '2025-11-01', '2026-11-14T02:57:54Z'), lastDay: '2025-12-31' };
  expect(periodTotals({ range: 'lifetime', today: '2026-11-14', timezone: NY, summary: s, daily: [] }).scheduleEnded).toBe('2025-12-31');
  // A future stop (e.g. Nov 16 for a running campaign) is never shown as an end.
  expect(periodTotals({ range: 'lifetime', today: '2026-11-14', timezone: NY, summary: { ...s, lastDay: '2026-11-16' }, daily: [] }).scheduleEnded).toBeNull();
});
