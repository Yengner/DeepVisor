import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/lib/shared/types/supabase';
import { getActionProposal, getAutonomyPolicy, getDecisionRun, getFeatureSnapshot } from './repository';
import { canReviewProposal, record } from './surface';
import { approvalFingerprint } from './approval';

export async function reviewProposal(client: SupabaseClient<Database>, input: {
  businessId: string; userId: string; role: string; proposalId: string; choice: 'approve' | 'reject'; reviewFingerprint: string;
}) {
  if (!['approve', 'reject'].includes(input.choice)) throw new Error('Invalid review choice.');
  if (!['owner', 'admin'].includes(input.role)) throw new Error('Only an owner or admin can review actions.');
  const [proposal, policy] = await Promise.all([getActionProposal(client, input.businessId, input.proposalId), getAutonomyPolicy(client, input.businessId)]);
  if (!proposal) throw new Error('This action is no longer available.');
  const [run, execution] = await Promise.all([
    getDecisionRun(client, input.businessId, proposal.decision_run_id),
    client.schema('ai').from('executed_actions').select('id').eq('business_id', input.businessId).eq('action_proposal_id', proposal.id).limit(1),
  ]);
  if (execution.error) throw new Error('Unable to verify this action. Try again.');
  if (!run || !canReviewProposal(proposal, run, policy, Boolean(execution.data?.length))) throw new Error('This action is not available for approval. Refresh to see its latest status.');
  const snapshot = await getFeatureSnapshot(client, input.businessId, run.feature_snapshot_id);
  if (!snapshot || snapshot.entity_id !== proposal.target_entity_id || snapshot.entity_type !== proposal.target_entity_type) throw new Error('The action target could not be verified.');
  const fingerprint = approvalFingerprint(proposal, run, snapshot, policy!);
  if (input.reviewFingerprint !== fingerprint) throw new Error('The proposal or evidence changed. Refresh before reviewing.');
  const { data, error } = await client.schema('ai').from('action_proposals').update({
    status: input.choice === 'approve' ? 'approved' : 'rejected',
    policy_result_json: { ...record(proposal.policy_result_json), review: { userId: input.userId, choice: input.choice, reviewedAt: new Date().toISOString(), fingerprint } } as Json,
  }).eq('business_id', input.businessId).eq('id', proposal.id).eq('status', 'pending').eq('updated_at', proposal.updated_at).select('id').maybeSingle();
  if (error || !data) throw new Error('This action changed while you were reviewing it. Refresh and try again.');
}
