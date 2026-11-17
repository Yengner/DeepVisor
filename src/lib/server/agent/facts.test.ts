import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const context = vi.hoisted(() => ({ role: 'owner' as string, saved: [] as unknown[] }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/server/actions/user/session', () => ({ requireUserId: vi.fn(async () => 'user-1') }));
vi.mock('@/lib/server/actions/business/context', () => ({
  getOrCreateOrganizationBusinessContext: vi.fn(async () => ({ businessId: 'session-biz', role: context.role })),
}));
vi.mock('@/lib/server/supabase/admin', () => ({
  createAdminClient: () => ({ from: () => ({ upsert: (row: unknown) => { context.saved.push(row); return Promise.resolve({ error: null }); } }) }),
}));
import { AdFactError, loadAdFacts, saveFact } from './facts';

type Call = { table: string; ops: Array<[string, unknown[]]> };

/** Minimal Supabase query fake: records every filter and returns canned rows per table. */
function fakeClient(rows: Record<string, unknown>) {
  const calls: Call[] = [];
  const client = {
    from(table: string) {
      const call: Call = { table, ops: [] };
      calls.push(call);
      const builder: Record<string, unknown> = {};
      for (const op of ['select', 'eq', 'in', 'order', 'range', 'upsert', 'delete']) {
        builder[op] = (...args: unknown[]) => { call.ops.push([op, args]); return builder; };
      }
      const result = () => {
        const data = rows[table];
        return { data: call.ops.some(([op]) => op === 'maybeSingle') ? data : data ?? [], error: null };
      };
      builder.maybeSingle = () => { call.ops.push(['maybeSingle', []]); return Promise.resolve(result()); };
      builder.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result()).then(resolve);
      return builder;
    },
  };
  return { client: client as never, calls };
}
const filters = (call: Call) => call.ops.filter(([op]) => op === 'eq').map(([, args]) => args);

describe('loadAdFacts', () => {
  it('scopes every read to the business and account and derives history', async () => {
    const { client, calls } = fakeClient({
      business_ad_facts: [{ fact_key: 'whatsapp_greeting', value: { text: 'Hola' }, confirmed_at: '2026-11-10T00:00:00Z' }, { fact_key: 'retired_key', value: {}, confirmed_at: '2026-11-10T00:00:00Z' }],
      ad_accounts: { id: 'acct', currency_code: 'USD' },
      ad_entities: [
        { id: '1', entity_level: 'campaign', external_id: 'c1', parent_external_id: null, created_time: null, raw: { daily_budget: '2500' } },
        { id: '2', entity_level: 'adset', external_id: 's1', parent_external_id: 'c1', created_time: '2026-10-28T00:00:00Z', raw: { start_time: '2026-10-28T00:00:00Z', end_time: '2026-11-04T00:00:00Z' } },
      ],
    });
    const view = await loadAdFacts(client, { businessId: 'biz', adAccountId: 'acct', now: '2026-11-16T00:00:00Z' });
    expect(filters(calls.find(c => c.table === 'business_ad_facts')!)).toEqual([['business_id', 'biz']]);
    expect(filters(calls.find(c => c.table === 'ad_accounts')!)).toEqual([['id', 'acct'], ['business_id', 'biz']]);
    expect(filters(calls.find(c => c.table === 'ad_entities')!)).toEqual([['business_id', 'biz'], ['ad_account_id', 'acct']]);
    // The ad set has no own budget, so its campaign's budget is used.
    expect(view.facts.daily_budget).toMatchObject({ source: 'history', value: { amountMinor: 2500, currency: 'USD' } });
    expect(view.facts.run_days).toMatchObject({ source: 'history', value: { days: 7 } });
    expect(view.facts.whatsapp_greeting).toMatchObject({ source: 'owner', value: { text: 'Hola' } });
    expect(view.toAsk).toEqual(['monthly_ceiling', 'client_languages', 'slow_days']);
  });

  it('refuses an account outside the business', async () => {
    const { client } = fakeClient({ business_ad_facts: [], ad_accounts: null });
    await expect(loadAdFacts(client, { businessId: 'biz', adAccountId: 'other' })).rejects.toBeInstanceOf(AdFactError);
  });

  it('returns owner answers without history when no account is selected', async () => {
    const { client, calls } = fakeClient({ business_ad_facts: [] });
    const view = await loadAdFacts(client, { businessId: 'biz', adAccountId: null });
    expect(calls.map(c => c.table)).toEqual(['business_ad_facts']);
    expect(view.accountCurrency).toBeNull();
  });
});

describe('saveFact', () => {
  it('rejects invalid values before writing', async () => {
    const { client, calls } = fakeClient({});
    await expect(saveFact(client, { businessId: 'biz', userId: 'u', key: 'run_days', value: { days: 400 } })).rejects.toBeInstanceOf(AdFactError);
    expect(calls).toHaveLength(0);
  });

  it('upserts the normalized value for the given business', async () => {
    const { client, calls } = fakeClient({});
    await saveFact(client, { businessId: 'biz', userId: 'u', key: 'whatsapp_greeting', value: { text: '  Hola  ' } });
    const [, [row, options]] = calls[0].ops.find(([op]) => op === 'upsert')! as [string, [Record<string, unknown>, unknown]];
    expect(row).toMatchObject({ business_id: 'biz', fact_key: 'whatsapp_greeting', value: { text: 'Hola' }, confirmed_by: 'u' });
    expect(options).toEqual({ onConflict: 'business_id,fact_key' });
  });
});

describe('saveAdFactAction', () => {
  beforeEach(() => { context.role = 'owner'; context.saved = []; });

  it('lets owners save, using the business from the session', async () => {
    const { saveAdFactAction } = await import('@/app/(root)/settings/adFactsActions');
    expect((await saveAdFactAction('run_days', { days: 7 })).success).toBe(true);
    expect(context.saved).toEqual([expect.objectContaining({ business_id: 'session-biz', fact_key: 'run_days', value: { days: 7 } })]);
  });

  it('refuses members, unknown keys and invalid values without writing', async () => {
    const { saveAdFactAction } = await import('@/app/(root)/settings/adFactsActions');
    context.role = 'member';
    expect(await saveAdFactAction('run_days', { days: 7 })).toMatchObject({ success: false, error: { code: 'FORBIDDEN' } });
    context.role = 'owner';
    expect(await saveAdFactAction('budget_hack', { days: 7 })).toMatchObject({ success: false, error: { code: 'VALIDATION_ERROR' } });
    expect(await saveAdFactAction('run_days', { days: -1 })).toMatchObject({ success: false, error: { code: 'VALIDATION_ERROR' } });
    expect(context.saved).toEqual([]);
  });
});
