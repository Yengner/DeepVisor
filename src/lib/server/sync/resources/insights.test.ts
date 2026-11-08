import { afterEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const state = vi.hoisted(() => ({ generation: 1, from: vi.fn(), rpc: vi.fn() }));
vi.mock('@/lib/server/supabase/admin', () => ({ createAdminClient: () => ({ from: state.from, rpc: state.rpc }) }));
import { withSyncLease } from '@/lib/server/supabase/syncLeaseContext';
import { syncSavedInsights } from './insights';
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
it('refuses to refresh optional insights outside a claimed worker', async () => {
  vi.stubEnv('DEEPVISOR_RESOURCE_REFRESH', 'true');
  await expect(syncSavedInsights('job', 'private-token')).rejects.toThrow('claimed worker');
  expect(state.from).not.toHaveBeenCalled();
});
it('cannot borrow a replacement worker generation for optional publication', async () => {
  vi.stubEnv('DEEPVISOR_RESOURCE_REFRESH', 'true');
  const query = { select: () => query, eq: () => query, single: async () => ({ data: { lease_generation: 2 }, error: null }) };
  state.from.mockReturnValue(query);
  await expect(withSyncLease('job', 1, () => syncSavedInsights('job', 'private-token'))).rejects.toThrow('Expired insight writer lease');
  expect(state.rpc).not.toHaveBeenCalled();
});
it('does not add optional provider work while the rollout gate is off', async () => {
  vi.stubEnv('DEEPVISOR_RESOURCE_REFRESH', 'false');
  await syncSavedInsights('job', 'private-token');
  expect(state.from).not.toHaveBeenCalled();
});
