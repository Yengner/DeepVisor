import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { deletePlan, PlanConflictError, savePlan } from './plans';

type Result = { data: unknown; error: unknown };

/** A chainable fake for `db.from('ad_set_plans')` that records filters and writes. */
function fakeDb(results: { existing?: Result; update?: Result; insert?: Result; remove?: Result }) {
  const calls: Array<{ op: string; values?: unknown; filters: Array<[string, unknown]> }> = [];
  const db = {
    from: vi.fn(() => {
      const call = { op: 'select', values: undefined as unknown, filters: [] as Array<[string, unknown]> };
      calls.push(call);
      const chain: Record<string, unknown> = {};
      const finish = (): Result => call.op === 'update' ? results.update! : call.op === 'insert' ? results.insert! : call.op === 'delete' ? results.remove! : results.existing!;
      Object.assign(chain, {
        select: () => chain,
        update: (values: unknown) => { call.op = 'update'; call.values = values; return chain; },
        insert: (values: unknown) => { call.op = 'insert'; call.values = values; return chain; },
        delete: () => { call.op = 'delete'; return chain; },
        eq: (column: string, value: unknown) => { call.filters.push([column, value]); return chain; },
        maybeSingle: async () => finish(),
        single: async () => finish(),
        then: (resolve: (value: Result) => unknown) => resolve(finish()),
      });
      return chain;
    }),
  };
  return { db, calls };
}

const scope = (db: unknown) => ({ db, businessId: 'business', account: { id: 'account' }, userId: 'user' }) as never;
const source = { adSetId: '123', campaignId: '456', name: 'Holiday color', destinationType: 'WHATSAPP', sourceAdId: '789' };
const input = { source, currency: 'USD', dailyBudget: 20, days: 7, startDay: '2026-11-21', endDay: '2026-11-27' };
const row = (version: number, budget = 20) => ({ id: 'plan', adset_external_id: '123', daily_budget: String(budget), days: 7, start_day: '2026-11-21', end_day: '2026-11-27', version, updated_at: '2026-11-20T12:00:00Z' });

describe('savePlan', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates the first plan for an ad set, scoped to the business and account', async () => {
    const { db, calls } = fakeDb({ existing: { data: null, error: null }, insert: { data: row(1), error: null } });
    const plan = await savePlan(scope(db), { ...input, expectedVersion: null });
    expect(plan).toMatchObject({ dailyBudget: 20, days: 7, version: 1 });
    expect(calls[0].filters).toEqual([['business_id', 'business'], ['ad_account_id', 'account'], ['adset_external_id', '123']]);
    expect(calls[1].values).toMatchObject({ business_id: 'business', ad_account_id: 'account', adset_external_id: '123', created_by_user_id: 'user', daily_budget: 20 });
  });

  it('updates the same plan when saved again, bumping its version', async () => {
    const { db, calls } = fakeDb({ existing: { data: row(1), error: null }, update: { data: row(2, 30), error: null } });
    const plan = await savePlan(scope(db), { ...input, dailyBudget: 30, expectedVersion: 1 });
    expect(plan).toMatchObject({ dailyBudget: 30, version: 2 });
    expect(calls[1].values).toMatchObject({ daily_budget: 30, version: 2, updated_by_user_id: 'user' });
    expect(calls[1].filters).toEqual([['id', 'plan'], ['version', 1]]);
  });

  it('refuses a save from a page that was editing an older version', async () => {
    const { db } = fakeDb({ existing: { data: row(3), error: null } });
    await expect(savePlan(scope(db), { ...input, expectedVersion: 2 })).rejects.toBeInstanceOf(PlanConflictError);
  });

  it('reports a conflict when another save got there first', async () => {
    const changed = fakeDb({ existing: { data: row(1), error: null }, update: { data: null, error: null } });
    await expect(savePlan(scope(changed.db), { ...input, expectedVersion: 1 })).rejects.toBeInstanceOf(PlanConflictError);
    const raced = fakeDb({ existing: { data: null, error: null }, insert: { data: null, error: { code: '23505' } } });
    await expect(savePlan(scope(raced.db), { ...input, expectedVersion: null })).rejects.toBeInstanceOf(PlanConflictError);
  });
});

it('discards only this account’s plan for the ad set', async () => {
  const { db, calls } = fakeDb({ remove: { data: [{ id: 'plan' }], error: null } });
  expect(await deletePlan(scope(db), '123')).toBe(true);
  expect(calls[0]).toMatchObject({ op: 'delete', filters: [['business_id', 'business'], ['ad_account_id', 'account'], ['adset_external_id', '123']] });
});
