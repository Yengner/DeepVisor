import type { Database } from '@/lib/shared/types/supabase';
import { formatCurrencyAmount } from '@/lib/shared/utils/currency';
import { approvalFingerprint } from './approval';

type Tables = Database['ai']['Tables'];
type ActionProposalRow = Tables['action_proposals']['Row'];
type AutonomyPolicyRow = Tables['autonomy_policies']['Row'];
type DecisionRunRow = Tables['decision_runs']['Row'];
type ExecutedActionRow = Tables['executed_actions']['Row'];
type FeatureSnapshotRow = Tables['feature_snapshots']['Row'];

export function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
const text = (value: unknown) => typeof value === 'string' ? value : null;
const numeric = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : null;

export const decisionLabels: Record<string, string> = {
  HOLD: 'Keep things as they are', INSUFFICIENT_DATA: 'More data needed',
  REDUCE_BUDGET: 'Review a lower budget', PAUSE_DELIVERY_UNIT: 'Review pausing this ad set', REVIEW_CREATIVE: 'Refresh your ad creative',
};
const policyReasons: Record<string, string> = {
  INSUFFICIENT_DATA: 'There is not enough recent performance data to support a change.',
  TRACKING_INADEQUATE: 'Results tracking needs attention before changing delivery.',
  LOW_CONFIDENCE: 'The evidence is not strong enough for this change.',
  STALE_DATA: 'Fresh performance data is needed.', LOCKED: 'This ad set is locked.',
  COOLDOWN: 'A recent change needs more time before another adjustment.', DAILY_LIMIT: 'The daily change limit has been reached.',
  BUDGET_BOUNDS: 'The proposed budget falls outside your limits.', BUDGET_CHANGE_LIMIT: 'This change exceeds your budget-change limit.',
  OFF: 'Automatic changes are turned off.', INCOMPLETE_HISTORY: 'Recent action history could not be verified.',
  ACTION_IN_FLIGHT: 'Another change is still being processed.', REVIEW_MODE: 'Your approval is required.',
  HIGH_RISK: 'This change needs a closer review.', SHADOW_MODE: 'This recommendation is being observed only.',
};

export function canReviewProposal(proposal: ActionProposalRow, run: DecisionRunRow, policy: AutonomyPolicyRow | null, hasExecution: boolean): boolean {
  const result = record(proposal.policy_result_json);
  return run.status === 'completed' && proposal.status === 'pending' && proposal.requires_approval &&
    policy?.mode === 'approval_required' && policy.business_id === proposal.business_id && run.business_id === proposal.business_id &&
    proposal.decision_run_id === run.id && result.outcome === 'REQUIRE_APPROVAL' && result.reason === 'REVIEW_MODE' &&
    ['REDUCE_BUDGET', 'PAUSE_DELIVERY_UNIT'].includes(proposal.action_type) &&
    policy.allowed_action_classes.includes(proposal.action_type) && !hasExecution;
}

export interface DecisionCard {
  id: string; title: string; entity: string; account: string; createdAt: string; explanation: string;
  evaluated: string[]; confidence: number | null; probability: number | null; provider: string;
  evidence: Array<{ label: string; value: string }>; period: string | null;
  proposals: Array<{ id: string; title: string; detail: string; status: string; reason: string | null; canReview: boolean; reviewFingerprint: string | null }>;
}

