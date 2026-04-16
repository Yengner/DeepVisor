import { asRecord } from '@/lib/shared';
import type {
  AccountSyncJobStatus,
  FirstSyncJobStatus,
  FirstSyncStage,
  FirstSyncStatusCounts,
  HistoricalSyncType,
  SyncCoverage,
} from '@/lib/shared/types/integrations';
import type { Database, Json } from '@/lib/shared/types/supabase';
import { chunkArray, type RepositoryClient } from '../utils';

type AdAccountRow = Database['public']['Tables']['ad_accounts']['Row'];
type AdAccountSyncStateRow = Database['public']['Tables']['ad_account_sync_state']['Row'];
type AdAccountSyncStateInsert = Database['public']['Tables']['ad_account_sync_state']['Insert'];
type AccountSyncJobRow = Database['public']['Tables']['account_sync_jobs']['Row'];
type AccountSyncJobInsert = Database['public']['Tables']['account_sync_jobs']['Insert'];

type HistoricalJobStatus = 'queued' | 'running' | 'completed' | 'partial' | 'failed';

type HistoricalSyncProgress = {
  stage: FirstSyncStage | null;
  message: string | null;
  windowSince: string | null;
  windowUntil: string | null;
  windowsCompleted: number;
  coverageStartDate: string | null;
  coverageEndDate: string | null;
  counts: FirstSyncStatusCounts;
  updatedAt: string | null;
};

type HistoricalSyncJobMetadata = {
  externalAccountId?: string | null;
  queuedFrom?: string | null;
  progress?: Partial<HistoricalSyncProgress>;
};

const DEFAULT_PROGRESS_COUNTS: FirstSyncStatusCounts = {
  campaignsSynced: 0,
  adsetsSynced: 0,
  adsSynced: 0,
  creativesSynced: 0,
  performanceRowsSynced: 0,
};

const FIRST_SYNC_STAGES = new Set<FirstSyncStage>([
  'resolving_account',
  'syncing_campaigns',
  'syncing_adsets',
  'syncing_ads',
  'syncing_creatives',
  'syncing_performance_windows',
  'finalizing_summaries',
  'running_assessments',
  'completed',
]);

function todayIso(): string {
  return new Date().toISOString();
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function asNonNegativeInteger(value: unknown, fallback: number = 0): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : fallback;
}

function isHistoricalSyncType(value: unknown): value is HistoricalSyncType {
  return (
    value === 'initial_historical' ||
    value === 'incremental' ||
    value === 'manual_refresh' ||
    value === 'backfill'
  );
}

function isAccountSyncJobStatus(value: unknown): value is AccountSyncJobStatus {
  return value === 'queued' || value === 'running' || value === 'completed' || value === 'failed';
}

function parseHistoricalSyncJobMetadata(value: Json | null | undefined): HistoricalSyncJobMetadata {
  const metadata = asRecord(value);
  const progress = asRecord(metadata.progress);
  const countsRecord = asRecord(progress.counts);
  const stage = FIRST_SYNC_STAGES.has(progress.stage as FirstSyncStage)
    ? (progress.stage as FirstSyncStage)
    : null;

  return {
    externalAccountId: asNullableString(metadata.externalAccountId),
    queuedFrom: asNullableString(metadata.queuedFrom),
    progress: {
      stage,
      message: asNullableString(progress.message),
      windowSince: asNullableString(progress.windowSince),
      windowUntil: asNullableString(progress.windowUntil),
      windowsCompleted: asNonNegativeInteger(progress.windowsCompleted),
      coverageStartDate: asNullableString(progress.coverageStartDate),
      coverageEndDate: asNullableString(progress.coverageEndDate),
      counts: {
        campaignsSynced: asNonNegativeInteger(countsRecord.campaignsSynced),
        adsetsSynced: asNonNegativeInteger(countsRecord.adsetsSynced),
        adsSynced: asNonNegativeInteger(countsRecord.adsSynced),
        creativesSynced: asNonNegativeInteger(countsRecord.creativesSynced),
        performanceRowsSynced: asNonNegativeInteger(countsRecord.performanceRowsSynced),
      },
      updatedAt: asNullableString(progress.updatedAt),
    },
  };
}

