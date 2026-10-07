import type { Database, Json } from '@/lib/shared/types/supabase';
import type { FeatureSnapshot } from '../features';
import { approvalFingerprint, canonical } from '../decisions/approval';
import { PolicyEngine } from '../decisions/policy/PolicyEngine';
import type { BusinessPolicy, ProposedAction, RecentActionHistory } from '../decisions/policy/types';
import { record } from '../decisions/surface';
import { validateDecisionResult } from '../decisions/validation';
import { AdvertisingError, metaStateSchema, type AdvertisingPlatformAdapter, type AdvertisingState, type AccountBudgetState } from './types';

type Tables = Database['ai']['Tables'];
export interface ExecutionContext {
  proposal: Tables['action_proposals']['Row']; run: Tables['decision_runs']['Row'];
  snapshot: Tables['feature_snapshots']['Row']; policy: Tables['autonomy_policies']['Row'];
  history: RecentActionHistory['actions'];
}
export interface ExecutionStore {
  claim(): Promise<ExecutionContext>;
  checkpoint(before: AdvertisingState, request: Json): Promise<void>;
  finish(success: boolean, after: AdvertisingState | null, error: Json): Promise<void>;
  authorize?(): Promise<void>;
}

export function executionEnabled(businessId: string, env: Record<string, string | undefined> = process.env): boolean {
  return env.DEEPVISOR_META_EXECUTION_ENABLED === 'true' && Boolean(businessId) &&
    (env.DEEPVISOR_META_EXECUTION_BUSINESSES ?? '').split(',').map((id) => id.trim()).includes(businessId);
}

function verifyApproval(context: ExecutionContext, businessId: string, proposalId: string, now: Date) {
  const { proposal, run, snapshot, policy } = context;
  const result = record(proposal.policy_result_json);
  const review = record(result.review);
  const age = now.getTime() - Date.parse(String(review.reviewedAt));
  if (proposal.id !== proposalId || [proposal, run, snapshot, policy].some((row) => row.business_id !== businessId) ||
    proposal.decision_run_id !== run.id || run.feature_snapshot_id !== snapshot.id || run.status !== 'completed' ||
    proposal.status !== 'approved' || !proposal.requires_approval || policy.mode !== 'approval_required' ||
    result.outcome !== 'REQUIRE_APPROVAL' || result.reason !== 'REVIEW_MODE' || review.choice !== 'approve' ||
    typeof review.userId !== 'string' || !review.userId || review.fingerprint !== approvalFingerprint(proposal, run, snapshot, policy) ||
    !Number.isFinite(age) || age < 0 || age > 3600000 || snapshot.entity_type !== 'adset' || proposal.target_entity_type !== 'adset' ||
    snapshot.entity_id !== proposal.target_entity_id || record(policy.budget_boundaries_json).executionEnabled !== true ||
    record(policy.budget_boundaries_json).exclusiveWriterConfirmed !== true) throw new AdvertisingError('INVALID_OR_STALE_APPROVAL');
}

function verifyAuto(context: ExecutionContext, businessId: string, proposalId: string, now: Date) {
  const { proposal, run, snapshot, policy } = context;
  const result = record(proposal.policy_result_json);
  const auto = record(result.automaticAuthorization);
  const bounds = record(policy.budget_boundaries_json);
  const age = now.getTime() - Date.parse(run.updated_at);
  if (proposal.id !== proposalId || [proposal,run,snapshot,policy].some(row=>row.business_id !== businessId) ||
    proposal.decision_run_id !== run.id || run.feature_snapshot_id !== snapshot.id || run.status !== 'completed' ||
    proposal.status !== 'pending' || proposal.requires_approval || policy.mode !== 'autonomous' ||
    result.outcome !== 'ALLOW_EXECUTION' || result.reason !== 'POLICY_PASSED' || proposal.risk_level !== 'low' ||
    auto.fingerprint !== approvalFingerprint(proposal,run,snapshot,policy) ||
    !Number.isFinite(age) || age < 0 || age > 120000 || snapshot.entity_type !== 'adset' ||
    proposal.target_entity_type !== 'adset' || snapshot.entity_id !== proposal.target_entity_id ||
    bounds.executionEnabled !== true || bounds.exclusiveWriterConfirmed !== true ||
    record(bounds.limitedAuto).enabled !== true || record(bounds.limitedAuto).killSwitch !== false) throw new AdvertisingError('INVALID_AUTO_AUTHORIZATION');
}

