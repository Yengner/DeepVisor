import { describe, expect, it } from 'vitest';
import { bucketHour, hourInZone, hourlyToday, periodContext, previousPeriod } from './compare';
import type { Insight } from './model';

const row = (day: string, spend: number, results: number | null, publisher = 'facebook', label = ''): Insight => ({
  entity_id: 'a', externalId: 'a', day, currency_code: 'USD', publisher, label,
  spend, impressions: 100, clicks: 4, reach: null, inline_link_clicks: null,
  leads: results === null ? null : 0, messages: results, calls: results === null ? null : 0,
});
const hour = (h: number) => `${String(h).padStart(2, '0')}:00:00 - ${String(h).padStart(2, '0')}:59:59`;

describe('hour helpers', () => {
  it('parses Meta hourly buckets and resolves the advertiser hour', () => {
    expect(bucketHour('09:00:00 - 09:59:59')).toBe(9);
    expect(bucketHour('Unknown hour')).toBeNull();
    expect(hourInZone('2026-11-12T18:30:00Z', 'America/New_York')).toBe(13);
    expect(hourInZone('2026-11-12T18:30:00Z', 'Not/AZone')).toBeNull();
  });
});

describe('previousPeriod', () => {
  it('aligns the previous window day-by-day and keeps missing days null', () => {
    const daily = [row('2026-10-30', 10, 1), row('2026-11-01', 20, 2), row('2026-11-06', 30, 3)];
    const { previousPoints, reference } = previousPeriod(daily, 'combined', '7d', '2026-11-12', 'USD');
    expect(previousPoints).toHaveLength(7);
    expect(previousPoints![0]).toMatchObject({ day: '2026-10-30', spend: 10, results: 1, costPerResult: 10 });
    expect(previousPoints![1]).toMatchObject({ day: '2026-10-31', spend: null, results: null });
    expect(previousPoints![2]).toMatchObject({ day: '2026-11-01', spend: 20, costPerResult: 10 }); // running 30 / 3
    expect(reference).toMatchObject({ spend: 30, results: 3 });
  });
  it('scopes to the selected platform and is unavailable without data', () => {
    const daily = [row('2026-11-01', 20, 2, 'instagram')];
    expect(previousPeriod(daily, 'facebook', '7d', '2026-11-12', 'USD').reference).toBeNull();
    expect(previousPeriod(null, 'combined', '7d', '2026-11-12', 'USD')).toEqual({ previousPoints: null, reference: null });
  });
});

describe('hourlyToday', () => {
  const hourly = [
    row('2026-11-11', 5, 1, 'facebook', hour(8)), row('2026-11-11', 5, 2, 'facebook', hour(14)),
    row('2026-11-12', 4, 0, 'facebook', hour(9)),
  ];
  it('builds cumulative today vs yesterday and compares yesterday through the current hour', () => {
    const { hourly: points, reference } = hourlyToday(hourly, 'combined', '2026-11-12', 10, 'USD');
    expect(points![9].today).toMatchObject({ spend: 4, results: 0 });
    expect(points![11].today.spend).toBeNull(); // future hours are not drawn
    expect(points![23].yesterday).toMatchObject({ spend: 10, results: 3 });
    expect(reference).toMatchObject({ spend: 5, results: 1 }); // yesterday by 10AM
  });
  it('is unavailable without an advertiser hour or any rows', () => {
    expect(hourlyToday(hourly, 'combined', '2026-11-12', null, 'USD').hourly).toBeNull();
    expect(hourlyToday([], 'combined', '2026-11-12', 10, 'USD').hourly).toBeNull();
  });
});

describe('periodContext', () => {
  it('labels the reference for each period', () => {
    const base = { daily: [row('2026-11-01', 20, 2)], hourly: [row('2026-11-11', 5, 1, 'facebook', hour(1))], platform: 'combined' as const, today: '2026-11-12', now: '2026-11-12T18:00:00Z', zone: 'UTC', currency: 'USD' };
    expect(periodContext({ ...base, period: '7d' }).referenceLabel).toBe('Previous 7 days');
    expect(periodContext({ ...base, period: '30d' }).previousPoints).toHaveLength(30);
    expect(periodContext({ ...base, period: 'today' }).referenceLabel).toBe('Yesterday by now');
  });
});
