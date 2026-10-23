import { describe, expect, it } from 'vitest';
import { fixture, decision, now, identity } from '../shadow/fixture';
import { evaluateReviewPolicy, reviewVersion } from './evaluate';
import { evaluationVersion } from '../shadow/evaluate';
import type { AdvertisingState } from '../../advertising/types';

const state: AdvertisingState = {
  adset: { id:'123', account_id:'456',campaign_id:'789',status:'ACTIVE',effective_status:'ACTIVE',daily_budget:'10000',updated_time:now.toISOString(),is_budget_schedule_enabled:false },
  campaign: { id:'789',account_id:'456',status:'ACTIVE',effective_status:'ACTIVE',daily_budget:'0',updated_time:now.toISOString() },
  account: { id:'act_456',account_id:'456',account_status:1,currency:'USD',timezone_name:'UTC' },
};
function reviewJob() { const job=fixture();job.source_json.policy.mode='approval_required';return job; }
describe('new Review evaluations',()=>{
  it('uses a distinct evaluation version and creates a policy-approved concrete proposal with fresh state',()=>{
    expect(reviewVersion(identity)).not.toBe(evaluationVersion(identity));
    expect(evaluateReviewPolicy(reviewJob(),decision,state,now)).toMatchObject({result:{mode:'REVIEW',policy:{outcome:'REQUIRE_APPROVAL',risk:'low'}},proposal:{actionType:'REDUCE_BUDGET',currentState:{metaState:state},proposedState:{type:'REDUCE_BUDGET',targetBudgetMinor:9500}}});
  });
  it.each(['HOLD','INSUFFICIENT_DATA','REVIEW_CREATIVE'] as const)('persists %s without an executable proposal',value=>{
    expect(evaluateReviewPolicy(reviewJob(),{...decision,decision:value},null,now).proposal).toBeNull();
  });
  it('supports pause with mandatory approval and high risk',()=>{
    expect(evaluateReviewPolicy(reviewJob(),{...decision,decision:'PAUSE_DELIVERY_UNIT'},state,now)).toMatchObject({result:{policy:{outcome:'REQUIRE_APPROVAL',risk:'high'}},proposal:{proposedState:{type:'PAUSE_DELIVERY_UNIT'}}});
  });
  it('does not promote Shadow or accept a foreign state',()=>{
    expect(()=>evaluateReviewPolicy(fixture(),decision,state,now)).toThrow('REVIEW_DISABLED');
    expect(()=>evaluateReviewPolicy(reviewJob(),decision,{...state,adset:{...state.adset,id:'999'}},now)).toThrow('STATE_SCOPE_MISMATCH');
  });
  it('blocks missing evidence, budget violations, paused delivery and recent actions',()=>{
    const job=reviewJob();job.source_json.rows=[];
    expect(evaluateReviewPolicy(job,decision,state,now).proposal).toBeNull();
    const limited=reviewJob();limited.source_json.policy.max_budget_change_percent=0;
    expect(evaluateReviewPolicy(limited,decision,state,now).proposal).toBeNull();
    expect(evaluateReviewPolicy(reviewJob(),decision,{...state,adset:{...state.adset,status:'PAUSED'}},now).proposal).toBeNull();
    const recent=reviewJob();recent.history=[{id:'prior',businessId:'business',adAccountId:'account',entityId:'123',status:'succeeded',attemptedAt:now.toISOString()}];
    expect(evaluateReviewPolicy(recent,decision,state,now)).toMatchObject({result:{policy:{reason:'COOLDOWN'}},proposal:null});
  });
  it('requires a fresh state for actionable decisions',()=>{
    expect(()=>evaluateReviewPolicy(reviewJob(),decision,null,now)).toThrow('CURRENT_STATE_REQUIRED');
  });
});
