import { describe, it, expect } from 'vitest';
import { analyticsArguments, analyticsRange, performanceAnswer, type AnalyticsArguments, type AnalyticsRow } from './analyticsModel';
import { shiftReportDay } from '@/lib/shared/reports/dates';
const args: AnalyticsArguments = { period: 'today', dateFrom: null, dateTo: null, platform: 'combined', level: 'account', entityId: null, metric: 'spend', order: 'highest', dimension: 'publisher_platform', visual: true };
function rows(today: string, at: string, days = 60): AnalyticsRow[] {
  return Array.from({ length: days }, (_, i) => ({ day: shiftReportDay(today, -i), entity_id: 'one', updated_at: at, spend: i ? 10 : 20, impressions: i ? 100 : 1000, clicks: 10, inline_link_clicks: 5, leads: i ? 2 : 4, messages: 0, calls: 0, currency_code: 'USD' }));
}
describe('advertiser calendar and comparisons', () => {
  it.each([['2026-11-06T00:59:00Z', false], ['2026-11-06T01:00:00Z', true], ['2026-11-06T04:59:00Z', true], ['2026-11-06T05:00:00Z', false]])('New York cutoff %s', (at, eligible) => {
    const today = at === '2026-11-06T05:00:00Z' ? '2026-11-06' : '2026-11-05';
    const answer = performanceAnswer(rows(today, at), args, 'America/New_York', 'USD', new Date(at));
    expect(answer.changes.spend !== null).toBe(eligible);
    expect(answer.baseline.dailyAverages?.spend).toBe(10);
    if (eligible) { expect(answer.changes.spend?.value).toBe(100); expect(answer.changes.spend?.direction).toBe('neutral'); expect(answer.changes.ctr?.value).toBe(-9); expect(answer.changes.ctr?.unit).toBe('pp'); }
  });
  it.each([['7d', '2026-10-30', '2026-10-23'], ['30d', '2026-10-07', '2026-09-07']] as const)('non-overlapping %s', (period, start, previous) => {
    const range = analyticsRange({ ...args, period }, 'UTC', new Date('2026-11-05T20:00Z'));
    expect(range.dateFrom).toBe(start); expect(range.previous.dateFrom).toBe(previous); expect(range.previous.dateTo).toBe(shiftReportDay(start, -1)); expect(range.partial).toBe(true);
  });
  it('resolves yesterday, custom bounds and timezone rollover', () => {
    expect(analyticsRange({ ...args, period: 'yesterday' }, 'Asia/Tokyo', new Date('2026-11-05T22:00Z')).dateFrom).toBe('2026-11-05');
    expect(() => analyticsRange({ ...args, period: 'custom', dateFrom: '2026-02-30', dateTo: '2026-03-02' }, 'UTC')).toThrow();
    expect(() => analyticsRange(args, null)).toThrow();
    expect(analyticsArguments.safeParse({ ...args, sql: 'select' }).success).toBe(false);
  });
  it('omits comparisons on missing baseline, duplicate observations, stale or currency mismatch', () => {
    const at = '2026-11-05T21:00:00Z', complete = rows('2026-11-05', at);
    for (const data of [complete.filter(r => r.day !== '2026-11-03'), [...complete, complete[0]], complete.map(r => ({ ...r, updated_at: '2026-11-05T10:00:00Z' })), complete.map(r => ({ ...r, currency_code: 'EUR' }))]) {
      expect(performanceAnswer(data, args, 'UTC', 'USD', new Date(at)).changes.spend).toBeNull();
    }
  });
  it('recomputes ratios, separates leads, and never sums reach', () => {
    const at = '2026-11-05T21:00:00Z';
    const result = performanceAnswer(rows('2026-11-05', at), { ...args, period: '7d' }, 'UTC', 'USD', new Date(at));
    expect(result.metrics.ctr).toBeCloseTo(70 / 1600 * 100);
    expect(result.metrics.costPerResult).toBe(80 / 16);
    expect(result.metrics.costPerLead).toBe(80 / 16);
    expect(result.metrics.reach).toBeNull(); expect(result.metrics.frequency).toBeNull();
    expect(result.dailyAverages.spend).toBeCloseTo(80 / 7);
    expect(result.dailyAverages.ctr).toBe(result.metrics.ctr);
  });
  it('preserves missing results and zero denominators', () => {
    const at = '2026-11-05T21:00:00Z';
    const answer = performanceAnswer(rows('2026-11-05', at).map(r => ({ ...r, leads: null, impressions: 0, clicks: 0 })), args, 'UTC', 'USD', new Date(at));
    expect(answer.metrics.conversion).toBeNull(); expect(answer.metrics.costPerResult).toBeNull(); expect(answer.metrics.ctr).toBeNull();
    expect(answer.changes.conversion).toBeNull();
  });
});
it('does not label foreign-currency spend as account currency', () => {
  const at = '2026-11-05T21:00:00Z';
  const answer = performanceAnswer(rows('2026-11-05', at).map(r => ({ ...r, currency_code: 'EUR' })), args, 'UTC', 'USD', new Date(at));
  expect(answer.metrics.spend).toBeNull(); expect(answer.metrics.costPerLead).toBeNull(); expect(answer.cards[0].value).toBe('—');
});
