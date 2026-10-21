import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
vi.mock('server-only', () => ({}));
const m=vi.hoisted(()=>({ context:vi.fn(),integration:vi.fn(),select:vi.fn(),worker:vi.fn(),job:vi.fn(),coverage:vi.fn(),account:vi.fn() }));
vi.mock('@/lib/server/actions/app/context',()=>({getRequiredAppContext:m.context}));
vi.mock('@/lib/server/integrations/service',()=>({getBusinessIntegrationById:m.integration}));
vi.mock('@/lib/server/integrations/metaSelection',()=>({syncSelectedMetaAdAccount:m.select,applyAppSelectionCookies:vi.fn()}));
vi.mock('@/lib/server/sync/meta/processBackfillJobs',()=>({processMetaBackfillJobs:m.worker}));
vi.mock('@/lib/server/repositories/ad_accounts/syncState',()=>({getAccountSyncJobById:m.job,getAdAccountSyncCoverage:m.coverage,buildFirstSyncJobStatus:vi.fn()}));
vi.mock('@/lib/server/supabase/admin',()=>({createAdminClient:()=>({from:()=>{const q={select:()=>q,eq:()=>q,maybeSingle:m.account};return q;}})}));
import { POST } from './route';
const request=(body:unknown)=>new NextRequest('http://localhost/api/integrations/meta/select-ad-account',{method:'POST',body:JSON.stringify(body)});
beforeEach(()=>{
 vi.resetAllMocks();m.context.mockResolvedValue({businessId:'business-a'});
 m.integration.mockResolvedValue({id:'integration-a',platformKey:'meta',platformId:'meta'});
 m.account.mockResolvedValue({data:{external_account_id:'act_a',name:'A'},error:null});
});
it('rejects malformed selection before privileged reads',async()=>{
 expect((await POST(request({}))).status).toBe(400);expect(m.integration).not.toHaveBeenCalled();
});
it('allows an authenticated incomplete onboarding context and scopes integration access',async()=>{
 m.integration.mockResolvedValue(null);
 expect((await POST(request({integrationId:'foreign',externalAccountId:'foreign'}))).status).toBe(404);
 expect(m.context).toHaveBeenCalledWith(false);
 expect(m.integration).toHaveBeenCalledWith(expect.anything(),{businessId:'business-a',integrationId:'foreign'});
 expect(m.worker).not.toHaveBeenCalled();
});
it('rejects a forged external account',async()=>{
 m.account.mockResolvedValue({data:null,error:null});
 expect((await POST(request({integrationId:'integration-a',externalAccountId:'foreign'}))).status).toBe(400);
 expect(m.select).not.toHaveBeenCalled();
});
it('processes a queued follow-up selection before claiming success',async()=>{
 m.select.mockResolvedValue({integrationId:'integration-a',adAccountId:'account-a',externalAccountId:'act_a',syncJobId:'job-a',firstSyncJob:null});
 m.worker.mockResolvedValue({results:[{jobId:'job-a',status:'completed'}]});m.job.mockResolvedValue({id:'job-a',status:'completed'});
 expect((await POST(request({integrationId:'integration-a',externalAccountId:'act_a'}))).status).toBe(200);
 expect(m.worker).toHaveBeenCalledWith({limit:1,targetJobId:'job-a'});
});
it('never reports a failed worker as a successful selection',async()=>{
 m.select.mockResolvedValue({syncJobId:'job-a',firstSyncJob:null});m.worker.mockResolvedValue({results:[{jobId:'job-a',status:'failed',message:'Provider timeout'}]});m.job.mockResolvedValue({status:'failed'});
 expect((await POST(request({integrationId:'integration-a',externalAccountId:'act_a'}))).status).toBe(500);
});
