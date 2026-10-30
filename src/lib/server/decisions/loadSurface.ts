import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/shared/types/supabase';
import { getAutonomyPolicy } from './repository';
import { listTrendFindingsForBusiness } from '../intelligence/repositories/trendFindings';
import { toDecisionCard } from './surface';

export async function loadDecisionSurface(client: SupabaseClient<Database>, businessId: string, page: number, accountId?: string) {
  const ai = client.schema('ai');
  // Filter before pagination; the account belongs to the authorized selection.
  let runsQuery = ai.from('decision_runs').select(accountId ? '*,feature_snapshots!inner(ad_account_id)' : '*,feature_snapshots(ad_account_id)').eq('business_id', businessId);
  if (accountId) runsQuery = runsQuery.eq('feature_snapshots.ad_account_id', accountId);
  const [runsResult, policy, findingsResult] = await Promise.all([
    runsQuery.order('created_at', { ascending: false }).order('id', { ascending: false }).range(page * 20, page * 20 + 20),
    getAutonomyPolicy(client, businessId),
    accountId ? Promise.resolve({ findings: [], failed: false }) : listTrendFindingsForBusiness(client, { businessId, status: 'all', limit: 10 })
      .then((findings) => ({ findings, failed: false })).catch(() => ({ findings: [], failed: true })),
  ]);
  if (runsResult.error) throw runsResult.error;
  const runs = (runsResult.data ?? []).slice(0, 20);
  const runIds = runs.map((run) => run.id);
  const [snapshotsResult, proposalsResult] = runIds.length ? await Promise.all([
    ai.from('feature_snapshots').select('*').eq('business_id', businessId).in('id', runs.map((run) => run.feature_snapshot_id)),
    ai.from('action_proposals').select('*').eq('business_id', businessId).in('decision_run_id', runIds).order('created_at'),
  ]) : [{ data: [], error: null }, { data: [], error: null }];
  if (snapshotsResult.error) throw snapshotsResult.error;
  if (proposalsResult.error) throw proposalsResult.error;
  const snapshots = snapshotsResult.data ?? [];
  const proposals = proposalsResult.data ?? [];
  const accountIds = [...new Set(snapshots.map((s) => s.ad_account_id))];
  const [executionResult, accountResult, entityResult] = await Promise.all([
    proposals.length ? ai.from('executed_actions').select('*').eq('business_id', businessId).in('action_proposal_id', proposals.map((p) => p.id)).order('created_at', { ascending: false }) : Promise.resolve({ data: [], error: null }),
    accountIds.length ? client.from('ad_accounts').select('id,name').eq('business_id', businessId).in('id', accountIds) : Promise.resolve({ data: [], error: null }),
    accountIds.length ? client.from('adset_dims').select('id,external_id,name,ad_account_id').in('ad_account_id', accountIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (executionResult.error) throw executionResult.error;
  const executionIds = (executionResult.data ?? []).map(e => e.id);
  const outcomes = executionIds.length ? await ai.from('action_outcomes').select('*').eq('business_id', businessId).in('executed_action_id', executionIds).order('measurement_horizon_hours') : { data: [], error: null };
  if (outcomes.error) throw outcomes.error;
  const cards = runs.map((run) => {
    const snapshot = snapshots.find((s) => s.id === run.feature_snapshot_id);
    const entity = entityResult.data?.find((e) => e.ad_account_id === snapshot?.ad_account_id && (e.external_id === snapshot?.entity_id || e.id === snapshot?.entity_id));
    return toDecisionCard({ run, snapshot, proposals, executions: executionResult.data ?? [], outcomes: outcomes.data ?? [], policy,
      entityName: entity?.name ?? undefined, accountName: accountResult.data?.find((a) => a.id === snapshot?.ad_account_id)?.name ?? undefined });
  });
  return { cards, hasNext: (runsResult.data?.length ?? 0) > 20, findingsUnavailable: findingsResult.failed,
    findings: findingsResult.findings.map((finding) => ({ id: finding.id, title: finding.title, summary: finding.summary,
      reason: finding.reason, status: finding.status, confidence: finding.confidence, detectedAt: finding.detectedAt })),
  };
}
