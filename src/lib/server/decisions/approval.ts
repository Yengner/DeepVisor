import { createHash } from 'node:crypto';
import type { Database } from '@/lib/shared/types/supabase';

type Tables = Database['ai']['Tables'];
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}

// Bind the human review to the exact proposal, evidence and policy, not just an ID.
export function approvalFingerprint(proposal: Tables['action_proposals']['Row'], run: Tables['decision_runs']['Row'], snapshot: Tables['feature_snapshots']['Row'], policy: Tables['autonomy_policies']['Row']): string {
  return createHash('sha256').update(canonical({
    business: proposal.business_id, run, snapshot, policy,
    proposal: { id: proposal.id, action: proposal.action_type, entityType: proposal.target_entity_type,
      entity: proposal.target_entity_id, current: proposal.current_state_json, proposed: proposal.proposed_state_json,
      risk: proposal.risk_level, requiresApproval: proposal.requires_approval },
  })).digest('hex');
}
