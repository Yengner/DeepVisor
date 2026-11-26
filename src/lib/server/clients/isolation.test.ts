import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const m = vi.hoisted(() => ({ cookie: vi.fn(), set: vi.fn(), remove: vi.fn(), memberships: [] as unknown[], rows: new Map<string, unknown>(), inserted: vi.fn(), rpc: vi.fn() }));

vi.mock('next/headers', () => ({ cookies: async () => ({ get: m.cookie, set: m.set, delete: m.remove }) }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next-intl/server', () => ({ getLocale: async () => 'en' }));
vi.mock('react', () => ({ cache: <T,>(fn: T) => fn }));
vi.mock('@/lib/server/actions/user/session', () => ({ requireUserId: async () => 'user-a' }));
vi.mock('@/lib/server/supabase/server', () => ({ createServerClient: vi.fn() }));
vi.mock('@/lib/server/supabase/admin', () => ({
  createAdminClient: () => ({
    rpc: m.rpc,
    from: (table: string) => {
      const result = () => Promise.resolve({ data: m.rows.get(table) ?? null, error: null });
      const query: Record<string, unknown> = {};
      for (const method of ['select', 'eq', 'is', 'limit', 'delete']) query[method] = () => query;
      query.order = () => (table === 'organization_memberships' ? Promise.resolve({ data: m.memberships, error: null }) : query);
      query.in = () => (table === 'operator_workspaces' ? result() : query);
      query.maybeSingle = result;
      query.insert = (value: unknown) => { m.inserted(table, value); return Promise.resolve({ error: null }); };
      return query;
    },
  }),
}));

import { getExistingOrganizationBusinessContext } from '@/lib/server/actions/business/context';
import { createClientBusiness, linkClientAccount, saveEngagement, switchBusiness } from './actions';

const membership = (name: string, role = 'owner') => ({
  organization_id: `org-${name}`, role,
  organizations: { id: `org-${name}`, name, type: 'business', business_profiles: { id: `business-${name}`, onboarding_completed: true, onboarding_step: 0 } },
});
const chosen = async () => {
  const found = await getExistingOrganizationBusinessContext('user-a');
  return found.kind === 'found' ? found.context.businessId : found.kind;
};

beforeEach(() => {
  vi.clearAllMocks();
  m.memberships = [membership('mine'), membership('client')];
  m.rows = new Map();
});

it('follows the cookie only to a business the user belongs to', async () => {
  m.cookie.mockReturnValue(undefined);
  expect(await chosen()).toBe('business-mine');
  m.cookie.mockReturnValue({ value: 'business-client' });
  expect(await chosen()).toBe('business-client');
  m.cookie.mockReturnValue({ value: 'business-stranger' });
  expect(await chosen()).toBe('business-mine');
});

it('returns to the own business as soon as access is removed', async () => {
  m.cookie.mockReturnValue({ value: 'business-client' });
  m.memberships = [membership('mine')];
  expect(await chosen()).toBe('business-mine');
});

it('switches only into a membership, and drops the previous account choice', async () => {
  expect(await switchBusiness('business-stranger')).toEqual({ ok: false, error: 'notAllowed' });
  expect(m.set).not.toHaveBeenCalled();
  expect(await switchBusiness('business-client')).toMatchObject({ ok: true });
  expect(m.set).toHaveBeenCalledWith('active_business_id', 'business-client', expect.objectContaining({ httpOnly: true }));
  expect(m.remove.mock.calls.map(([name]) => name)).toEqual(['platform_integration_id', 'ad_account_row_id']);
});

it('lets only an operator create businesses or edit client records', async () => {
  m.rows.set('operator_workspaces', []);
  expect(await createClientBusiness({ name: 'Salon' })).toEqual({ ok: false, error: 'notAllowed' });
  expect(await saveEngagement('business-client', { fee: '100' })).toEqual({ ok: false, error: 'notAllowed' });
  expect(await linkClientAccount('business-client', '123')).toEqual({ ok: false, error: 'notAllowed' });
  expect(m.rpc).not.toHaveBeenCalled();
  expect(m.inserted).not.toHaveBeenCalled();
});

it('links only an account saved on the operator connection, to an active client', async () => {
  m.rows.set('operator_workspaces', [{ organization_id: 'org-mine' }]);
  // Not this operator's client.
  expect(await linkClientAccount('business-client', '123')).toEqual({ ok: false, error: 'notAllowed' });
  m.rows.set('client_engagements', { business_id: 'business-client' });
  expect(await linkClientAccount('business-client', '123&x=1')).toEqual({ ok: false, error: 'account' });
  expect(await linkClientAccount('business-client', '999')).toEqual({ ok: false, error: 'account' });
  expect(m.inserted).not.toHaveBeenCalled();
  m.rows.set('ad_accounts', { name: 'Salon account' });
  expect(await linkClientAccount('business-client', 'act_123')).toMatchObject({ ok: true });
  expect(m.inserted).toHaveBeenCalledWith('client_ad_accounts', { external_account_id: '123', business_id: 'business-client', name: 'Salon account' });
});
