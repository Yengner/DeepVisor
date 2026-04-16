import 'server-only';

import {
  completeHistoricalSyncJob,
  ensureAdAccountSyncStates,
  markAdAccountHistoricalSyncSucceeded,
  updateHistoricalSyncJobProgress,
} from '@/lib/server/repositories/ad_accounts/syncState';
import { refreshMetaPerformanceSummaries, syncMetaPerformance } from '@/lib/server/sync/meta/syncMetaPerformance';
import type { RepositoryClient } from '@/lib/server/repositories/utils';
import { runBusinessAssessment, runMetaAdAccountAssessment } from '@/lib/server/intelligence';
import type { Database } from '@/lib/shared/types/supabase';
import { FULL_HISTORY_BACKFILL_DAYS } from '../types';
import { resolveMetaBackfillWindow } from './client';
import { syncMetaAdCreatives } from './syncMetaAdCreatives';
import { syncMetaAds } from './syncMetaAds';
import { syncMetaAdsets } from './syncMetaAdsets';
import { syncMetaCampaigns } from './syncMetaCampaigns';

type AccountSyncJobRow = Database['public']['Tables']['account_sync_jobs']['Row'];
type AdAccountRow = Database['public']['Tables']['ad_accounts']['Row'];
type CampaignDimRow = Database['public']['Tables']['campaign_dims']['Row'];
type AdsetDimRow = Database['public']['Tables']['adset_dims']['Row'];
type AdDimRow = Database['public']['Tables']['ad_dims']['Row'];

type MetaFirstSyncResult = {
  adAccountId: string;
  counts: {
    campaignsSynced: number;
    adsetsSynced: number;
    adsSynced: number;
    creativesSynced: number;
    performanceRowsSynced: number;
  };
  historicalDataAvailable: boolean;
  hasMeaningfulHistory: boolean;
  firstActivityDate: string | null;
  latestActivityDate: string | null;
  insightsSyncedThrough: string | null;
  coverageStartDate: string | null;
  coverageEndDate: string | null;
};

function formatWindowLabel(since: string, until: string): string {
  return `${since} through ${until}`;
}

