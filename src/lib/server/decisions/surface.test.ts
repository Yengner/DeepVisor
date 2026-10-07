import { createClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Database } from '@/lib/shared/types/supabase';
import { canReviewProposal, toDecisionCard } from './surface';
import { reviewProposal } from './reviewProposal';
import { approvalFingerprint } from './approval';

type Tables = Database['ai']['Tables'];
const base = { id: 'run', business_id: 'business', created_at: '2026-10-06T12:00:00Z', updated_at: '2026-10-06T12:00:00Z' };
const run: Tables['decision_runs']['Row'] = { ...base, feature_snapshot_id: 'snapshot', provider: 'deepvisor-mock', provider_model: 'rules', provider_version: '1', model_version: '1', status: 'completed', confidence: 0.8, provider_response_json: { private: 'hidden' }, decision_json: { questions: ['Is delivery efficient?'], result: { decision: 'HOLD', explanation: 'Performance is steady.', probabilities: { HOLD: 0.8 } } } };
const snapshot: Tables['feature_snapshots']['Row'] = { ...base, id: 'snapshot', platform_integration_id: 'integration', ad_account_id: 'account', entity_type: 'adset', entity_id: 'adset', feature_schema_version: 1, feature_json: { deliveryUnit: { currency: 'USD' }, windows: { recent7d: { sinceDay: '2026-09-30', untilDay: '2026-10-06', metrics: { spend: 100, results: 10, costPerResult: 10 } } } } };
const policy: Tables['autonomy_policies']['Row'] = { ...base, mode: 'approval_required', allowed_action_classes: ['REDUCE_BUDGET'], max_budget_change_percent: 10, budget_boundaries_json: {}, cooldown_config_json: {}, minimum_evidence_json: {} };
const proposal: Tables['action_proposals']['Row'] = { ...base, id: 'proposal', decision_run_id: 'run', action_type: 'REDUCE_BUDGET', target_entity_id: 'adset', target_entity_type: 'adset', current_state_json: { budgetMinor: 10000 }, proposed_state_json: { targetBudgetMinor: 9000 }, risk_level: 'low', policy_result_json: { outcome: 'REQUIRE_APPROVAL', reason: 'REVIEW_MODE' }, requires_approval: true, status: 'pending' };
const input = { run, snapshot, policy, proposals: [proposal], executions: [], entityName: 'New clients', accountName: 'My salon' };

describe('decision surface', () => {
  it('presents persisted mock decisions and evidence without raw provider data', () => {
    const card = toDecisionCard({ ...input, proposals: [] });
    expect(card).toMatchObject({ title: 'Keep things as they are', entity: 'New clients', confidence: 0.8, probability: 0.8, provider: 'Sample evaluation' });
    expect(card.evidence).toContainEqual({ label: 'Results', value: '10' });
    expect(JSON.stringify(card)).not.toContain('hidden');
  });
  it.each(['INSUFFICIENT_DATA', 'REVIEW_CREATIVE', 'PAUSE_DELIVERY_UNIT'])('shows %s as a readable review', (decision) => {
    expect(toDecisionCard({ ...input, run: { ...run, decision_json: { result: { decision } } } }).title).not.toBe('Account review');
  });
  it.each(['failed', 'pending'])('does not imply a completed decision for %s', (status) => {
    const card = toDecisionCard({ ...input, run: { ...run, status } });
    expect(card.confidence).toBeNull();
    expect(card.proposals[0].canReview).toBe(false);
  });
  it.each([['BLOCK', 'Blocked'], ['SHADOW_ONLY', 'Observation only'], ['REQUIRE_APPROVAL', 'Needs approval']])('labels %s accurately', (outcome, status) => {
    expect(toDecisionCard({ ...input, proposals: [{ ...proposal, policy_result_json: { outcome } }] }).proposals[0].status).toBe(status);
  });
  it.each([['approved', 'Approved - not executed'], ['rejected', 'Rejected'], ['cancelled', 'Cancelled']])('shows %s history', (status, label) => {
    expect(toDecisionCard({ ...input, proposals: [{ ...proposal, status }] }).proposals[0]).toMatchObject({ status: label, canReview: false });
  });
  it('recognizes executed history and disables further review', () => {
    const execution: Tables['executed_actions']['Row'] = { ...base, action_proposal_id: proposal.id, status: 'succeeded', completed_at: base.created_at, started_at: base.created_at, error_json: null, request_metadata_json: {}, state_before_json: {}, state_after_json: {} };
    expect(toDecisionCard({ ...input, executions: [execution] }).proposals[0]).toMatchObject({ status: 'Executed', canReview: false });
  });
  it('fails closed without policy, snapshot, matching target or valid probability', () => {
    expect(canReviewProposal(proposal, run, null, false)).toBe(false);
    expect(toDecisionCard({ ...input, snapshot: undefined }).proposals[0].canReview).toBe(false);
    expect(toDecisionCard({ ...input, snapshot: { ...snapshot, entity_id: 'other' } }).proposals[0].canReview).toBe(false);
    expect(toDecisionCard({ ...input, run: { ...run, confidence: 2 } }).confidence).toBeNull();
  });
  it('formats budget changes and allows only pending REVIEW actions', () => {
    expect(toDecisionCard(input).proposals[0]).toMatchObject({ detail: '$100.00 to $90.00', canReview: true });
    expect(canReviewProposal(proposal, run, { ...policy, mode: 'autonomous' }, false)).toBe(false);
    expect(canReviewProposal(proposal, run, policy, true)).toBe(false);
  });
});

