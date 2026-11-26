import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
vi.mock('server-only', () => ({}));
const m = vi.hoisted(() => ({ context: vi.fn(), managed: vi.fn(), state: vi.fn(), url: vi.fn() }));
vi.mock('@/lib/server/integrations/simulation/meta', () => ({ simulationForUser: () => null }));
vi.mock('@/lib/server/supabase/server', () => ({ createServerClient: async () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }) }));
vi.mock('@/lib/server/actions/user/session', () => ({ requireUserId: async () => 'user-a' }));
vi.mock('@/lib/server/actions/business/context', () => ({ getOrCreateOrganizationBusinessContext: m.context }));
vi.mock('@/lib/server/clients/operator', () => ({ isManagedClient: m.managed }));
vi.mock('@/lib/server/integrations/adapters/meta', () => ({ buildMetaOAuthUrl: m.url }));
vi.mock('@/lib/server/integrations/service', () => ({
  buildIntegrationResultPath: () => '/integration?status=error',
  createOAuthState: m.state,
  getBaseUrl: () => 'http://localhost',
  parseSupportedIntegrationPlatform: () => 'meta',
  resolvePlatformByKey: async () => ({ id: 'meta' }),
  sanitizeReturnTo: () => '/integration',
}));
import { GET } from './route';

const connect = () => GET(new NextRequest('http://localhost/api/integrations/connect/meta'), { params: Promise.resolve({ platform: 'meta' }) });

beforeEach(() => {
  vi.resetAllMocks();
  m.context.mockResolvedValue({ businessId: 'business-a', role: 'owner' });
  m.state.mockResolvedValue('state');
  m.url.mockReturnValue('https://www.facebook.com/dialog/oauth');
});

it('never starts Meta sign-in inside a managed client business', async () => {
  m.managed.mockResolvedValue(true);
  expect((await connect()).headers.get('location')).toContain('status=error');
  expect(m.state).not.toHaveBeenCalled();
});

it('fails closed when the client check cannot be read', async () => {
  m.managed.mockRejectedValue(new Error('unavailable'));
  expect((await connect()).headers.get('location')).toContain('status=error');
  expect(m.state).not.toHaveBeenCalled();
});

it('refuses a member, and lets an owner of their own business continue', async () => {
  m.context.mockResolvedValue({ businessId: 'business-a', role: 'member' });
  await connect();
  expect(m.state).not.toHaveBeenCalled();
  m.context.mockResolvedValue({ businessId: 'business-a', role: 'owner' });
  m.managed.mockResolvedValue(false);
  expect((await connect()).headers.get('location')).toBe('https://www.facebook.com/dialog/oauth');
});
