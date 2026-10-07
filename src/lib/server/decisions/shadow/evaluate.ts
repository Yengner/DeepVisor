import type { Database, Json } from '@/lib/shared/types/supabase';
import { buildFeatureSnapshot, FEATURE_SCHEMA_VERSION, type MetaDeliveryDailyRow } from '../../features';
import { PolicyEngine } from '../policy/PolicyEngine';
import type { BusinessPolicy, CurrentEntityState, ProposedAction, RecentActionHistory } from '../policy/types';
import type { DecisionProviderIdentity, DecisionResult } from '../types';
import { canonical } from '../approval';
import { record } from '../surface';

export const SHADOW_PIPELINE_VERSION = 1;
export const SHADOW_QUESTION_VERSION = 1;
export const SHADOW_QUESTIONS = ['Should this ad set keep running unchanged, reduce its budget, pause delivery, or have its creative reviewed?'] as const;
export function evaluationVersion(identity: DecisionProviderIdentity): string {
  return canonical({ pipeline: SHADOW_PIPELINE_VERSION, features: FEATURE_SCHEMA_VERSION, questions: SHADOW_QUESTION_VERSION, provider: identity });
}

export interface ShadowJob {
  id: string; business_id: string; platform_integration_id: string; ad_account_id: string; entity_id: string;
  evaluation_version: string; source_hash: string; source_synced_at: string; source_sync_job_id: string;
  feature_snapshot_id: string; decision_run_id: string; action_proposal_id: string;
  started_at: string;
  source_json: {
    asOfDay: string; currency: string; timeZone: string;
    rows: MetaDeliveryDailyRow[]; entity: Record<string, unknown>;
    policy: Omit<Database['ai']['Tables']['autonomy_policies']['Row'], 'created_at' | 'updated_at'>;
  };
  history: RecentActionHistory['actions'];
}

export function assertFresh(job: ShadowJob, now: Date) {
  const age = now.getTime() - Date.parse(job.source_synced_at);
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: job.source_json.timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const yesterday = new Date(`${day}T00:00:00Z`); yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  if (!Number.isFinite(age) || age < 0 || age > 6 * 3600000 || job.source_json.asOfDay !== yesterday.toISOString().slice(0, 10)) throw new Error('STALE_SOURCE');
}

export function featureSnapshot(job: ShadowJob) {
  return buildFeatureSnapshot({ asOfDay: job.source_json.asOfDay, rows: job.source_json.rows,
    deliveryUnit: { platform: 'meta', entityType: 'adset', businessId: job.business_id, adAccountId: job.ad_account_id, adsetId: job.entity_id, currency: job.source_json.currency } });
}

function currentEntity(job: ShadowJob): CurrentEntityState | null {
  const source = job.source_json;
  const entity = source.entity;
  const bounds = record(source.policy.budget_boundaries_json);
  if (!Array.isArray(bounds.lockedEntityIds) || bounds.lockedEntityIds.some((id) => typeof id !== 'string') || entity.id !== job.entity_id) return null;
  const candidates: Array<{ owner: 'adset' | 'campaign'; period: 'daily' | 'lifetime'; amount: number }> = [];
  for (const [key, owner, period] of [['dailyBudget', 'adset', 'daily'], ['lifetimeBudget', 'adset', 'lifetime'], ['campaignDailyBudget', 'campaign', 'daily'], ['campaignLifetimeBudget', 'campaign', 'lifetime']] as const) {
    const raw = entity[key];
    if (raw === null || raw === undefined) continue;
    if (typeof raw !== 'string' || !/^\d+$/.test(raw) || !Number.isSafeInteger(Number(raw))) return null;
    if (Number(raw) > 0) candidates.push({ owner, period, amount: Number(raw) });
  }
  if (candidates.length !== 1 || !entity.campaignId) return null;
  const budget = candidates[0];
  return { businessId: job.business_id, adAccountId: job.ad_account_id, entityId: job.entity_id, platform: 'meta', entityType: 'adset',
    status: entity.status === 'ACTIVE' && entity.effectiveStatus === 'ACTIVE' && entity.campaignStatus === 'ACTIVE' ? 'active' : 'paused',
    locked: bounds.lockedEntityIds.includes(job.entity_id) || bounds.lockedEntityIds.includes(entity.campaignId),
    budgetOwner: budget.owner, budgetMinor: budget.amount, budgetPeriod: budget.period,
    currency: source.currency, timeZone: source.timeZone, observedAt: job.source_synced_at };
}

