import 'server-only';
import type { Database } from '@/lib/shared/types/supabase';
import { performanceFingerprint } from '../manualRefreshStatus';
import { parallelTasks } from '../concurrency';
import { asRecord } from '@/lib/shared';

import {
  claimHistoricalSyncJob,
  failHistoricalSyncJob,
  getAccountSyncJobById,
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

async function processClaimedJob(jobId: string): Promise<{
  jobId: string;
  adAccountId: string;
  status: 'completed' | 'failed';
  message: string;
}> {
  const supabase = createAdminClient();
  const job = await getAccountSyncJobById(supabase, jobId);

  if (!job) {
    throw new Error('Historical sync job could not be found after claiming');
  }

  try {
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

    if (job.sync_type === 'initial_historical') {
      await processMetaFirstSyncJob({
        supabase,
        job,
        accessToken,
      });

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
    const automatic = ['app_visit','scheduled_refresh'].includes(String(asRecord(job.metadata).queuedFrom));
    await syncBusinessPlatform({
      businessId: job.business_id,
      integrationId: job.platform_integration_id,
      ...(automatic && job.requested_start_date && job.requested_end_date ? { dateRange: { since: job.requested_start_date, until: job.requested_end_date } } : {}),
      trigger: job.sync_type === 'manual_refresh' ? 'manual_refresh' : 'cron',
      backfillDays: job.sync_type === 'backfill' ? FULL_HISTORY_BACKFILL_DAYS : undefined,
      syncMode: job.sync_type === 'backfill' ? 'full_backfill' : 'default',
      primaryExternalAccountId: adAccount.external_account_id,
    });

    return {
      jobId: job.id,
      adAccountId: job.ad_account_id,
      status: 'completed',
      message: `${job.sync_type === 'backfill' ? 'Backfill' : 'Account sync'} completed.`,
    };
  } catch (error) {
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

export async function processMetaBackfillJobs(input?: {
  limit?: number;
  targetJobId?: string | null;
}): Promise<ProcessMetaBackfillJobsResult> {
  const supabase = createAdminClient();
  const limit = Math.min(5, Math.max(1, input?.limit ?? 5));
  const results: ProcessMetaBackfillJobsResult['results'] = [];

  if (input?.targetJobId) {
    const claimed = await claimHistoricalSyncJob(supabase, {
      jobId: input.targetJobId,
      syncTypes: ['initial_historical', 'incremental', 'manual_refresh', 'backfill'],
    });

    if (claimed) {
      results.push(await processClaimedJob(claimed.id));
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
      const claimed = await claimHistoricalSyncJob(supabase, { syncTypes: ['initial_historical', 'incremental', 'manual_refresh', 'backfill'] });
      if (!claimed) break;
      results.push(await processClaimedJob(claimed.id));
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
