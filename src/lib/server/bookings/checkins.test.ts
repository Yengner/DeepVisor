import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('next-intl/server', () => ({ getTranslations: async () => (key: string) => key }));
const ctx = vi.hoisted(() => ({ role: 'owner' as string, upserts: [] as unknown[], selected: 'acct' as string | null }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/server/actions/user/session', () => ({ requireUserId: vi.fn(async () => 'user-1') }));
vi.mock('@/lib/server/actions/business/context', () => ({
  getOrCreateOrganizationBusinessContext: vi.fn(async () => ({ businessId: 'session-biz', role: ctx.role })),
}));
vi.mock('@/lib/server/actions/app/selection', () => ({ resolveCurrentSelection: vi.fn(async () => ({ selectedAdAccountId: ctx.selected })) }));
vi.mock('@/lib/server/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const b: Record<string, unknown> = {};
      for (const op of ['select', 'eq']) b[op] = () => b;
      b.maybeSingle = async () => ({ data: table === 'ad_accounts' ? { id: 'acct', timezone: 'America/New_York' } : null, error: null });
      b.upsert = (row: unknown) => { ctx.upserts.push(row); return Promise.resolve({ error: null }); };
      return b;
    },
  }),
}));
import { CheckinError, loadCheckins, saveCheckin } from './checkins';

type Call = { table: string; ops: Array<[string, unknown[]]> };
function fakeClient(rows: Record<string, unknown>) {
  const calls: Call[] = [];
  const client = {
    from(table: string) {
      const call: Call = { table, ops: [] };
      calls.push(call);
      const b: Record<string, unknown> = {};
      for (const op of ['select', 'eq', 'in', 'gte', 'lte', 'order', 'range']) b[op] = (...args: unknown[]) => { call.ops.push([op, args]); return b; };
      b.upsert = (...args: unknown[]) => { call.ops.push(['upsert', args]); ctx.upserts.push(args[0]); return Promise.resolve({ error: null }); };
      b.maybeSingle = () => Promise.resolve({ data: rows[table] ?? null, error: null });
      b.then = (resolve: (v: unknown) => unknown) => Promise.resolve({ data: rows[table] ?? [], error: null }).then(resolve);
      return b;
    },
  };
  return { client: client as never, calls };
}
const eqs = (call: Call) => call.ops.filter(([op]) => op === 'eq').map(([, a]) => a);
const TODAY = '2026-11-17'; // Tuesday; last completed week is Nov 9–15.

beforeEach(() => { ctx.role = 'owner'; ctx.upserts = []; ctx.selected = 'acct'; });

describe('loadCheckins', () => {
  const day = (d: string, spend: number, messages = 3) => ({ entity_id: 'e1', day: d, spend, leads: 0, messages, calls: 0 });
  const base = {
    ad_entities: [{ id: 'e1', raw: { destination_type: 'WHATSAPP' } }],
    ad_entity_performance_daily: [day('2026-11-10', 20), day('2026-11-12', 10), day('2026-11-03', 30, 2)],
  };

  it('asks about last week and scopes every read', async () => {
    const { client, calls } = fakeClient({ ...base, booking_checkins: [] });
    const view = await loadCheckins(client, { businessId: 'biz', adAccountId: 'acct', today: TODAY });
    expect(view.ask).toMatchObject({ weekStart: '2026-11-09', spend: 30, results: 6, result: { kind: 'whatsapp_conversations' } });
    expect(view.summary).toEqual({ weeksWithSpend: 2, weeksAnswered: 0, bookings: null, costPerBooking: null });
    expect(eqs(calls.find(c => c.table === 'ad_entities')!)).toEqual([['business_id', 'biz'], ['ad_account_id', 'acct'], ['entity_level', 'adset']]);
    expect(eqs(calls.find(c => c.table === 'booking_checkins')!)).toEqual([['business_id', 'biz'], ['ad_account_id', 'acct']]);
    const perf = calls.find(c => c.table === 'ad_entity_performance_daily')!;
    expect(perf.ops.find(([op]) => op === 'gte')![1]).toEqual(['day', '2026-10-19']);
    expect(perf.ops.find(([op]) => op === 'lte')![1]).toEqual(['day', '2026-11-15']);
  });

  it('stops asking once answered and reports owner-reported cost', async () => {
    const { client } = fakeClient({ ...base, booking_checkins: [{ week_start: '2026-11-09', bookings: 3, skipped: false }, { week_start: '2026-11-02', bookings: null, skipped: true }] });
    const view = await loadCheckins(client, { businessId: 'biz', adAccountId: 'acct', today: TODAY });
    expect(view.ask).toBeNull();
    expect(view.summary).toEqual({ weeksWithSpend: 2, weeksAnswered: 1, bookings: 3, costPerBooking: 10 });
  });
});