export function toDecisionCard(input: {
  run: DecisionRunRow; snapshot: FeatureSnapshotRow | undefined; proposals: ActionProposalRow[];
  executions: ExecutedActionRow[]; policy: AutonomyPolicyRow | null; entityName?: string; accountName?: string;
}): DecisionCard {
  const { run, snapshot } = input;
  const payload = record(run.decision_json);
  const result = record(payload.result);
  const decision = text(result.decision) ?? '';
  const features = record(snapshot?.feature_json);
  const recent = record(record(features.windows).recent7d);
  const metrics = record(recent.metrics);
  const rawCurrency = text(record(features.deliveryUnit).currency)?.trim().toUpperCase();
  const currency = rawCurrency && /^[A-Z]{3}$/.test(rawCurrency) ? rawCurrency : null;
  const percent = (value: unknown) => { const n = numeric(value); return n !== null && n >= 0 && n <= 1 ? n : null; };
  const title = run.status === 'failed' ? 'Evaluation could not finish' : run.status === 'pending' ? 'Evaluation in progress' : decisionLabels[decision] ?? 'Account review';
  const evidence: DecisionCard['evidence'] = [];
  if (numeric(metrics.spend) !== null) evidence.push({ label: 'Spend', value: currency ? formatCurrencyAmount(numeric(metrics.spend), currency) : String(metrics.spend) });
  if (numeric(metrics.results) !== null) evidence.push({ label: 'Results', value: String(metrics.results) });
  if (numeric(metrics.costPerResult) !== null) evidence.push({ label: 'Cost per result', value: currency ? formatCurrencyAmount(numeric(metrics.costPerResult), currency) : String(metrics.costPerResult) });
  return {
    id: run.id, title, createdAt: run.created_at,
    entity: input.entityName || (snapshot ? `Ad set ${snapshot.entity_id}` : 'Ad set unavailable'),
    account: input.accountName || 'Connected ad account',
    explanation: run.status === 'completed'
      ? text(result.explanation) || (decision === 'HOLD' ? 'No delivery change was recommended.' : decision === 'INSUFFICIENT_DATA' ? 'Wait for stronger evidence before making changes.' : 'Based on the saved performance review. No additional explanation was supplied.')
      : run.status === 'failed' ? 'No action was authorized by this evaluation.' : 'The saved evaluation is waiting for a result.',
    evaluated: Array.isArray(payload.questions) ? payload.questions.filter((q): q is string => typeof q === 'string').slice(0, 5) : [],
    confidence: run.status === 'completed' ? percent(run.confidence) : null,
    probability: run.status === 'completed' ? percent(record(result.probabilities)[decision]) : null,
    provider: run.provider === 'deepvisor-mock' ? 'Sample evaluation' : run.provider === 'jev' ? 'Jev evaluation' : 'DeepVisor evaluation',
    evidence, period: text(recent.sinceDay) && text(recent.untilDay) ? `${recent.sinceDay} to ${recent.untilDay}` : null,
    proposals: input.proposals.filter((p) => p.decision_run_id === run.id).map((proposal) => {
      const policy = record(proposal.policy_result_json);
      const executions = input.executions.filter((execution) => execution.action_proposal_id === proposal.id);
      const latest = [...executions].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
      const outcome = text(policy.outcome);
      const status = executions.some((execution) => record(execution.error_json).reconciliationRequired === true) ? 'Needs reconciliation'
        : executions.some((execution) => execution.status === 'succeeded') ? 'Executed'
        : latest?.status === 'failed' ? 'Execution failed' : latest ? 'Execution pending'
          : proposal.status === 'rejected' ? 'Rejected' : proposal.status === 'cancelled' ? 'Cancelled'
            : proposal.status === 'approved' ? 'Approved - not executed'
              : outcome === 'BLOCK' ? 'Blocked' : outcome === 'SHADOW_ONLY' ? 'Observation only'
                : outcome === 'REQUIRE_APPROVAL' ? 'Needs approval' : outcome === 'ALLOW_EXECUTION' ? 'Eligible - not executed' : 'Not cleared';
      const current = numeric(record(proposal.current_state_json).budgetMinor);
      const proposed = record(proposal.proposed_state_json);
      const target = numeric(proposed.targetBudgetMinor) ?? numeric(proposed.budgetMinor);
      const divisor = currency ? 10 ** (new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2) : 100;
      const detail = proposal.action_type === 'REDUCE_BUDGET' && current !== null && target !== null && currency
        ? `${formatCurrencyAmount(current / divisor, currency)} to ${formatCurrencyAmount(target / divisor, currency)}`
        : proposal.action_type === 'PAUSE_DELIVERY_UNIT' ? 'Pause delivery for this ad set.' : 'Review the proposed change.';
      return { id: proposal.id, title: decisionLabels[proposal.action_type] ?? 'Proposed action', detail, status,
        reason: policyReasons[text(policy.reason) ?? ''] ?? null,
        reviewFingerprint: snapshot && input.policy ? approvalFingerprint(proposal, run, snapshot, input.policy) : null,
        canReview: Boolean(snapshot && snapshot.entity_id === proposal.target_entity_id && snapshot.entity_type === proposal.target_entity_type) &&
          canReviewProposal(proposal, run, input.policy, executions.length > 0),
      };
    }),
  };
}
