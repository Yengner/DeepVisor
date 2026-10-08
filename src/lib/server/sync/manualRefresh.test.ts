import { beforeEach, afterEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('@/lib/server/supabase/admin', () => ({createAdminClient: vi.fn()}));
vi.mock('@/lib/server/repositories/ad_accounts/syncState', () => ({createOrReuseQueuedSyncJob: vi.fn()}));
vi.mock('./manualRefreshStatus', () => ({performanceFingerprint: vi.fn().mockResolvedValue('baseline')}));
vi.mock('@/lib/server/integrations/service', () => ({getPrimaryAdAccountSelection: () => ({externalAccountId:'primary-other-account'})}));
import { createAdminClient } from '@/lib/server/supabase/admin';
import { createOrReuseQueuedSyncJob } from '@/lib/server/repositories/ad_accounts/syncState';
import { runManualBusinessSync } from './manualRefresh';
let details: Record<string, unknown>;
let claimError: Error | null;
const eq = vi.fn();
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-08T01:00:00Z')); vi.clearAllMocks(); details={}; claimError=null;
  const client = { from: (table: string) => {
    const q = { select: vi.fn(), eq, update: vi.fn(), order: vi.fn(), maybeSingle: vi.fn(), single: vi.fn() };
    q.select.mockReturnValue(q); eq.mockReturnValue(q); q.update.mockReturnValue(q);
    q.order.mockImplementation(() => Promise.resolve({data:[{id:'chosen-integration',business_id:'business',platform_id:'meta-platform',platforms:{key:'meta'},status:'connected',integration_details:details,updated_at:'version-before'}],error:null}));
    q.maybeSingle.mockResolvedValue({data:{id:'chosen-account',external_account_id:'act_selected',timezone:'America/New_York'},error:null});
    q.single.mockImplementation(() => Promise.resolve({data:claimError?null:{id:'chosen-integration'},error:claimError}));
    expect(['platform_integrations','ad_accounts']).toContain(table);
    return q;
  }};
  vi.mocked(createAdminClient).mockReturnValue(client as unknown as ReturnType<typeof createAdminClient>);
  vi.mocked(createOrReuseQueuedSyncJob).mockResolvedValue({id:'job',ad_account_id:'chosen-account',business_id:'business',platform_integration_id:'chosen-integration',status:'queued',sync_type:'manual_refresh'} as Awaited<ReturnType<typeof createOrReuseQueuedSyncJob>>);
});
afterEach(() => vi.useRealTimers());
const input = {businessId:'business',platformKey:'meta' as const,integrationId:'chosen-integration',adAccountId:'chosen-account'};
it('queues the authorized selection, not a different saved primary, with the account-local window and baseline', async () => {
  expect(await runManualBusinessSync(input)).toMatchObject({allowed:true,refreshedCount:1});
  expect(eq).toHaveBeenCalledWith('id','chosen-account');
  expect(eq).toHaveBeenCalledWith('platform_id','meta-platform');
  expect(eq).toHaveBeenCalledWith('updated_at','version-before');
  expect(createOrReuseQueuedSyncJob).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({adAccountId:'chosen-account',requestedStartDate:'2026-09-08',requestedEndDate:'2026-10-07',metadata:expect.objectContaining({externalAccountId:'act_selected',last_processed_ids:{performanceFingerprint:'baseline'}})}));
});
it('rejects a stale concurrent cooldown claim before queue insertion', async () => {
  claimError=new Error('concurrent update');
  await expect(runManualBusinessSync(input)).rejects.toThrow('concurrent update');
  expect(createOrReuseQueuedSyncJob).not.toHaveBeenCalled();
});
it('keeps the cooldown and does not enqueue while it is active', async () => {
  details={manual_sync_rate_limit:{nextAllowedAt:'2026-10-08T01:01:00Z'}};
  expect(await runManualBusinessSync(input)).toMatchObject({allowed:false,retryAfterMs:60000});
  expect(createOrReuseQueuedSyncJob).not.toHaveBeenCalled();
});
it('does not report a persisted job when insertion fails', async () => {
  vi.mocked(createOrReuseQueuedSyncJob).mockRejectedValue(new Error('database write failed'));
  expect(await runManualBusinessSync(input)).toMatchObject({allowed:true,refreshedCount:0,failedCount:1,jobs:[]});
});