function serializeHistoricalSyncJobMetadata(
  metadata: HistoricalSyncJobMetadata
): Database['public']['Tables']['account_sync_jobs']['Update']['metadata'] {
  return {
    ...(metadata.externalAccountId ? { externalAccountId: metadata.externalAccountId } : {}),
    ...(metadata.queuedFrom ? { queuedFrom: metadata.queuedFrom } : {}),
    ...(metadata.progress
      ? {
          progress: {
            ...(metadata.progress.stage ? { stage: metadata.progress.stage } : {}),
            ...(metadata.progress.message ? { message: metadata.progress.message } : {}),
            ...(metadata.progress.windowSince ? { windowSince: metadata.progress.windowSince } : {}),
            ...(metadata.progress.windowUntil ? { windowUntil: metadata.progress.windowUntil } : {}),
            windowsCompleted: metadata.progress.windowsCompleted ?? 0,
            ...(metadata.progress.coverageStartDate
              ? { coverageStartDate: metadata.progress.coverageStartDate }
              : {}),
            ...(metadata.progress.coverageEndDate
              ? { coverageEndDate: metadata.progress.coverageEndDate }
              : {}),
            counts: metadata.progress.counts ?? DEFAULT_PROGRESS_COUNTS,
            ...(metadata.progress.updatedAt ? { updatedAt: metadata.progress.updatedAt } : {}),
          },
        }
      : {}),
  } as Json;
}

function resolveCountsFromJob(
  job: AccountSyncJobRow,
  metadata: HistoricalSyncJobMetadata
): FirstSyncStatusCounts {
  const metadataCounts = metadata.progress?.counts ?? DEFAULT_PROGRESS_COUNTS;

  return {
    campaignsSynced: Math.max(job.campaigns_synced ?? 0, metadataCounts.campaignsSynced),
    adsetsSynced: Math.max(job.adsets_synced ?? 0, metadataCounts.adsetsSynced),
    adsSynced: Math.max(job.ads_synced ?? 0, metadataCounts.adsSynced),
    creativesSynced: Math.max(job.creatives_synced ?? 0, metadataCounts.creativesSynced),
    performanceRowsSynced: Math.max(
      job.performance_rows_synced ?? 0,
      metadataCounts.performanceRowsSynced
    ),
  };
}

export function resolveRequestedSyncWindow(backfillDays: number): {
  requestedStartDate: string;
  requestedEndDate: string;
} {
  const endDate = new Date();
  endDate.setUTCHours(0, 0, 0, 0);
  const startDate = new Date(endDate);
  startDate.setUTCDate(startDate.getUTCDate() - Math.max(1, Math.floor(backfillDays)) + 1);

  return {
    requestedStartDate: startDate.toISOString().slice(0, 10),
    requestedEndDate: endDate.toISOString().slice(0, 10),
  };
}

async function selectAdAccountSyncStates(
  supabase: RepositoryClient,
  adAccountIds: string[]
): Promise<AdAccountSyncStateRow[]> {
  const rows: AdAccountSyncStateRow[] = [];

  for (const adAccountIdsChunk of chunkArray(adAccountIds, 200)) {
    const { data, error } = await supabase
      .from('ad_account_sync_state')
      .select('*')
      .in('ad_account_id', adAccountIdsChunk);

    if (error) {
      throw error;
    }

    rows.push(...((data ?? []) as AdAccountSyncStateRow[]));
  }

  return rows;
}

