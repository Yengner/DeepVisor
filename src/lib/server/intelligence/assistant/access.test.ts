import { beforeEach,expect,it,vi } from 'vitest';
vi.mock('server-only',()=>({}));
const mocks=vi.hoisted(()=>({auth:vi.fn(),context:vi.fn(),selection:vi.fn(),admin:vi.fn()}));
vi.mock('@/lib/server/supabase/server',()=>({createServerClient:async()=>({auth:{getUser:mocks.auth}})}));
vi.mock('@/lib/server/supabase/admin',()=>({createAdminClient:mocks.admin}));
vi.mock('@/lib/server/actions/app/context',()=>({getRequiredAppContext:mocks.context}));
vi.mock('@/lib/server/actions/app/selection',()=>({resolveCurrentSelection:mocks.selection}));
import { authorizeAssistant, authorizeSelectedMetaAccount } from './access';
function fixture(account:unknown={id:'account',platform_id:'meta'},integration:unknown={id:'integration',platform_id:'meta',platforms:{key:'meta'}}) {
 const eq=vi.fn();
 const db={from:vi.fn((table:string)=>{const q={select:vi.fn(),eq,maybeSingle:vi.fn().mockResolvedValue({data:table==='ad_accounts'?account:integration,error:null})};q.select.mockReturnValue(q);eq.mockReturnValue(q);return q;})};
 mocks.admin.mockReturnValue(db);return {db,eq};
}
beforeEach(()=>{
 vi.stubEnv('DEEPVISOR_ASSISTANT','true');vi.clearAllMocks();mocks.auth.mockResolvedValue({data:{user:{id:'user'}},error:null});mocks.context.mockResolvedValue({businessId:'business'});mocks.selection.mockResolvedValue({selectedAdAccountId:'account',selectedPlatformId:'integration'});
});
it('checks session before privileged queries and rejects browser-selected account mismatch',async()=>{
 fixture();mocks.auth.mockResolvedValue({data:{user:null},error:null});
 await expect(authorizeAssistant('account')).rejects.toMatchObject({status:401});expect(mocks.admin).not.toHaveBeenCalled();
 mocks.auth.mockResolvedValue({data:{user:{id:'user'}},error:null});
 await expect(authorizeAssistant('other-account')).rejects.toMatchObject({status:409});expect(mocks.admin).not.toHaveBeenCalled();
});
it('requires business-owned account and integration with matching Meta platform',async()=>{
 const {eq}=fixture();expect((await authorizeAssistant('account')).businessId).toBe('business');expect(eq).toHaveBeenCalledWith('business_id','business');
 fixture(null);await expect(authorizeAssistant('account')).rejects.toMatchObject({status:403});
 fixture({id:'account',platform_id:'other'});await expect(authorizeAssistant('account')).rejects.toMatchObject({status:403});
 fixture(undefined,{id:'integration',platform_id:'meta',platforms:{key:'google'}});await expect(authorizeAssistant('account')).rejects.toMatchObject({status:403});
});
it('refuses every request while Ask DeepVisor is hidden, before reading the session',async()=>{
 vi.stubEnv('DEEPVISOR_ASSISTANT','');fixture();
 await expect(authorizeAssistant('account')).rejects.toMatchObject({status:404});
 expect(mocks.auth).not.toHaveBeenCalled();expect(mocks.admin).not.toHaveBeenCalled();
});
it('still verifies the selected Meta account for Quick ad and the restart suggestion while Ask DeepVisor is hidden',async()=>{
 vi.stubEnv('DEEPVISOR_ASSISTANT','');const {eq}=fixture();
 expect((await authorizeSelectedMetaAccount('account')).account.id).toBe('account');expect(eq).toHaveBeenCalledWith('business_id','business');
 mocks.auth.mockResolvedValue({data:{user:null},error:null});
 await expect(authorizeSelectedMetaAccount('account')).rejects.toMatchObject({status:401});
 mocks.auth.mockResolvedValue({data:{user:{id:'user'}},error:null});mocks.selection.mockResolvedValue({selectedAdAccountId:null,selectedPlatformId:null});
 await expect(authorizeSelectedMetaAccount()).rejects.toMatchObject({status:409});
});