function addUtcDays(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function minDate(left: string | null, right: string | null): string | null {
  if (!left) {
    return right;
  }

  if (!right) {
    return left;
  }

  return left <= right ? left : right;
}

function maxDate(left: string | null, right: string | null): string | null {
  if (!left) {
    return right;
  }

  if (!right) {
    return left;
  }

  return left >= right ? left : right;
}

function toDay(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? null;
}

function resolveOldestCreatedDay(input: {
  campaigns: CampaignDimRow[];
  adsets: AdsetDimRow[];
  ads: AdDimRow[];
}): string | null {
  const days = [
    ...input.campaigns.map((row) => toDay(row.created_time)),
    ...input.adsets.map((row) => toDay(row.created_time)),
    ...input.ads.map((row) => toDay(row.created_time)),
  ].filter((value): value is string => Boolean(value));

  if (days.length === 0) {
    return null;
  }

  return [...days].sort()[0] ?? null;
}

function buildBackwardWindows(input: {
  floorDay: string;
  untilDay: string;
  windowDays: number;
}): Array<{ since: string; until: string }> {
  const windows: Array<{ since: string; until: string }> = [];
  let cursorUntil = input.untilDay;

  while (cursorUntil >= input.floorDay) {
    const candidateSince = addUtcDays(cursorUntil, -(Math.max(input.windowDays, 1) - 1));
    const since = candidateSince > input.floorDay ? candidateSince : input.floorDay;

    windows.push({
      since,
      until: cursorUntil,
    });

    cursorUntil = addUtcDays(since, -1);
  }

  return windows;
}

async function loadAdAccount(
  supabase: RepositoryClient,
  adAccountId: string
): Promise<AdAccountRow> {
  const { data, error } = await supabase
    .from('ad_accounts')
    .select('*')
    .eq('id', adAccountId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('Selected Meta ad account could not be found');
  }

  return data as AdAccountRow;
}

export async function processMetaFirstSyncJob(input: {
  supabase: RepositoryClient;
  job: AccountSyncJobRow;
  accessToken: string;
}): Promise<MetaFirstSyncResult> {
  const syncedAt = new Date().toISOString();
  const adAccount = await loadAdAccount(input.supabase, input.job.ad_account_id);
  await ensureAdAccountSyncStates(input.supabase, [adAccount]);

  await updateHistoricalSyncJobProgress(input.supabase, {
    jobId: input.job.id,
    stage: 'resolving_account',
    message: 'Resolving your selected Meta ad account.',
    updatedAt: syncedAt,
  });

  const historicalScope = [adAccount];

  await updateHistoricalSyncJobProgress(input.supabase, {
    jobId: input.job.id,
    stage: 'syncing_campaigns',
    message: 'Syncing campaign structure.',
  });
  const campaigns = await syncMetaCampaigns({
    supabase: input.supabase,
    adAccounts: historicalScope,
    accessToken: input.accessToken,
    syncedAt,
  });

  await updateHistoricalSyncJobProgress(input.supabase, {
    jobId: input.job.id,
    stage: 'syncing_campaigns',
    counts: {
      campaignsSynced: campaigns.count,
    },
  });

  await updateHistoricalSyncJobProgress(input.supabase, {
    jobId: input.job.id,
    stage: 'syncing_adsets',
    message: 'Syncing ad set structure.',
  });
  const adsets = await syncMetaAdsets({
    supabase: input.supabase,
    adAccounts: historicalScope,
    campaignsByExternalId: campaigns.byExternalId,
    accessToken: input.accessToken,
    syncedAt,
  });

  await updateHistoricalSyncJobProgress(input.supabase, {
    jobId: input.job.id,
    stage: 'syncing_adsets',
    counts: {
      campaignsSynced: campaigns.count,
      adsetsSynced: adsets.count,
    },
  });

  await updateHistoricalSyncJobProgress(input.supabase, {
    jobId: input.job.id,
    stage: 'syncing_ads',
    message: 'Syncing ad structure.',
  });
  const ads = await syncMetaAds({
    supabase: input.supabase,
    adAccounts: historicalScope,
    campaignsByExternalId: campaigns.byExternalId,
    adsetsByExternalId: adsets.byExternalId,
    accessToken: input.accessToken,
    syncedAt,
  });

  await updateHistoricalSyncJobProgress(input.supabase, {
    jobId: input.job.id,
    stage: 'syncing_ads',
    counts: {
      campaignsSynced: campaigns.count,
      adsetsSynced: adsets.count,
      adsSynced: ads.count,
    },
  });

  await updateHistoricalSyncJobProgress(input.supabase, {
    jobId: input.job.id,
    stage: 'syncing_creatives',
    message: 'Syncing creative assets.',
  });
  const creatives = await syncMetaAdCreatives({
    supabase: input.supabase,
    businessId: input.job.business_id,
    platformIntegrationId: input.job.platform_integration_id,
    adAccounts: historicalScope,
    ads: ads.rows,
    adsetsByExternalId: adsets.byExternalId,
    campaignsByExternalId: campaigns.byExternalId,
    accessToken: input.accessToken,
    syncedAt,
  });

  const dimensionCounts = {
    campaignsSynced: campaigns.count,
    adsetsSynced: adsets.count,
    adsSynced: ads.count,
    creativesSynced: creatives.adCreatives,
    performanceRowsSynced: 0,
  };

  await updateHistoricalSyncJobProgress(input.supabase, {
    jobId: input.job.id,
    stage: 'syncing_creatives',
    counts: dimensionCounts,
  });

  const maxSupportedWindow = resolveMetaBackfillWindow(FULL_HISTORY_BACKFILL_DAYS);
  const oldestCreatedDay = resolveOldestCreatedDay({
    campaigns: campaigns.rows,
    adsets: adsets.rows,
    ads: ads.rows,
  });
  const floorDay =
    oldestCreatedDay && oldestCreatedDay > maxSupportedWindow.since
      ? oldestCreatedDay
      : maxSupportedWindow.since;
  const latest30DayStart = addUtcDays(maxSupportedWindow.until, -29);
  const performanceWindows = buildBackwardWindows({
    floorDay: oldestCreatedDay ? floorDay : latest30DayStart,
    untilDay: maxSupportedWindow.until,
    windowDays: 30,
  });

  let historicalDataAvailable = false;
  let hasMeaningfulHistory = false;
  let firstActivityDate: string | null = null;
  let latestActivityDate: string | null = null;
  let insightsSyncedThrough: string | null = null;
  let coverageStartDate: string | null = null;
  let coverageEndDate: string | null = null;
  let windowsCompleted = 0;
  let performanceRowsSynced = 0;

  for (const window of performanceWindows) {
    await updateHistoricalSyncJobProgress(input.supabase, {
      jobId: input.job.id,
      stage: 'syncing_performance_windows',
      message: `Syncing daily performance for ${formatWindowLabel(window.since, window.until)}.`,
      windowSince: window.since,
      windowUntil: window.until,
      windowsCompleted,
      coverageStartDate,
      coverageEndDate,
      counts: {
        ...dimensionCounts,
        performanceRowsSynced,
      },
    });

    const performance = await syncMetaPerformance({
      supabase: input.supabase,
      adAccounts: historicalScope,
      campaignsByExternalId: campaigns.byExternalId,
      adsetsByExternalId: adsets.byExternalId,
      adsByExternalId: ads.byExternalId,
      accessToken: input.accessToken,
      dateRange: window,
      refreshSummaries: false,
      syncedAt: new Date().toISOString(),
    });

    historicalDataAvailable = historicalDataAvailable || performance.historicalDataAvailable;
    hasMeaningfulHistory = hasMeaningfulHistory || performance.hasMeaningfulHistory;
    firstActivityDate = minDate(firstActivityDate, performance.firstActivityDate);
    latestActivityDate = maxDate(latestActivityDate, performance.latestActivityDate);
    insightsSyncedThrough = maxDate(
      insightsSyncedThrough,
      performance.insightsSyncedThrough ?? window.until
    );
    coverageStartDate = window.since;
    coverageEndDate = coverageEndDate ?? window.until;
    windowsCompleted += 1;
    performanceRowsSynced +=
      performance.adAccountPerformanceRows +
      performance.campaignPerformanceRows +
      performance.adsetPerformanceRows +
      performance.adPerformanceRows;

    await updateHistoricalSyncJobProgress(input.supabase, {
      jobId: input.job.id,
      stage: 'syncing_performance_windows',
      message: `Synced ${formatWindowLabel(window.since, window.until)}.`,
      windowSince: window.since,
      windowUntil: window.until,
      windowsCompleted,
      coverageStartDate,
      coverageEndDate,
      actualStartDate: firstActivityDate,
      actualEndDate: insightsSyncedThrough,
      counts: {
        ...dimensionCounts,
        performanceRowsSynced,
      },
    });
  }

  await updateHistoricalSyncJobProgress(input.supabase, {
    jobId: input.job.id,
    stage: 'finalizing_summaries',
    message: 'Finalizing lifetime summaries from synced daily data.',
    coverageStartDate,
    coverageEndDate,
    actualStartDate: firstActivityDate,
    actualEndDate: insightsSyncedThrough,
    counts: {
      ...dimensionCounts,
      performanceRowsSynced,
    },
  });

  await refreshMetaPerformanceSummaries({
    supabase: input.supabase,
    campaignsByExternalId: campaigns.byExternalId,
    adsetsByExternalId: adsets.byExternalId,
    adsByExternalId: ads.byExternalId,
    syncedAt: new Date().toISOString(),
  });

  const finalizedAt = new Date().toISOString();
  await markAdAccountHistoricalSyncSucceeded(input.supabase, {
    adAccountId: adAccount.id,
    jobId: input.job.id,
    syncedAt: finalizedAt,
    historicalDataAvailable,
    hasMeaningfulHistory,
    firstActivityDate,
    latestActivityDate,
    insightsSyncedThrough,
    completesFullHistory: true,
  });

  await updateHistoricalSyncJobProgress(input.supabase, {
    jobId: input.job.id,
    stage: 'running_assessments',
    message: 'Running DeepVisor intelligence on the synced history.',
    coverageStartDate,
    coverageEndDate,
    actualStartDate: firstActivityDate,
    actualEndDate: insightsSyncedThrough,
    counts: {
      ...dimensionCounts,
      performanceRowsSynced,
    },
  });

  try {
    await runMetaAdAccountAssessment({
      supabase: input.supabase,
      businessId: input.job.business_id,
      platformIntegrationId: input.job.platform_integration_id,
      adAccountId: adAccount.id,
      trigger: 'integration',
    });
    await runBusinessAssessment({
      supabase: input.supabase,
      businessId: input.job.business_id,
      trigger: 'integration',
    });
  } catch (error) {
    console.error('First Meta history sync assessments failed:', error);
  }

  const completedAt = new Date().toISOString();
  await completeHistoricalSyncJob(input.supabase, {
    jobId: input.job.id,
    finishedAt: completedAt,
    actualStartDate: firstActivityDate,
    actualEndDate: insightsSyncedThrough ?? latestActivityDate,
    campaignsSynced: campaigns.count,
    adsetsSynced: adsets.count,
    adsSynced: ads.count,
    creativesSynced: creatives.adCreatives,
    performanceRowsSynced,
    message: 'First history sync completed.',
  });

  return {
    adAccountId: adAccount.id,
    counts: {
      campaignsSynced: campaigns.count,
      adsetsSynced: adsets.count,
      adsSynced: ads.count,
      creativesSynced: creatives.adCreatives,
      performanceRowsSynced,
    },
    historicalDataAvailable,
    hasMeaningfulHistory,
    firstActivityDate,
    latestActivityDate,
    insightsSyncedThrough,
    coverageStartDate,
    coverageEndDate,
  };
}
