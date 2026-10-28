import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
vi.mock('server-only',()=>({}));
vi.mock('next/cache',()=>({revalidateTag:vi.fn()}));
vi.mock('@/lib/server/actions/app/context',()=>({getRequiredAppContext:vi.fn()}));
vi.mock('@/lib/server/actions/app/selection',()=>({resolveCurrentSelection:vi.fn()}));
vi.mock('@/lib/server/supabase/admin',()=>({createAdminClient:vi.fn()}));
vi.mock('@/lib/server/sync/automaticRefresh',()=>({enqueueAutomaticAccountSync:vi.fn(),targetedSimulationAllowed:()=>false}));
vi.mock('@/lib/server/sync/dispatch',()=>({dispatchAccountSync:vi.fn()}));
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import { resolveCurrentSelection } from '@/lib/server/actions/app/selection';
import { enqueueAutomaticAccountSync } from '@/lib/server/sync/automaticRefresh';
import { dispatchAccountSync } from '@/lib/server/sync/dispatch';
import { createAdminClient } from '@/lib/server/supabase/admin';
import { revalidateTag } from 'next/cache';
import { GET,POST } from './route';
const request=(body='{}',origin='https://app.test')=>new NextRequest('https://app.test/api/sync/automatic-refresh',{method:'POST',headers:{origin,'content-type':'application/json'},body});
beforeEach(()=>{
 vi.clearAllMocks();vi.mocked(getRequiredAppContext).mockResolvedValue({businessId:'authorized'} as Awaited<ReturnType<typeof getRequiredAppContext>>);
 vi.mocked(resolveCurrentSelection).mockResolvedValue({selectedPlatformId:'integration',selectedAdAccountId:'account'});
 vi.mocked(enqueueAutomaticAccountSync).mockResolvedValue({status:'queued',reason:'enqueued',jobId:'job'});
});
it('queues only server-authorized selected scope and dispatches the existing worker without reporting completion',async()=>{
 const response=await POST(request());expect(response.status).toBe(202);expect(await response.json()).toMatchObject({status:'queued'});
 expect(enqueueAutomaticAccountSync).toHaveBeenCalledWith({businessId:'authorized',integrationId:'integration',adAccountId:'account',source:'app_visit',allowSimulation:false});
 expect(dispatchAccountSync).toHaveBeenCalledWith('job','authorized');expect(revalidateTag).not.toHaveBeenCalled();
});
it.each(['{"businessId":"forged"}','{"adAccountId":"forged"}','bad','[]'])('rejects malformed or browser-supplied scope: %s',async body=>{
 expect((await POST(request(body))).status).toBe(400);expect(enqueueAutomaticAccountSync).not.toHaveBeenCalled();
});
it('rejects cross-origin requests and unauthorized sessions',async()=>{
 expect((await POST(request('{}','https://evil.test'))).status).toBe(403);
 vi.mocked(getRequiredAppContext).mockRejectedValue(new Error('Private auth detail'));
 const response=await POST(request());expect(response.status).toBe(500);expect(await response.text()).not.toContain('Private');expect(enqueueAutomaticAccountSync).not.toHaveBeenCalled();
});
it('does not dispatch fresh accounts or replay a running claim',async()=>{
 vi.mocked(enqueueAutomaticAccountSync).mockResolvedValue({status:'skipped',reason:'fresh'});expect((await POST(request())).status).toBe(200);
 vi.mocked(enqueueAutomaticAccountSync).mockResolvedValue({status:'running',reason:'existing_job',jobId:'job'});expect((await POST(request())).status).toBe(202);expect(dispatchAccountSync).not.toHaveBeenCalled();
});
it('reads only selected jobs, exposes actual failure and retains prior successful time',async()=>{
 const eq=vi.fn();const client={from:(table:string)=>{
   const q={select:()=>q,eq,order:()=>q,limit:()=>q,maybeSingle:vi.fn()};eq.mockReturnValue(q);
   q.maybeSingle.mockResolvedValue({error:null,data:table==='ad_account_sync_state'?{last_successful_sync_job_id:'success'}:{id:'failed',status:'failed',finished_at:'2026-10-23T12:00:00Z'}});
   return q;
 }};
 vi.mocked(createAdminClient).mockReturnValue(client as unknown as ReturnType<typeof createAdminClient>);
 const result=await GET(new NextRequest('https://app.test/api/sync/automatic-refresh?businessId=forged'));
 expect(await result.json()).toMatchObject({status:'failed',lastSuccessfulAt:'2026-10-23T12:00:00Z'});
 expect(eq).toHaveBeenCalledWith('business_id','authorized');expect(eq).toHaveBeenCalledWith('ad_account_id','account');expect(eq).toHaveBeenCalledWith('platform_integration_id','integration');
});
