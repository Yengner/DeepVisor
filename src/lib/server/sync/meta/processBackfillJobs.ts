import 'server-only';

import {
  failHistoricalSyncJob,
  listPendingBackfillSyncJobs,
} from '@/lib/server/repositories/ad_accounts/syncState';
import { createAdminClient } from '@/lib/server/supabase/admin';
import { syncBusinessPlatform } from '@/lib/server/sync';
import { FULL_HISTORY_BACKFILL_DAYS } from '@/lib/server/sync/types';

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

export async function processMetaBackfillJobs(limit: number = 1): Promise<ProcessMetaBackfillJobsResult> {
  const supabase = createAdminClient();
  const jobs = await listPendingBackfillSyncJobs(supabase, limit);
  const results: ProcessMetaBackfillJobsResult['results'] = [];

  for (const job of jobs) {
    try {
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

      results.push({
        jobId: job.id,
        adAccountId: job.ad_account_id,
        status: 'completed',
        message: 'Backfill completed.',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Meta backfill failed';

      await failHistoricalSyncJob(supabase, {
        adAccountId: job.ad_account_id,
        jobId: job.id,
        failedAt: new Date().toISOString(),
        errorMessage: message,
      }).catch((nestedError) => {
        console.error('Failed to mark Meta backfill job as failed:', nestedError);
      });

      results.push({
        jobId: job.id,
        adAccountId: job.ad_account_id,
        status: 'failed',
        message,
      });
    }
  }

  return {
    processedCount: jobs.length,
    completedCount: results.filter((item) => item.status === 'completed').length,
    failedCount: results.filter((item) => item.status === 'failed').length,
    results,
  };
}
