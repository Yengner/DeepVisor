import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { redirect } from 'next/navigation';
vi.mock('server-only', () => ({}));
const m=vi.hoisted(()=>({context:vi.fn(),pages:vi.fn(),update:vi.fn(),eq:vi.fn()}));
vi.mock('@/lib/server/actions/app/context',()=>({getRequiredAppContext:m.context}));
vi.mock('@/lib/server/actions/meta/pages/actions',()=>({getMetaPages:m.pages}));
vi.mock('@/lib/server/supabase/admin',()=>({createAdminClient:()=>({from:()=>({update:(value:unknown)=>{m.update(value);return {eq:m.eq};}})})}));
import { POST } from './route';
const request=(body:Record<string,unknown>={})=>new NextRequest('http://localhost/api/integrations/meta/page-whatsapp-setup',{method:'POST',body:JSON.stringify({integrationId:'integration-a',pageId:'page-a',whatsappNumberSource:'page_phone_confirmed',...body})});
beforeEach(()=>{
 vi.resetAllMocks();m.context.mockImplementation(async(completed=true)=>{if(completed)redirect('/onboarding');return {businessId:'business-a'};});
 m.pages.mockResolvedValue({success:true,data:[{id:'saved-page-a',page_id:'page-a',name:'Synthetic Salon',phone:'+1 (555) 123-4567'}]});
 m.eq.mockResolvedValue({error:null});
});
it('saves a confirmed Page phone during incomplete onboarding in authenticated business scope',async()=>{
 const response=await POST(request({businessId:'foreign-business',whatsappNumber:'+19999999999'}));
 expect(response.status).toBe(200);expect(m.context).toHaveBeenCalledWith(false);
 expect(m.pages).toHaveBeenCalledWith({platformId:'integration-a',adAccountId:null});
 expect(m.eq).toHaveBeenCalledWith('id','business-a');
 expect(m.update).toHaveBeenCalledWith(expect.objectContaining({meta_page_id:'page-a',page_phone:'+15551234567',whatsapp_number:'+15551234567',whatsapp_number_source:'page_phone_confirmed',whatsapp_setup_completed:true}));
 expect((await response.json()).data.whatsappSetup.whatsappNumber).toBe('+15551234567');
});
it('preserves authentication redirects instead of returning NEXT_REDIRECT as a 500',async()=>{
 m.context.mockImplementation(async()=>redirect('/login'));
 await expect(POST(request())).rejects.toMatchObject({digest:expect.stringContaining('NEXT_REDIRECT')});
 expect(m.pages).not.toHaveBeenCalled();expect(m.update).not.toHaveBeenCalled();
});
it('rejects a Page outside the authorized integration without writing',async()=>{
 expect((await POST(request({pageId:'foreign-page'}))).status).toBe(400);expect(m.update).not.toHaveBeenCalled();
});
it('does not write when integration discovery rejects access',async()=>{
 m.pages.mockResolvedValue({success:false,error:{code:'INTEGRATION_ERROR',userMessage:'Connect Meta first.'}});
 expect((await POST(request())).status).toBe(502);expect(m.update).not.toHaveBeenCalled();
});
it('reports real persistence failures',async()=>{
 m.eq.mockResolvedValue({error:new Error('Database unavailable')});
 expect((await POST(request())).status).toBe(500);
});
it.each([
 {whatsappNumberSource:'manual',whatsappNumber:'+1 (555) 987-6543',expected:'+15559876543'},
 {whatsappNumberSource:'skipped',expected:null},
])('supports onboarding alternative $whatsappNumberSource',async({expected,...body})=>{
 expect((await POST(request(body))).status).toBe(200);
 expect(m.update).toHaveBeenCalledWith(expect.objectContaining({whatsapp_number:expected}));
});
