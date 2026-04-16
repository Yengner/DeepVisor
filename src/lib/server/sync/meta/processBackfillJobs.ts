import 'server-only';

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

    if (!integration || integration.platformKey !== 'meta') {
      throw new Error('Historical sync job is missing a connected Meta integration');
    }

    const accessToken = await resolveIntegrationAccessToken(supabase, integration);
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

    if (job.sync_type !== 'backfill') {
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

    await syncBusinessPlatform({
      businessId: job.business_id,
      integrationId: job.platform_integration_id,
      trigger: 'cron',
      backfillDays: FULL_HISTORY_BACKFILL_DAYS,
      syncMode: 'full_backfill',
      primaryExternalAccountId: adAccount.external_account_id,
    });

    return {
      jobId: job.id,
      adAccountId: job.ad_account_id,
      status: 'completed',
      message: 'Backfill completed.',
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
  const limit = Math.max(1, input?.limit ?? 1);
  const results: ProcessMetaBackfillJobsResult['results'] = [];

  if (input?.targetJobId) {
    const claimed = await claimHistoricalSyncJob(supabase, {
      jobId: input.targetJobId,
      syncTypes: ['initial_historical', 'backfill'],
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

  for (let index = 0; index < limit; index += 1) {
    const claimed = await claimHistoricalSyncJob(supabase, {
      syncTypes: ['initial_historical', 'backfill'],
    });

    if (!claimed) {
      break;
    }

    results.push(await processClaimedJob(claimed.id));
  }

  return {
    processedCount: results.length,
    completedCount: results.filter((item) => item.status === 'completed').length,
    failedCount: results.filter((item) => item.status === 'failed').length,
    results,
  };
}
