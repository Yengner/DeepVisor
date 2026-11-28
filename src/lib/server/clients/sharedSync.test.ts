import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));

type Row = Record<string, unknown>;
const m = vi.hoisted(() => ({
  tables: {} as Record<string, Record<string, unknown>[]>,
  discover: vi.fn(), select: vi.fn(), dispatch: vi.fn(), release: vi.fn(), disconnect: vi.fn(), rpc: vi.fn(),
}));

/** A small in-memory stand-in for the filters this module uses. */
vi.mock('@/lib/server/supabase/admin', () => ({
  createAdminClient: () => ({
    rpc: m.rpc,
    from: (table: string) => {
      const filters: Array<(row: Row) => boolean> = [];
      let write: { kind: 'upsert' | 'update'; value: Row } | null = null;
      const value = (row: Row, column: string) => column.startsWith('integration_details->>')
        ? (row.integration_details as Row | undefined)?.[column.split('->>')[1]] : row[column];
      const run = () => {
        const rows = (m.tables[table] ??= []);
        if (write?.kind === 'upsert') {
          const next = write.value;
          let row = rows.find((item) => item.business_id === next.business_id && item.platform_id === next.platform_id);
          if (row) Object.assign(row, next);
          else rows.push(row = { id: `new-${next.business_id}`, ...next });
          return [row];
        }
        const found = rows.filter((row) => filters.every((filter) => filter(row)));
        if (write) found.forEach((row) => Object.assign(row, write!.value));
        return found;
      };
      const query = {
        select: () => query, limit: () => query,
        eq: (column: string, wanted: unknown) => { filters.push((row) => value(row, column) === wanted); return query; },
        in: (column: string, wanted: unknown[]) => { filters.push((row) => wanted.includes(value(row, column))); return query; },
        upsert: (next: Row) => { write = { kind: 'upsert', value: next }; return query; },
        update: (next: Row) => { write = { kind: 'update', value: next }; return query; },
        maybeSingle: async () => ({ data: run()[0] ?? null, error: null }),
        single: async () => ({ data: run()[0] ?? null, error: null }),
        then: (done: (result: { data: Row[]; error: null }) => unknown) => Promise.resolve({ data: run(), error: null }).then(done),
      };
      return query;
    },
  }),
}));
vi.mock('@/lib/server/integrations/service', () => ({ resolvePlatformByKey: async () => ({ id: 'meta' }), softDisconnectIntegration: m.disconnect }));
vi.mock('@/lib/server/integrations/metaSelection', () => ({ syncSelectedMetaAdAccount: m.select }));
vi.mock('@/lib/server/sync/meta/discoverMetaAdAccounts', () => ({ discoverMetaAdAccounts: m.discover }));
vi.mock('@/lib/server/sync/dispatch', () => ({ dispatchAccountSync: m.dispatch }));
vi.mock('@/lib/server/webhooks/subscription', () => ({ releaseIntegrationWebhooks: m.release }));

import { refreshSharedConnections, startClientSync, stopClientSync, stopSharedConnections, syncedClientAccount } from './sharedSync';

const operator = { organizationId: 'org-mine', businessId: 'mine' };
const start = (businessId = 'salon', accountNumber = '123') => startClientSync({ operator, userId: 'user-a', businessId, accountNumber });
const own = (): Row => ({
  id: 'own', business_id: 'mine', platform_id: 'meta', status: 'connected', access_token_secret_id: 'secret-1',
  token_expires_at: '2999-01-01T00:00:00Z', scopes: ['ads_read'],
  integration_details: { meta_user_id: 'fb-1', primary_ad_account_external_id: 'act_999', page_id: 'my-page' },
});
const account = (number: string) => ({ business_id: 'mine', platform_id: 'meta', external_account_id: `act_${number}`, name: `Account ${number}`, status: 'active', currency_code: 'USD', timezone: 'America/New_York' });
const connection = (businessId: string) => m.tables.platform_integrations.find((row) => row.business_id === businessId)!;

