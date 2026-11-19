import { describe, expect, it } from 'vitest';
import { idleSuggestionDue, restartForecast } from './idle';

describe('idleSuggestionDue', () => {
  const base = { today: '2026-11-24', activeNow: false as boolean | null, lastSpendDay: '2026-11-15', lastSuggestedDay: null as string | null };
  it('suggests once ads have been off for 7 days', () => {
    expect(idleSuggestionDue(base)).toBe(true);
    expect(idleSuggestionDue({ ...base, lastSpendDay: '2026-11-18' })).toBe(false);
    expect(idleSuggestionDue({ ...base, lastSpendDay: '2026-11-17' })).toBe(true);
  });
  it('repeats at most every 14 days while ads stay off', () => {
    expect(idleSuggestionDue({ ...base, lastSuggestedDay: '2026-11-20' })).toBe(false);
    expect(idleSuggestionDue({ ...base, today: '2026-12-04', lastSuggestedDay: '2026-11-20' })).toBe(true);
  });
  it('starts over after the ads ran again', () => {
    expect(idleSuggestionDue({ ...base, lastSuggestedDay: '2026-11-01' })).toBe(true);
  });
  it('never suggests while ads run, when delivery is unknown, or without any past spend', () => {
    expect(idleSuggestionDue({ ...base, activeNow: true })).toBe(false);
    expect(idleSuggestionDue({ ...base, activeNow: null })).toBe(false);
    expect(idleSuggestionDue({ ...base, lastSpendDay: null })).toBe(false);
  });
});

describe('restartForecast', () => {
  it('turns the best and worst weekly cost per result into a range', () => {
    const f = restartForecast({ dailyBudget: 20, days: 7, weeks: [{ spend: 100, results: 20 }, { spend: 120, results: 12 }, { spend: 90, results: 15 }] });
    expect(f).toEqual({ low: 14, high: 28, costLow: 5, costHigh: 10, weeks: 3 });
  });
  it('shows no number without 2 comparable weeks of at least 3 results', () => {
    expect(restartForecast({ dailyBudget: 20, days: 7, weeks: [{ spend: 100, results: 20 }, { spend: 50, results: 2 }] })).toBeNull();
    expect(restartForecast({ dailyBudget: 20, days: 7, weeks: [{ spend: 100, results: null }, { spend: null, results: 5 }, { spend: 80, results: 8 }] })).toBeNull();
    expect(restartForecast({ dailyBudget: 0, days: 7, weeks: [{ spend: 100, results: 20 }, { spend: 120, results: 12 }] })).toBeNull();
  });
});