export function evaluateExecutionPolicy(context: ExecutionContext, state: AdvertisingState, adapter: AdvertisingPlatformAdapter, now: Date, automatic = false, accountBudget?: AccountBudgetState): ProposedAction {
  const { policy, proposal, snapshot, run } = context;
  const bounds = record(policy.budget_boundaries_json);
  const cooldown = record(policy.cooldown_config_json);
  if (!Array.isArray(bounds.lockedEntityIds) || bounds.lockedEntityIds.some((id) => typeof id !== 'string')) throw new AdvertisingError('MISSING_LOCK_CONFIGURATION');
  const budget = adapter.resolveBudget(state);
  if (proposal.action_type === 'REDUCE_BUDGET' && record(proposal.current_state_json).budgetMinor !== budget.amountMinor) throw new AdvertisingError('APPROVED_BUDGET_MISMATCH');
  const businessPolicy = {
    businessId: policy.business_id, mode: automatic ? 'LIMITED_AUTO' : 'REVIEW', timeZone: bounds.timeZone, currency: bounds.currency,
    budgetPeriod: bounds.budgetPeriod, allowedActionClasses: policy.allowed_action_classes,
    minimumEvidence: policy.minimum_evidence_json, maxBudgetChangePercent: policy.max_budget_change_percent,
    minBudgetMinor: bounds.minBudgetMinor, maxBudgetMinor: bounds.maxBudgetMinor,
    cooldownHours: cooldown.cooldownHours, maxDailyChanges: cooldown.maxDailyChanges,
    ...(automatic ? { limitedAuto: bounds.limitedAuto } : {}),
  } as BusinessPolicy;
  const proposed = record(proposal.proposed_state_json);
  let action: ProposedAction;
  if (proposal.action_type === 'PAUSE_DELIVERY_UNIT') action = { type: 'PAUSE_DELIVERY_UNIT' };
  else if (proposal.action_type === 'REDUCE_BUDGET' && typeof proposed.targetBudgetMinor === 'number') action = { type: 'REDUCE_BUDGET', targetBudgetMinor: proposed.targetBudgetMinor };
  else throw new AdvertisingError('UNSUPPORTED_ACTION');
  const decision = validateDecisionResult(record(run.decision_json).result);
  if (decision.providerId !== run.provider || decision.modelId !== run.provider_model ||
    (automatic && (decision.providerVersion !== run.provider_version || decision.modelVersion !== run.model_version))) throw new AdvertisingError('DECISION_IDENTITY_MISMATCH');
  const evaluated = new PolicyEngine().evaluate({
    now: now.toISOString(), policy: businessPolicy, decision, snapshot: snapshot.feature_json as unknown as FeatureSnapshot,
    proposedAction: action,
    entity: { businessId: proposal.business_id, adAccountId: snapshot.ad_account_id, entityId: state.adset.id,
      platform: 'meta', entityType: 'adset', status: state.adset.status === 'ACTIVE' ? 'active' : 'paused',
      locked: bounds.lockedEntityIds.includes(state.adset.id) || bounds.lockedEntityIds.includes(state.campaign.id),
      budgetOwner: budget.owner, budgetMinor: budget.amountMinor, budgetPeriod: budget.period,
      currency: state.account.currency, timeZone: state.account.timezone_name, observedAt: now.toISOString(),
      ...(automatic ? { accountBudgetMinor: accountBudget?.totalDailyBudgetMinor } : {}) },
    history: { businessId: proposal.business_id, complete: true, since: new Date(now.getTime() - 366 * 86400000).toISOString(), until: now.toISOString(),
      actions: context.history.filter((item) => ['pending', 'running', 'unknown'].includes(item.status) || Date.parse(item.attemptedAt) >= now.getTime() - 366 * 86400000) },
  });
  if (evaluated.outcome !== (automatic ? 'ALLOW_EXECUTION' : 'REQUIRE_APPROVAL') || evaluated.reason !== (automatic ? 'POLICY_PASSED' : 'REVIEW_MODE') || !evaluated.action ||
    (automatic && evaluated.risk !== 'low')) throw new AdvertisingError('POLICY_BLOCKED', { reason: evaluated.reason });
  if (state.account.account_status !== 1 || state.adset.effective_status !== 'ACTIVE' || state.campaign.status !== 'ACTIVE' || state.campaign.effective_status !== 'ACTIVE') throw new AdvertisingError('META_NOT_ACTIVE');
  return evaluated.action;
}

function verifyAfter(before: AdvertisingState, after: AdvertisingState, action: ProposedAction, adapter: AdvertisingPlatformAdapter): boolean {
  const expected = structuredClone(before);
  // Meta updates this timestamp as a consequence of either supported write.
  expected.adset.updated_time = after.adset.updated_time;
  if (action.type === 'PAUSE_DELIVERY_UNIT') { expected.adset.status = 'PAUSED'; expected.adset.effective_status = 'PAUSED'; }
  else expected.adset[`${adapter.resolveBudget(before).period}_budget`] = String(action.targetBudgetMinor);
  return canonical(expected) === canonical(after);
}

/** No provider is invoked here. Only already-approved persisted lineage is accepted. */
interface ExecutorInput {
  businessId: string; proposalId: string; enabled: boolean; store: ExecutionStore;
  adapter: (context: ExecutionContext) => Promise<AdvertisingPlatformAdapter>; now?: () => Date;
}
export async function executeReview(input: ExecutorInput): Promise<void> { return execute(input, false); }
export async function executeLimitedAuto(input: ExecutorInput): Promise<void> { return execute(input, true); }

