import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import type { Database, Json } from '@/lib/shared/types/supabase';
vi.mock('server-only', () => ({}));
import { runReviewJob } from './decisions/review/service';
import { runShadowJob } from './decisions/shadow/service';
import { evaluationVersion, type ShadowJob } from './decisions/shadow/evaluate';
import { reviewVersion } from './decisions/review/evaluate';
import { reviewProposal } from './decisions/reviewProposal';
import { approvalFingerprint } from './decisions/approval';
import { loadDecisionSurface } from './decisions/loadSurface';
import { executeReview, type ExecutionContext, type ExecutionStore } from './advertising/ReviewExecutor';
import { resolveBudget, type AdvertisingState } from './advertising/types';
import { record } from './decisions/surface';
import type { DecisionProvider } from './decisions/types';

const project='gkdyyjqepzayjdpvqnja';
const business='f6f96cff-bde3-4627-a613-4f16bfdc1d7c';
const account='eeee4444-0000-4000-8000-000000000001';
const campaign='eeee4444-0000-4000-8000-000000000002';
const adset='eeee4444-0000-4000-8000-000000000003';
const sync='eeee4444-0000-4000-8000-000000000004';
const external='9000000000040001', campaignExternal='9000000000040002', entity='9000000000040003';
const identity={providerId:'deepvisor-mock',providerVersion:'phase4-1',modelId:'deterministic-review',modelVersion:'1'};
const provider:DecisionProvider={identity,evaluate:async()=>({...identity,decision:'REDUCE_BUDGET',confidence:0.9,explanation:'Synthetic controlled recommendation. No live advertising action.'})};
const json=(value:unknown)=>JSON.parse(JSON.stringify(value)) as Json;
function checked<T>(result:{data:T;error:unknown}):NonNullable<T> {if(result.error)throw result.error;return result.data as NonNullable<T>;}

