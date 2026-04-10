import 'server-only';

import {
  beginHistoricalSyncJob,
  completeHistoricalSyncJob,
  ensureAdAccountSyncStates,
  failHistoricalSyncJob,
  markAdAccountHistoricalSyncSucceeded,
} from '@/lib/server/repositories/ad_accounts/syncState';
import type { RepositoryClient } from '@/lib/server/repositories/utils';
import { FULL_HISTORY_BACKFILL_DAYS } from '../types';
import type { SyncTrigger } from '../types';
import { resolveMetaBackfillWindow } from './client';
import { syncMetaAdCreatives } from './syncMetaAdCreatives';
import { syncMetaAds } from './syncMetaAds';
import { syncMetaAdsets } from './syncMetaAdsets';
import { syncMetaCampaigns } from './syncMetaCampaigns';
import { discoverMetaAdAccounts } from './discoverMetaAdAccounts';
import { syncMetaPerformance } from './syncMetaPerformance';

function resolveHistoricalJobType(input: {
  trigger: SyncTrigger;
  isInitialHistoricalSync: boolean;
}): 'initial_historical' | 'incremental' | 'manual_refresh' {
  if (input.isInitialHistoricalSync) {
    return 'initial_historical';
  }

  return input.trigger === 'manual_refresh' ? 'manual_refresh' : 'incremental';
}

export async function syncMetaBusinessPlatform(input: {
  supabase: RepositoryClient;
  businessId: string;
  platformId: string;
  platformIntegrationId: string;
  accessToken: string;
  backfillDays: number;
  syncedAt: string;
  trigger: SyncTrigger;
  primaryExternalAccountId: string;
}) {
  const discoveryWindow = resolveMetaBackfillWindow(FULL_HISTORY_BACKFILL_DAYS);

  // Step 01: discovery/registration only. This records accessible accounts and queues
  // historical jobs, but it does not count as a successful sync.
  const discoveredAccounts = await discoverMetaAdAccounts({
    supabase: input.supabase,
    businessId: input.businessId,
    platformId: input.platformId,
    platformIntegrationId: input.platformIntegrationId,
    accessToken: input.accessToken,
    requestedStartDate: discoveryWindow.since,
    requestedEndDate: discoveryWindow.until,
  });

  const primaryAdAccount =
    discoveredAccounts.byExternalAccountId.get(input.primaryExternalAccountId) ?? null;

  if (!primaryAdAccount) {
    throw new Error('Selected Meta ad account is no longer accessible to this integration');
  }

  const syncStates = await ensureAdAccountSyncStates(input.supabase, [primaryAdAccount]);
  const primarySyncState = syncStates.get(primaryAdAccount.id);
  const isInitialHistoricalSync = !primarySyncState?.first_full_sync_completed;
  // The first real ad-account sync should pull the widest practical time window so
  // account intelligence starts from the full available history, not a short sample.
  const historicalWindow = resolveMetaBackfillWindow(
    isInitialHistoricalSync ? FULL_HISTORY_BACKFILL_DAYS : input.backfillDays
  );
  const historicalBackfillDays = historicalWindow.backfillDays;
  const job = await beginHistoricalSyncJob(input.supabase, {
    businessId: input.businessId,
    platformIntegrationId: input.platformIntegrationId,
    adAccountId: primaryAdAccount.id,
    requestedStartDate: historicalWindow.since,
    requestedEndDate: historicalWindow.until,
    syncType: resolveHistoricalJobType({
      trigger: input.trigger,
      isInitialHistoricalSync,
    }),
  });

  try {
    // Step 02: full historical sync for the selected primary account only.
    const historicalScope = [primaryAdAccount];

    const campaigns = await syncMetaCampaigns({
      supabase: input.supabase,
      adAccounts: historicalScope,
      accessToken: input.accessToken,
      syncedAt: input.syncedAt,
    });

    const adsets = await syncMetaAdsets({
      supabase: input.supabase,
      adAccounts: historicalScope,
      campaignsByExternalId: campaigns.byExternalId,
      accessToken: input.accessToken,
      syncedAt: input.syncedAt,
    });

    const ads = await syncMetaAds({
      supabase: input.supabase,
      adAccounts: historicalScope,
      campaignsByExternalId: campaigns.byExternalId,
      adsetsByExternalId: adsets.byExternalId,
      accessToken: input.accessToken,
      syncedAt: input.syncedAt,
    });

    const creatives = await syncMetaAdCreatives({
      supabase: input.supabase,
      businessId: input.businessId,
      platformIntegrationId: input.platformIntegrationId,
      adAccounts: historicalScope,
      ads: ads.rows,
      adsetsByExternalId: adsets.byExternalId,
      campaignsByExternalId: campaigns.byExternalId,
      accessToken: input.accessToken,
      syncedAt: input.syncedAt,
    });

    const performance = await syncMetaPerformance({
      supabase: input.supabase,
      adAccounts: historicalScope,
      campaignsByExternalId: campaigns.byExternalId,
      adsetsByExternalId: adsets.byExternalId,
      adsByExternalId: ads.byExternalId,
      accessToken: input.accessToken,
      backfillDays: historicalBackfillDays,
      syncedAt: input.syncedAt,
    });
    const completedAt = new Date().toISOString();

    await Promise.all([
      completeHistoricalSyncJob(input.supabase, {
        jobId: job.id,
        finishedAt: completedAt,
        actualStartDate: performance.firstActivityDate,
        actualEndDate: performance.insightsSyncedThrough ?? performance.latestActivityDate,
        campaignsSynced: campaigns.count,
        adsetsSynced: adsets.count,
        adsSynced: ads.count,
        creativesSynced: creatives.adCreatives,
        performanceRowsSynced:
          performance.campaignPerformanceRows +
          performance.adsetPerformanceRows +
          performance.adPerformanceRows,
      }),
      markAdAccountHistoricalSyncSucceeded(input.supabase, {
        adAccountId: primaryAdAccount.id,
        jobId: job.id,
        syncedAt: completedAt,
        historicalDataAvailable: performance.historicalDataAvailable,
        hasMeaningfulHistory: performance.hasMeaningfulHistory,
        firstActivityDate: performance.firstActivityDate,
        latestActivityDate: performance.latestActivityDate,
        insightsSyncedThrough: performance.insightsSyncedThrough,
        isInitialHistoricalSync,
      }),
    ]);

    return {
      adAccounts: discoveredAccounts.count,
      campaignDims: campaigns.count,
      adsetDims: adsets.count,
      adDims: ads.count,
      adCreatives: creatives.adCreatives,
      creativeFeatureSnapshots: creatives.creativeFeatureSnapshots,
      adAccountPerformanceRows: performance.adAccountPerformanceRows,
      campaignPerformanceRows: performance.campaignPerformanceRows,
      adsetPerformanceRows: performance.adsetPerformanceRows,
      adPerformanceRows: performance.adPerformanceRows,
      campaignPerformanceSummaries: performance.campaignPerformanceSummaries,
      adsetPerformanceSummaries: performance.adsetPerformanceSummaries,
      adPerformanceSummaries: performance.adPerformanceSummaries,
    };
  } catch (error) {
    await failHistoricalSyncJob(input.supabase, {
      adAccountId: primaryAdAccount.id,
      jobId: job.id,
      failedAt: new Date().toISOString(),
      errorMessage: error instanceof Error ? error.message : 'Meta historical sync failed',
    });

    throw error;
  }
}
