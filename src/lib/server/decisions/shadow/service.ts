import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/shared/types/supabase';
import { createAdminClient } from '../../supabase/admin';
import { DecisionEngine, DecisionEngineError } from '../DecisionEngine';
import { getAutonomyPolicy } from '../repository';
import { DeterministicDecisionProvider } from '../providers/DeterministicDecisionProvider';
import { JevDecisionProvider } from '../providers/JevDecisionProvider';
import type { DecisionProvider } from '../types';
import { canonical } from '../approval';
import { assertFresh, evaluationVersion, evaluateShadowPolicy, featureSnapshot, SHADOW_QUESTIONS, type ShadowJob } from './evaluate';

type Client = SupabaseClient<Database>;
const enabled = () => process.env.DEEPVISOR_SHADOW_ENABLED === 'true';
function provider(): DecisionProvider {
  if (process.env.DEEPVISOR_SHADOW_PROVIDER === 'jev') return new JevDecisionProvider();
  if (process.env.DEEPVISOR_SHADOW_PROVIDER === 'mock') return new DeterministicDecisionProvider();
  throw new Error('SHADOW_PROVIDER_NOT_CONFIGURED');
}
function log(event: string, fields: Record<string, unknown>) {
  console.info(JSON.stringify({ event: `shadow.${event}`, ...fields }));
}

export async function enqueueShadowAfterSync(client: Client, input: { businessId: string; integrationId: string; adAccountId: string; syncJobId: string }): Promise<number> {
  if (!enabled()) return 0;
  try {
    const version = evaluationVersion(provider().identity);
    const { data, error } = await client.schema('ai').rpc('enqueue_meta_shadow', {
      p_business: input.businessId, p_integration: input.integrationId, p_account: input.adAccountId,
      p_sync_job: input.syncJobId, p_version: version,
    }).abortSignal(AbortSignal.timeout(5000));
    if (error) throw error;
    log('enqueued', { ...input, count: data ?? 0 });
    return data ?? 0;
  } catch {
    log('enqueue_failed', { ...input, code: 'SHADOW_ENQUEUE_FAILED' });
    return 0;
  }
}

export async function runShadowJob(client: Client, job: ShadowJob, decisionProvider: DecisionProvider, now: () => Date = () => new Date()): Promise<void> {
  const started = Date.now();
  const fields = { jobId: job.id, businessId: job.business_id, adAccountId: job.ad_account_id, entityId: job.entity_id, sourceHash: job.source_hash, decisionRunId: job.decision_run_id };
  log('started', fields);
  try {
    assertFresh(job, now());
    if (job.evaluation_version !== evaluationVersion(decisionProvider.identity)) throw new Error('PROVIDER_VERSION_CHANGED');
    const currentPolicy = await getAutonomyPolicy(client, job.business_id);
    if (!currentPolicy || currentPolicy.mode !== 'observe') throw new Error('SHADOW_DISABLED');
    const configuration = Object.fromEntries(Object.entries(currentPolicy).filter(([key]) => key !== 'created_at' && key !== 'updated_at'));
    if (canonical(configuration) !== canonical(job.source_json.policy)) throw new Error('POLICY_CHANGED');
    const snapshot = featureSnapshot(job);
    const evaluated = await new DecisionEngine(client, decisionProvider).evaluate({
      businessId: job.business_id, platformIntegrationId: job.platform_integration_id, snapshot, questions: SHADOW_QUESTIONS,
      persistenceIds: { featureSnapshotId: job.feature_snapshot_id, decisionRunId: job.decision_run_id },
    });
    assertFresh(job, now());
    const { result, proposal } = evaluateShadowPolicy(job, evaluated.result, now());
    const { error } = await client.schema('ai').rpc('finish_meta_shadow', { p_job: job.id, p_result: result, p_proposal: proposal, p_error: null });
    if (error) throw error;
    log('completed', { ...fields, decision: evaluated.result.decision, provider: evaluated.result.providerId, elapsedMs: Date.now() - started });
  } catch (error) {
    const known = ['STALE_SOURCE','PROVIDER_VERSION_CHANGED','SHADOW_DISABLED','POLICY_CHANGED'];
    const code = error instanceof DecisionEngineError ? error.code : error instanceof Error && known.includes(error.message) ? error.message : 'SHADOW_EVALUATION_FAILED';
    try {
      const { error: failure } = await client.schema('ai').rpc('finish_meta_shadow', { p_job: job.id, p_result: null, p_proposal: null, p_error: code });
      if (failure) throw failure;
    } catch { log('audit_failed', { ...fields, code: 'SHADOW_FINALIZATION_FAILED' }); }
    log('failed', { ...fields, code, elapsedMs: Date.now() - started });
  }
}

/** Separate post-response work; failures never propagate into Meta sync. */
export async function drainShadowJobs(): Promise<void> {
  if (!enabled()) return;
  try {
    const decisionProvider = provider();
    const client = createAdminClient();
    // One bounded inference per worker tick. Subsequent sync-worker ticks drain backlog.
    const { data, error } = await client.schema('ai').rpc('claim_meta_shadow', {});
    if (error) throw error;
    if (data) await runShadowJob(client, data as unknown as ShadowJob, decisionProvider);
  } catch { log('worker_failed', { code: 'SHADOW_WORKER_FAILED' }); }
}
