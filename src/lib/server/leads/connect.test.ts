import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const { connectWhatsApp, disconnectWhatsAppAccounts, WhatsAppConnectError } = await import('./connect');

const BUSINESS = '00000000-0000-4000-8000-000000000001';
const OTHER = '00000000-0000-4000-8000-000000000002';
const WABA = '419592037907470', PHONE = '409769752222955';
const deps = (fetch: typeof globalThis.fetch) => ({ fetch, appId: '1170459584316506', appSecret: 'app-secret' });

type Call = { method: string; path: string; params: URLSearchParams; auth: string | null; body: unknown };
/** Fake Graph API: routes by method + path; anything unrouted is a 404 so unexpected calls fail loudly. */
function graph(routes: Record<string, { status?: number; body: unknown }>) {
  const calls: Call[] = [];
  const fetch = vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
    const url = new URL(String(input));
    const path = url.pathname.replace(/^\/v\d+\.\d+\//, '');
    const method = init?.method ?? 'GET';
    calls.push({ method, path, params: url.searchParams, auth: (init?.headers as Record<string, string>)?.Authorization ?? null, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const route = routes[`${method} ${path}`] ?? { status: 404, body: { error: { code: 100 } } };
    return new Response(JSON.stringify(route.body), { status: route.status ?? 200 });
  });
  return { fetch: fetch as unknown as typeof globalThis.fetch, calls };
}
const happy = (overrides: Record<string, { status?: number; body: unknown }> = {}) => graph({
  'GET oauth/access_token': { body: { access_token: 'business-token', token_type: 'bearer' } },
  [`GET ${WABA}/phone_numbers`]: { body: { data: [{ id: PHONE, display_phone_number: '+1 813-863-2868', is_on_biz_app: true }] } },
  [`POST ${WABA}/subscribed_apps`]: { body: { success: true } },
  [`POST ${PHONE}/smb_app_data`]: { body: { messaging_product: 'whatsapp', request_id: 'r1' } },
  ...overrides,
});

/** Just enough of the Supabase client for connect.ts. */
function fakeDb(existing: { business_id: string } | null = null) {
  const writes: Array<{ op: string; table: string; values?: unknown; filters: Array<[string, unknown]> }> = [];
  const rpc = vi.fn(async () => ({ data: 'secret-uuid', error: null }));
  const from = (table: string) => {
    const state = { op: 'select', values: undefined as unknown, filters: [] as Array<[string, unknown]> };
    const chain = {
      select: () => chain,
      eq: (k: string, v: unknown) => { state.filters.push([k, v]); return chain; },
      in: (k: string, v: unknown) => { state.filters.push([k, v]); return chain; },
      upsert: (values: unknown) => { state.op = 'upsert'; state.values = values; return chain; },
      update: (values: unknown) => { state.op = 'update'; state.values = values; return chain; },
      maybeSingle: async () => ({ data: existing, error: null }),
      single: async () => { writes.push({ op: state.op, table, values: state.values, filters: state.filters }); return { data: { id: 'connection-1' }, error: null }; },
      then: (resolve: (v: unknown) => void) => {
        writes.push({ op: state.op, table, values: state.values, filters: state.filters });
        resolve({ data: [{ id: 'connection-1' }], error: null });
      },
    };
    return chain;
  };
  return { db: { from, rpc } as never, writes, rpc };
}

describe('connectWhatsApp', () => {
  it('onboards a WhatsApp Business app number: exchange, verify, subscribe, Vault, save, sync', async () => {
    const meta = happy();
    const { db, writes, rpc } = fakeDb();
    const result = await connectWhatsApp(db, { businessId: BUSINESS, code: 'code-1', phoneNumberId: PHONE, wabaId: WABA }, deps(meta.fetch));

    expect(result).toEqual({ connectionId: 'connection-1', displayPhone: '+1 813-863-2868', synced: true });
    expect(meta.calls.map(c => `${c.method} ${c.path}`)).toEqual([
      'GET oauth/access_token', `GET ${WABA}/phone_numbers`, `POST ${WABA}/subscribed_apps`, `POST ${PHONE}/smb_app_data`, `POST ${PHONE}/smb_app_data`,
    ]);
    expect(meta.calls[0].params.get('code')).toBe('code-1');
    expect(meta.calls.slice(1).every(c => c.auth === 'Bearer business-token')).toBe(true);
    expect(meta.calls.slice(3).map(c => (c.body as { sync_type: string }).sync_type)).toEqual(['smb_app_state_sync', 'history']);
    expect(rpc).toHaveBeenCalledWith('upsert_platform_token', expect.objectContaining({ secret_value: 'business-token', secret_name: `whatsapp_business_token:${PHONE}` }));
    expect(writes[0]).toMatchObject({ op: 'upsert', values: { business_id: BUSINESS, phone_number_id: PHONE, waba_id: WABA, onboarded_via: 'embedded_signup', token_secret_id: 'secret-uuid', status: 'active' } });
    expect(writes[1]).toMatchObject({ op: 'update', values: { sync_requested_at: expect.any(String) } });
    // The token never lands in the connection row.
    expect(JSON.stringify(writes)).not.toContain('business-token');
  });

  it('finds the app number when Meta only returned the account id', async () => {
    const meta = happy({ [`GET ${WABA}/phone_numbers`]: { body: { data: [{ id: '1', is_on_biz_app: false }, { id: PHONE, display_phone_number: '+1 813', is_on_biz_app: true }] } } });
    const { db, writes } = fakeDb();
    await connectWhatsApp(db, { businessId: BUSINESS, code: 'c', phoneNumberId: null, wabaId: WABA }, deps(meta.fetch));
    expect(writes[0]).toMatchObject({ values: { phone_number_id: PHONE } });
  });

  it.each([
    ['the code exchange fails', { 'GET oauth/access_token': { status: 400, body: { error: { code: 100 } } } }, 'exchange', PHONE],
    ['the number is not on that account', {}, 'access', '999'],
    ['the number is not a WhatsApp Business app number', { [`GET ${WABA}/phone_numbers`]: { body: { data: [{ id: PHONE, is_on_biz_app: false }] } } }, 'not_app_number', PHONE],
    ['the account has no app number and Meta gave no phone id', { [`GET ${WABA}/phone_numbers`]: { body: { data: [{ id: PHONE, is_on_biz_app: false }] } } }, 'not_app_number', null],
    ['Meta refuses the webhook subscription', { [`POST ${WABA}/subscribed_apps`]: { status: 403, body: { error: { code: 200 } } } }, 'subscribe', PHONE],
  ] as const)('saves nothing when %s', async (_, overrides, reason, phone) => {
    const meta = happy(overrides);
    const { db, writes, rpc } = fakeDb();
    await expect(connectWhatsApp(db, { businessId: BUSINESS, code: 'c', phoneNumberId: phone, wabaId: WABA }, deps(meta.fetch)))
      .rejects.toMatchObject({ reason });
    expect(writes).toEqual([]);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('refuses a number another business already uses, before subscribing', async () => {
    const meta = happy();
    const { db, writes } = fakeDb({ business_id: OTHER });
    await expect(connectWhatsApp(db, { businessId: BUSINESS, code: 'c', phoneNumberId: PHONE, wabaId: WABA }, deps(meta.fetch)))
      .rejects.toBeInstanceOf(WhatsAppConnectError);
    expect(meta.calls.some(c => c.path.endsWith('subscribed_apps'))).toBe(false);
    expect(writes).toEqual([]);
  });

  it('keeps the connection but reports a failed history sync', async () => {
    const meta = happy({ [`POST ${PHONE}/smb_app_data`]: { status: 400, body: { error: { code: 131000 } } } });
    const { db, writes } = fakeDb();
    const result = await connectWhatsApp(db, { businessId: BUSINESS, code: 'c', phoneNumberId: PHONE, wabaId: WABA }, deps(meta.fetch));
    expect(result.synced).toBe(false);
    expect(writes[1]).toMatchObject({ op: 'update', values: { sync_error: 'smb_app_state_sync failed (Meta 131000)' } });
  });

  it('rejects malformed ids and missing configuration without calling Meta', async () => {
    const meta = happy();
    const { db } = fakeDb();
    await expect(connectWhatsApp(db, { businessId: BUSINESS, code: 'c', phoneNumberId: 'abc', wabaId: WABA }, deps(meta.fetch))).rejects.toMatchObject({ reason: 'access' });
    await expect(connectWhatsApp(db, { businessId: BUSINESS, code: 'c', phoneNumberId: PHONE, wabaId: WABA }, { fetch: meta.fetch })).rejects.toMatchObject({ reason: 'config' });
    expect(meta.calls).toEqual([]);
  });
});

describe('disconnectWhatsAppAccounts', () => {
  it('disconnects active numbers on the removed accounts only', async () => {
    const { db, writes } = fakeDb();
    expect(await disconnectWhatsAppAccounts(db, [WABA, 'bad'])).toBe(1);
    expect(writes[0]).toMatchObject({ op: 'update', values: { status: 'disconnected' }, filters: [['waba_id', [WABA]], ['status', 'active']] });
    expect(await disconnectWhatsAppAccounts(db, [])).toBe(0);
  });
});
