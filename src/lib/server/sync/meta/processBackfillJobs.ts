import { captureAccountHealth } from '@/lib/server/insights/issues';
import { refreshLifecycleBriefs } from '@/lib/server/lifecycle/brief';
import { captureLifecycle } from '@/lib/server/lifecycle/service';
import 'server-only';
import { withSyncLease } from '@/lib/server/supabase/syncLeaseContext';
import { resourceRefreshEnabled } from '../resources/coordinator';
import { withResourceBudget } from '../resources/budget';
import { processResourceJob } from '../resources/worker';
import { revalidateTag } from 'next/cache';
import type { Database } from '@/lib/shared/types/supabase';
import { performanceFingerprint } from '../manualRefreshStatus';
import { parallelTasks } from '../concurrency';
import { asRecord } from '@/lib/shared';

import {
  claimHistoricalSyncJob,
  failHistoricalSyncJob,
} from '@/lib/server/repositories/ad_accounts/syncState';
import { createAdminClient } from '@/lib/server/supabase/admin';
import {
  getBusinessIntegrationById,
  resolveIntegrationAccessToken,
} from '@/lib/server/integrations/service';
import { syncBusinessPlatform } from '@/lib/server/sync';
import { FULL_HISTORY_BACKFILL_DAYS } from '@/lib/server/sync/types';
import { processMetaFirstSyncJob } from './processFirstSyncJob';

export type ProcessMetaBackfillJobsResult = {
  processedCount: number;
  completedCount: number;
  failedCount: number;
  results: Array<{
    jobId: string;
    adAccountId: string;
    status: 'completed' | 'failed';
    message: string;
  }>;
};

async function invalidateCompleted(businessId: string) {
  // All worker entry points, including the cron route, publish the same invalidation.
  try { revalidateTag(`dashboard-context:${businessId}`, { expire: 0 }); }
  catch { /* Worker tests/CLI have no Next cache; revision observers still invalidate. */ }
}

async function runClaimedJob(job: Database['public']['Tables']['account_sync_jobs']['Row']): Promise<{
  jobId: string;
  adAccountId: string;
  status: 'completed' | 'failed';
  message: string;
}> {
  const supabase = createAdminClient();

  try {
    if (job.sync_type === 'resource_refresh') {
      const result = await processResourceJob(job);
      if (result.status === 'completed') {
        await refreshLifecycleBriefs(job.business_id,job.ad_account_id).catch(()=>console.warn('Lifecycle report refresh unavailable.'));
        await invalidateCompleted(job.business_id);
      }
      return result;
    }
    const integration = await getBusinessIntegrationById(supabase, {
      businessId: job.business_id,
      integrationId: job.platform_integration_id,
    });

    if (!integration || integration.platformKey !== 'meta' || !['connected','error'].includes(integration.status)) {
      throw new Error('Historical sync job is missing a connected Meta integration');
    }

    const accessToken = await resolveIntegrationAccessToken(supabase, integration, job.business_id);
    if (!accessToken) {
      throw new Error('Historical sync job is missing a Meta access token');
    }

    if (process.env.DEEPVISOR_INSIGHTS_EVENTS === 'true') {
      const account = await supabase.from('ad_accounts').select('external_account_id').eq('id',job.ad_account_id).eq('business_id',job.business_id).single();
      if (account.data) await captureAccountHealth(job.business_id,job.ad_account_id,account.data.external_account_id,accessToken).catch(()=>console.warn('Account health observation unavailable; previous evidence retained.'));
    }

    if (job.sync_type === 'initial_historical') {
      await processMetaFirstSyncJob({
        supabase,
        job,
        accessToken,
      });

      await captureLifecycle(job).catch(() => console.warn('Lifecycle capture pending; sync data retained.'));
      await refreshLifecycleBriefs(job.business_id,job.ad_account_id).catch(()=>console.warn('Lifecycle report refresh unavailable.'));
      await invalidateCompleted(job.business_id);
      return {
        jobId: job.id,
        adAccountId: job.ad_account_id,
        status: 'completed',
        message: 'First history sync completed.',
      };
    }

    if (
      job.sync_type !== 'backfill' &&
      job.sync_type !== 'incremental' &&
      job.sync_type !== 'manual_refresh'
    ) {
      throw new Error(`Unsupported historical sync type: ${job.sync_type}`);
    }

    const { data: adAccount, error: adAccountError } = await supabase
      .from('ad_accounts')
      .select('external_account_id')
      .eq('id', job.ad_account_id)
      .maybeSingle();

    if (adAccountError) {
      throw adAccountError;
    }

    if (!adAccount?.external_account_id) {
      throw new Error('Backfill ad account is missing or no longer accessible');
    }

    if (job.sync_type === 'manual_refresh' && job.requested_start_date && job.requested_end_date) {
      const metadata = asRecord(job.metadata);
      const previous = asRecord(metadata.last_processed_ids);
      if (typeof previous.performanceFingerprint !== 'string') {
        const baseline = await performanceFingerprint(supabase, job.ad_account_id, job.requested_start_date, job.requested_end_date);
        const {error} = await supabase.from('account_sync_jobs').update({metadata:{...metadata,last_processed_ids:{...previous,performanceFingerprint:baseline}} as Database['public']['Tables']['account_sync_jobs']['Update']['metadata']})
          .eq('id',job.id).eq('business_id',job.business_id).eq('status','running');
        if(error) throw error;
      }
    }
    const automatic = ['app_visit','scheduled_refresh','resource_maintenance'].includes(String(asRecord(job.metadata).queuedFrom));
    await syncBusinessPlatform({
      businessId: job.business_id,
      integrationId: job.platform_integration_id,
      ...(automatic && job.requested_start_date && job.requested_end_date ? { dateRange: { since: job.requested_start_date, until: job.requested_end_date } } : {}),
      trigger: job.sync_type === 'manual_refresh' ? 'manual_refresh' : 'cron',
      backfillDays: job.sync_type === 'backfill' ? FULL_HISTORY_BACKFILL_DAYS : undefined,
      syncMode: job.sync_type === 'backfill' ? 'full_backfill' : 'default',
      primaryExternalAccountId: adAccount.external_account_id,
    });

    await captureLifecycle(job).catch(() => console.warn('Lifecycle capture pending; sync data retained.'));
      await refreshLifecycleBriefs(job.business_id,job.ad_account_id).catch(()=>console.warn('Lifecycle report refresh unavailable.'));
    await invalidateCompleted(job.business_id);
    return {
      jobId: job.id,
      adAccountId: job.ad_account_id,
      status: 'completed',
      message: `${job.sync_type === 'backfill' ? 'Backfill' : 'Account sync'} completed.`,
    };
  } catch (error) {
    if (job.sync_type === 'resource_refresh') throw error; // Never let a stale resource worker use legacy unfenced failure writes.
    const message = error instanceof Error ? error.message : 'Meta historical sync failed';

    await failHistoricalSyncJob(supabase, {
      adAccountId: job.ad_account_id,
      jobId: job.id,
      failedAt: new Date().toISOString(),
      errorMessage: message,
    }).catch((nestedError) => {
      console.error('Failed to mark Meta historical sync job as failed:', nestedError);
    });

    return {
      jobId: job.id,
      adAccountId: job.ad_account_id,
      status: 'failed',
      message,
    };
  }
}


