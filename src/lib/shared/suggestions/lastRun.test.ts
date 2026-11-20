import { describe, expect, it } from 'vitest';
import { averagePerSpendingDay, lastRun, rerunDefaults, scheduledDays } from './lastRun';

const day = (d: string, spend: number | null) => ({ day: d, spend });

describe('lastRun', () => {
  it('finds the latest stretch of spending days, joining short quiet gaps', () => {
    const rows = [
      day('2026-09-01', 10), day('2026-09-02', 10), // an older run
      day('2026-10-03', 20), day('2026-10-04', 18), day('2026-10-06', 22), // one quiet day
      day('2026-10-09', 20), day('2026-10-10', 0), day('2026-10-11', 18), // two quiet days, then a zero
    ];
    expect(lastRun(rows)).toEqual({ firstDay: '2026-10-03', lastDay: '2026-10-11', days: 9, spend: 98, perDay: 98 / 9 });
  });
  it('splits runs separated by more than two quiet days', () => {
    expect(lastRun([day('2026-10-01', 5), day('2026-10-05', 7), day('2026-10-06', 9)])).toMatchObject({ firstDay: '2026-10-05', days: 2, spend: 16 });
  });
  it('returns null when nothing was spent', () => {
    expect(lastRun([])).toBeNull();
    expect(lastRun([day('2026-10-01', 0), day('2026-10-02', null)])).toBeNull();
  });
});

describe('rerunDefaults', () => {
  const run = { firstDay: '2026-10-03', lastDay: '2026-10-11', days: 9, spend: 162, perDay: 18 };
  const none = { dailyBudget: null, lifetimeBudget: null, scheduledDays: null };

  it('uses the daily budget it had and how long it actually ran', () => {
    expect(rerunDefaults({ setup: { ...none, dailyBudget: 20 }, run, ownerDays: 5, accountPerDay: 30 }))
      .toEqual({ dailyBudget: 20, budgetSource: 'daily', days: 9, daysSource: 'actual' });
  });
  it('spreads a lifetime budget over its scheduled days, and keeps those days', () => {
    expect(rerunDefaults({ setup: { dailyBudget: null, lifetimeBudget: 150, scheduledDays: 7 }, run, ownerDays: null, accountPerDay: null }))
      .toEqual({ dailyBudget: 21, budgetSource: 'lifetime', days: 7, daysSource: 'schedule' });
  });
  it('falls back to what it actually spent per day, then the account average', () => {
    expect(rerunDefaults({ setup: none, run, ownerDays: null, accountPerDay: 30 })).toMatchObject({ dailyBudget: 18, budgetSource: 'actual' });
    expect(rerunDefaults({ setup: none, run: null, ownerDays: null, accountPerDay: 30.4 })).toMatchObject({ dailyBudget: 30, budgetSource: 'account' });
    expect(rerunDefaults({ setup: none, run: null, ownerDays: null, accountPerDay: null })).toMatchObject({ dailyBudget: null, budgetSource: null });
  });
  it('uses the owner’s usual run length, then a week, when the ad has no run to go by', () => {
    expect(rerunDefaults({ setup: none, run: null, ownerDays: 10, accountPerDay: 25 })).toMatchObject({ days: 10, daysSource: 'owner' });
    expect(rerunDefaults({ setup: none, run: null, ownerDays: null, accountPerDay: 25 })).toMatchObject({ days: 7, daysSource: 'usual' });
  });
  it('ignores day counts outside 1–90', () => {
    expect(rerunDefaults({ setup: { ...none, dailyBudget: 20, scheduledDays: 200 }, run: { ...run, days: 120 }, ownerDays: null, accountPerDay: null }))
      .toMatchObject({ days: 7, daysSource: 'usual' });
  });
  it('never starts below 1 a day', () => {
    expect(rerunDefaults({ setup: none, run: { ...run, perDay: 0.3 }, ownerDays: null, accountPerDay: null }).dailyBudget).toBe(1);
  });
});

it('counts scheduled days from start and end timestamps', () => {
  expect(scheduledDays('2026-10-03T00:00:00-0400', '2026-10-10T00:00:00-0400')).toBe(7);
  expect(scheduledDays('2026-10-03T00:00:00-0400', null)).toBeNull();
  expect(scheduledDays('2026-10-10T00:00:00-0400', '2026-10-03T00:00:00-0400')).toBeNull();
});

it('averages account spend over days that had spend', () => {
  expect(averagePerSpendingDay([day('2026-10-01', 10), day('2026-10-01', 20), day('2026-10-02', 30), day('2026-10-03', 0)])).toBe(30);
  expect(averagePerSpendingDay([day('2026-10-01', 0)])).toBeNull();
});
