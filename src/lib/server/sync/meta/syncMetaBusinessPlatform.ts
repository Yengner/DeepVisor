import 'server-only';

import { fetchMetaAdAccountSnapshots } from '@/lib/server/integrations/adapters/meta';
import {
  beginHistoricalSyncJob,
  completeHistoricalSyncJob,
  ensureAdAccountSyncStates,
  failHistoricalSyncJob,
  markAdAccountHistoricalSyncSucceeded,
} from '@/lib/server/repositories/ad_accounts/syncState';
import type { RepositoryClient } from '@/lib/server/repositories/utils';
import type { Database } from '@/lib/shared/types/supabase';
import { FULL_HISTORY_BACKFILL_DAYS, RECENT_SEED_SYNC_DAYS } from '../types';
import type { PlatformSyncMode, SyncTrigger } from '../types';
import { resolveMetaBackfillWindow } from './client';
import { syncMetaAdCreatives } from './syncMetaAdCreatives';
import { syncMetaAds } from './syncMetaAds';
import { syncMetaAdsets } from './syncMetaAdsets';
import { syncMetaCampaigns } from './syncMetaCampaigns';
import { discoverMetaAdAccounts } from './discoverMetaAdAccounts';
import { syncMetaPerformance } from './syncMetaPerformance';

type AdAccountRow = Database['public']['Tables']['ad_accounts']['Row'];

function resolveHistoricalJobType(input: {
  trigger: SyncTrigger;
  syncMode: PlatformSyncMode;
}): 'incremental' | 'manual_refresh' | 'backfill' {
  if (input.syncMode === 'full_backfill') {
    return 'backfill';
  }

  return input.trigger === 'manual_refresh' ? 'manual_refresh' : 'incremental';
}

function resolvePerformanceWindow(input: {
  syncMode: PlatformSyncMode;
  backfillDays: number;
}): { since: string; until: string; backfillDays: number } {
  if (input.syncMode === 'seed_recent') {
    return resolveMetaBackfillWindow(Math.min(input.backfillDays, RECENT_SEED_SYNC_DAYS));
  }

  if (input.syncMode === 'full_backfill') {
    return resolveMetaBackfillWindow(FULL_HISTORY_BACKFILL_DAYS);
  }

  return resolveMetaBackfillWindow(input.backfillDays);
}

async function runMetaSyncStage<T>(label: string, operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected Meta sync error';
    throw new Error(`Meta ${label} sync failed: ${message}`);
  }
}

async function getSavedPrimaryAdAccount(input: {
  supabase: RepositoryClient;
  businessId: string;
  platformId: string;
  primaryExternalAccountId: string;
}): Promise<AdAccountRow | null> {
  const { data, error } = await input.supabase
    .from('ad_accounts')
    .select('*')
    .eq('business_id', input.businessId)
    .eq('platform_id', input.platformId)
    .eq('external_account_id', input.primaryExternalAccountId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as AdAccountRow | null) ?? null;
}

async function refreshSelectedAdAccount(input: {
  supabase: RepositoryClient;
  businessId: string;
  platformId: string;
  accessToken: string;
  primaryExternalAccountId: string;
}): Promise<{ primaryAdAccount: AdAccountRow; discoveredCount: number }> {
  const snapshots = await fetchMetaAdAccountSnapshots(input.accessToken, {
    externalAccountId: input.primaryExternalAccountId,
  });

  if (snapshots.length === 0) {
    throw new Error('Selected Meta ad account is no longer accessible to this integration');
  }

  const discoveredAccounts = await discoverMetaAdAccounts({
    supabase: input.supabase,
    businessId: input.businessId,
    platformId: input.platformId,
    snapshots,
  });

  const primaryAdAccount =
    discoveredAccounts.byExternalAccountId.get(input.primaryExternalAccountId) ?? null;

  if (!primaryAdAccount) {
    throw new Error('Selected Meta ad account is no longer accessible to this integration');
  }

  return {
    primaryAdAccount,
    discoveredCount: discoveredAccounts.count,
  };
}

