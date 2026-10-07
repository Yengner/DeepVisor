import type { Database } from "@/lib/shared/types/supabase";
type Ai = Database["ai"]["Tables"];
type Public = Database["public"]["Tables"];
export type Period = "today" | "7d" | "30d";
export type Mode = "OFF" | "SHADOW" | "REVIEW" | "LIMITED AUTO" | "Unavailable";
export type UnitState =
  "Paused" | "Needs attention" | "Insufficient data" | "Watching" | "Healthy";
export type DailyRow = Pick<
  Public["ad_entity_performance_daily"]["Row"],
  | "entity_id"
  | "day"
  | "currency_code"
  | "spend"
  | "leads"
  | "messages"
  | "calls"
  | "impressions"
  | "clicks"
  | "reach"
  | "inline_link_clicks"
>;
export type Entity = Pick<
  Public["ad_entities"]["Row"],
  "id" | "external_id" | "name" | "status"
>;
export type Metrics = {
  spend: number | null;
  results: number | null;
  costPerResult: number | null;
};
export type TrendPoint = Metrics & { day: string; current: boolean };
export interface PerformanceView {
  metrics: Metrics;
  currency: string | null;
  since: string;
  until: string;
  missingDays: number;
  targetLabel: string | null;
  targetStatus: "not_configured" | "unavailable";
  points: TrendPoint[];
  units: Array<Metrics & { name: string; state: UnitState }>;
}
export interface AttentionItem {
  entity: string;
  title: string;
  reason: string;
  detail: string | null;
  evidence: string | null;
  period: string | null;
  confidence: number | null;
  state: string;
  mode: Mode | null;
}
export interface ActivityItem {
  title: string;
  entity: string;
  at: string;
  state: string;
  mode: Mode | null;
}
export interface DecisionsView {
  counts: {
    evaluations: number;
    checked: number;
    holds: number;
    recommendations: number;
    blocked: number;
    approvals: number | null;
    shadow: number | null;
    executed: number;
  };
  attention: AttentionItem[];
  activity: ActivityItem[];
  lastCheck: string | null;
  provenanceUnavailable: boolean;
  outcomesUnavailable: boolean;
}
export interface DecisionRecords {
  runs: Ai["decision_runs"]["Row"][];
  snapshots: Ai["feature_snapshots"]["Row"][];
  proposals: Ai["action_proposals"]["Row"][];
  executions: Pick<
    Ai["executed_actions"]["Row"],
    | "id"
    | "business_id"
    | "action_proposal_id"
    | "status"
    | "error_json"
    | "created_at"
    | "started_at"
    | "completed_at"
  >[];
  outcomes: Pick<
    Ai["action_outcomes"]["Row"],
    | "id"
    | "executed_action_id"
    | "shadow_decision_run_id"
    | "source_kind"
    | "measurement_status"
    | "measured_at"
    | "measurement_horizon_hours"
  >[];
  shadowRunIds: string[];
  autoRunIds: string[];
  provenanceUnavailable: boolean;
  outcomesUnavailable: boolean;
  policy: Ai["autonomy_policies"]["Row"] | null;
  policyUnavailable: boolean;
}
