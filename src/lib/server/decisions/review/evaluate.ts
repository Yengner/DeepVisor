import type { Json } from '@/lib/shared/types/supabase';
import { metaStateSchema, resolveBudget, type AdvertisingState } from '../../advertising/types';
import { PolicyEngine } from '../policy/PolicyEngine';
import { evaluationPolicyInput, evaluationVersion, type ShadowJob } from '../shadow/evaluate';
import type { DecisionProviderIdentity, DecisionResult } from '../types';

export const reviewVersion = (identity: DecisionProviderIdentity) => `review:1:${evaluationVersion(identity)}`;

/** A new REVIEW evaluation, never a promoted Shadow proposal. State is read-only. */
export function evaluateReviewPolicy(job: ShadowJob, decision: DecisionResult, state: AdvertisingState | null, now: Date, simulation = false) {
  if (job.source_json.policy.mode !== 'approval_required') throw new Error('REVIEW_DISABLED');
  const input = evaluationPolicyInput(job, decision);
  input.policy.mode = 'REVIEW';
  if (state) {
    state = metaStateSchema.parse(state);
    if (state.adset.id !== job.entity_id || state.adset.campaign_id !== state.campaign.id ||
      state.adset.account_id !== state.account.account_id || state.campaign.account_id !== state.account.account_id ||
      state.account.id !== `act_${state.account.account_id}` || state.campaign.id !== job.source_json.entity.campaignId) throw new Error('STATE_SCOPE_MISMATCH');
    const budget = resolveBudget(state);
    if (input.entity) {
      input.entity = { ...input.entity, budgetMinor: budget.amountMinor, budgetOwner: budget.owner, budgetPeriod: budget.period,
        currency: state.account.currency, timeZone: state.account.timezone_name,
        status: state.account.account_status === 1 && state.adset.status === 'ACTIVE' && state.adset.effective_status === 'ACTIVE' && state.campaign.status === 'ACTIVE' && state.campaign.effective_status === 'ACTIVE' ? 'active' : 'paused',
        // Policy history is atomic at claim. Execution separately rechecks current history.
        observedAt: job.started_at };
    }
    if (decision.decision === 'REDUCE_BUDGET') input.proposedAction = { type: 'REDUCE_BUDGET', targetBudgetMinor: budget.amountMinor - Number(BigInt(budget.amountMinor) * BigInt(5) / BigInt(100)) };
  } else if (['REDUCE_BUDGET', 'PAUSE_DELIVERY_UNIT'].includes(decision.decision)) throw new Error('CURRENT_STATE_REQUIRED');
  const policy = new PolicyEngine().evaluate(input);
  const proposal = policy.outcome === 'REQUIRE_APPROVAL' && state ? {
    actionType: decision.decision, currentState: { ...input.entity, metaState: state }, proposedState: policy.action, risk: policy.risk,
  } : null;
  const result = { mode: 'REVIEW', simulation, sourceHash: job.source_hash, sourceSyncJobId: job.source_sync_job_id,
    evaluatedAt: now.toISOString(), policyAsOf: input.now, policy, policyInput: input };
  return { result: JSON.parse(JSON.stringify(result)) as Json, proposal: JSON.parse(JSON.stringify(proposal)) as Json };
}
