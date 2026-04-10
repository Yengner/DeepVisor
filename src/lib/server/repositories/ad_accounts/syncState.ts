import type { Database, Json } from '@/lib/shared/types/supabase';
import { chunkArray, type RepositoryClient } from '../utils';

type AdAccountRow = Database['public']['Tables']['ad_accounts']['Row'];
type AdAccountSyncStateRow = Database['public']['Tables']['ad_account_sync_state']['Row'];
type AdAccountSyncStateInsert = Database['public']['Tables']['ad_account_sync_state']['Insert'];
type AccountSyncJobRow = Database['public']['Tables']['account_sync_jobs']['Row'];

type HistoricalJobStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'partial'
  | 'failed';
type HistoricalJobType =
  | 'initial_historical'
  | 'incremental'
  | 'manual_refresh'
  | 'backfill';

function todayIso(): string {
  return new Date().toISOString();
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
    syncType?: HistoricalJobType;
    statuses?: HistoricalJobStatus[];
  }
): Promise<AccountSyncJobRow[]> {
  const rows: AccountSyncJobRow[] = [];

  for (const adAccountIdsChunk of chunkArray(input.adAccountIds, 200)) {
    let query = supabase
      .from('account_sync_jobs')
      .select('*')
      .in('ad_account_id', adAccountIdsChunk);

    if (input.syncType) {
      query = query.eq('sync_type', input.syncType);
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

export async function enqueueInitialHistoricalSyncJobs(
  supabase: RepositoryClient,
  input: {
    businessId: string;
    platformIntegrationId: string;
    adAccounts: AdAccountRow[];
    requestedStartDate: string;
    requestedEndDate: string;
  }
): Promise<Map<string, AccountSyncJobRow>> {
  const syncStates = await ensureAdAccountSyncStates(supabase, input.adAccounts);
  const existingJobs = await selectHistoricalSyncJobs(supabase, {
    adAccountIds: input.adAccounts.map((account) => account.id),
    syncType: 'initial_historical',
    statuses: ['queued', 'running'],
  });
  const jobsByAdAccountId = new Map(
    existingJobs.map((job) => [job.ad_account_id, job] satisfies [string, AccountSyncJobRow])
  );
  const rowsToInsert = input.adAccounts
    .filter((account) => {
      const syncState = syncStates.get(account.id);
      return !syncState?.first_full_sync_completed && !jobsByAdAccountId.has(account.id);
    })
    .map((account) => ({
      business_id: input.businessId,
      platform_integration_id: input.platformIntegrationId,
      ad_account_id: account.id,
      status: 'queued',
      sync_type: 'initial_historical',
      requested_start_date: input.requestedStartDate,
      requested_end_date: input.requestedEndDate,
      metadata: {
        externalAccountId: account.external_account_id,
        discoveredAt: todayIso(),
      } satisfies Json,
    }));

  for (const chunk of chunkArray(rowsToInsert, 200)) {
    const { error } = await supabase.from('account_sync_jobs').insert(chunk);

    if (error) {
      throw error;
    }
  }

  const jobs = await selectHistoricalSyncJobs(supabase, {
    adAccountIds: input.adAccounts.map((account) => account.id),
    syncType: 'initial_historical',
    statuses: ['queued', 'running'],
  });

  return new Map(
    jobs.map((job) => [job.ad_account_id, job] satisfies [string, AccountSyncJobRow])
  );
}

export async function beginHistoricalSyncJob(
  supabase: RepositoryClient,
  input: {
    businessId: string;
    platformIntegrationId: string;
    adAccountId: string;
    requestedStartDate: string;
    requestedEndDate: string;
    syncType?: HistoricalJobType;
  }
): Promise<AccountSyncJobRow> {
  const syncType = input.syncType ?? 'initial_historical';
  const existingJobs = await selectHistoricalSyncJobs(supabase, {
    adAccountIds: [input.adAccountId],
    syncType,
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
  }
): Promise<void> {
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
  const [{ error: jobError }, { error: syncStateError }] = await Promise.all([
    supabase
      .from('account_sync_jobs')
      .update({
        status: 'failed',
        finished_at: input.failedAt,
        error_message: input.errorMessage,
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
    isInitialHistoricalSync: boolean;
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

  if (input.isInitialHistoricalSync) {
    syncStatePatch.first_full_sync_completed = true;
    syncStatePatch.first_full_sync_at = input.syncedAt;
  } else {
    syncStatePatch.last_incremental_sync_at = input.syncedAt;
  }

  // `last_synced` is reserved for completed historical sync, never discovery/registration.
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
