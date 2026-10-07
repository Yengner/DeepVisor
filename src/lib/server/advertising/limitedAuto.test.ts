import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/shared/types/supabase';
import { DecisionEngine, DecisionEngineError } from '../decisions/DecisionEngine';
import { DeterministicDecisionProvider } from '../decisions/providers/DeterministicDecisionProvider';
import { getDecisionRun, getFeatureSnapshot, insertActionProposal, updateActionProposal } from '../decisions/repository';
import { createMetaExecutionAdapter } from './executeMetaProposal';
import { evaluateExecutionPolicy, executeLimitedAuto } from './ReviewExecutor';
import { limitedAutoEnabled, runLimitedAuto } from './limitedAuto';

vi.mock('server-only',()=>({}));
vi.mock('./executeMetaProposal',()=>({createMetaExecutionAdapter:vi.fn()}));
vi.mock('../decisions/repository',()=>({getDecisionRun:vi.fn(),getFeatureSnapshot:vi.fn(),insertActionProposal:vi.fn(),updateActionProposal:vi.fn()}));
vi.mock('./ReviewExecutor',async original=>({...await original<typeof import('./ReviewExecutor')>(),executeLimitedAuto:vi.fn(),evaluateExecutionPolicy:vi.fn()}));

function setup() {
  const snapshot={id:'source',platform_integration_id:'integration',ad_account_id:'account',feature_json:{}};
  const policy={mode:'autonomous',max_budget_change_percent:10,budget_boundaries_json:{}};
  const eq=vi.fn(); eq.mockReturnValue({eq,error:null});
  const update=vi.fn(()=>({eq}));
  const rpc=vi.fn(async(name:string)=>({data:name==='claim_limited_auto_evaluation'?{snapshot,policy}:name==='limited_auto_history'?[]:null,error:null}));
  const schema=vi.fn(()=>({rpc,from:vi.fn(()=>({update}))}));
  const client={schema} as unknown as SupabaseClient<Database>;
  const read=vi.fn(async()=>({adset:{id:'123'}}));
  const readAccountBudget=vi.fn(async()=>({totalDailyBudgetMinor:200000}));
  const apply=vi.fn();
  vi.mocked(createMetaExecutionAdapter).mockResolvedValue({read,readAccountBudget,apply,resolveBudget:()=>({amountMinor:10000})} as unknown as Awaited<ReturnType<typeof createMetaExecutionAdapter>>);
  const evaluate=vi.spyOn(DecisionEngine.prototype,'evaluate').mockResolvedValue({decisionRunId:'run',featureSnapshotId:'snapshot',result:{decision:'REDUCE_BUDGET',confidence:0.99,providerId:'mock',providerVersion:'1',modelId:'mock',modelVersion:'1'}});
  vi.mocked(insertActionProposal).mockResolvedValue({id:'proposal',business_id:'business',decision_run_id:'run',risk_level:'unknown',current_state_json:{},proposed_state_json:{}} as Awaited<ReturnType<typeof insertActionProposal>>);
  vi.mocked(getDecisionRun).mockResolvedValue({id:'run'} as Awaited<ReturnType<typeof getDecisionRun>>);
  vi.mocked(getFeatureSnapshot).mockResolvedValue(snapshot as Awaited<ReturnType<typeof getFeatureSnapshot>>);
  vi.mocked(evaluateExecutionPolicy).mockReturnValue({type:'REDUCE_BUDGET',targetBudgetMinor:9500});
  const run=()=>runLimitedAuto(client,{businessId:'business',sourceSnapshotId:'source',provider:new DeterministicDecisionProvider()});
  return {run,rpc,evaluate,apply,policy,update};
}
beforeEach(()=>{
  vi.resetAllMocks();
  vi.stubEnv('DEEPVISOR_META_EXECUTION_ENABLED','true'); vi.stubEnv('DEEPVISOR_META_EXECUTION_BUSINESSES','business'); vi.stubEnv('DEEPVISOR_LIMITED_AUTO_ENABLED','true');
});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllEnvs();});
describe('limited auto orchestration',()=>{
  it('requires every environment gate and business allowlist',()=>{
    expect(limitedAutoEnabled('business',{})).toBe(false);
    expect(limitedAutoEnabled('business',{DEEPVISOR_META_EXECUTION_ENABLED:'true',DEEPVISOR_META_EXECUTION_BUSINESSES:'business'})).toBe(false);
    expect(limitedAutoEnabled('other')).toBe(false);
    expect(limitedAutoEnabled('business')).toBe(true);
  });
  it('does nothing when disabled',async()=>{
    const f=setup(); vi.stubEnv('DEEPVISOR_LIMITED_AUTO_ENABLED','false');
    expect(await f.run()).toEqual({outcome:'BLOCK',reason:'AUTO_DISABLED'});
    expect(f.rpc).not.toHaveBeenCalled(); expect(f.evaluate).not.toHaveBeenCalled(); expect(f.apply).not.toHaveBeenCalled();
  });
  it('cannot infer or execute after a rejected source claim',async()=>{
    const f=setup(); f.rpc.mockResolvedValueOnce({data:null,error:{message:'duplicate'}} as never);
    expect(await f.run()).toEqual({outcome:'BLOCK',reason:'SOURCE_CLAIM_REJECTED'});
    expect(f.evaluate).not.toHaveBeenCalled(); expect(executeLimitedAuto).not.toHaveBeenCalled();
  });
  it.each(['PROVIDER_FAILED','INVALID_RESPONSE'] as const)('records HOLD on %s without fallback or action',async code=>{
    const f=setup(); f.evaluate.mockRejectedValueOnce(new DecisionEngineError(code,'failed-run'));
    expect(await f.run()).toMatchObject({outcome:'HOLD',reason:code,decisionRunId:'failed-run'});
    expect(f.evaluate).toHaveBeenCalledOnce(); expect(insertActionProposal).not.toHaveBeenCalled(); expect(executeLimitedAuto).not.toHaveBeenCalled();
    expect(f.rpc).toHaveBeenLastCalledWith('finish_limited_auto_evaluation',expect.objectContaining({p_status:'hold',p_run:'failed-run'}));
  });
  it.each(['HOLD','INSUFFICIENT_DATA','REVIEW_CREATIVE'] as const)('does not turn %s into execution',async decision=>{
    const f=setup(); f.evaluate.mockResolvedValueOnce({decisionRunId:'run',featureSnapshotId:'snapshot',result:{decision,confidence:0.99,providerId:'mock',modelId:'mock',providerVersion:'1',modelVersion:'1'}});
    expect(await f.run()).toMatchObject({outcome:'HOLD',reason:decision}); expect(insertActionProposal).not.toHaveBeenCalled(); expect(executeLimitedAuto).not.toHaveBeenCalled();
  });
  it('blocks policy failure and persists a cancelled proposal',async()=>{
    const f=setup(); vi.mocked(evaluateExecutionPolicy).mockImplementationOnce(()=>{throw new Error('policy unavailable');});
    expect(await f.run()).toMatchObject({outcome:'BLOCK',reason:'AUTO_VALIDATION_FAILED'});
    expect(executeLimitedAuto).not.toHaveBeenCalled(); expect(updateActionProposal).toHaveBeenCalledWith(expect.anything(),'business','proposal',expect.objectContaining({status:'cancelled',policy_result_json:expect.objectContaining({outcome:'BLOCK'})}));
  });
  it('does not execute after authorization persistence fails',async()=>{
    const f=setup(); f.update.mockImplementationOnce(()=>{throw new Error('offline');});
    expect(await f.run()).toMatchObject({outcome:'BLOCK'}); expect(executeLimitedAuto).not.toHaveBeenCalled();
  });
  it('caps the server-generated reduction at five percent and preserves automatic lineage',async()=>{
    const f=setup(); expect(await f.run()).toMatchObject({outcome:'EXECUTED',proposalId:'proposal'});
    expect(insertActionProposal).toHaveBeenCalledWith(expect.anything(),'business',expect.objectContaining({proposed_state_json:{targetBudgetMinor:9500},requires_approval:false}));
    expect(executeLimitedAuto).toHaveBeenCalledOnce(); expect(f.apply).not.toHaveBeenCalled();
    expect(f.rpc).toHaveBeenCalledWith('finish_limited_auto_evaluation',expect.objectContaining({p_status:'running',p_run:'run',p_proposal:'proposal'}));
  });
  it('does not report success if the evaluation audit fails',async()=>{
    const f=setup();
    vi.mocked(executeLimitedAuto).mockImplementationOnce(async()=>{f.rpc.mockResolvedValue({data:null,error:{message:'offline'}} as never);});
    await expect(f.run()).rejects.toThrow('AUTO_AUDIT_FINALIZATION_FAILED');
  });
});
