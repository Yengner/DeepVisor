import { createClient } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Database } from '@/lib/shared/types/supabase';
import type { DecisionProvider, DecisionResult } from '../types';
import { assertFresh, evaluationVersion, evaluateShadowPolicy, featureSnapshot, type ShadowJob } from './evaluate';
import { enqueueShadowAfterSync, runShadowJob } from './service';

vi.mock('server-only', () => ({}));
vi.mock('../../supabase/admin', () => ({ createAdminClient: vi.fn() }));
const now = new Date('2026-10-06T12:00:00.000Z');
const identity = { providerId:'test',providerVersion:'1',modelId:'test-model',modelVersion:'1' };
const decision: DecisionResult = { ...identity,decision:'REDUCE_BUDGET',confidence:0.9 };
function fixture(): ShadowJob {
  return { id:'job',business_id:'business',platform_integration_id:'integration',ad_account_id:'account',entity_id:'123',
    evaluation_version:evaluationVersion(identity),source_hash:'hash',source_synced_at:now.toISOString(),source_sync_job_id:'sync',started_at:now.toISOString(),
    feature_snapshot_id:'snapshot',decision_run_id:'run',action_proposal_id:'proposal',history:[],
    source_json:{ asOfDay:'2026-10-05',currency:'USD',timeZone:'UTC',
      entity:{id:'123',campaignId:'789',status:'ACTIVE',effectiveStatus:'ACTIVE',campaignStatus:'ACTIVE',dailyBudget:'10000',lifetimeBudget:'0',campaignDailyBudget:'0',campaignLifetimeBudget:'0'},
      policy:{ id:'policy',business_id:'business',mode:'observe',allowed_action_classes:['REDUCE_BUDGET','PAUSE_DELIVERY_UNIT'],max_budget_change_percent:20,
        budget_boundaries_json:{lockedEntityIds:[],currency:'USD',timeZone:'UTC',budgetPeriod:'daily',minBudgetMinor:1000,maxBudgetMinor:20000},
        cooldown_config_json:{cooldownHours:24,maxDailyChanges:3},minimum_evidence_json:{spend:100,impressions:600,results:2,activeDays:4,decisionConfidence:0.8,trackingConfidence:'medium',maxSnapshotAgeDays:1,maxEntityAgeMinutes:15},
      },
      rows:Array.from({length:60},(_,i)=>({adset_id:'123',day:new Date(now.getTime()-(i+1)*86400000).toISOString().slice(0,10),spend:20,reach:500,impressions:1000,clicks:50,inline_link_clicks:40,leads:2,messages:1,calls:0})),
    },
  };
}

