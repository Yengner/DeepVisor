import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
vi.mock('server-only', () => ({}));
const m=vi.hoisted(()=>({ context:vi.fn(),integration:vi.fn(),select:vi.fn(),dispatch:vi.fn(),account:vi.fn(),managed:vi.fn() }));
vi.mock('@/lib/server/clients/operator',()=>({isManagedClient:m.managed}));
vi.mock('@/lib/server/actions/app/context',()=>({getRequiredAppContext:m.context}));
vi.mock('@/lib/server/integrations/service',()=>({getBusinessIntegrationById:m.integration}));
vi.mock('@/lib/server/integrations/metaSelection',()=>({syncSelectedMetaAdAccount:m.select,applyAppSelectionCookies:vi.fn()}));
vi.mock('@/lib/server/sync/dispatch',()=>({dispatchAccountSync:m.dispatch}));
vi.mock('@/lib/server/supabase/admin',()=>({createAdminClient:()=>({from:()=>{const q={select:()=>q,eq:()=>q,maybeSingle:m.account};return q;}})}));
import { POST } from './route';
const request=(body:unknown)=>new NextRequest('http://localhost/api/integrations/meta/select-ad-account',{method:'POST',body:JSON.stringify(body)});
beforeEach(()=>{
 vi.resetAllMocks();m.context.mockResolvedValue({businessId:'business-a',role:'owner'});
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
 expect(m.dispatch).not.toHaveBeenCalled();
});
it('leaves a client business to its Business details page',async()=>{
 m.managed.mockResolvedValue(true);
 expect((await POST(request({integrationId:'integration-a',externalAccountId:'act_a'}))).status).toBe(403);
 expect(m.integration).not.toHaveBeenCalled();expect(m.select).not.toHaveBeenCalled();
});
it('rejects a forged external account',async()=>{
 m.account.mockResolvedValue({data:null,error:null});
 expect((await POST(request({integrationId:'integration-a',externalAccountId:'foreign'}))).status).toBe(400);
 expect(m.select).not.toHaveBeenCalled();
});
it('answers right away and starts the queued sync in the background',async()=>{
 m.select.mockResolvedValue({integrationId:'integration-a',adAccountId:'account-a',externalAccountId:'act_a',syncJobId:'job-a',firstSyncJob:{jobId:'job-a',status:'queued'},syncCoverage:null});
 const response=await POST(request({integrationId:'integration-a',externalAccountId:'act_a'}));
 expect(response.status).toBe(200);
 expect(m.dispatch).toHaveBeenCalledWith('job-a','business-a');
 expect((await response.json()).data).toMatchObject({syncJobId:'job-a',firstSyncJob:{status:'queued'}});
});
it('does not start anything when there is no job or it already finished',async()=>{
 m.select.mockResolvedValue({integrationId:'integration-a',syncJobId:null,firstSyncJob:null});
 expect((await POST(request({integrationId:'integration-a',externalAccountId:'act_a'}))).status).toBe(200);
 m.select.mockResolvedValue({integrationId:'integration-a',syncJobId:'job-a',firstSyncJob:{status:'completed'}});
 expect((await POST(request({integrationId:'integration-a',externalAccountId:'act_a'}))).status).toBe(200);
 expect(m.dispatch).not.toHaveBeenCalled();
});
it('reports a selection failure instead of success',async()=>{
 m.select.mockRejectedValue(new Error('Service temporarily unavailable'));
 const response=await POST(request({integrationId:'integration-a',externalAccountId:'act_a'}));
 expect(response.status).toBe(500);
 expect((await response.json()).error.userMessage).toMatch(/temporarily unavailable/);
 expect(m.dispatch).not.toHaveBeenCalled();
});
it('refuses a member before any privileged read or sync',async()=>{
 m.context.mockResolvedValue({businessId:'business-a',role:'member'});
 expect((await POST(request({integrationId:'integration-a',externalAccountId:'act_a'}))).status).toBe(403);
 expect(m.integration).not.toHaveBeenCalled();expect(m.select).not.toHaveBeenCalled();
});