describe('saveCheckin', () => {
  it('rejects weeks that are not completed, recent Mondays and invalid counts', async () => {
    const { client, calls } = fakeClient({});
    const save = (weekStart: string, bookings: number | null) => saveCheckin(client, { businessId: 'biz', adAccountId: 'acct', userId: 'u', weekStart, bookings, today: TODAY });
    await expect(save('2026-11-16', 1)).rejects.toBeInstanceOf(CheckinError);
    await expect(save('2026-11-10', 1)).rejects.toBeInstanceOf(CheckinError);
    await expect(save('2026-11-09', -1)).rejects.toBeInstanceOf(CheckinError);
    await expect(save('2026-11-09', 2.5)).rejects.toBeInstanceOf(CheckinError);
    expect(calls).toHaveLength(0);
  });

  it('records a count, or "not sure" as skipped, for the business and account', async () => {
    const { client } = fakeClient({});
    await saveCheckin(client, { businessId: 'biz', adAccountId: 'acct', userId: 'u', weekStart: '2026-11-09', bookings: 4, today: TODAY });
    await saveCheckin(client, { businessId: 'biz', adAccountId: 'acct', userId: 'u', weekStart: '2026-11-02', bookings: null, today: TODAY });
    expect(ctx.upserts).toEqual([
      expect.objectContaining({ business_id: 'biz', ad_account_id: 'acct', week_start: '2026-11-09', bookings: 4, skipped: false, answered_by: 'u' }),
      expect.objectContaining({ week_start: '2026-11-02', bookings: null, skipped: true }),
    ]);
  });
});

describe('saveBookingCheckinAction', () => {
  it('saves for the session business and selected account', async () => {
    const { saveBookingCheckinAction } = await import('@/app/(root)/dashboard/checkinActions');
    const { lastCompletedWeek } = await import('@/lib/shared/bookings/checkin');
    const { dayIn } = await import('@/lib/shared/time/zone');
    const week = lastCompletedWeek(dayIn('America/New_York'));
    expect((await saveBookingCheckinAction(week, 2)).success).toBe(true);
    expect(ctx.upserts).toEqual([expect.objectContaining({ business_id: 'session-biz', ad_account_id: 'acct', week_start: week, bookings: 2 })]);
  });

  it('refuses members, missing selections and malformed input without writing', async () => {
    const { saveBookingCheckinAction } = await import('@/app/(root)/dashboard/checkinActions');
    ctx.role = 'member';
    expect(await saveBookingCheckinAction('2026-11-09', 2)).toMatchObject({ success: false, error: { code: 'FORBIDDEN' } });
    ctx.role = 'owner';
    ctx.selected = null;
    expect(await saveBookingCheckinAction('2026-11-09', 2)).toMatchObject({ success: false, error: { code: 'VALIDATION_ERROR' } });
    expect(await saveBookingCheckinAction(42, 2)).toMatchObject({ success: false, error: { code: 'VALIDATION_ERROR' } });
    expect(await saveBookingCheckinAction('2026-11-09', '2')).toMatchObject({ success: false, error: { code: 'VALIDATION_ERROR' } });
    expect(ctx.upserts).toEqual([]);
  });
});
