import { beforeEach,expect,it,vi } from 'vitest';
vi.mock('server-only',()=>({}));
const mocks=vi.hoisted(()=>({status:vi.fn(),scope:vi.fn(),cookie:vi.fn(()=>({value:'foreign'}))}));
vi.mock('next/headers',()=>({cookies:async()=>({get:mocks.cookie})}));
vi.mock('@/lib/server/supabase/server',()=>({createServerClient:async()=>({from:(table:string)=>{
 const rows=table==='platform_integrations'?[{id:'own-integration',platform_id:'meta',integration_details:{primary_ad_account_external_id:'act_own'}}]:[{id:'own-account',platform_id:'meta',external_account_id:'act_own'}];
 const q={select:()=>q,eq:mocks.scope,in:mocks.status,order:()=>q,then:(done:(value:unknown)=>unknown)=>Promise.resolve({data:rows,error:null}).then(done)};
 mocks.scope.mockReturnValue(q);mocks.status.mockReturnValue(q);return q;
}})}));
import { resolveCurrentSelection } from './selection';
beforeEach(()=>vi.clearAllMocks());
it('preserves saved-data selection for failed/reauth integrations and rejects foreign cookie scope',async()=>{
 expect(await resolveCurrentSelection('own-business')).toEqual({selectedPlatformId:'own-integration',selectedAdAccountId:'own-account'});
 expect(mocks.status).toHaveBeenCalledWith('status',['connected','error','needs_reauth']);
 expect(mocks.scope).toHaveBeenCalledWith('business_id','own-business');
});