const transport = vi.fn<typeof fetch>();
const client = createClient<Database>('https://unit-test.supabase.co', 'test-key', { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: transport } });
const reviewInput = { businessId: 'business', userId: 'owner', role: 'owner', proposalId: 'proposal', choice: 'approve' as const, reviewFingerprint: approvalFingerprint(proposal, run, snapshot, policy) };
let storedProposal = proposal;
let storedSnapshot = snapshot;
let executionExists = false;
let conflict = false;
beforeEach(() => {
  storedProposal = proposal; storedSnapshot = snapshot; executionExists = false; conflict = false;
  transport.mockReset();
  transport.mockImplementation(async (url, init) => {
    const table = new URL(String(url)).pathname.split('/').pop();
    const records: Record<string, unknown> = { action_proposals: storedProposal, autonomy_policies: policy, decision_runs: run, feature_snapshots: storedSnapshot, executed_actions: executionExists ? [{ id: 'execution' }] : [] };
    const data = init?.method === 'PATCH' ? conflict ? null : { id: 'proposal' } : records[table!];
    return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
});

describe('proposal review persistence', () => {
  it('rejects stale screen approvals when the displayed proposal changed', async () => {
    storedProposal = { ...proposal, proposed_state_json: { targetBudgetMinor: 8000 } };
    await expect(reviewProposal(client, reviewInput)).rejects.toThrow('changed');
    expect(transport.mock.calls.some(([, init]) => init?.method === 'PATCH')).toBe(false);
  });
  it.each(['approve', 'reject'] as const)('saves %s with audit metadata and never executes an action', async (choice) => {
    await reviewProposal(client, { ...reviewInput, choice });
    const writes = transport.mock.calls.filter(([, init]) => init?.method === 'PATCH');
    expect(writes).toHaveLength(1);
    const [url, init] = writes[0];
    expect(new URL(String(url)).pathname).toBe('/rest/v1/action_proposals');
    expect(new URL(String(url)).searchParams.get('updated_at')).toBe(`eq.${proposal.updated_at}`);
    expect(JSON.parse(String(init?.body))).toMatchObject({ status: choice === 'approve' ? 'approved' : 'rejected', policy_result_json: { review: { userId: 'owner', choice } } });
    for (const [request] of transport.mock.calls) expect(new URL(String(request)).searchParams.get('business_id')).toBe('eq.business');
  });
  it('denies members before accessing records', async () => {
    await expect(reviewProposal(client, { ...reviewInput, role: 'member' })).rejects.toThrow('owner or admin');
    expect(transport).not.toHaveBeenCalled();
  });
  it.each(['BLOCK', 'SHADOW_ONLY'])('cannot approve %s', async (outcome) => {
    storedProposal = { ...proposal, policy_result_json: { outcome, reason: 'REVIEW_MODE' } };
    await expect(reviewProposal(client, reviewInput)).rejects.toThrow('not available');
    expect(transport.mock.calls.some(([, init]) => init?.method === 'PATCH')).toBe(false);
  });
  it('rejects an action with execution history', async () => {
    executionExists = true;
    await expect(reviewProposal(client, reviewInput)).rejects.toThrow('not available');
  });
  it('rejects a mismatched target', async () => {
    storedSnapshot = { ...snapshot, entity_id: 'other' };
    await expect(reviewProposal(client, reviewInput)).rejects.toThrow('target');
  });
  it('reports concurrent changes rather than overwriting a review', async () => {
    conflict = true;
    await expect(reviewProposal(client, reviewInput)).rejects.toThrow('changed');
  });
});