async function processClaimedJob(job: Database['public']['Tables']['account_sync_jobs']['Row']) {
  if(!resourceRefreshEnabled() || job.sync_type==='resource_refresh') return runClaimedJob(job);
  return withResourceBudget(createAdminClient(),job.ad_account_id,()=>withSyncLease(job.id,job.lease_generation,()=>runClaimedJob(job)),{timeoutMs:240000,maxRequests:2000});
}

export async function processMetaBackfillJobs(input?: {
  limit?: number;
  targetJobId?: string | null;
}): Promise<ProcessMetaBackfillJobsResult> {
  const supabase = createAdminClient();
  const limit = Math.min(5, Math.max(1, input?.limit ?? 5));
  const results: ProcessMetaBackfillJobsResult['results'] = [];

  const claim = async (jobId?: string | null) => {
    if (resourceRefreshEnabled()) {
      const resource = await supabase.rpc('claim_next_account_sync', { p_job: jobId ?? undefined });
      if (resource.error) throw resource.error;
      return resource.data?.[0] ?? null;
    }
    return claimHistoricalSyncJob(supabase, { jobId, syncTypes: ['initial_historical', 'incremental', 'manual_refresh', 'backfill'] });
  };
  if (resourceRefreshEnabled() && !input?.targetJobId) {
    const pending = await supabase.from('account_sync_resources').select('ad_account_id,platform_integrations!inner(integration_details)').eq('pending', true).neq('availability', 'blocked').lte('not_before', new Date().toISOString()).order('requested_at').limit(100);
    if (pending.error) throw pending.error;
    for (const id of new Set(pending.data.filter(row => !asRecord(row.platform_integrations?.integration_details)['deepvisor-meta-phase2']).map(row => row.ad_account_id))) {
      const promoted = await supabase.rpc('promote_account_resource', { p_account: id });
      if (promoted.error) throw promoted.error;
    }
    const pruned = await supabase.rpc('prune_account_resources');
    if (pruned.error) throw pruned.error;
  }

  if (input?.targetJobId) {
    const followupDeadline=Date.now()+45000;
    const claimed = await claim(input.targetJobId);


    if (claimed) {
      results.push(await processClaimedJob(claimed));
      if(resourceRefreshEnabled()) {
        const completed=await supabase.from('account_sync_jobs').select('metadata').eq('id',claimed.id).single();
        if(completed.error)throw completed.error;
        const followup=asRecord(completed.data.metadata).followupJobId;
        const promoted=typeof followup==='string'?{data:{jobId:followup},error:null}:await supabase.rpc('promote_account_resource',{p_account:claimed.ad_account_id});
        if(promoted.error)throw promoted.error;
        const id=asRecord(promoted.data).jobId;
        if(typeof id==='string' && Date.now()<followupDeadline) {
          const next=await claim(id);
          if(next) results.push(await processClaimedJob(next));
        }
      }
    }

    return {
      processedCount: results.length,
      completedCount: results.filter((item) => item.status === 'completed').length,
      failedCount: results.filter((item) => item.status === 'failed').length,
      results,
    };
  }

  const deadline = Date.now() + 45_000;
  let claimedCount = 0;
  const drain = async () => {
    while (Date.now() < deadline && claimedCount < limit) {
      claimedCount++;
      const claimed = await claim();
      if (!claimed) break;
      results.push(await processClaimedJob(claimed));
    }
  };
  await parallelTasks([drain, drain], 2);

  return {
    processedCount: results.length,
    completedCount: results.filter((item) => item.status === 'completed').length,
    failedCount: results.filter((item) => item.status === 'failed').length,
    results,
  };
}
