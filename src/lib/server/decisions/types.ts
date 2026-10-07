import type { Json } from '@/lib/shared/types/supabase';
import type { FeatureSnapshot } from '@/lib/server/features';

export const DECISIONS = [
  'HOLD', 'INSUFFICIENT_DATA', 'REDUCE_BUDGET', 'PAUSE_DELIVERY_UNIT', 'REVIEW_CREATIVE',
] as const;
export type Decision = typeof DECISIONS[number];

export interface DecisionProviderIdentity {
  providerId: string;
  providerVersion: string | null;
  modelId: string;
  modelVersion: string | null;
}

export interface DecisionResult extends DecisionProviderIdentity {
  decision: Decision;
  confidence: number | null;
  probabilities?: Partial<Record<Decision, number>>;
  explanation?: string;
  evidence?: Json;
  rawResponse?: Json;
}

export interface DecisionProvider {
  readonly identity: DecisionProviderIdentity;
  evaluate(state: FeatureSnapshot, questions: readonly string[]): Promise<DecisionResult>;
}

export interface PersistedDecisionResult {
  featureSnapshotId: string;
  decisionRunId: string;
  result: DecisionResult;
}
