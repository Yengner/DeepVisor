import { describe, it, expect, vi, afterEach } from 'vitest';
import { historicalDefaults } from './history';
const campaign = (raw: Record<string, string>, objective = 'OUTCOME_LEADS') => ({ external_id: '1', name: 'Test', objective, raw, updated_at: '2026-10-20T00:00:00Z' });
afterEach(() => vi.useRealTimers());
describe('historical advertising defaults', () => {
    it('separates daily and lifetime budgets and requires three observations', () => {
        const rows = [campaign({ daily_budget: '1000' }), campaign({ daily_budget: '2000' }), campaign({ daily_budget: '3000' }), campaign({ lifetime_budget: '15000' })];
        const result = historicalDefaults(rows, 'USD', 'OUTCOME_LEADS');
        expect(result.dailyBudget).toEqual({ median: 20, sampleSize: 3 });
        expect(result.lifetimeBudget).toEqual({ median: null, sampleSize: 1 });
    });
    it('excludes mixed budget ownership, invalid amounts and incompatible goals', () => {
        const result = historicalDefaults([campaign({ daily_budget: '1000', lifetime_budget: '5000' }), campaign({ daily_budget: '-3' }), campaign({ daily_budget: '2000' }, 'OUTCOME_ENGAGEMENT')], 'USD', 'OUTCOME_LEADS');
        expect(result.dailyBudget.sampleSize).toBe(0);
        expect(result.lifetimeBudget.sampleSize).toBe(0);
    });
    it('never guesses objective or unsupported currency scaling', () => {
        const rows = Array.from({ length: 3 }, () => campaign({ daily_budget: '1000' }));
        expect(historicalDefaults(rows, 'JPY', 'OUTCOME_LEADS').dailyBudget.median).toBeNull();
        expect(historicalDefaults(rows, 'USD', null).dailyBudget.median).toBeNull();
    });
    it('uses completed valid schedules, not entity creation dates', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-11-01T00:00:00Z'));
        const rows = Array.from({ length: 3 }, () => campaign({ start_time: '2026-10-01T00:00:00Z', stop_time: '2026-10-08T00:00:00Z' }));
        rows.push(campaign({ start_time: '2026-10-01T00:00:00Z', stop_time: '2026-12-01T00:00:00Z' }));
        expect(historicalDefaults(rows, 'USD', 'OUTCOME_LEADS').durationDays).toEqual({ median: 7, sampleSize: 3 });
    });
});