describe.skipIf(process.env.DEEPVISOR_FIXTURES!==project)('Phase 4 persisted synthetic intelligence flow',()=>{
 it('runs features → Shadow → new Review → owner approval → fake execution → outcomes with real RLS',async()=>{
  expect(process.env.NODE_ENV).toBe('test');expect(process.env.NEXT_PUBLIC_SUPABASE_URL).toBe(`https://${project}.supabase.co`);
  expect(process.env.DEEPVISOR_META_EXECUTION_ENABLED).not.toBe('true');
  const admin=createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
  const ai=admin.schema('ai');
  const credentials=JSON.parse(readFileSync('.env.beta-fixtures.json','utf8'));
  const clients=['a','b'].map(()=>createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{auth:{persistSession:false,autoRefreshToken:false}}));
  const signedA=await clients[0].auth.signInWithPassword(credentials.users.a);if(signedA.error)throw signedA.error;const owner=signedA.data.user;
  const signedB=await clients[1].auth.signInWithPassword(credentials.users.b);if(signedB.error)throw signedB.error;
  const integration=checked(await admin.from('platform_integrations').select('*').eq('business_id',business).single());
  expect(JSON.stringify(integration.integration_details)).toContain('deepvisor-beta-v1');
  // Refuse overwrite of an existing audit chain. Clean using the scoped SQL first.
  expect(checked(await ai.from('feature_snapshots').select('id').eq('ad_account_id',account))).toHaveLength(0);
  const now=new Date();const stamp=now.toISOString();
  const day=(i:number)=>new Date(now.getTime()-i*86400000).toISOString().slice(0,10);
  checked(await admin.from('ad_accounts').upsert({id:account,business_id:business,platform_id:integration.platform_id,external_account_id:`act_${external}`,name:'[SYNTHETIC PHASE 4] Intelligence fixture',timezone:'UTC',currency_code:'USD',status:'active'}));
  const dims={business_id:business,ad_account_id:account,platform_id:integration.platform_id,platform_integration_id:integration.id,status:'ACTIVE'};
  checked(await admin.from('ad_entities').upsert({ ...dims,id:campaign,entity_level:'campaign',external_id:campaignExternal,name:'[SYNTHETIC PHASE 4] Campaign',raw:{daily_budget:'0',effective_status:'ACTIVE'}}));
  checked(await admin.from('ad_entities').upsert({ ...dims,id:adset,entity_level:'adset',external_id:entity,parent_id:campaign,parent_external_id:campaignExternal,campaign_id:campaign,name:'[SYNTHETIC PHASE 4] Review ad set',raw:{daily_budget:'10000',effective_status:'ACTIVE'}}));
  checked(await admin.from('ad_entity_performance_daily').upsert(Array.from({length:60},(_,i)=>({entity_id:adset,ad_account_id:account,entity_level:'adset',day:day(i+1),spend:20,impressions:1000,reach:500,clicks:50,inline_link_clicks:40,leads:2,messages:1,calls:0,currency_code:'USD',source:'synthetic-phase4'}))));
  checked(await admin.from('account_sync_jobs').upsert({id:sync,business_id:business,platform_integration_id:integration.id,ad_account_id:account,sync_type:'initial_historical',status:'completed',started_at:stamp,finished_at:stamp,actual_start_date:day(60),actual_end_date:day(1),metadata:{fixture:'phase4',source:'controlled fixture import; not a Meta sync'}}));
  checked(await admin.from('ad_account_sync_state').upsert({ad_account_id:account,insights_synced_through:day(1),first_full_sync_completed:true,last_successful_sync_job_id:sync},{onConflict:'ad_account_id'}));
  const previousPolicy=checked(await ai.from('autonomy_policies').select('*').eq('business_id',business).maybeSingle());
  const bounds={executionEnabled:true,exclusiveWriterConfirmed:true,lockedEntityIds:[],currency:'USD',timeZone:'UTC',budgetPeriod:'daily',minBudgetMinor:1000,maxBudgetMinor:20000};
  const policy={business_id:business,mode:'observe',allowed_action_classes:['REDUCE_BUDGET','PAUSE_DELIVERY_UNIT'],max_budget_change_percent:20,budget_boundaries_json:bounds,cooldown_config_json:{cooldownHours:24,maxDailyChanges:3},minimum_evidence_json:{spend:100,impressions:600,results:2,activeDays:4,decisionConfidence:0.8,trackingConfidence:'medium',maxSnapshotAgeDays:1,maxEntityAgeMinutes:15}};
  try {
   checked(await ai.from('autonomy_policies').upsert(policy,{onConflict:'business_id'}));
   const args={p_business:business,p_integration:integration.id,p_account:account,p_sync_job:sync};
   expect(checked(await ai.rpc('enqueue_meta_shadow',{...args,p_version:evaluationVersion(identity)}))).toBe(1);
   const shadow=checked(await ai.rpc('claim_meta_shadow',{})) as unknown as ShadowJob;
   expect(shadow.ad_account_id).toBe(account);await runShadowJob(admin,shadow,provider);
   expect(checked(await ai.from('shadow_evaluation_jobs').select('status').eq('id',shadow.id).single()).status).toBe('completed');
   checked(await ai.from('autonomy_policies').update({mode:'approval_required'}).eq('business_id',business));
   expect(checked(await ai.rpc('enqueue_meta_review',{...args,p_version:reviewVersion(identity)}))).toBe(1);
   expect(checked(await ai.rpc('enqueue_meta_review',{...args,p_version:reviewVersion(identity)}))).toBe(0);
   const job=checked(await ai.rpc('claim_meta_review',{})) as unknown as ShadowJob;
   expect(job.ad_account_id).toBe(account);
   let fake:AdvertisingState={
    adset:{id:entity,account_id:external,campaign_id:campaignExternal,status:'ACTIVE',effective_status:'ACTIVE',daily_budget:'10000',updated_time:stamp,is_budget_schedule_enabled:false},
    campaign:{id:campaignExternal,account_id:external,status:'ACTIVE',effective_status:'ACTIVE',daily_budget:'0',updated_time:stamp},
    account:{id:`act_${external}`,account_id:external,account_status:1,currency:'USD',timezone_name:'UTC'},
   };
   await runReviewJob(admin,job,provider,{readState:async()=>structuredClone(fake),simulation:true});
   expect(checked(await ai.from('shadow_evaluation_jobs').select('status,error_code').eq('id',job.id).single())).toEqual({status:'completed',error_code:null});
   const proposal=checked(await ai.from('action_proposals').select('*').eq('id',job.action_proposal_id).single());
   const run=checked(await ai.from('decision_runs').select('*').eq('id',job.decision_run_id).single());
   const snapshot=checked(await ai.from('feature_snapshots').select('*').eq('id',job.feature_snapshot_id).single());
   const savedPolicy=checked(await ai.from('autonomy_policies').select('*').eq('business_id',business).single());
   expect(record(record(record(snapshot.feature_json).windows).recent7d).metrics).toMatchObject({spend:140,results:21,costPerResult:140/21});
   for(const table of ['feature_snapshots','decision_runs','action_proposals','shadow_evaluation_jobs'] as const){
    expect(checked(await clients[0].schema('ai').from(table).select('id').eq('business_id',business)).length).toBeGreaterThan(0);
    expect(checked(await clients[1].schema('ai').from(table).select('id').eq('business_id',business))).toEqual([]);
   }
   expect((await clients[0].schema('ai').rpc('claim_meta_review',{})).error).toBeTruthy();
   const review={businessId:business,userId:owner.id,role:'owner',proposalId:proposal.id,choice:'approve' as const,reviewFingerprint:approvalFingerprint(proposal,run,snapshot,savedPolicy)};
   await expect(reviewProposal(admin,{...review,role:'member'})).rejects.toThrow('owner or admin');
   await reviewProposal(admin,review);
   await expect(reviewProposal(admin,review)).rejects.toThrow('not available');
   const executionId=randomUUID();const keys={p_business:business,p_execution:executionId};
   const store:ExecutionStore={
    claim:async()=>checked(await ai.rpc('claim_review_execution',{...keys,p_proposal:proposal.id})) as unknown as ExecutionContext,
    checkpoint:async(before,request)=>{checked(await ai.rpc('checkpoint_review_execution',{...keys,p_before:json(before),p_request:{...record(request),simulation:true} as Json}));},
    finish:async(success,after,error)=>{checked(await ai.rpc('finish_review_execution',{...keys,p_success:success,p_after:json(after),p_error:error}));},
   };
   let writes=0;
   await executeReview({businessId:business,proposalId:proposal.id,enabled:true,store,adapter:async()=>({resolveBudget,read:async()=>structuredClone(fake),apply:async action=>{writes++;expect(action.type).toBe('REDUCE_BUDGET');if(action.type==='REDUCE_BUDGET')fake={...fake,adset:{...fake.adset,daily_budget:String(action.targetBudgetMinor)}};}})});
   expect(writes).toBe(1);expect(fake.adset.daily_budget).toBe('9500');
   expect(checked(await ai.from('executed_actions').select('status').eq('id',executionId).single()).status).toBe('succeeded');
   expect((await ai.rpc('claim_review_execution',{p_business:business,p_proposal:proposal.id,p_execution:randomUUID()})).error).toBeTruthy();
   checked(await ai.rpc('process_action_outcomes',{p_limit:100}));
   const outcomes=checked(await ai.from('action_outcomes').select('*').eq('executed_action_id',executionId));
   expect(outcomes.map(o=>o.measurement_horizon_hours).sort((a,b)=>a-b)).toEqual([1,6,24,72]);
   expect(outcomes.every(o=>o.measurement_status==='pending')).toBe(true);
   expect(checked(await ai.from('action_outcomes').select('id').eq('shadow_decision_run_id',run.id))).toHaveLength(0);
   const surface=await loadDecisionSurface(clients[0],business,0);
   expect(surface.cards.find(c=>c.id===run.id)?.proposals[0]).toMatchObject({status:'Simulated execution',canReview:false,outcomes:expect.arrayContaining(['1h: Waiting for observations'])});
   expect((await loadDecisionSurface(clients[1],business,0)).cards).toHaveLength(0);
   mkdirSync('docs/beta-readiness/phase4',{recursive:true});
   writeFileSync('docs/beta-readiness/phase4/flow.json',JSON.stringify({project,business,account,runId:run.id,proposalId:proposal.id,executionId,asOfDay:day(1),spend7d:140,results7d:21,budgetBefore:10000,budgetAfter:9500,simulation:true,outcomes:'pending: 1/6/24/72h',normalClientIsolation:true,verifiedAt:new Date().toISOString()},null,2)+'\n');
  } finally {
   if(previousPolicy)checked(await ai.from('autonomy_policies').upsert(previousPolicy,{onConflict:'business_id'}));
   else checked(await ai.from('autonomy_policies').update({budget_boundaries_json:{...bounds,executionEnabled:false}}).eq('business_id',business));
   await Promise.all(clients.map(c=>c.auth.signOut()));
  }
 },120000);
});
