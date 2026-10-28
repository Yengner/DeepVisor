import { beforeEach,expect,it,vi } from 'vitest';
import { NextRequest } from 'next/server';
vi.mock('server-only',()=>({}));vi.mock('@/lib/server/sync/scheduledRefresh',()=>({enqueueScheduledAccountSyncJobs:vi.fn()}));
import { enqueueScheduledAccountSyncJobs } from '@/lib/server/sync/scheduledRefresh';
import { POST } from './route';
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv('INTERNAL_API_KEY','internal-test');});
it('requires the internal credential even when a business scope is supplied',async()=>{
 expect((await POST(new NextRequest('https://app.test/api/sync/scheduled-refresh',{method:'POST',body:'{"businessId":"foreign"}'}))).status).toBe(401);
 expect(enqueueScheduledAccountSyncJobs).not.toHaveBeenCalled();
});
it('passes the two-hour job freshness and bounded lookback to the shared enqueuer',async()=>{
 vi.mocked(enqueueScheduledAccountSyncJobs).mockResolvedValue({consideredCount:1,queuedCount:1,skippedCount:0,failedCount:0,results:[]});
 expect((await POST(new NextRequest('https://app.test/api/sync/scheduled-refresh',{method:'POST',headers:{'x-internal-api-key':'internal-test'},body:'{"staleAfterMinutes":90,"lookbackDays":7}'}))).status).toBe(200);
 expect(enqueueScheduledAccountSyncJobs).toHaveBeenCalledWith(expect.objectContaining({staleAfterMinutes:90,lookbackDays:7}));
});