async function execute(input: ExecutorInput, automatic: boolean): Promise<void> {
  if (!input.enabled) throw new AdvertisingError('EXECUTION_DISABLED');
  const now = input.now ?? (() => new Date());
  const context = await input.store.claim();
  let adapter: AdvertisingPlatformAdapter | undefined;
  let after: AdvertisingState | null = null;
  let writeAttempted = false;
  const verify = automatic ? verifyAuto : verifyApproval;
  let beforeAccount: AccountBudgetState | undefined;
  try {
    verify(context, input.businessId, input.proposalId, now());
    if (automatic && !input.store.authorize) throw new AdvertisingError('MISSING_AUTO_AUTHORIZATION_GATE');
    adapter = await input.adapter(context);
    const expected = metaStateSchema.safeParse(record(context.proposal.current_state_json).metaState);
    if (!expected.success) throw new AdvertisingError('MISSING_APPROVED_META_STATE');
    const before = await adapter.read();
    if (canonical(before) !== canonical(expected.data)) throw new AdvertisingError('STALE_PROPOSAL');
    if (automatic) {
      if (!adapter.readAccountBudget) throw new AdvertisingError('MISSING_ACCOUNT_BUDGET');
      beforeAccount = await adapter.readAccountBudget();
      if (canonical(beforeAccount) !== canonical(record(context.proposal.current_state_json).accountBudget)) throw new AdvertisingError('ACCOUNT_STATE_CHANGED');
      if (beforeAccount.accountId !== before.account.account_id || canonical(beforeAccount.adsets.find(row=>row.id === before.adset.id)) !== canonical(before.adset) ||
        canonical(beforeAccount.campaigns.find(row=>row.id === before.campaign.id)) !== canonical(before.campaign)) throw new AdvertisingError('ACCOUNT_STATE_CHANGED');
    }
    evaluateExecutionPolicy(context, before, adapter, now(), automatic, beforeAccount);
    const observedAt = now().getTime();
    const fresh = await adapter.read();
    if (canonical(before) !== canonical(fresh)) throw new AdvertisingError('META_STATE_CHANGED');
    if (automatic && canonical(await adapter.readAccountBudget!()) !== canonical(beforeAccount)) throw new AdvertisingError('ACCOUNT_STATE_CHANGED');
    const action = evaluateExecutionPolicy(context, fresh, adapter, now(), automatic, beforeAccount);
    verify(context, input.businessId, input.proposalId, now());
    const budgetCapability = adapter.resolveBudget(fresh);
    await input.store.checkpoint({ ...fresh, ...(automatic ? { accountBudget: beforeAccount } : {}) }, { executorVersion: 1, executionMode: automatic ? 'LIMITED_AUTO' : 'REVIEW', platform: 'meta', graphVersion: 'v24.0', action,
      request: { method: 'POST', entityId: fresh.adset.id, fields: action.type === 'PAUSE_DELIVERY_UNIT' ? { status: 'PAUSED' } : { [`${budgetCapability.period}_budget`]: String(action.targetBudgetMinor) } },
      budgetCapability, approvalFingerprint: String(record(record(context.proposal.policy_result_json)[automatic ? 'automaticAuthorization' : 'review']).fingerprint) } as unknown as Json);
    if (automatic) await input.store.authorize!();
    if (now().getTime() - observedAt > 15000) throw new AdvertisingError('PREWRITE_STATE_EXPIRED');
    writeAttempted = true;
    await adapter.apply(action, fresh);
    after = await adapter.read();
    if (!verifyAfter(fresh, after, action, adapter)) throw new AdvertisingError('READBACK_MISMATCH');
    if (automatic) {
      const afterAccount = await adapter.readAccountBudget!();
      const expectedAccount = structuredClone(beforeAccount!);
      expectedAccount.totalDailyBudgetMinor -= action.type === 'PAUSE_DELIVERY_UNIT' ? budgetCapability.amountMinor : budgetCapability.amountMinor-action.targetBudgetMinor;
      expectedAccount.adsets = expectedAccount.adsets.map(row=>row.id === after!.adset.id ? after!.adset : row);
      after = { ...after, ...{ accountBudget: afterAccount } };
      if (canonical(expectedAccount) !== canonical(afterAccount)) throw new AdvertisingError('ACCOUNT_READBACK_MISMATCH');
    }
    await input.store.finish(true, after, null);
  } catch (error) {
    if (writeAttempted && !after && adapter) {
      try { after = await adapter.read(); } catch { /* Preserve the original failure; no write retries. */ }
    }
    const failure = error instanceof AdvertisingError ? error : new AdvertisingError('EXECUTION_VALIDATION_OR_STORAGE_ERROR');
    await input.store.finish(false, after, { code: failure.code, ...failure.metadata, reconciliationRequired: writeAttempted });
    throw failure;
  }
}