async function selectHistoricalSyncJobs(
  supabase: RepositoryClient,
  input: {
    adAccountIds: string[];
    syncTypes?: HistoricalSyncType[];
    statuses?: HistoricalJobStatus[];
  }
): Promise<AccountSyncJobRow[]> {
  const rows: AccountSyncJobRow[] = [];

  for (const adAccountIdsChunk of chunkArray(input.adAccountIds, 200)) {
    let query = supabase
      .from('account_sync_jobs')
      .select('*')
      .in('ad_account_id', adAccountIdsChunk);

    if (input.syncTypes && input.syncTypes.length > 0) {
      query = query.in('sync_type', input.syncTypes);
    }

    if (input.statuses && input.statuses.length > 0) {
      query = query.in('status', input.statuses);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    rows.push(...((data ?? []) as AccountSyncJobRow[]));
  }

  return rows;
}

async function selectHistoricalSyncJobById(
  supabase: RepositoryClient,
  jobId: string
): Promise<AccountSyncJobRow | null> {
  const { data, error } = await supabase
    .from('account_sync_jobs')
    .select('*')
    .eq('id', jobId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as AccountSyncJobRow | null) ?? null;
}

export async function getAccountSyncJobById(
  supabase: RepositoryClient,
  jobId: string
): Promise<AccountSyncJobRow | null> {
  return selectHistoricalSyncJobById(supabase, jobId);
}

export async function ensureAdAccountSyncStates(
  supabase: RepositoryClient,
  adAccounts: AdAccountRow[]
): Promise<Map<string, AdAccountSyncStateRow>> {
  const adAccountIds = Array.from(new Set(adAccounts.map((account) => account.id)));

  if (adAccountIds.length === 0) {
    return new Map();
  }

  const existingRows = await selectAdAccountSyncStates(supabase, adAccountIds);
  const existingByAdAccountId = new Map(
    existingRows.map((row) => [row.ad_account_id, row] satisfies [string, AdAccountSyncStateRow])
  );
  const now = todayIso();
  const rowsToInsert: AdAccountSyncStateInsert[] = [];

  for (const adAccount of adAccounts) {
    if (existingByAdAccountId.has(adAccount.id)) {
      continue;
    }

    rowsToInsert.push({
      ad_account_id: adAccount.id,
      created_at: now,
      updated_at: now,
      first_full_sync_completed: false,
      historical_data_available: false,
      has_meaningful_history: false,
    });
  }

  for (const chunk of chunkArray(rowsToInsert, 200)) {
    const { error } = await supabase.from('ad_account_sync_state').insert(chunk);

    if (error) {
      throw error;
    }
  }

  const rows = rowsToInsert.length > 0
    ? await selectAdAccountSyncStates(supabase, adAccountIds)
    : existingRows;

  return new Map(
    rows.map((row) => [row.ad_account_id, row] satisfies [string, AdAccountSyncStateRow])
  );
}

export async function createOrReuseFirstSyncJob(
  supabase: RepositoryClient,
  input: {
    businessId: string;
    platformIntegrationId: string;
    adAccountId: string;
    requestedStartDate: string;
    requestedEndDate: string;
    metadata?: Json;
  }
): Promise<AccountSyncJobRow> {
  const existingJobs = await selectHistoricalSyncJobs(supabase, {
    adAccountIds: [input.adAccountId],
    syncTypes: ['initial_historical'],
    statuses: ['queued', 'running'],
  });
  const existing = existingJobs[0] ?? null;

  if (existing) {
    return existing;
  }

  const metadata = parseHistoricalSyncJobMetadata(input.metadata);
  metadata.progress = {
    ...(metadata.progress ?? {}),
    message: metadata.progress?.message ?? 'Queued for first history sync.',
    windowsCompleted: metadata.progress?.windowsCompleted ?? 0,
    counts: metadata.progress?.counts ?? DEFAULT_PROGRESS_COUNTS,
    updatedAt: todayIso(),
  };

  const rowToInsert: AccountSyncJobInsert = {
    business_id: input.businessId,
      platform_integration_id: input.platformIntegrationId,
      ad_account_id: input.adAccountId,
      status: 'queued',
      sync_type: 'initial_historical',
      requested_start_date: input.requestedStartDate,
      requested_end_date: input.requestedEndDate,
      metadata: serializeHistoricalSyncJobMetadata(metadata),
  };

  const { data, error } = await supabase
    .from('account_sync_jobs')
    .insert(rowToInsert)
    .select('*')
    .single();

  if (error || !data) {
    throw error ?? new Error('Failed to enqueue first history sync job');
  }

  return data as AccountSyncJobRow;
}

export async function enqueueBackfillSyncJob(
  supabase: RepositoryClient,
  input: {
    businessId: string;
    platformIntegrationId: string;
    adAccountId: string;
    requestedStartDate: string;
    requestedEndDate: string;
    metadata?: Json;
  }
): Promise<AccountSyncJobRow> {
  const existingJobs = await selectHistoricalSyncJobs(supabase, {
    adAccountIds: [input.adAccountId],
    syncTypes: ['backfill'],
    statuses: ['queued', 'running'],
  });
  const existing = existingJobs[0] ?? null;
  if (existing) {
    return existing;
  }

  const { data, error } = await supabase
    .from('account_sync_jobs')
    .insert({
      business_id: input.businessId,
      platform_integration_id: input.platformIntegrationId,
      ad_account_id: input.adAccountId,
      status: 'queued',
      sync_type: 'backfill',
      requested_start_date: input.requestedStartDate,
      requested_end_date: input.requestedEndDate,
      metadata: input.metadata ?? {},
    })
    .select('*')
    .single();

  if (error || !data) {
    throw error ?? new Error('Failed to enqueue backfill sync job');
  }

  return data as AccountSyncJobRow;
}

export async function claimHistoricalSyncJob(
  supabase: RepositoryClient,
  input?: {
    jobId?: string | null;
    syncTypes?: HistoricalSyncType[] | null;
  }
): Promise<AccountSyncJobRow | null> {
  const { data, error } = await (supabase as any).rpc('claim_account_sync_job', {
    target_job_id: input?.jobId ?? null,
    allowed_sync_types: input?.syncTypes ?? null,
  });

  if (error) {
    throw error;
  }

  const row = Array.isArray(data) ? data[0] ?? null : data ?? null;
  return (row as AccountSyncJobRow | null) ?? null;
}

function mergeProgressCounts(
  current: FirstSyncStatusCounts,
  patch?: Partial<FirstSyncStatusCounts>
): FirstSyncStatusCounts {
  if (!patch) {
    return current;
  }

  return {
    campaignsSynced: patch.campaignsSynced ?? current.campaignsSynced,
    adsetsSynced: patch.adsetsSynced ?? current.adsetsSynced,
    adsSynced: patch.adsSynced ?? current.adsSynced,
    creativesSynced: patch.creativesSynced ?? current.creativesSynced,
    performanceRowsSynced: patch.performanceRowsSynced ?? current.performanceRowsSynced,
  };
}

export async function updateHistoricalSyncJobProgress(
  supabase: RepositoryClient,
  input: {
    jobId: string;
    stage?: FirstSyncStage | null;
    message?: string | null;
    windowSince?: string | null;
    windowUntil?: string | null;
    windowsCompleted?: number;
    coverageStartDate?: string | null;
    coverageEndDate?: string | null;
    counts?: Partial<FirstSyncStatusCounts>;
    actualStartDate?: string | null;
    actualEndDate?: string | null;
    updatedAt?: string;
  }
): Promise<AccountSyncJobRow> {
  const existing = await selectHistoricalSyncJobById(supabase, input.jobId);

  if (!existing) {
    throw new Error('Historical sync job not found');
  }

  const updatedAt = input.updatedAt ?? todayIso();
  const metadata = parseHistoricalSyncJobMetadata(existing.metadata);
  const currentProgress = metadata.progress ?? {
    stage: null,
    message: null,
    windowSince: null,
    windowUntil: null,
    windowsCompleted: 0,
    coverageStartDate: null,
    coverageEndDate: null,
    counts: DEFAULT_PROGRESS_COUNTS,
    updatedAt: null,
  };
  const mergedCounts = mergeProgressCounts(
    resolveCountsFromJob(existing, metadata),
    input.counts
  );

  metadata.progress = {
    stage:
      input.stage !== undefined ? input.stage : currentProgress.stage ?? null,
    message:
      input.message !== undefined ? input.message : currentProgress.message ?? null,
    windowSince:
      input.windowSince !== undefined
        ? input.windowSince
        : currentProgress.windowSince ?? null,
    windowUntil:
      input.windowUntil !== undefined
        ? input.windowUntil
        : currentProgress.windowUntil ?? null,
    windowsCompleted:
      input.windowsCompleted !== undefined
        ? input.windowsCompleted
        : currentProgress.windowsCompleted ?? 0,
    coverageStartDate:
      input.coverageStartDate !== undefined
        ? input.coverageStartDate
        : currentProgress.coverageStartDate ?? null,
    coverageEndDate:
      input.coverageEndDate !== undefined
        ? input.coverageEndDate
        : currentProgress.coverageEndDate ?? null,
    counts: mergedCounts,
    updatedAt,
  };

  const { data, error } = await supabase
    .from('account_sync_jobs')
    .update({
      campaigns_synced: mergedCounts.campaignsSynced,
      adsets_synced: mergedCounts.adsetsSynced,
      ads_synced: mergedCounts.adsSynced,
      creatives_synced: mergedCounts.creativesSynced,
      performance_rows_synced: mergedCounts.performanceRowsSynced,
      actual_start_date:
        input.actualStartDate !== undefined ? input.actualStartDate : existing.actual_start_date,
      actual_end_date:
        input.actualEndDate !== undefined ? input.actualEndDate : existing.actual_end_date,
      metadata: serializeHistoricalSyncJobMetadata(metadata),
      updated_at: updatedAt,
    })
    .eq('id', input.jobId)
    .select('*')
    .single();

  if (error || !data) {
    throw error ?? new Error('Failed to update historical sync job progress');
  }

  return data as AccountSyncJobRow;
}

async function getLatestCoverageJob(
  supabase: RepositoryClient,
  adAccountId: string
): Promise<AccountSyncJobRow | null> {
  const jobs = await selectHistoricalSyncJobs(supabase, {
    adAccountIds: [adAccountId],
    syncTypes: ['initial_historical', 'backfill'],
    statuses: ['queued', 'running', 'completed', 'failed'],
  });

  return jobs[0] ?? null;
}

export async function getAdAccountSyncCoverage(
  supabase: RepositoryClient,
  adAccountId: string
): Promise<SyncCoverage | null> {
  const syncStateRows = await selectAdAccountSyncStates(supabase, [adAccountId]);
  const syncState = syncStateRows[0] ?? null;

  if (!syncState) {
    return null;
  }

  const [latestCoverageJob, lastSuccessfulJob] = await Promise.all([
    getLatestCoverageJob(supabase, adAccountId),
    syncState.last_successful_sync_job_id
      ? selectHistoricalSyncJobById(supabase, syncState.last_successful_sync_job_id)
      : Promise.resolve(null),
  ]);

  const fullHistoryCompleted = syncState.first_full_sync_completed === true;
  const coverageStartDate = fullHistoryCompleted
    ? syncState.first_activity_date ??
      lastSuccessfulJob?.actual_start_date ??
      lastSuccessfulJob?.requested_start_date ??
      null
    : lastSuccessfulJob?.actual_start_date ??
      lastSuccessfulJob?.requested_start_date ??
      null;
  const coverageEndDate =
    syncState.insights_synced_through ??
    syncState.latest_activity_date ??
    lastSuccessfulJob?.actual_end_date ??
    lastSuccessfulJob?.requested_end_date ??
    null;
  const activeJobStatus = isAccountSyncJobStatus(latestCoverageJob?.status)
    ? latestCoverageJob!.status
    : null;
  const activeJobSyncType = isHistoricalSyncType(latestCoverageJob?.sync_type)
    ? latestCoverageJob!.sync_type
    : null;
  const shouldExposeLatestJob =
    activeJobStatus === 'queued' || activeJobStatus === 'running' || activeJobStatus === 'failed';
  const historicalRepairPending =
    activeJobSyncType === 'backfill' &&
    (activeJobStatus === 'queued' || activeJobStatus === 'running' || activeJobStatus === 'failed');

  return {
    syncMode: fullHistoryCompleted ? 'incremental' : 'first_sync',
    coverageStartDate,
    coverageEndDate,
    firstFullSyncCompleted: fullHistoryCompleted,
    activeJobId: shouldExposeLatestJob ? latestCoverageJob?.id ?? null : null,
    activeJobStatus: shouldExposeLatestJob ? activeJobStatus : null,
    activeJobSyncType: shouldExposeLatestJob ? activeJobSyncType : null,
    historicalAnalysisPending: !fullHistoryCompleted || historicalRepairPending,
  };
}

export function buildFirstSyncJobStatus(
  job: AccountSyncJobRow,
  syncCoverage: SyncCoverage | null
): FirstSyncJobStatus {
  const metadata = parseHistoricalSyncJobMetadata(job.metadata);
  const progress = metadata.progress;
  const counts = resolveCountsFromJob(job, metadata);
  const stage =
    job.status === 'completed'
      ? 'completed'
      : progress?.stage ?? null;

  return {
    jobId: job.id,
    adAccountId: job.ad_account_id,
    integrationId: job.platform_integration_id,
    status: isAccountSyncJobStatus(job.status) ? job.status : 'queued',
    stage,
    message:
      job.status === 'completed'
        ? progress?.message ?? 'First history sync completed.'
        : progress?.message ?? null,
    windowSince: progress?.windowSince ?? null,
    windowUntil: progress?.windowUntil ?? null,
    windowsCompleted: progress?.windowsCompleted ?? 0,
    coverageStartDate:
      progress?.coverageStartDate ??
      syncCoverage?.coverageStartDate ??
      job.actual_start_date ??
      null,
    coverageEndDate:
      progress?.coverageEndDate ??
      syncCoverage?.coverageEndDate ??
      job.actual_end_date ??
      null,
    firstFullSyncCompleted: syncCoverage?.firstFullSyncCompleted ?? job.status === 'completed',
    counts,
    startedAt: job.started_at,
    finishedAt: job.finished_at,
    errorMessage: job.error_message,
  };
}

export async function beginHistoricalSyncJob(
  supabase: RepositoryClient,
  input: {
    businessId: string;
    platformIntegrationId: string;
    adAccountId: string;
    requestedStartDate: string;
    requestedEndDate: string;
    syncType?: HistoricalSyncType;
  }
): Promise<AccountSyncJobRow> {
  const syncType = input.syncType ?? 'incremental';
  const existingJobs = await selectHistoricalSyncJobs(supabase, {
    adAccountIds: [input.adAccountId],
    syncTypes: [syncType],
    statuses: ['queued', 'running'],
  });
  const existing = existingJobs[0] ?? null;
  const now = todayIso();

  if (existing?.status === 'running') {
    return existing;
  }

  if (existing?.status === 'queued') {
    const { data, error } = await supabase
      .from('account_sync_jobs')
      .update({
        status: 'running',
        started_at: now,
        requested_start_date: input.requestedStartDate,
        requested_end_date: input.requestedEndDate,
        updated_at: now,
      })
      .eq('id', existing.id)
      .select('*')
      .single();

    if (error || !data) {
      throw error ?? new Error('Failed to begin queued historical sync job');
    }

    return data as AccountSyncJobRow;
  }

  const { data, error } = await supabase
    .from('account_sync_jobs')
    .insert({
      business_id: input.businessId,
      platform_integration_id: input.platformIntegrationId,
      ad_account_id: input.adAccountId,
      status: 'running',
      sync_type: syncType,
      requested_start_date: input.requestedStartDate,
      requested_end_date: input.requestedEndDate,
      started_at: now,
    })
    .select('*')
    .single();

  if (error || !data) {
    throw error ?? new Error('Failed to create historical sync job');
  }

  return data as AccountSyncJobRow;
}

export async function completeHistoricalSyncJob(
  supabase: RepositoryClient,
  input: {
    jobId: string;
    finishedAt: string;
    actualStartDate: string | null;
    actualEndDate: string | null;
    campaignsSynced: number;
    adsetsSynced: number;
    adsSynced: number;
    creativesSynced: number;
    performanceRowsSynced: number;
    message?: string | null;
  }
): Promise<void> {
  const existing = await selectHistoricalSyncJobById(supabase, input.jobId);
  if (!existing) {
    throw new Error('Historical sync job not found');
  }

  const metadata = parseHistoricalSyncJobMetadata(existing.metadata);
  metadata.progress = {
    ...(metadata.progress ?? {}),
    stage: 'completed',
    message: input.message ?? metadata.progress?.message ?? 'Historical sync completed.',
    coverageStartDate: input.actualStartDate,
    coverageEndDate: input.actualEndDate,
    counts: {
      campaignsSynced: input.campaignsSynced,
      adsetsSynced: input.adsetsSynced,
      adsSynced: input.adsSynced,
      creativesSynced: input.creativesSynced,
      performanceRowsSynced: input.performanceRowsSynced,
    },
    updatedAt: input.finishedAt,
  };

  const { error } = await supabase
    .from('account_sync_jobs')
    .update({
      status: 'completed',
      finished_at: input.finishedAt,
      actual_start_date: input.actualStartDate,
      actual_end_date: input.actualEndDate,
      campaigns_synced: input.campaignsSynced,
      adsets_synced: input.adsetsSynced,
      ads_synced: input.adsSynced,
      creatives_synced: input.creativesSynced,
      performance_rows_synced: input.performanceRowsSynced,
      error_message: null,
      metadata: serializeHistoricalSyncJobMetadata(metadata),
      updated_at: input.finishedAt,
    })
    .eq('id', input.jobId);

  if (error) {
    throw error;
  }
}

export async function failHistoricalSyncJob(
  supabase: RepositoryClient,
  input: {
    adAccountId: string;
    jobId: string;
    failedAt: string;
    errorMessage: string;
  }
): Promise<void> {
  const existing = await selectHistoricalSyncJobById(supabase, input.jobId);
  const metadata = existing ? parseHistoricalSyncJobMetadata(existing.metadata) : null;

  if (metadata?.progress) {
    metadata.progress.message = input.errorMessage;
    metadata.progress.updatedAt = input.failedAt;
  }

  const [{ error: jobError }, { error: syncStateError }] = await Promise.all([
    supabase
      .from('account_sync_jobs')
      .update({
        status: 'failed',
        finished_at: input.failedAt,
        error_message: input.errorMessage,
        ...(metadata ? { metadata: serializeHistoricalSyncJobMetadata(metadata) } : {}),
        updated_at: input.failedAt,
      })
      .eq('id', input.jobId),
    supabase
      .from('ad_account_sync_state')
      .update({
        last_failed_sync_job_id: input.jobId,
        updated_at: input.failedAt,
      })
      .eq('ad_account_id', input.adAccountId),
  ]);

  if (jobError) {
    throw jobError;
  }

  if (syncStateError) {
    throw syncStateError;
  }
}

export async function markAdAccountHistoricalSyncSucceeded(
  supabase: RepositoryClient,
  input: {
    adAccountId: string;
    jobId: string;
    syncedAt: string;
    historicalDataAvailable: boolean;
    hasMeaningfulHistory: boolean;
    firstActivityDate: string | null;
    latestActivityDate: string | null;
    insightsSyncedThrough: string | null;
    completesFullHistory: boolean;
  }
): Promise<void> {
  const syncStatePatch: Database['public']['Tables']['ad_account_sync_state']['Update'] = {
    dimensions_synced_at: input.syncedAt,
    historical_data_available: input.historicalDataAvailable,
    has_meaningful_history: input.hasMeaningfulHistory,
    first_activity_date: input.firstActivityDate,
    latest_activity_date: input.latestActivityDate,
    insights_synced_through: input.insightsSyncedThrough,
    last_successful_sync_job_id: input.jobId,
    updated_at: input.syncedAt,
  };

  if (input.completesFullHistory) {
    syncStatePatch.first_full_sync_completed = true;
    syncStatePatch.first_full_sync_at = input.syncedAt;
  } else {
    syncStatePatch.last_incremental_sync_at = input.syncedAt;
  }

  const [{ error: adAccountError }, { error: syncStateError }] = await Promise.all([
    supabase
      .from('ad_accounts')
      .update({
        last_synced: input.syncedAt,
        updated_at: input.syncedAt,
      })
      .eq('id', input.adAccountId),
    supabase
      .from('ad_account_sync_state')
      .update(syncStatePatch)
      .eq('ad_account_id', input.adAccountId),
  ]);

  if (adAccountError) {
    throw adAccountError;
  }

  if (syncStateError) {
    throw syncStateError;
  }
}
