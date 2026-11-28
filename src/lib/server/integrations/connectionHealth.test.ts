import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));

type Row = Record<string, unknown>;
const m = vi.hoisted(() => ({
  rows: [] as Record<string, unknown>[],
  tokens: {} as Record<string, string>,
  notify: vi.fn(), reauth: vi.fn(),
}));

/** Just the filters this module uses, over one in-memory `platform_integrations` table. */
vi.mock('@/lib/server/supabase/admin', () => ({
  createAdminClient: () => ({
    rpc: async (_name: string, args: { secret_id: string }) => ({ data: m.tokens[args.secret_id] ?? null, error: null }),
    from: () => {
      const filters: Array<(row: Row) => boolean> = [];
      let patch: Row | null = null;
      const value = (row: Row, column: string) => column.startsWith('integration_details->>')
        ? (row.integration_details as Row)?.[column.split('->>')[1]] : row[column];
      const query = {
        select: () => query,
        update: (next: Row) => { patch = next; return query; },
        eq: (column: string, wanted: unknown) => { filters.push((row) => value(row, column) === wanted); return query; },
        in: (column: string, wanted: unknown[]) => { filters.push((row) => wanted.includes(value(row, column))); return query; },
        not: (column: string) => { filters.push((row) => row[column] != null); return query; },
        then: (done: (result: { data: Row[]; error: null }) => unknown) => {
          const found = m.rows.filter((row) => filters.every((filter) => filter(row)));
          if (patch) found.forEach((row) => Object.assign(row, patch));
          return Promise.resolve({ data: found, error: null }).then(done);
        },
      };
      return query;
    },
  }),
}));
vi.mock('@/lib/server/integrations/service', () => ({
  resolvePlatformByKey: async () => ({ id: 'meta' }),
  markIntegrationNeedsReauth: async (_db: unknown, id: string) => {
    m.reauth(id);
    const row = m.rows.find((item) => item.id === id);
    if (row) row.status = 'needs_reauth';
  },
}));
vi.mock('@/lib/server/notifications/health', () => ({
  notifyHealth: (input: unknown) => m.notify(input),
  loginRejectedKey: (id: string) => `rejected:${id}`,
}));

import { checkMetaConnectionsDue } from './connectionHealth';

const now = new Date('2026-11-27T12:00:00Z');
const own = (id: string, extra: Row = {}): Row => ({
  id, business_id: `biz-${id}`, platform_id: 'meta', status: 'connected', access_token_secret_id: `secret-${id}`,
  token_expires_at: '2027-02-01T00:00:00Z', integration_details: {}, ...extra,
});
const respond = (status: number, body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status }));

beforeEach(() => {
  m.rows = []; m.tokens = {}; m.notify.mockReset(); m.reauth.mockReset();
  vi.unstubAllGlobals();
});

it('records a working login and stays quiet', async () => {
  m.rows = [own('a')]; m.tokens = { 'secret-a': 'tok' };
  vi.stubGlobal('fetch', respond(200, { id: '1' }));
  expect(await checkMetaConnectionsDue(now)).toEqual({ checked: 1, rejected: 0, expiring: 0 });
  expect((m.rows[0].integration_details as Row).token_checked_at).toEqual(expect.any(String));
  expect(m.notify).not.toHaveBeenCalled();
});

it('marks a rejected login and the client connections borrowing it, with one alert', async () => {
  m.rows = [
    own('op'),
    own('c1', { business_id: 'client-1', access_token_secret_id: 'secret-op', integration_details: { shared_from_business_id: 'biz-op' } }),
    own('c2', { business_id: 'client-2', access_token_secret_id: 'secret-op', integration_details: { shared_from_business_id: 'biz-op' } }),
  ];
  m.tokens = { 'secret-op': 'tok' };
  const fetch = respond(400, { error: { code: 190, type: 'OAuthException' } });
  vi.stubGlobal('fetch', fetch);
  expect(await checkMetaConnectionsDue(now)).toMatchObject({ rejected: 1 });
  expect(fetch).toHaveBeenCalledTimes(1); // Borrowed connections are not checked separately.
  expect(m.reauth.mock.calls.map(([id]) => id).sort()).toEqual(['c1', 'c2', 'op']);
  expect(m.notify).toHaveBeenCalledWith({ businessId: 'biz-op', dedupeKey: 'rejected:op', notice: { kind: 'signInNeeded', clients: 2 } });
});

it('never treats an outage as a broken login, and retries later', async () => {
  m.rows = [own('a')]; m.tokens = { 'secret-a': 'tok' };
  vi.stubGlobal('fetch', respond(500, {}));
  expect(await checkMetaConnectionsDue(now)).toEqual({ checked: 0, rejected: 0, expiring: 0 });
  expect(m.rows[0].status).toBe('connected');
  expect((m.rows[0].integration_details as Row).token_checked_at).toBeUndefined();
});

it('warns once a login is in its last week', async () => {
  m.rows = [own('a', { token_expires_at: '2026-11-30T00:00:00Z' })]; m.tokens = { 'secret-a': 'tok' };
  vi.stubGlobal('fetch', respond(200, { id: '1' }));
  await checkMetaConnectionsDue(now);
  expect(m.notify).toHaveBeenCalledWith({ businessId: 'biz-a', dedupeKey: 'meta-login-expiring:secret-a', notice: { kind: 'signInExpiring', days: 2 } });
});

it('skips logins checked today, already broken, or simulated', async () => {
  m.rows = [
    own('fresh', { integration_details: { token_checked_at: '2026-11-27T06:00:00Z' } }),
    own('broken', { status: 'needs_reauth' }),
    own('sim', { integration_details: { 'deepvisor-meta-phase2': { businessId: 'x' } } }),
  ];
  const fetch = respond(200, {});
  vi.stubGlobal('fetch', fetch);
  expect(await checkMetaConnectionsDue(now)).toEqual({ checked: 0, rejected: 0, expiring: 0 });
  expect(fetch).not.toHaveBeenCalled();
});
