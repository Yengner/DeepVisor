import { describe, expect, it } from 'vitest';
import { amountToMinor, budgetMinor, factsToAsk, historyFacts, minorToAmount, parseFact, resolveFacts, type HistoryFacts, type StoredFact } from './facts';

const NOW = '2026-11-16T12:00:00Z';
const daysAgo = (n: number) => new Date(Date.parse(NOW) - n * 86_400_000).toISOString();

describe('fact validation', () => {
  it('accepts well-formed values and rejects the rest', () => {
    expect(parseFact('daily_budget', { amountMinor: 2000, currency: 'USD' })).toEqual({ amountMinor: 2000, currency: 'USD' });
    expect(parseFact('daily_budget', { amountMinor: 20.5, currency: 'USD' })).toBeNull();
    expect(parseFact('daily_budget', { amountMinor: 0, currency: 'USD' })).toBeNull();
    expect(parseFact('daily_budget', { amountMinor: 2000, currency: 'usd' })).toBeNull();
    expect(parseFact('daily_budget', { amountMinor: 100_000_01, currency: 'USD' })).toBeNull();
    expect(parseFact('daily_budget', { amountMinor: 2000, currency: 'USD', extra: 1 })).toBeNull();
    expect(parseFact('run_days', { days: 0 })).toBeNull();
    expect(parseFact('run_days', { days: 91 })).toBeNull();
    expect(parseFact('whatsapp_greeting', { text: '  Hola, quiero una cita  ' })).toEqual({ text: 'Hola, quiero una cita' });
    expect(parseFact('whatsapp_greeting', { text: '   ' })).toBeNull();
    expect(parseFact('whatsapp_greeting', { text: 'x'.repeat(301) })).toBeNull();
    expect(parseFact('client_languages', { languages: ['es', 'en'] })).toEqual({ languages: ['es', 'en'] });
    expect(parseFact('client_languages', { languages: [] })).toBeNull();
    expect(parseFact('client_languages', { languages: ['es', 'es'] })).toBeNull();
    expect(parseFact('client_languages', { languages: ['fr'] })).toBeNull();
    expect(parseFact('slow_days', { days: [] })).toEqual({ days: [] });
    expect(parseFact('slow_days', { days: ['mon', 'mon'] })).toBeNull();
  });

  it('converts money with the currency’s minor units', () => {
    expect(amountToMinor(20, 'USD')).toBe(2000);
    expect(amountToMinor(20.5, 'USD')).toBe(2050);
    expect(amountToMinor(20.555, 'USD')).toBeNull();
    expect(amountToMinor(-1, 'USD')).toBeNull();
    expect(amountToMinor(1500, 'JPY')).toBe(1500);
    expect(minorToAmount(2000, 'USD')).toBe(20);
    expect(budgetMinor('2000')).toBe(2000);
    expect(budgetMinor('0')).toBeNull();
    expect(budgetMinor(null)).toBeNull();
    expect(budgetMinor('20.5')).toBeNull();
  });
});

describe('history facts', () => {
  // Saved Meta ad sets from a real salon account (dates and budgets only).
  const adSets = [
    { createdTime: '2026-10-28T18:25:05Z', startTime: '2026-10-28T15:00:00-0400', endTime: '2026-11-16T15:00:00-0500', dailyBudgetMinor: 2000 },
    { createdTime: '2025-12-10T22:12:58Z', startTime: '2025-12-10T17:12:58-0500', endTime: '2025-12-31T18:11:00-0500', dailyBudgetMinor: null },
    { createdTime: '2025-12-10T22:10:43Z', startTime: '2025-12-10T17:10:43-0500', endTime: '2025-12-31T00:00:00-0500', dailyBudgetMinor: null },
    { createdTime: '2025-11-01T16:35:44Z', startTime: '2025-11-01T13:00:00-0400', endTime: '2025-11-15T13:00:00-0500', dailyBudgetMinor: null },
    { createdTime: '2025-10-10T18:26:01Z', startTime: '2025-10-10T14:26:01-0400', endTime: '2025-10-20T00:00:00-0400', dailyBudgetMinor: null },
    { createdTime: '2025-10-03T19:49:44Z', startTime: '2025-10-03T16:00:00-0400', endTime: '2025-10-17T16:00:00-0400', dailyBudgetMinor: 1500 },
  ];

  it('takes the most recent daily budget and the median run length', () => {
    expect(historyFacts(adSets, 'USD')).toEqual({
      daily_budget: { value: { amountMinor: 2000, currency: 'USD' }, basis: { code: 'latest_ad_set' } },
      // 9, 14, 14, 19, 20, 21 days → median 16.5 → 17
      run_days: { value: { days: 17 }, basis: { code: 'typical', count: 6 } },
    });
  });

  it('supplies nothing it cannot read', () => {
    expect(historyFacts([], 'USD')).toEqual({});
    expect(historyFacts(adSets, null).daily_budget).toBeUndefined();
    expect(historyFacts([{ createdTime: null, startTime: null, endTime: null, dailyBudgetMinor: 2000 }], 'USD')).toEqual({});
  });
});

describe('resolving and asking', () => {
  const history: HistoryFacts = { daily_budget: { value: { amountMinor: 2000, currency: 'USD' }, basis: { code: 'latest_ad_set' } } };
  const stored = (key: StoredFact['key'], value: unknown, age: number): StoredFact => ({ key, value, confirmedAt: daysAgo(age) });

  it('prefers a fresh owner answer over history', () => {
    const facts = resolveFacts({ stored: [stored('daily_budget', { amountMinor: 1500, currency: 'USD' }, 10)], history, accountCurrency: 'USD', now: NOW });
    expect(facts.daily_budget).toMatchObject({ source: 'owner', value: { amountMinor: 1500 }, stale: false });
  });

  it('falls back to history when the owner answer is old, keeping the old answer visible', () => {
    const facts = resolveFacts({ stored: [stored('daily_budget', { amountMinor: 1500, currency: 'USD' }, 120)], history, accountCurrency: 'USD', now: NOW });
    expect(facts.daily_budget).toMatchObject({ source: 'history', value: { amountMinor: 2000 }, owner: { value: { amountMinor: 1500 } } });
  });

  it('asks again only when an old answer has no history to replace it', () => {
    const facts = resolveFacts({ stored: [stored('whatsapp_greeting', { text: 'Hola' }, 400), stored('slow_days', { days: [] }, 5)], history, accountCurrency: 'USD', now: NOW });
    expect(facts.whatsapp_greeting).toMatchObject({ source: 'owner', stale: true });
    expect(factsToAsk(facts)).toEqual(['run_days', 'monthly_ceiling', 'whatsapp_greeting', 'client_languages']);
  });

  it('ignores invalid stored values and money in another currency', () => {
    const facts = resolveFacts({
      stored: [stored('monthly_ceiling', { amountMinor: 50000, currency: 'EUR' }, 1), stored('run_days', { days: 'seven' }, 1)],
      history: {}, accountCurrency: 'USD', now: NOW,
    });
    expect(facts.monthly_ceiling.source).toBeNull();
    expect(facts.run_days.source).toBeNull();
  });
});
