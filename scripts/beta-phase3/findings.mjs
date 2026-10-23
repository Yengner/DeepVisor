import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { businesses,uid } from '../beta-fixtures/fixture.ts';
const project='gkdyyjqepzayjdpvqnja';
assert.equal(process.env.DEEPVISOR_FIXTURES,project);
assert.notEqual(process.env.NODE_ENV,'production');
assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL,`https://${project}.supabase.co`);
const client=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const b=businesses[0],id=uid('phase3:historical-observation'),source='deepvisor-beta-phase3';
const result=process.argv[2]==='seed'
 ? await client.schema('ai').from('trend_findings').upsert({id,business_id:b.id,platform_integration_id:b.integrationId,ad_account_id:b.accountId,
     finding_type:'delivery_drop_vs_efficiency',severity:'info',confidence:'low',status:'active',source,
     title:'[SYNTHETIC] Historical fixture observation',summary:'Manually authored test observation. No AI evaluation or action was performed.',
     reason:'Saved October 13–19 fixture totals; not a fresh decision or a causal inference.',
     metric_snapshot_json:{periodStart:'2026-10-13',periodEnd:'2026-10-19',spend:994,results:109,costPerResult:994/109,ctr:3},
     recommended_action_json:{},snapshot_hash:source,dedupe_key:source,
     detected_at:'2026-10-20T16:00:00Z',first_detected_at:'2026-10-20T16:00:00Z',last_detected_at:'2026-10-20T16:00:00Z'})
 : process.argv[2]==='clean'
   ? await client.schema('ai').from('trend_findings').delete().eq('id',id).eq('business_id',b.id).eq('source',source)
   : (()=>{throw new Error('Use seed or clean');})();
if(result.error)throw result.error;
console.log(JSON.stringify({operation:process.argv[2],id,source}));
