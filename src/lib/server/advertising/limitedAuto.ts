import 'server-only';
import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/lib/shared/types/supabase';
import type { FeatureSnapshot } from '../features';
import type { DecisionProvider } from '../decisions/types';
import { DecisionEngine, DecisionEngineError } from '../decisions/DecisionEngine';
import { getDecisionRun, getFeatureSnapshot, insertActionProposal, updateActionProposal } from '../decisions/repository';
import { approvalFingerprint } from '../decisions/approval';
import { executeLimitedAuto, executionEnabled, evaluateExecutionPolicy, type ExecutionContext, type ExecutionStore } from './ReviewExecutor';
import { createMetaExecutionAdapter } from './executeMetaProposal';
import { AdvertisingError } from './types';

export function limitedAutoEnabled(businessId: string, env: Record<string,string|undefined> = process.env): boolean {
  return executionEnabled(businessId, env) && env.DEEPVISOR_LIMITED_AUTO_ENABLED === 'true';
}

export type LimitedAutoResult = { outcome: 'HOLD' | 'BLOCK' | 'EXECUTED'; reason: string; decisionRunId?: string; proposalId?: string; executionId?: string };

/** Trusted server worker entry point. A fresh provider call is mandatory; no cached fallback. */
export async function runLimitedAuto(client: SupabaseClient<Database>, input: {
  businessId: string; sourceSnapshotId: string; provider: DecisionProvider;
}): Promise<LimitedAutoResult> {
  if (!limitedAutoEnabled(input.businessId)) return { outcome: 'BLOCK', reason: 'AUTO_DISABLED' };
  const ai = client.schema('ai');
  const sourceKeys = { p_business: input.businessId, p_snapshot: input.sourceSnapshotId };
  // A durable source/content reservation prevents retries (including crashes) from
  // re-evaluating and re-executing the same evidence under a new proposal ID.
  const { data, error } = await ai.rpc('claim_limited_auto_evaluation', sourceKeys);
  if (error || !data) return { outcome: 'BLOCK', reason: 'SOURCE_CLAIM_REJECTED' };
  const source = data as unknown as Pick<ExecutionContext,'snapshot'|'policy'>;
  let decisionRunId: string | undefined;
  let proposalId: string | undefined;
  const finish = async (outcome: LimitedAutoResult['outcome'], reason: string, executionId?: string): Promise<LimitedAutoResult> => {
    const { error: failure } = await ai.rpc('finish_limited_auto_evaluation', { ...sourceKeys,
      p_status: outcome === 'EXECUTED' ? 'executed' : outcome === 'HOLD' ? 'hold' : 'blocked', p_reason: reason,
      p_run: decisionRunId ?? null, p_proposal: proposalId ?? null });
    if (failure) throw new AdvertisingError('AUTO_AUDIT_FINALIZATION_FAILED');
    return { outcome, reason, decisionRunId, proposalId, ...(executionId ? { executionId } : {}) };
  };
  try {
    const adapter = await createMetaExecutionAdapter(client, input.businessId, source.snapshot, limitedAutoEnabled(input.businessId));
    const before = await adapter.read();
    const accountBudget = await adapter.readAccountBudget();
    const evaluated = await new DecisionEngine(client,input.provider).evaluate({ businessId: input.businessId,
      platformIntegrationId: source.snapshot.platform_integration_id, snapshot: source.snapshot.feature_json as unknown as FeatureSnapshot,
      questions: ['Limited auto v1: should this ad set hold, reduce budget, pause delivery, or receive a creative review recommendation?'] });
    decisionRunId = evaluated.decisionRunId;
    const decision = evaluated.result.decision;
    if (decision === 'HOLD' || decision === 'INSUFFICIENT_DATA' || decision === 'REVIEW_CREATIVE') return finish('HOLD',decision);
    const budget = adapter.resolveBudget(before);
    // The provider chooses a class, never an unconstrained spend amount.
    const percent = source.policy.max_budget_change_percent;
    if (!Number.isFinite(percent) || percent < 0 || percent > 100 || (decision === 'REDUCE_BUDGET' && percent === 0)) return finish('BLOCK','INVALID_BUDGET_POLICY');
    const reduction = Number(BigInt(budget.amountMinor) * BigInt(Math.round(Math.min(percent,5)*100)) / BigInt(10000));
    const proposed = decision === 'REDUCE_BUDGET' ? { targetBudgetMinor: budget.amountMinor-reduction } : {};
    const saved = await insertActionProposal(client,input.businessId,{
      decision_run_id: decisionRunId, action_type: decision, target_entity_type:'adset',target_entity_id:before.adset.id,
      current_state_json:{budgetMinor:budget.amountMinor,metaState:before,accountBudget} as unknown as Json,
      proposed_state_json:proposed, requires_approval:false,status:'pending',risk_level:'unknown',
      policy_result_json:{outcome:'BLOCK',reason:'NOT_EVALUATED',executionMode:'LIMITED_AUTO'},
    });
    proposalId = saved.id;
    const run = await getDecisionRun(client,input.businessId,decisionRunId);
    const snapshot = await getFeatureSnapshot(client,input.businessId,evaluated.featureSnapshotId);
    if (!run || !snapshot) throw new AdvertisingError('MISSING_AUTO_LINEAGE');
    const {data:history,error:historyError} = await ai.rpc('limited_auto_history',{p_business:input.businessId});
    if (historyError || !Array.isArray(history)) throw new AdvertisingError('INCOMPLETE_HISTORY');
    const context: ExecutionContext = {proposal:saved,run,snapshot,policy:source.policy,history:history as unknown as ExecutionContext['history']};
    // The execution claim reloads cross-mode history under the business lock.
    evaluateExecutionPolicy(context,before,adapter,new Date(),true,accountBudget);
    const authorized = { ...saved,risk_level:'low' };
    const policyResult = { outcome:'ALLOW_EXECUTION',reason:'POLICY_PASSED',executionMode:'LIMITED_AUTO',
      automaticAuthorization:{fingerprint:approvalFingerprint(authorized,run,snapshot,source.policy)} };
    const { error: updateError } = await ai.from('action_proposals').update({risk_level:'low',policy_result_json:policyResult})
      .eq('business_id',input.businessId).eq('id',proposalId);
    if (updateError) throw new AdvertisingError('AUTO_AUTHORIZATION_PERSISTENCE_FAILED');
    const { error: linked } = await ai.rpc('finish_limited_auto_evaluation',{...sourceKeys,p_status:'running',p_reason:'POLICY_PASSED',p_run:decisionRunId,p_proposal:proposalId});
    if (linked) throw new AdvertisingError('AUTO_LINEAGE_PERSISTENCE_FAILED');
    const executionId = randomUUID();
    const keys = { p_business:input.businessId,p_execution:executionId };
    const authorize = async () => {
      if (!limitedAutoEnabled(input.businessId)) throw new AdvertisingError('EXECUTION_DISABLED');
      const { error: rejected } = await ai.rpc('authorize_limited_auto_execution',keys);
      if (rejected) throw new AdvertisingError('AUTO_AUTHORIZATION_REVOKED');
    };
    const store: ExecutionStore = {
      async claim() {
        if (!limitedAutoEnabled(input.businessId)) throw new AdvertisingError('EXECUTION_DISABLED');
        const {data:claimed,error:rejected} = await ai.rpc('claim_limited_auto_execution',{...keys,p_proposal:proposalId!});
        if (rejected || !claimed) throw new AdvertisingError('AUTO_CLAIM_REJECTED');
        return claimed as unknown as ExecutionContext;
      },
      async checkpoint(state,request) {
        if (!limitedAutoEnabled(input.businessId)) throw new AdvertisingError('EXECUTION_DISABLED');
        const {error:rejected} = await ai.rpc('checkpoint_limited_auto_execution',{...keys,p_before:state as unknown as Json,p_request:request});
        if (rejected) throw new AdvertisingError('AUTO_CHECKPOINT_REJECTED');
      },
      authorize,
      async finish(success,after,errorInfo) {
        const {error:failure} = await ai.rpc('finish_review_execution',{...keys,p_success:success,p_after:after as unknown as Json,p_error:errorInfo});
        if (failure) throw new AdvertisingError('AUDIT_FINALIZATION_FAILED');
      },
    };
    await executeLimitedAuto({businessId:input.businessId,proposalId,enabled:limitedAutoEnabled(input.businessId),store,adapter:async()=>adapter});
    return finish('EXECUTED','VERIFIED',executionId);
  } catch (failure) {
    const reason = failure instanceof AdvertisingError ? failure.code : failure instanceof DecisionEngineError ? failure.code : 'AUTO_VALIDATION_FAILED';
    if (failure instanceof DecisionEngineError) decisionRunId = failure.decisionRunId;
    if (proposalId) {
      // Never overwrite an execution audit or imply that a partial write was undone.
      await updateActionProposal(client,input.businessId,proposalId,{policy_result_json:{outcome:'BLOCK',reason,executionMode:'LIMITED_AUTO'},status:'cancelled'});
    }
    return finish(failure instanceof DecisionEngineError && ['PROVIDER_FAILED','INVALID_RESPONSE'].includes(reason) ? 'HOLD' : 'BLOCK',reason);
  }
}
