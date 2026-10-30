import {createClient} from '@supabase/supabase-js';
import {expect,it,vi} from 'vitest';
import type {Database} from '@/lib/shared/types/supabase';
vi.mock('server-only',()=>({}));
vi.mock('@/lib/server/supabase/admin',()=>({createAdminClient:vi.fn()}));
vi.mock('./automaticRefresh',()=>({AUTO_SYNC_LOOKBACK_DAYS:7,AUTO_SYNC_STALE_MINUTES:90,targetedSimulationAllowed:()=>false,enqueueAutomaticAccountSync:vi.fn(async(input)=>({reason:'enqueued',jobId:input.adAccountId}))}));
import {createAdminClient} from '@/lib/server/supabase/admin';
import {enqueueAutomaticAccountSync} from './automaticRefresh';
import {enqueueScheduledAccountSyncJobs} from './scheduledRefresh';
it('batches discovery while preserving business/account associations and the queue limit',async()=>{
 const requests:URL[]=[];
 const integrations=['a','b'].map(b=>({id:`integration-${b}`,business_id:b,platform_id:'meta',integration_details:{primary_ad_account_external_id:'act_same'}}));
 const accounts=['b','a'].map(b=>({id:`account-${b}`,business_id:b,platform_id:'meta',external_account_id:'act_same'}));
 const client=createClient<Database>('https://test.supabase.co','test',{auth:{persistSession:false},global:{fetch:async url=>{
  const parsed=new URL(String(url));requests.push(parsed);
  return new Response(JSON.stringify(parsed.pathname.endsWith('platform_integrations')?integrations:accounts),{headers:{'Content-Type':'application/json'}});
 }}});
 vi.mocked(createAdminClient).mockReturnValue(client);
 const result=await enqueueScheduledAccountSyncJobs({limit:1});
 expect(result.queuedCount).toBe(1);expect(requests.filter(r=>r.pathname.endsWith('ad_accounts'))).toHaveLength(1);
 expect(enqueueAutomaticAccountSync).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({businessId:'a',integrationId:'integration-a',adAccountId:'account-a'}));
});