beforeEach(() => {
  vi.resetAllMocks();
  m.release.mockResolvedValue(undefined);
  m.select.mockResolvedValue({ syncJobId: 'job-1', firstSyncJob: { status: 'queued' } });
  m.tables = { platform_integrations: [own()], ad_accounts: [account('123'), account('999')] };
});

it('shares the stored token by reference and registers only the linked account', async () => {
  expect(await start()).toEqual({ ok: true });
  expect(connection('salon')).toMatchObject({ access_token_secret_id: 'secret-1', status: 'connected', token_expires_at: '2999-01-01T00:00:00Z' });
  // Nothing about the operator's own choices travels with the token.
  expect(connection('salon').integration_details).toEqual({ shared_from_business_id: 'mine', meta_user_id: 'fb-1', status: 'connected', disconnected_at: null, last_error: null });
  expect(m.rpc).not.toHaveBeenCalled();
  const registered = m.discover.mock.calls[0][0];
  expect(registered.businessId).toBe('salon');
  expect(registered.snapshots.map((row: { externalAccountId: string }) => row.externalAccountId)).toEqual(['act_123']);
  expect(m.select).toHaveBeenCalledWith(expect.objectContaining({ businessId: 'salon', externalAccountId: 'act_123' }));
  expect(m.dispatch).toHaveBeenCalledWith('job-1', 'salon');
});

it('refuses without a working connection of the operator', async () => {
  for (const change of [{ status: 'disconnected' }, { access_token_secret_id: null }, { token_expires_at: '2000-01-01T00:00:00Z' }, { integration_details: { shared_from_business_id: 'other' } }]) {
    m.tables.platform_integrations = [{ ...own(), ...change }];
    expect(await start()).toEqual({ ok: false, error: 'noConnection' });
  }
  expect(m.discover).not.toHaveBeenCalled();
  expect(m.select).not.toHaveBeenCalled();
});

it('refuses the operator business, unknown accounts and a client with its own sign-in', async () => {
  expect(await start('mine')).toEqual({ ok: false, error: 'account' });
  expect(await start('salon', '555')).toEqual({ ok: false, error: 'account' });
  m.tables.platform_integrations.push({ id: 'theirs', business_id: 'salon', platform_id: 'meta', status: 'connected', access_token_secret_id: 'their-secret', integration_details: {} });
  expect(await start()).toEqual({ ok: false, error: 'ownConnection' });
  expect(connection('salon').access_token_secret_id).toBe('their-secret');
  expect(m.select).not.toHaveBeenCalled();
});

it('reports the synced account only for a borrowed connection', async () => {
  expect(await syncedClientAccount('mine')).toBeNull();
  await start();
  Object.assign(connection('salon').integration_details as Row, { primary_ad_account_external_id: 'act_123' });
  expect(await syncedClientAccount('salon')).toBe('123');
});

it('stops borrowed connections without touching the operator connection', async () => {
  await start();
  await start('spa', '999');
  await stopClientSync('mine');
  expect(m.disconnect).not.toHaveBeenCalled();
  await stopSharedConnections('mine');
  expect(m.disconnect.mock.calls.map(([, input]) => input.businessId)).toEqual(['salon', 'spa']);
  m.disconnect.mockClear();
  await stopSharedConnections('stranger');
  expect(m.disconnect).not.toHaveBeenCalled();
});

it('gives running client connections the new expiry after the operator signs in again', async () => {
  await start();
  Object.assign(connection('mine'), { token_expires_at: '2999-06-01T00:00:00Z' });
  Object.assign(connection('salon'), { status: 'needs_reauth' });
  await refreshSharedConnections('mine', 'meta');
  expect(connection('salon')).toMatchObject({ status: 'connected', token_expires_at: '2999-06-01T00:00:00Z' });
});
