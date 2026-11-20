import { describe, expect, it } from 'vitest';
import { rerunPlan, validDays } from './rerun';
import { profileSpendLimit } from '@/lib/shared/campaigns/budgetGuardrail';

const base = {
  today: '2026-11-20',
  previousDailyBudget: 20,
  // Two qualifying weeks: $10 and $5 per conversation.
  weeks: [{ spend: 100, results: 10 }, { spend: 100, results: 20 }],
  monthlyCap: null as number | null,
  maxDaily: 10_000,
};

describe('rerunPlan', () => {
  it('starts tomorrow and ends on the last day it runs (inclusive)', () => {
    expect(rerunPlan(base, 20, 7)).toMatchObject({ startDay: '2026-11-21', lastDay: '2026-11-27', total: 140, problem: null });
    expect(rerunPlan(base, 20, 1)).toMatchObject({ startDay: '2026-11-21', lastDay: '2026-11-21' });
    expect(rerunPlan({ ...base, today: '2026-12-30' }, 20, 3)).toMatchObject({ startDay: '2026-12-31', lastDay: '2027-01-02' });
  });

  it('estimates from the owner’s own weeks and follows budget and days', () => {
    expect(rerunPlan(base, 20, 7).forecast).toMatchObject({ low: 14, high: 28 });
    expect(rerunPlan(base, 40, 7).forecast).toMatchObject({ low: 28, high: 56 });
    expect(rerunPlan({ ...base, weeks: [{ spend: 100, results: 10 }] }, 20, 7).forecast).toBeNull();
  });

  it('refuses budgets and days the draft builder would refuse', () => {
    expect(rerunPlan(base, 0.5, 7).problem).toBe('budget-low');
    expect(rerunPlan(base, Number.NaN, 7).problem).toBe('budget-low');
    expect(rerunPlan(base, 10_001, 7).problem).toBe('budget-high');
    expect(rerunPlan(base, 20, 0).problem).toBe('days');
    expect(rerunPlan(base, 20, 91).problem).toBe('days');
    expect(rerunPlan(base, 20, 2.5).problem).toBe('days');
    expect(rerunPlan(base, 0.5, 7).total).toBe(0);
  });

  it('uses the same monthly limit as the draft builder', () => {
    const capped = { ...base, monthlyCap: 300 };
    expect(rerunPlan(capped, 20, 7)).toMatchObject({ limit: profileSpendLimit(300, 7), overLimit: false, problem: null });
    expect(rerunPlan(capped, 60, 7)).toMatchObject({ limit: 375, overLimit: true, problem: 'over-limit' });
    expect(rerunPlan(capped, 20, 60).limit).toBe(750);
  });

  it('flags a budget far above last time without blocking it', () => {
    expect(rerunPlan(base, 40, 7)).toMatchObject({ bigJump: false, problem: null });
    expect(rerunPlan(base, 41, 7)).toMatchObject({ bigJump: true, problem: null });
  });
});

it('accepts whole days from 1 to 90', () => {
  expect([1, 7, 90].every(validDays)).toBe(true);
  expect([0, 91, 3.5, Number.NaN].some(validDays)).toBe(false);
});
