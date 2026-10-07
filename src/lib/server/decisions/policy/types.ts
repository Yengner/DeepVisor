import type { FeatureSnapshot } from '@/lib/server/features';
import type { DecisionResult } from '../types';

export interface BusinessPolicy {
  businessId: string;
  mode: 'SHADOW' | 'REVIEW' | 'LIMITED_AUTO' | 'OFF';
  timeZone: string;
  currency: string;
  budgetPeriod: 'daily' | 'lifetime';
  allowedActionClasses: Array<'REDUCE_BUDGET' | 'PAUSE_DELIVERY_UNIT'>;
  minimumEvidence: {
    spend: number;
    impressions: number;
    results: number;
    activeDays: number;
    decisionConfidence: number;
    trackingConfidence: 'medium' | 'high';
    maxSnapshotAgeDays: number;
    maxEntityAgeMinutes: number;
  };
  maxBudgetChangePercent: number;
  minBudgetMinor: number;
  maxBudgetMinor: number;
  cooldownHours: number;
  maxDailyChanges: number;
  limitedAuto?: {
    adAccountId: string;
    enabled: boolean;
    killSwitch: boolean;
    allowedEntityIds: string[];
    minAccountBudgetMinor: number;
    maxAccountBudgetMinor: number;
    maxPauseBudgetMinor: number;
    maxPauseAccountPercent: number;
  };
}

export interface CurrentEntityState {
  businessId: string;
  adAccountId: string;
  entityId: string;
  platform: 'meta';
  entityType: 'adset';
  status: 'active' | 'paused';
  locked: boolean;
  budgetOwner: 'adset' | 'campaign';
  budgetMinor: number;
  currency: string;
  budgetPeriod: 'daily' | 'lifetime';
  timeZone: string;
  observedAt: string;
  accountBudgetMinor?: number;
}

export type ProposedAction =
  | { type: 'REDUCE_BUDGET'; targetBudgetMinor: number }
  | { type: 'PAUSE_DELIVERY_UNIT' };

export interface RecentActionHistory {
  businessId: string;
  complete: boolean;
  since: string;
  until: string;
  actions: Array<{
    id: string;
    businessId: string;
    adAccountId: string;
    entityId: string;
    status: 'pending' | 'running' | 'succeeded' | 'failed' | 'unknown';
    attemptedAt: string;
  }>;
}

export interface PolicyInput {
  policy: BusinessPolicy | null;
  entity: CurrentEntityState | null;
  snapshot: FeatureSnapshot | null;
  decision: DecisionResult | null;
  history: RecentActionHistory | null;
  proposedAction?: ProposedAction;
  now: string;
}

export type PolicyReason =
  | 'INVALID_INPUT' | 'SCOPE_MISMATCH' | 'OFF' | 'NO_ACTION' | 'RECOMMENDATION_ONLY'
  | 'INSUFFICIENT_DATA' | 'LOW_CONFIDENCE' | 'TRACKING_INADEQUATE'
  | 'STALE_DATA' | 'LOCKED' | 'NOT_ACTIVE' | 'ACTION_NOT_ALLOWED'
  | 'PROPOSAL_MISMATCH' | 'SHARED_BUDGET' | 'BUDGET_BOUNDS' | 'BUDGET_CHANGE_LIMIT'
  | 'INCOMPLETE_HISTORY' | 'ACTION_IN_FLIGHT' | 'COOLDOWN' | 'DAILY_LIMIT'
  | 'SHADOW_MODE' | 'REVIEW_MODE' | 'HIGH_RISK' | 'POLICY_PASSED'
  | 'AUTO_DISABLED' | 'ACCOUNT_BUDGET_BOUNDS' | 'NOT_LOW_RISK';

export interface PolicyResult {
  policySchemaVersion: 1;
  outcome: 'HOLD' | 'SHADOW_ONLY' | 'REQUIRE_APPROVAL' | 'ALLOW_EXECUTION' | 'BLOCK';
  reason: PolicyReason;
  risk: 'low' | 'medium' | 'high' | null;
  /** Authorization describes this exact proposal only; no platform operation occurs. */
  action: ProposedAction | null;
}
