import 'server-only';
import { loadBusinessObjectives } from '../../agency/loadObjectives';
import { agencyQuestions } from '../../agency/objectives';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/shared/types/supabase';
import { createMetaExecutionAdapter } from '../../advertising/executeMetaProposal';
import type { AdvertisingState } from '../../advertising/types';
import { DecisionEngine, DecisionEngineError } from '../DecisionEngine';
import { canonical } from '../approval';
import { getAutonomyPolicy } from '../repository';
import type { DecisionProvider } from '../types';
import { assertFresh, featureSnapshot, SHADOW_QUESTIONS, type ShadowJob } from '../shadow/evaluate';
import { evaluateReviewPolicy, reviewVersion } from './evaluate';

type Client = SupabaseClient<Database>;
type StateReader = (job: ShadowJob) => Promise<AdvertisingState>;

export async function runReviewJob(client: Client, job: ShadowJob, provider: DecisionProvider, options: { now?: () => Date; readState?: StateReader; simulation?: boolean } = {}): Promise<void> {
  const now = options.now ?? (() => new Date());
  try {
    assertFresh(job, now());
    if (job.evaluation_version !== reviewVersion(provider.identity)) throw new Error('PROVIDER_VERSION_CHANGED');
    const policy = await getAutonomyPolicy(client, job.business_id);
    if (!policy || policy.mode !== 'approval_required') throw new Error('REVIEW_DISABLED');
    if (canonical(Object.fromEntries(Object.entries(policy).filter(([k]) => !['created_at','updated_at'].includes(k)))) !== canonical(job.source_json.policy)) throw new Error('POLICY_CHANGED');
    const evaluated = await new DecisionEngine(client, provider).evaluate({ businessId: job.business_id, platformIntegrationId: job.platform_integration_id,
      snapshot: featureSnapshot(job), questions: agencyQuestions(SHADOW_QUESTIONS, await loadBusinessObjectives(client, job.business_id)), persistenceIds: { featureSnapshotId: job.feature_snapshot_id, decisionRunId: job.decision_run_id } });
    let state: AdvertisingState | null = null;
    if (['REDUCE_BUDGET','PAUSE_DELIVERY_UNIT'].includes(evaluated.result.decision)) {
      state = options.readState ? await options.readState(job) : await (await createMetaExecutionAdapter(client, job.business_id, {
        platform_integration_id: job.platform_integration_id, ad_account_id: job.ad_account_id, entity_id: job.entity_id,
      }, false, true)).read();
    }
    assertFresh(job, now());
    const { result, proposal } = evaluateReviewPolicy(job, evaluated.result, state, now(), options.simulation);
    const { error } = await client.schema('ai').rpc('finish_meta_review', { p_job: job.id, p_result: result, p_proposal: proposal, p_error: null });
    if (error) throw error;
  } catch (error) {
    const known = ['STALE_SOURCE','PROVIDER_VERSION_CHANGED','REVIEW_DISABLED','POLICY_CHANGED','STATE_SCOPE_MISMATCH'];
    const code = error instanceof DecisionEngineError ? error.code : error instanceof Error && known.includes(error.message) ? error.message : 'REVIEW_EVALUATION_FAILED';
    const { error: failure } = await client.schema('ai').rpc('finish_meta_review', { p_job: job.id, p_result: null, p_proposal: null, p_error: code });
    console.info(JSON.stringify({ event: failure ? 'review.audit_failed' : 'review.failed', jobId: job.id, code }));
  }
}