describe('deterministic shadow inputs and policy',()=>{
  it('builds a versioned feature snapshot from completed-day normalized rows',()=>{
    const result=featureSnapshot(fixture());
    expect(result.asOfDay).toBe('2026-10-05'); expect(result.windows.recent7d.metrics.spend).toBe(140);
    expect(result.windows.recent7d.dataSufficiency.status).toBe('sufficient');
  });
  it('persists a concrete 5% candidate and both shadow and REVIEW policy results',()=>{
    const {result,proposal}=evaluateShadowPolicy(fixture(),decision,now);
    expect(proposal).toMatchObject({actionType:'REDUCE_BUDGET',proposedState:{targetBudgetMinor:9500}});
    expect(result).toMatchObject({shadowOnly:true,allowedBySafetyChecks:true,shadowPolicy:{outcome:'SHADOW_ONLY'},reviewPolicy:{outcome:'REQUIRE_APPROVAL'},measurementHorizonsHours:[24,72,168]});
    expect(JSON.stringify(result)).not.toContain('LIMITED_AUTO');
  });
  it('keeps blocked candidates for comparison instead of dropping them',()=>{
    const job=fixture();job.source_json.policy.max_budget_change_percent=0;
    expect(evaluateShadowPolicy(job,decision,now)).toMatchObject({result:{shadowPolicy:{outcome:'BLOCK',reason:'BUDGET_CHANGE_LIMIT'},allowedBySafetyChecks:false},proposal:{proposedState:{targetBudgetMinor:9500}}});
  });
  it('never reduces a shared campaign budget',()=>{
    const job=fixture();job.source_json.entity.dailyBudget='0';job.source_json.entity.campaignDailyBudget='10000';
    expect(evaluateShadowPolicy(job,decision,now).result).toMatchObject({shadowPolicy:{outcome:'BLOCK',reason:'SHARED_BUDGET'}});
  });
  it.each(['HOLD','INSUFFICIENT_DATA'] as const)('records %s without an actionable proposal',(selected)=>{
    expect(evaluateShadowPolicy(fixture(),{...decision,decision:selected},now).proposal).toBeNull();
  });
  it('keeps creative review recommendation-only',()=>{
    expect(evaluateShadowPolicy(fixture(),{...decision,decision:'REVIEW_CREATIVE'},now)).toMatchObject({proposal:{actionType:'REVIEW_CREATIVE'},result:{shadowPolicy:{outcome:'HOLD',reason:'RECOMMENDATION_ONLY'}}});
  });
  it('records pause recommendations with mandatory hypothetical review',()=>{
    expect(evaluateShadowPolicy(fixture(),{...decision,decision:'PAUSE_DELIVERY_UNIT'},now).result).toMatchObject({shadowPolicy:{outcome:'SHADOW_ONLY',risk:'high'},reviewPolicy:{outcome:'REQUIRE_APPROVAL'}});
  });
  it('blocks inadequate evidence and unknown budget ownership',()=>{
    const job=fixture();job.source_json.rows=[];
    expect(evaluateShadowPolicy(job,decision,now).result).toMatchObject({shadowPolicy:{outcome:'BLOCK',reason:'INSUFFICIENT_DATA'}});
    delete job.source_json.entity.dailyBudget;
    expect(evaluateShadowPolicy(job,decision,now).result).toMatchObject({shadowPolicy:{outcome:'BLOCK',reason:'INVALID_INPUT'}});
  });
  it('respects business action history',()=>{
    const job=fixture();job.history=[{id:'prior',businessId:'business',adAccountId:'account',entityId:'123',status:'succeeded',attemptedAt:'2026-10-06T11:00:00Z'}];
    expect(evaluateShadowPolicy(job,decision,now).result).toMatchObject({shadowPolicy:{reason:'COOLDOWN'}});
  });
  it('keeps policy history coverage at claim time even if inference finishes later',()=>{
    const job=fixture(); const finished=new Date(now.getTime()+60000);
    expect(evaluateShadowPolicy(job,decision,finished).result).toMatchObject({evaluatedAt:finished.toISOString(),policyAsOf:now.toISOString(),policyInput:{now:now.toISOString(),history:{until:now.toISOString()}}});
  });
  it('enforces six-hour source freshness with inclusive boundary',()=>{
    const job=fixture();job.source_synced_at=new Date(now.getTime()-6*3600000).toISOString();
    expect(()=>assertFresh(job,now)).not.toThrow();
    job.source_synced_at=new Date(now.getTime()-6*3600000-1).toISOString();expect(()=>assertFresh(job,now)).toThrow('STALE_SOURCE');
    job.source_synced_at=new Date(now.getTime()+1).toISOString();expect(()=>assertFresh(job,now)).toThrow('STALE_SOURCE');
  });
  it('uses account-local dates at UTC midnight',()=>{
    const job=fixture();job.source_json.timeZone='America/Los_Angeles';job.source_json.asOfDay='2026-10-04';job.source_synced_at='2026-10-06T01:00:00Z';
    expect(()=>assertFresh(job,new Date(job.source_synced_at))).not.toThrow();
    job.source_json.asOfDay='2026-10-05';expect(()=>assertFresh(job,new Date(job.source_synced_at))).toThrow('STALE_SOURCE');
  });
  it('changes the evaluation version when the provider model changes',()=>{
    expect(evaluationVersion(identity)).not.toBe(evaluationVersion({...identity,modelVersion:'2'}));
  });
});