async function resolvePrimaryAdAccountForSync(input: {
  supabase: RepositoryClient;
  businessId: string;
  platformId: string;
  accessToken: string;
  primaryExternalAccountId: string;
  syncMode: PlatformSyncMode;
}): Promise<{
  primaryAdAccount: AdAccountRow;
  discoveredCount: number;
  syncStateEnsured: boolean;
}> {
  const savedPrimaryAdAccount = await getSavedPrimaryAdAccount({
    supabase: input.supabase,
    businessId: input.businessId,
    platformId: input.platformId,
    primaryExternalAccountId: input.primaryExternalAccountId,
  });

  if (savedPrimaryAdAccount && input.syncMode === 'seed_recent') {
    return {
      primaryAdAccount: savedPrimaryAdAccount,
      discoveredCount: 1,
      syncStateEnsured: false,
    };
  }

  const refreshed = await refreshSelectedAdAccount({
    supabase: input.supabase,
    businessId: input.businessId,
    platformId: input.platformId,
    accessToken: input.accessToken,
    primaryExternalAccountId: input.primaryExternalAccountId,
  });

  return {
    primaryAdAccount: refreshed.primaryAdAccount,
    discoveredCount: refreshed.discoveredCount,
    syncStateEnsured: true,
  };
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
  syncMode: PlatformSyncMode;
}) {
  const resolvedPrimaryAccount = await runMetaSyncStage('selected account resolution', () =>
    resolvePrimaryAdAccountForSync({
      supabase: input.supabase,
      businessId: input.businessId,
      platformId: input.platformId,
      accessToken: input.accessToken,
      primaryExternalAccountId: input.primaryExternalAccountId,
      syncMode: input.syncMode,
    })
  );

  const { primaryAdAccount, discoveredCount, syncStateEnsured } = resolvedPrimaryAccount;

  if (!syncStateEnsured) {
    await ensureAdAccountSyncStates(input.supabase, [primaryAdAccount]);
  }

  const performanceWindow = resolvePerformanceWindow({
    syncMode: input.syncMode,
    backfillDays: input.backfillDays,
  });
  const completesFullHistory = input.syncMode === 'full_backfill';
  const job = await beginHistoricalSyncJob(input.supabase, {
    businessId: input.businessId,
    platformIntegrationId: input.platformIntegrationId,
    adAccountId: primaryAdAccount.id,
    requestedStartDate: performanceWindow.since,
    requestedEndDate: performanceWindow.until,
    syncType: resolveHistoricalJobType({
      trigger: input.trigger,
      syncMode: input.syncMode,
    }),
  });

  try {
    // Step 02: full historical sync for the selected primary account only.
    const historicalScope = [primaryAdAccount];

    const campaigns = await runMetaSyncStage('campaigns', () =>
      syncMetaCampaigns({
        supabase: input.supabase,
        adAccounts: historicalScope,
        accessToken: input.accessToken,
        syncedAt: input.syncedAt,
      })
    );

    const adsets = await runMetaSyncStage('ad set', () =>
      syncMetaAdsets({
        supabase: input.supabase,
        adAccounts: historicalScope,
        campaignsByExternalId: campaigns.byExternalId,
        accessToken: input.accessToken,
        syncedAt: input.syncedAt,
      })
    );

    const ads = await runMetaSyncStage('ad', () =>
      syncMetaAds({
        supabase: input.supabase,
        adAccounts: historicalScope,
        campaignsByExternalId: campaigns.byExternalId,
        adsetsByExternalId: adsets.byExternalId,
        accessToken: input.accessToken,
        syncedAt: input.syncedAt,
      })
    );

    const creatives = await runMetaSyncStage('creative', () =>
      syncMetaAdCreatives({
        supabase: input.supabase,
        businessId: input.businessId,
        platformIntegrationId: input.platformIntegrationId,
        adAccounts: historicalScope,
        ads: ads.rows,
        adsetsByExternalId: adsets.byExternalId,
        campaignsByExternalId: campaigns.byExternalId,
        accessToken: input.accessToken,
        syncedAt: input.syncedAt,
      })
    );

    const performance = await runMetaSyncStage('performance', () =>
      syncMetaPerformance({
        supabase: input.supabase,
        adAccounts: historicalScope,
        campaignsByExternalId: campaigns.byExternalId,
        adsetsByExternalId: adsets.byExternalId,
        adsByExternalId: ads.byExternalId,
        accessToken: input.accessToken,
        backfillDays: performanceWindow.backfillDays,
        syncedAt: input.syncedAt,
      })
    );
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
        completesFullHistory,
      }),
    ]);

    return {
      syncMode: input.syncMode,
      coverageStartDate: performanceWindow.since,
      coverageEndDate: performance.insightsSyncedThrough ?? performanceWindow.until,
      adAccounts: discoveredCount,
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
