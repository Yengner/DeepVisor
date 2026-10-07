import type { Json } from './supabase';

// Local additive bindings for the V2 migration; merge into generated bindings after deployment.
type RecordBase = { id: string; business_id: string; created_at: string };
type MutableRecord = RecordBase & { updated_at: string };
type Relation<Name extends string, Columns extends string[], Target extends string, TargetColumns extends string[]> = {
  foreignKeyName: Name;
  columns: Columns;
  isOneToOne: false;
  referencedRelation: Target;
  referencedColumns: TargetColumns;
};
type BusinessRelation<T extends string> = Relation<`${T}_business_id_fkey`, ['business_id'], 'business_profiles', ['id']>;
type ParentRelation<T extends string, Column extends string, Parent extends string> =
  Relation<`${T}_business_id_${Column}_fkey`, ['business_id', Column], Parent, ['business_id', 'id']>;
type Table<Row, Required extends keyof Row, Relationships> = {
  Row: Row;
  Insert: Pick<Row, Required> & Partial<Omit<Row, Required>>;
  Update: Partial<Row>;
  Relationships: Relationships;
};

export type FeatureSnapshotRow = RecordBase & {
  platform_integration_id: string;
  ad_account_id: string;
  entity_type: string;
  entity_id: string;
  feature_schema_version: number;
  feature_json: Json;
};

export type DecisionRunRow = MutableRecord & {
  feature_snapshot_id: string;
  provider: string;
  provider_model: string | null;
  provider_version: string | null;
  model_version: string | null;
  decision_json: Json;
  confidence: number | null;
  provider_response_json: Json | null;
  status: 'pending' | 'completed' | 'failed';
};

export type ActionProposalRow = MutableRecord & {
  decision_run_id: string;
  action_type: string;
  target_entity_type: string;
  target_entity_id: string;
  current_state_json: Json;
  proposed_state_json: Json;
  risk_level: 'unknown' | 'low' | 'medium' | 'high';
  policy_result_json: Json;
  requires_approval: boolean;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
};

export type ExecutedActionRow = MutableRecord & {
  action_proposal_id: string;
  status: 'pending' | 'running' | 'succeeded' | 'failed';
  request_metadata_json: Json;
  state_before_json: Json | null;
  state_after_json: Json | null;
  error_json: Json | null;
  started_at: string | null;
  completed_at: string | null;
};

export type ActionOutcomeRow = RecordBase & {
  executed_action_id: string;
  measurement_horizon_hours: number;
  metrics_before_json: Json;
  metrics_after_json: Json;
  calculated_change_json: Json;
};

export type AutonomyPolicyRow = MutableRecord & {
  mode: 'off' | 'observe' | 'approval_required' | 'autonomous';
  allowed_action_classes: string[];
  max_budget_change_percent: number;
  budget_boundaries_json: Json;
  cooldown_config_json: Json;
  minimum_evidence_json: Json;
};

export type DecisionPersistenceTables = {
  feature_snapshots: Table<FeatureSnapshotRow, 'business_id' | 'platform_integration_id' | 'ad_account_id' | 'entity_type' | 'entity_id' | 'feature_schema_version' | 'feature_json', [
    BusinessRelation<'feature_snapshots'>,
    Relation<'feature_snapshots_platform_integration_id_fkey', ['platform_integration_id'], 'platform_integrations', ['id']>,
    Relation<'feature_snapshots_ad_account_id_fkey', ['ad_account_id'], 'ad_accounts', ['id']>,
  ]>;
  decision_runs: Table<DecisionRunRow, 'business_id' | 'feature_snapshot_id' | 'provider', [BusinessRelation<'decision_runs'>, ParentRelation<'decision_runs', 'feature_snapshot_id', 'feature_snapshots'>]>;
  action_proposals: Table<ActionProposalRow, 'business_id' | 'decision_run_id' | 'action_type' | 'target_entity_type' | 'target_entity_id', [BusinessRelation<'action_proposals'>, ParentRelation<'action_proposals', 'decision_run_id', 'decision_runs'>]>;
  executed_actions: Table<ExecutedActionRow, 'business_id' | 'action_proposal_id', [BusinessRelation<'executed_actions'>, ParentRelation<'executed_actions', 'action_proposal_id', 'action_proposals'>]>;
  action_outcomes: Table<ActionOutcomeRow, 'business_id' | 'executed_action_id' | 'measurement_horizon_hours' | 'metrics_before_json' | 'metrics_after_json' | 'calculated_change_json', [BusinessRelation<'action_outcomes'>, ParentRelation<'action_outcomes', 'executed_action_id', 'executed_actions'>]>;
  autonomy_policies: Table<AutonomyPolicyRow, 'business_id', [Omit<BusinessRelation<'autonomy_policies'>, 'isOneToOne'> & { isOneToOne: true }]>;
};
