import { describe, expect, it } from 'vitest';
import { resolveFacts, type StoredFact } from '@/lib/shared/agent/facts';
import { chooseSourceAdSet, localMidnightUtc, planQuickAd, quickAdSchedule, type SourceAdSet } from './plan';

const set = (id: string, over: Partial<SourceAdSet> = {}): SourceAdSet => ({
  adSetId: id, campaignId: `c-${id}`, name: id, destinationType: 'WHATSAPP', status: 'paused',
  createdTime: '2026-01-01T00:00:00Z', spend: null, results: null, ...over,
});

describe('chooseSourceAdSet', () => {
  it('picks the cheapest proven WhatsApp ad set', () => {
    const choice = chooseSourceAdSet([
      set('a', { spend: 100, results: 10 }),
      set('b', { spend: 60, results: 10 }),
      set('c', { spend: 1, results: 1 }), // too few results to compare
      set('d', { destinationType: 'WEBSITE', spend: 10, results: 10 }),
    ]);
    expect(choice).toMatchObject({ adSetId: 'b', reason: 'Lowest cost per conversation in the last 90 days' });
  });

  it('falls back to the most recent WhatsApp, then other messaging ad sets', () => {
    expect(chooseSourceAdSet([set('old'), set('new', { createdTime: '2026-10-28T00:00:00Z' })])?.adSetId).toBe('new');
    expect(chooseSourceAdSet([set('m', { destinationType: 'MESSAGING_INSTAGRAM_DIRECT_MESSENGER_WHATSAPP' }), set('w', { destinationType: 'WEBSITE' })])?.adSetId).toBe('m');
  });

  it('never reuses deleted or archived ad sets, and returns null without messaging ad sets', () => {
    expect(chooseSourceAdSet([set('x', { status: 'DELETED', spend: 1, results: 9 }), set('y')])?.adSetId).toBe('y');
    expect(chooseSourceAdSet([set('w', { destinationType: 'WEBSITE' })])).toBeNull();
  });
});

describe('planQuickAd', () => {
  const NOW = '2026-11-16T12:00:00Z';
  const facts = (stored: StoredFact[], history = {}) => resolveFacts({ stored, history, accountCurrency: 'USD', now: NOW });
  const answer = (key: StoredFact['key'], value: unknown): StoredFact => ({ key, value, confirmedAt: NOW });

  it('lists what must be asked when nothing is known', () => {
    const plan = planQuickAd({ facts: facts([]), request: {}, accountCurrency: 'USD', needsGreeting: true });
    expect(plan.missing).toEqual(['daily_budget', 'run_days', 'client_languages', 'whatsapp_greeting']);
    expect(plan.dailyBudget).toBeNull();
  });

  it('uses the request, then answers, then history', () => {
    const known = facts([answer('run_days', { days: 10 }), answer('client_languages', { languages: ['es', 'en'] }), answer('whatsapp_greeting', { text: 'Hola' })],
      { daily_budget: { value: { amountMinor: 2000, currency: 'USD' }, basis: 'x' } });
    expect(planQuickAd({ facts: known, request: {}, accountCurrency: 'USD', needsGreeting: true })).toMatchObject({
      dailyBudget: { amountMinor: 2000, source: 'history' }, days: { value: 10, source: 'owner' }, languages: ['es', 'en'], greeting: 'Hola', missing: [],
    });
    expect(planQuickAd({ facts: known, request: { dailyBudget: 15.5, days: 5 }, accountCurrency: 'USD', needsGreeting: true })).toMatchObject({
      dailyBudget: { amountMinor: 1550, source: 'request' }, days: { value: 5, source: 'request' },
    });
  });

  it('does not ask for a greeting when the ad set does not open WhatsApp', () => {
    const plan = planQuickAd({ facts: facts([]), request: { dailyBudget: 10, days: 7 }, accountCurrency: 'USD', needsGreeting: false });
    expect(plan.missing).toEqual(['client_languages']);
  });

  it('flags plans above the monthly limit without blocking them', () => {
    const known = facts([answer('monthly_ceiling', { amountMinor: 30000, currency: 'USD' }), answer('client_languages', { languages: ['en'] })]);
    expect(planQuickAd({ facts: known, request: { dailyBudget: 20, days: 20 }, accountCurrency: 'USD', needsGreeting: false }).overMonthlyLimit).toBe(true);
    expect(planQuickAd({ facts: known, request: { dailyBudget: 10, days: 20 }, accountCurrency: 'USD', needsGreeting: false }).overMonthlyLimit).toBe(false);
  });

  it('ignores invalid request values', () => {
    const plan = planQuickAd({ facts: facts([]), request: { dailyBudget: -5, days: 400 }, accountCurrency: 'USD', needsGreeting: false });
    expect(plan.missing).toContain('daily_budget');
    expect(plan.missing).toContain('run_days');
  });
});

describe('schedule', () => {
  it('uses local midnight across daylight saving changes', () => {
    expect(localMidnightUtc('2026-11-16', 'America/New_York').toISOString()).toBe('2026-11-16T05:00:00.000Z');
    expect(localMidnightUtc('2026-07-16', 'America/New_York').toISOString()).toBe('2026-07-16T04:00:00.000Z');
    // The day clocks fall back (Nov 1, 2026) still starts at 04:00Z.
    expect(localMidnightUtc('2026-11-01', 'America/New_York').toISOString()).toBe('2026-11-01T04:00:00.000Z');
  });

  it('starts tomorrow and runs whole days', () => {
    expect(quickAdSchedule({ today: '2026-10-31', zone: 'America/New_York', days: 2 })).toEqual({
      startDay: '2026-11-01', startAt: '2026-11-01T04:00:00.000Z', endAt: '2026-11-03T05:00:00.000Z',
    });
  });
});
