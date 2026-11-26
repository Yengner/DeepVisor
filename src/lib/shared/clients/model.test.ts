import { describe, expect, it } from 'vitest';
import { accountNumber, adTimeline, attentionFor, compareByAttention, earliestEnd, feeCents, paymentState, safeAppPath, showOnPortfolio, type AttentionInput } from './model';

const now = '2026-11-25T12:00:00Z';

describe('ad schedule', () => {
  it('measures progress only with both dates', () => {
    expect(adTimeline({ delivery: 'ACTIVE', start: '2026-11-23T12:00:00Z', end: '2026-11-27T12:00:00Z', now })).toMatchObject({ state: 'running', progress: 0.5, daysLeft: 2 });
    expect(adTimeline({ delivery: 'ACTIVE', start: '2026-11-23T12:00:00Z', end: null, now })).toMatchObject({ state: 'running', progress: null, daysLeft: null });
    expect(adTimeline({ delivery: 'ACTIVE', start: 'soon', end: 'later', now })).toMatchObject({ start: null, end: null, progress: null });
  });
  it('clamps scheduled and ended runs, and shows no bar for paused or unknown ones', () => {
    expect(adTimeline({ delivery: 'SCHEDULED', start: '2026-11-26T12:00:00Z', end: '2026-11-28T12:00:00Z', now }).progress).toBe(0);
    expect(adTimeline({ delivery: 'COMPLETED', start: '2026-11-01T12:00:00Z', end: '2026-11-08T12:00:00Z', now }).progress).toBe(1);
    for (const delivery of ['PAUSED', 'ADSET_PAUSED', 'NO_ACTIVE_ADS']) {
      expect(adTimeline({ delivery, start: '2026-11-23T12:00:00Z', end: '2026-11-27T12:00:00Z', now })).toMatchObject({ state: 'off', progress: null, daysLeft: null });
    }
    expect(adTimeline({ delivery: null, start: null, end: null, now }).state).toBe('unknown');
  });
  it('stops at the earlier of the ad set and campaign end', () => {
    expect(earliestEnd('2026-11-30T00:00:00Z', '2026-11-28T00:00:00Z')).toBe('2026-11-28T00:00:00Z');
    expect(earliestEnd(null, undefined, '')).toBeNull();
  });
  it('keeps recently ended runs and hides old or paused ones', () => {
    const ended = (end: string) => adTimeline({ delivery: 'COMPLETED', start: null, end, now });
    expect(showOnPortfolio(ended('2026-11-10T00:00:00Z'), now)).toBe(true);
    expect(showOnPortfolio(ended('2026-09-01T00:00:00Z'), now)).toBe(false);
    expect(showOnPortfolio(adTimeline({ delivery: 'PAUSED', start: null, end: null, now }), now)).toBe(false);
  });
});

describe('which business to look at first', () => {
  const healthy: AttentionInput = { synced: true, linkedAccounts: 1, urgent: false, lastSynced: '2026-11-25T08:00:00Z', runningAds: 3, endingSoon: 0, now };
  it('never calls missing, stale or unknown data healthy', () => {
    expect(attentionFor(healthy)).toBe('ok');
    expect(attentionFor({ ...healthy, lastSynced: null })).toBe('neverSynced');
    expect(attentionFor({ ...healthy, lastSynced: '2026-11-20T08:00:00Z' })).toBe('stale');
    expect(attentionFor({ ...healthy, runningAds: null })).toBe('stale');
    expect(attentionFor({ ...healthy, synced: false })).toBe('notSynced');
    expect(attentionFor({ ...healthy, synced: false, linkedAccounts: 0 })).toBe('noAccount');
  });
  it('puts delivery problems ahead of everything', () => {
    expect(attentionFor({ ...healthy, urgent: true, lastSynced: null })).toBe('urgent');
    expect(attentionFor({ ...healthy, runningAds: 0 })).toBe('adsOff');
    expect(attentionFor({ ...healthy, endingSoon: 1 })).toBe('endingSoon');
    const rows = [{ attention: 'ok' as const, name: 'A' }, { attention: 'notSynced' as const, name: 'Z' }, { attention: 'urgent' as const, name: 'M' }, { attention: 'notSynced' as const, name: 'B' }];
    expect(rows.sort(compareByAttention).map(row => row.name)).toEqual(['M', 'B', 'Z', 'A']);
  });
});

describe('form values', () => {
  it('reads account numbers, fees and payment dates strictly', () => {
    expect(accountNumber(' act_123 ')).toBe('123');
    expect(accountNumber('123?x=1')).toBeNull();
    expect(feeCents('$1,200.50')).toBe(120050);
    expect(feeCents('')).toBe('');
    expect(feeCents('-5')).toBeNull();
    expect(feeCents('12.345')).toBeNull();
    expect(paymentState(null, '2026-11-25')).toBe('unrecorded');
    expect(paymentState('2026-11-25', '2026-11-25')).toBe('paid');
    expect(paymentState('2026-11-24', '2026-11-25')).toBe('due');
  });
  it('only redirects inside the app', () => {
    expect(safeAppPath('/reports?x=1')).toBe('/reports?x=1');
    for (const bad of [null, '', 'https://evil.example', '//evil.example', '/\\evil.example', 'dashboard', '/a b']) expect(safeAppPath(bad)).toBe('/dashboard');
  });
});