const transport=vi.fn<typeof fetch>();
const client=createClient<Database>('https://unit-test.supabase.co','test-key',{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:transport}});
let job:ShadowJob;
beforeEach(()=>{
  job=fixture();vi.spyOn(console,'info').mockImplementation(()=>{});
  transport.mockReset();transport.mockImplementation(async(url,init)=>{
    const path=new URL(String(url)).pathname;
    const data=path.endsWith('autonomy_policies') ? {...job.source_json.policy,created_at:now.toISOString(),updated_at:now.toISOString()} : path.includes('/rpc/') ? null : JSON.parse(String(init?.body??'{}'));
    return new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}});
  });
});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllEnvs();});
function calls(path:string){return transport.mock.calls.filter(([url])=>String(url).includes(path)).map(([,init])=>JSON.parse(String(init?.body??'{}')));}

describe('shadow worker through DecisionEngine',()=>{
  it('persists linked snapshots, decisions, policy results and proposal candidates without Meta calls',async()=>{
    const provider:DecisionProvider={identity,evaluate:vi.fn(async()=>decision)};
    await runShadowJob(client,job,provider,()=>now);
    expect(calls('/feature_snapshots')[0]).toMatchObject({id:'snapshot',entity_id:'123'});
    expect(calls('/decision_runs')[0]).toMatchObject({id:'run',status:'pending'});
    expect(calls('finish_meta_shadow')[0]).toMatchObject({p_error:null,p_proposal:{actionType:'REDUCE_BUDGET'},p_result:{shadowOnly:true}});
    for(const [url] of transport.mock.calls) expect(new URL(String(url)).hostname).toBe('unit-test.supabase.co');
    expect(provider.evaluate).toHaveBeenCalledTimes(1);
  });
  it('does not evaluate again if reserved persistence IDs already exist',async()=>{
    const original=transport.getMockImplementation()!;
    transport.mockImplementation(async(url,init)=>String(url).includes('/feature_snapshots') ? new Response(JSON.stringify({code:'23505'}),{status:409}) : original(url,init));
    const provider:DecisionProvider={identity,evaluate:vi.fn(async()=>decision)};
    await expect(runShadowJob(client,job,provider,()=>now)).resolves.toBeUndefined();expect(provider.evaluate).not.toHaveBeenCalled();
    expect(calls('finish_meta_shadow')[0]).toMatchObject({p_error:'PERSISTENCE_FAILED'});
  });
  it('records provider failures without propagating into sync or creating actions',async()=>{
    const provider:DecisionProvider={identity,evaluate:vi.fn(async()=>{throw new Error('secret-token');})};
    await expect(runShadowJob(client,job,provider,()=>now)).resolves.toBeUndefined();
    expect(calls('finish_meta_shadow')[0]).toMatchObject({p_error:'PROVIDER_FAILED',p_proposal:null});
    expect(JSON.stringify(vi.mocked(console.info).mock.calls)).not.toContain('secret-token');
  });
  it('rejects malformed decisions through DecisionEngine',async()=>{
    const provider:DecisionProvider={identity,evaluate:vi.fn(async()=>({...decision,confidence:2}))};
    await runShadowJob(client,job,provider,()=>now);
    expect(calls('finish_meta_shadow')[0]).toMatchObject({p_error:'INVALID_RESPONSE'});
  });
  it('skips stale queued work before calling the provider',async()=>{
    job.source_synced_at='2026-10-05T00:00:00Z';
    const provider:DecisionProvider={identity,evaluate:vi.fn(async()=>decision)};
    await runShadowJob(client,job,provider,()=>now);
    expect(provider.evaluate).not.toHaveBeenCalled();expect(calls('finish_meta_shadow')[0]).toMatchObject({p_error:'STALE_SOURCE'});
  });
  it('isolates enqueue failures and makes no calls when disabled',async()=>{
    vi.stubEnv('DEEPVISOR_SHADOW_ENABLED','false');
    const input={businessId:'business',integrationId:'integration',adAccountId:'account',syncJobId:'sync'};
    expect(await enqueueShadowAfterSync(client,input)).toBe(0);expect(transport).not.toHaveBeenCalled();
    vi.stubEnv('DEEPVISOR_SHADOW_ENABLED','true');vi.stubEnv('DEEPVISOR_SHADOW_PROVIDER','mock');
    transport.mockResolvedValue(new Response('{}',{status:500}));
    expect(await enqueueShadowAfterSync(client,input)).toBe(0);
  });
});
