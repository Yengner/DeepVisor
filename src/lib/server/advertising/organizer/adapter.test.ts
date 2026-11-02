import {afterEach,expect,it,vi} from 'vitest';
vi.mock('server-only',()=>({}));
import {MetaRenameAdapter} from './adapter';
import type {RenameChange} from '@/lib/shared/organizer/renamePlan';
const c:RenameChange={entityId:'internal',before:{id:'123',level:'ad',accountId:'10',parentId:'20',name:'Old',updatedAt:'2026-01-01',creativeId:'30'},afterName:'New'};
afterEach(()=>vi.unstubAllEnvs());
it('is disabled by default and sends no request when a write is disabled',async()=>{vi.stubEnv('DEEPVISOR_META_EXECUTION_ENABLED','false');const http=vi.fn();const adapter=new MetaRenameAdapter({businessId:'b',accountId:'act_10',token:'private'},http);await expect(adapter.rename(c)).rejects.toThrow('DISABLED');expect(http).not.toHaveBeenCalled();});
it('allows only a name body',async()=>{
 for(const [k,v] of Object.entries({DEEPVISOR_META_EXECUTION_ENABLED:'true',DEEPVISOR_META_EXECUTION_BUSINESSES:'b',DEEPVISOR_ORGANIZER_RENAMES_ENABLED:'true',DEEPVISOR_ORGANIZER_EXCLUSIVE_WRITER:'true',DEEPVISOR_ORGANIZER_BUSINESSES:'b'}))vi.stubEnv(k,v);
 const http=vi.fn(async(url:URL|string,options?:RequestInit)=>{if(String(url).includes('me/permissions'))return Response.json({data:[{permission:'ads_management',status:'granted'}]});if(options?.method==='GET')return Response.json({id:'123',account_id:'10',name:'Old',updated_time:'2026-01-01',adset_id:'20',creative:{id:'30'}});return Response.json({success:true});});
 const adapter=new MetaRenameAdapter({businessId:'b',accountId:'act_10',token:'private'},http as typeof fetch);await adapter.rename({...c,extraBudget:100} as RenameChange);const posts=http.mock.calls.filter(([,o])=>o?.method==='POST');expect(posts).toHaveLength(1);expect(posts[0][1]?.body).toBe('name=New');expect(String(posts[0][0])).not.toContain('private');
});

function enable(){for(const [k,v] of Object.entries({DEEPVISOR_META_EXECUTION_ENABLED:'true',DEEPVISOR_META_EXECUTION_BUSINESSES:'b',DEEPVISOR_ORGANIZER_RENAMES_ENABLED:'true',DEEPVISOR_ORGANIZER_EXCLUSIVE_WRITER:'true',DEEPVISOR_ORGANIZER_BUSINESSES:'b'}))vi.stubEnv(k,v);}
function mockHttp(failWrite=false){return vi.fn(async(url:URL|string,options?:RequestInit)=>{
 if(String(url).includes('me/permissions'))return Response.json({data:[{permission:'ads_management',status:'granted'}]});
 if(options?.method==='GET')return Response.json({id:'123',account_id:'10',name:'Old',updated_time:'2026-01-01',adset_id:'20',creative:{id:'30'}});
 return failWrite?Response.json({error:{message:'provider secret'}},{status:500}):Response.json({success:true});
});}
it('does not retry or expose provider responses after an uncertain write',async()=>{enable();const http=mockHttp(true);const adapter=new MetaRenameAdapter({businessId:'b',accountId:'10',token:'private'},http as typeof fetch);await expect(adapter.rename(c)).rejects.toThrow('META_RENAME_REQUEST_FAILED');expect(http.mock.calls.filter(([,o])=>o?.method==='POST')).toHaveLength(1);});
it('checks the execution deadline immediately before POST',async()=>{enable();const http=mockHttp();const adapter=new MetaRenameAdapter({businessId:'b',accountId:'10',token:'private',writeDeadline:Date.now()-1},http as typeof fetch);await expect(adapter.rename(c)).rejects.toThrow('DEADLINE');expect(http.mock.calls.filter(([,o])=>o?.method==='POST')).toHaveLength(0);});
it('rejects a changed creative association before POST',async()=>{enable();const http=mockHttp();const adapter=new MetaRenameAdapter({businessId:'b',accountId:'10',token:'private'},http as typeof fetch);await expect(adapter.rename({...c,before:{...c.before,creativeId:'different'}})).rejects.toThrow('STALE');expect(http.mock.calls.filter(([,o])=>o?.method==='POST')).toHaveLength(0);});
