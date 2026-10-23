import { readFileSync,writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { describe,it,expect,vi } from 'vitest';
import type { Database,Json } from '@/lib/shared/types/supabase';
vi.mock('server-only',()=>({}));
import { runReviewJob } from './decisions/review/service';
import { reviewVersion } from './decisions/review/evaluate';
import { runShadowJob } from './decisions/shadow/service';
import { evaluationVersion,type ShadowJob } from './decisions/shadow/evaluate';
import type { DecisionProvider } from './decisions/types';
import { executeReview,type ExecutionContext,type ExecutionStore } from './advertising/ReviewExecutor';
import { resolveBudget,type AdvertisingState } from './advertising/types';
import { record } from './decisions/surface';
const project='gkdyyjqepzayjdpvqnja';
const json=(x:unknown)=>JSON.parse(JSON.stringify(x)) as Json;
function check<T>(r:{data:T;error:unknown}):NonNullable<T>{if(r.error)throw new Error(JSON.stringify(r.error));return r.data as NonNullable<T>;}
describe.skipIf(process.env.DEEPVISOR_PHASE5!==project)('fresh-user intelligence integration',()=>{
 it('uses the same persisted simulated sync account, real approval records and fake execution only',async()=>{
  expect(process.env.NEXT_PUBLIC_SUPABASE_URL).toBe(`https://${project}.supabase.co`);expect(process.env.DEEPVISOR_META_EXECUTION_ENABLED).not.toBe('true');
  const data=JSON.parse(readFileSync('.env.beta-phase5.json','utf8')),user=data.users[0];const business=user.businessId;
  const admin=createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}}),ai=admin.schema('ai');
  const client=createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
  const auth=await client.auth.signInWithPassword({email:user.email,password:user.password});if(auth.error)throw auth.error;
  const integration=check(await admin.from('platform_integrations').select('*').eq('business_id',business).single());expect(record(integration.integration_details)['deepvisor-meta-phase2']).toBeTruthy();
  const account=check(await admin.from('ad_accounts').select('*').eq('business_id',business).like('external_account_id','%_1').single());
  if(process.env.PHASE5_STAGE==='prepare'){
   const entity=check(await admin.from('ad_entities').select('*').eq('ad_account_id',account.id).eq('entity_level','adset').eq('status','active').single());
   const campaign=check(await admin.from('ad_entities').select('*').eq('id',entity.campaign_id!).single());
   const state=check(await admin.from('ad_account_sync_state').select('last_successful_sync_job_id').eq('ad_account_id',account.id).single());
   const now=new Date().toISOString();const external=account.external_account_id.replace(/^act_/,'');
   const fake:AdvertisingState={adset:{id:entity.external_id,account_id:external,campaign_id:campaign.external_id,status:'ACTIVE',effective_status:'ACTIVE',daily_budget:'5000',updated_time:now,is_budget_schedule_enabled:false},campaign:{id:campaign.external_id,account_id:external,status:'ACTIVE',effective_status:'ACTIVE',daily_budget:'0',updated_time:now},account:{id:account.external_account_id,account_id:external,account_status:1,currency:'USD',timezone_name:'America/New_York'}};
   const policy={business_id:business,mode:'observe',allowed_action_classes:['REDUCE_BUDGET','PAUSE_DELIVERY_UNIT'],max_budget_change_percent:20,budget_boundaries_json:{executionEnabled:true,exclusiveWriterConfirmed:true,lockedEntityIds:[],currency:'USD',timeZone:'America/New_York',budgetPeriod:'daily',minBudgetMinor:1000,maxBudgetMinor:20000},cooldown_config_json:{cooldownHours:24,maxDailyChanges:3},minimum_evidence_json:{spend:100,impressions:600,results:2,activeDays:4,decisionConfidence:0.8,trackingConfidence:'medium',maxSnapshotAgeDays:1,maxEntityAgeMinutes:15}};
   check(await ai.from('autonomy_policies').upsert(policy,{onConflict:'business_id'}));
   const args={p_business:business,p_integration:integration.id,p_account:account.id,p_sync_job:state.last_successful_sync_job_id!};
   data.proposals=[];
   for(const kind of ['shadow','reduce','pause'] as const){
    const identity={providerId:'deepvisor-mock',providerVersion:'phase5',modelId:`controlled-${kind}`,modelVersion:'1'};
    const provider:DecisionProvider={identity,evaluate:async()=>({...identity,decision:kind==='pause'?'PAUSE_DELIVERY_UNIT':'REDUCE_BUDGET',confidence:0.9,explanation:'[SIMULATED] Beta journey recommendation; no live advertising action.'})};
    if(kind!=='shadow')check(await ai.from('autonomy_policies').update({mode:'approval_required'}).eq('business_id',business));
    expect(check(await ai.rpc(kind==='shadow'?'enqueue_meta_shadow':'enqueue_meta_review',{...args,p_version:kind==='shadow'?evaluationVersion(identity):reviewVersion(identity)}))).toBe(1);
    const job=check(await ai.rpc(kind==='shadow'?'claim_meta_shadow':'claim_meta_review',{})) as unknown as ShadowJob;expect(job.business_id).toBe(business);
    if(kind==='shadow')await runShadowJob(admin,job,provider);else await runReviewJob(admin,job,provider,{readState:async()=>structuredClone(fake),simulation:true});
    expect(check(await ai.from('shadow_evaluation_jobs').select('status,error_code').eq('id',job.id).single())).toEqual({status:'completed',error_code:null});
    const snapshot=check(await ai.from('feature_snapshots').select('feature_json').eq('id',job.feature_snapshot_id).single());
    expect(record(record(record(snapshot.feature_json).windows).recent7d).metrics).toMatchObject({spend:280,results:28,costPerResult:10});
    if(kind!=='shadow')expect(check(await ai.from('action_proposals').select('status').eq('id',job.action_proposal_id).single()).status).toBe('pending');
    data.proposals.push({kind,id:job.action_proposal_id,runId:job.decision_run_id});
   }
   writeFileSync('.env.beta-phase5.json',JSON.stringify(data,null,2),{mode:0o600});
  }else{
   const proposal=check(await ai.from('action_proposals').select('*').eq('id',data.proposals.find((p:{kind:string})=>p.kind==='reduce').id).single());
   expect(proposal.status).toBe('approved');expect(record(record(proposal.policy_result_json).review).userId).toBe(user.id);
   expect(check(await ai.from('action_proposals').select('status').eq('id',data.proposals.find((p:{kind:string})=>p.kind==='pause').id).single()).status).toBe('rejected');
   let fake=record(proposal.current_state_json).metaState as AdvertisingState;let writes=0;const execution=randomUUID();const keys={p_business:business,p_execution:execution};
   const store:ExecutionStore={claim:async()=>check(await ai.rpc('claim_review_execution',{...keys,p_proposal:proposal.id})) as unknown as ExecutionContext,checkpoint:async(before,request)=>{check(await ai.rpc('checkpoint_review_execution',{...keys,p_before:json(before),p_request:json({...record(request),simulation:true})}));},finish:async(success,after,error)=>{check(await ai.rpc('finish_review_execution',{...keys,p_success:success,p_after:json(after),p_error:error}));}};
   try{
    await executeReview({businessId:business,proposalId:proposal.id,enabled:true,store,adapter:async()=>({resolveBudget,read:async()=>structuredClone(fake),apply:async action=>{writes++;if(action.type==='REDUCE_BUDGET')fake={...fake,adset:{...fake.adset,daily_budget:String(action.targetBudgetMinor)}};else throw new Error('Unexpected action');}})});
    expect(writes).toBe(1);expect(fake.adset.daily_budget).toBe('4750');expect(check(await ai.from('executed_actions').select('status').eq('id',execution).single()).status).toBe('succeeded');
    expect((await ai.rpc('claim_review_execution',{p_business:business,p_proposal:proposal.id,p_execution:randomUUID()})).error).toBeTruthy();
    check(await ai.rpc('process_action_outcomes',{p_limit:100}));expect(check(await ai.from('action_outcomes').select('measurement_status').eq('executed_action_id',execution))).toHaveLength(4);
    writeFileSync('docs/beta-readiness/phase5/intelligence.json',JSON.stringify({business,account:account.id,execution,spend7d:280,results7d:28,budgetBefore:5000,budgetAfter:4750,actualMetaWrites:0,approvedAndRejectedInBrowser:true},null,2));
   }finally{const policy=check(await ai.from('autonomy_policies').select('budget_boundaries_json').eq('business_id',business).single());check(await ai.from('autonomy_policies').update({budget_boundaries_json:json({...record(policy.budget_boundaries_json),executionEnabled:false})}).eq('business_id',business));}
  }
  for(const table of ['ad_accounts','ad_entities','ad_creatives','business_profiles'] as const)expect(check(await client.from(table).select('id').eq(table==='business_profiles'?'id':'business_id','f6f96cff-bde3-4627-a613-4f16bfdc1d7c'))).toHaveLength(0);
  for(const table of ['feature_snapshots','decision_runs','action_proposals','executed_actions'] as const)expect(check(await client.schema('ai').from(table).select('id').eq('business_id','f6f96cff-bde3-4627-a613-4f16bfdc1d7c'))).toHaveLength(0);
  expect((await client.schema('ai').rpc('claim_meta_review',{})).error).toBeTruthy();await client.auth.signOut({scope:'local'});
 },120000);
});
