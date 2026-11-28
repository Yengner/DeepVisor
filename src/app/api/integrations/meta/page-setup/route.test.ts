import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { redirect } from 'next/navigation';
vi.mock('server-only', () => ({}));
const m=vi.hoisted(()=>({context:vi.fn(),pages:vi.fn(),update:vi.fn(),eq:vi.fn()}));
vi.mock('@/lib/server/actions/app/context',()=>({getRequiredAppContext:m.context}));
vi.mock('@/lib/server/actions/meta/pages/actions',()=>({getMetaPages:m.pages}));
vi.mock('@/lib/server/supabase/admin',()=>({createAdminClient:()=>({from:()=>({update:(value:unknown)=>{m.update(value);return {eq:m.eq};}})})}));
import { POST } from './route';
const request=(body:Record<string,unknown>={})=>new NextRequest('http://localhost/api/integrations/meta/page-setup',{method:'POST',body:JSON.stringify({integrationId:'integration-a',pageId:'page-a',...body})});
beforeEach(()=>{
 vi.resetAllMocks();m.context.mockImplementation(async(completed=true)=>{if(completed)redirect('/onboarding');return {businessId:'business-a',role:'owner'};});
 m.pages.mockResolvedValue({success:true,data:[{id:'saved-page-a',page_id:'page-a',name:'Synthetic Salon',phone:'+1 (555) 123-4567'}]});
 m.eq.mockResolvedValue({error:null});
});
it('saves the Page during incomplete onboarding in the signed-in business, leaving WhatsApp alone',async()=>{
 const response=await POST(request({businessId:'foreign-business',whatsappNumber:'+19999999999'}));
 expect(response.status).toBe(200);expect(m.context).toHaveBeenCalledWith(false);
 expect(m.pages).toHaveBeenCalledWith({platformId:'integration-a',adAccountId:null});
 expect(m.eq).toHaveBeenCalledWith('id','business-a');
 const saved=m.update.mock.calls[0][0];
 expect(saved).toMatchObject({meta_page_id:'page-a',page_phone:'+15551234567'});
 expect(Object.keys(saved).filter(key=>key.startsWith('whatsapp'))).toEqual([]);
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
it('refuses a member without calling Meta or writing',async()=>{
 m.context.mockResolvedValue({businessId:'business-a',role:'member'});
 expect((await POST(request())).status).toBe(403);
 expect(m.pages).not.toHaveBeenCalled();expect(m.update).not.toHaveBeenCalled();
});