export function evaluateShadowPolicy(job: ShadowJob, decision: DecisionResult, now: Date) {
  const saved = job.source_json.policy;
  const bounds = record(saved.budget_boundaries_json);
  const cooldown = record(saved.cooldown_config_json);
  const entity = currentEntity(job);
  const policy = { businessId: saved.business_id, mode: 'SHADOW', timeZone: bounds.timeZone, currency: bounds.currency, budgetPeriod: bounds.budgetPeriod,
    allowedActionClasses: saved.allowed_action_classes, minimumEvidence: saved.minimum_evidence_json,
    maxBudgetChangePercent: saved.max_budget_change_percent, minBudgetMinor: bounds.minBudgetMinor, maxBudgetMinor: bounds.maxBudgetMinor,
    cooldownHours: cooldown.cooldownHours, maxDailyChanges: cooldown.maxDailyChanges } as BusinessPolicy;
  let proposedAction: ProposedAction | undefined;
  if (decision.decision === 'PAUSE_DELIVERY_UNIT') proposedAction = { type: 'PAUSE_DELIVERY_UNIT' };
  if (decision.decision === 'REDUCE_BUDGET' && entity) {
    // V1 models choose the class, not arbitrary spend values: a fixed 5% candidate.
    const reduction = Number(BigInt(entity.budgetMinor) * BigInt(5) / BigInt(100));
    proposedAction = { type: 'REDUCE_BUDGET', targetBudgetMinor: entity.budgetMinor - reduction };
  }
  const snapshot = featureSnapshot(job);
  // History is captured atomically at claim, not after inference. Keep the policy
  // clock aligned with that evidence rather than claiming coverage of unseen time.
  const policyTime = new Date(job.started_at);
  const input = { now: policyTime.toISOString(), policy, entity, snapshot, decision, proposedAction,
    history: { businessId: job.business_id, complete: job.history.length <= 10000, since: new Date(policyTime.getTime() - 366 * 86400000).toISOString(), until: policyTime.toISOString(),
      actions: job.history.filter((a) => ['pending','running','unknown'].includes(a.status) || Date.parse(a.attemptedAt) >= policyTime.getTime() - 366 * 86400000) } };
  const engine = new PolicyEngine();
  const shadowPolicy = engine.evaluate(input);
  // This counterfactual records required human review, never enables an execution mode.
  const reviewPolicy = engine.evaluate({ ...input, policy: { ...policy, mode: 'REVIEW' } });
  const result = { shadowOnly: true, pipelineVersion: SHADOW_PIPELINE_VERSION, sourceHash: job.source_hash,
    sourceSyncJobId: job.source_sync_job_id, sourceSyncedAt: job.source_synced_at, evaluatedAt: now.toISOString(), policyAsOf: policyTime.toISOString(),
    policyInput: input, shadowPolicy, reviewPolicy, allowedBySafetyChecks: shadowPolicy.outcome === 'SHADOW_ONLY',
    baseline: { asOfDay: snapshot.asOfDay, recent7d: snapshot.windows.recent7d, previous7d: snapshot.windows.previous7d },
    measurementHorizonsHours: [24,72,168] };
  const proposal = ['REDUCE_BUDGET','PAUSE_DELIVERY_UNIT','REVIEW_CREATIVE'].includes(decision.decision)
    ? { actionType: decision.decision, currentState: entity ?? {}, proposedState: proposedAction ?? { recommendation: decision.decision }, risk: shadowPolicy.risk ?? 'unknown' }
    : null;
  return { result: JSON.parse(JSON.stringify(result)) as Json, proposal: JSON.parse(JSON.stringify(proposal)) as Json };
}
