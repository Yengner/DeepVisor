import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
vi.mock('server-only', () => ({}));
const m = vi.hoisted(() => ({ context: vi.fn(), disconnect: vi.fn(), release: vi.fn(), stopShared: vi.fn() }));
vi.mock('@/lib/server/clients/sharedSync', () => ({ stopSharedConnections: m.stopShared }));
vi.mock('@/lib/server/actions/user/session', () => ({ requireUserId: async () => 'user-a' }));
vi.mock('@/lib/server/actions/business/context', () => ({ getOrCreateOrganizationBusinessContext: m.context }));
vi.mock('@/lib/server/integrations/service', () => ({ softDisconnectIntegration: m.disconnect }));
vi.mock('@/lib/server/webhooks/subscription', () => ({ releaseIntegrationWebhooks: m.release }));
vi.mock('@/lib/server/supabase/admin', () => ({ createAdminClient: () => ({}) }));
import { POST } from './route';

const request = () => new NextRequest('http://localhost/api/integrations/disconnect', { method: 'POST', body: JSON.stringify({ integrationId: 'integration-a' }) });

beforeEach(() => {
  vi.resetAllMocks();
  m.release.mockResolvedValue(undefined);
});

it('refuses a member and leaves the connection and its token alone', async () => {
  m.context.mockResolvedValue({ businessId: 'business-a', role: 'member' });
  expect((await POST(request())).status).toBe(403);
  expect(m.release).not.toHaveBeenCalled();
  expect(m.disconnect).not.toHaveBeenCalled();
  expect(m.stopShared).not.toHaveBeenCalled();
});

it.each(['owner', 'admin'])('lets an %s disconnect only their own business', async (role) => {
  m.context.mockResolvedValue({ businessId: 'business-a', role });
  expect((await POST(request())).status).toBe(200);
  expect(m.disconnect).toHaveBeenCalledWith(expect.anything(), { integrationId: 'integration-a', businessId: 'business-a' });
});

it('stops client syncing first, and keeps the connection if that fails', async () => {
  m.context.mockResolvedValue({ businessId: 'business-a', role: 'owner' });
  await POST(request());
  expect(m.stopShared).toHaveBeenCalledWith('business-a');
  expect(m.stopShared.mock.invocationCallOrder[0]).toBeLessThan(m.disconnect.mock.invocationCallOrder[0]);
  m.disconnect.mockClear();
  m.stopShared.mockRejectedValue(new Error('unavailable'));
  expect((await POST(request())).status).toBe(500);
  expect(m.disconnect).not.toHaveBeenCalled();
});
