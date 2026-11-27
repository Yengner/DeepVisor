import { describe, expect, it } from 'vitest';
import { adHealth, adSetSignals, reportedLearning } from './signals';
import type { Insight } from './model';

const today = '2026-11-12';
const row = (externalId: string, day: string, spend: number | null, results: number | null): Insight => ({
  entity_id: externalId, externalId, day, currency_code: 'USD', publisher: 'facebook', label: '',
  spend, impressions: 100, clicks: 5, reach: null, inline_link_clicks: null,
  leads: results === null ? null : 0, messages: results, calls: results === null ? null : 0,
});
const days = (n: number) => Array.from({ length: n }, (_, i) => {
  const d = new Date(`${today}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - i); return d.toISOString().slice(0, 10);
});

describe('reportedLearning', () => {
  it('shows only a learning or limited status that Meta reported, with when it was read', () => {
    expect(reportedLearning('Learning', 'Nov 26, 4:23 PM')).toEqual({ label: 'Learning', tone: 'learning', checkedAt: 'Nov 26, 4:23 PM' });
    expect(reportedLearning('Learning limited', null)).toEqual({ label: 'Learning limited', tone: 'limited', checkedAt: null });
  });
  it.each(['Unavailable', 'Learning complete', 'Learning not required', undefined])('shows nothing for %s', label => {
    expect(reportedLearning(label, 'Nov 26, 4:23 PM')).toBeNull();
  });
});

describe('adHealth', () => {
  const account = days(30).map(d => row('acct', d, 10, 1)); // $10 per result benchmark
  it('grades last-7-day cost per result against the account benchmark', () => {
    expect(adHealth(days(7).map(d => row('a', d, 10, 2)), account, today, null))
      .toMatchObject({ label: 'Strong', costPerResult: 5, benchmark: 10, benchmarkSource: 'account', percent: 100 });
    expect(adHealth(days(7).map(d => row('a', d, 10, 1)), account, today, null)).toMatchObject({ label: 'On track', percent: 55 });
    expect(adHealth(days(7).map(d => row('a', d, 26, 2)), account, today, null)).toMatchObject({ label: 'Watch' });
    expect(adHealth(days(7).map(d => row('a', d, 40, 2)), account, today, null)).toMatchObject({ label: 'Needs attention', percent: 0 });
  });
  it('prefers the business target, including numeric strings from Supabase', () => {
    expect(adHealth(days(7).map(d => row('a', d, 10, 1)), account, today, '20'))
      .toMatchObject({ label: 'Strong', benchmark: 20, benchmarkSource: 'target' });
  });
  it('flags spend without results only once a result was clearly expected', () => {
    expect(adHealth([row('a', today, 15, 0)], account, today, null)).toMatchObject({ label: 'Not enough data', percent: null });
    expect(adHealth([row('a', today, 25, 0)], account, today, null)).toMatchObject({ label: 'Needs attention', percent: 0 });
  });
  it('benchmarks against the 30 days before the week being judged, never overlapping it', () => {
    // The judged week is expensive ($20/result); earlier days are cheap ($5/result).
    const week = days(7).map(d => row('a', d, 20, 1));
    const earlier = days(37).slice(7).map(d => row('a', d, 5, 1));
    const health = adHealth(week, [...week, ...earlier], today, null);
    expect(health.benchmark).toBe(5); // an overlapping 30-day window would have blended in the week itself
    expect(health.label).toBe('Needs attention');
    expect(health.benchmarkWindow).toEqual({ since: '2026-10-07', until: '2026-11-05', days: 30, observedDays: 30 });
  });
  it('reports how much of the baseline window has data', () => {
    const sparse = ['2026-10-28', '2026-10-29', '2026-10-30', '2026-11-03', '2026-11-05'].map(d => row('a', d, 10, 1));
    expect(adHealth(days(7).map(d => row('a', d, 10, 1)), sparse, today, null).benchmarkWindow?.observedDays).toBe(5);
    expect(adHealth(days(7).map(d => row('a', d, 10, 1)), sparse, today, '20').benchmarkWindow).toBeNull();
  });
  it('refuses to grade without a benchmark or complete data', () => {
    expect(adHealth(days(7).map(d => row('a', d, 10, 2)), [], today, null)).toMatchObject({ label: 'Not enough data', benchmarkSource: null });
    expect(adHealth([row('a', today, 10, null)], account, today, null)).toMatchObject({ label: 'Not enough data' });
  });
});

describe('adSetSignals', () => {
  it('scopes each ad set to its own rows while benchmarking against the account', () => {
    const rows = [...days(7).map(d => row('a', d, 10, 2)), ...days(30).map(d => row('b', d, 10, 1))];
    const result = adSetSignals(rows, ['a', 'missing'], { a: 'Unavailable' }, 'Nov 26, 4:23 PM', today, null);
    // Few recent results with no Meta status must not read as "still learning".
    expect(result.a.learning).toBeNull();
    expect(result.missing.health.label).toBe('Not enough data');
    expect(result.missing.learning).toBeNull();
  });
});
