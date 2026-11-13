import { describe, expect, it } from 'vitest';
import { adHealth, adSetSignals, learningProgress, learningSnapshot } from './signals';
import type { Insight } from './model';

const today = '2026-11-12';
const now = '2026-11-12T18:00:00.000Z';
const row = (externalId: string, day: string, spend: number | null, results: number | null): Insight => ({
  entity_id: externalId, externalId, day, currency_code: 'USD', publisher: 'facebook', label: '',
  spend, impressions: 100, clicks: 5, reach: null, inline_link_clicks: null,
  leads: results === null ? null : 0, messages: results, calls: results === null ? null : 0,
});
const days = (n: number) => Array.from({ length: n }, (_, i) => {
  const d = new Date(`${today}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - i); return d.toISOString().slice(0, 10);
});

describe('learningSnapshot', () => {
  it('parses Meta learning_stage_info and rejects malformed values', () => {
    expect(learningSnapshot({ status: 'LEARNING', conversions: 12, last_sig_edit_ts: 1762560000 }))
      .toEqual({ status: 'LEARNING', conversions: 12, lastEditAt: new Date(1762560000 * 1000).toISOString() });
    expect(learningSnapshot({ status: 'FAIL', conversions: '7' }).conversions).toBe(7);
    expect(learningSnapshot(undefined)).toEqual({ status: null, conversions: null, lastEditAt: null });
    expect(learningSnapshot({ conversions: -3 }).conversions).toBeNull();
  });
});

describe('learningProgress', () => {
  it('uses Meta status and event count when reported', () => {
    const lastEdit = new Date(Date.parse(now) - 2.5 * 86400000).toISOString();
    expect(learningProgress({ status: 'LEARNING', conversions: 20, lastEditAt: lastEdit }, [], today, now))
      .toMatchObject({ label: 'Learning', tone: 'learning', percent: 40, events: 20, day: 3, estimated: false });
    expect(learningProgress({ status: 'FAIL', conversions: 9, lastEditAt: null }, [], today, now))
      .toMatchObject({ label: 'Learning limited', tone: 'limited', percent: 18, estimated: false });
    expect(learningProgress({ status: 'SUCCESS', conversions: null, lastEditAt: null }, [], today, now))
      .toMatchObject({ label: 'Learning complete', percent: 100 });
  });
  it('labels an estimate from the last 7 days of results when Meta omits learning info', () => {
    const rows = [...days(7).map(d => row('a', d, 20, 2)), row('a', days(8)[7], 20, 30)];
    expect(learningProgress(undefined, rows, today, now))
      .toMatchObject({ label: 'Learning progress', percent: 28, events: 14, estimated: true });
    const busy = days(7).map(d => row('a', d, 20, 8));
    expect(learningProgress(undefined, busy, today, now)).toMatchObject({ label: 'Likely out of learning', percent: 100, estimated: true });
  });
  it('stays unavailable when results are unknown', () => {
    expect(learningProgress(undefined, [row('a', today, 5, null)], today, now))
      .toMatchObject({ label: 'Learning unavailable', percent: null, events: null });
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
  it('refuses to grade without a benchmark or complete data', () => {
    expect(adHealth(days(7).map(d => row('a', d, 10, 2)), [], today, null)).toMatchObject({ label: 'Not enough data', benchmarkSource: null });
    expect(adHealth([row('a', today, 10, null)], account, today, null)).toMatchObject({ label: 'Not enough data' });
  });
});

describe('adSetSignals', () => {
  it('scopes each ad set to its own rows while benchmarking against the account', () => {
    const rows = [...days(7).map(d => row('a', d, 10, 2)), ...days(30).map(d => row('b', d, 10, 1))];
    const result = adSetSignals(rows, ['a', 'missing'], {}, today, now, null);
    expect(result.a.learning.events).toBe(14);
    expect(result.missing.health.label).toBe('Not enough data');
    expect(result.missing.learning.percent).toBeNull();
  });
});
