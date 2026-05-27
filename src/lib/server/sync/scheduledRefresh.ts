import 'server-only';

import { toSupportedIntegrationPlatform } from '@/lib/shared';
import { createOrReuseQueuedSyncJob } from '@/lib/server/repositories/ad_accounts/syncState';
import { getPrimaryAdAccountSelection } from '@/lib/server/integrations/service';
import { createAdminClient } from '@/lib/server/supabase/admin';
import type { Database, Json } from '@/lib/shared/types/supabase';
import { FULL_HISTORY_BACKFILL_DAYS } from './types';
import { resolveMetaBackfillWindow } from './meta/client';

type IntegrationRow = Database['public']['Tables']['platform_integrations']['Row'] & {
  platforms?: { key: string } | { key: string }[] | null;
};

type AdAccountWithSyncState = Pick<
  Database['public']['Tables']['ad_accounts']['Row'],
  'id' | 'business_id' | 'external_account_id' | 'last_synced' | 'platform_id'
> & {
  ad_account_sync_state?:
    | Pick<
        Database['public']['Tables']['ad_account_sync_state']['Row'],
        'first_full_sync_completed' | 'last_incremental_sync_at' | 'first_full_sync_at'
      >
    | Array<
        Pick<
          Database['public']['Tables']['ad_account_sync_state']['Row'],
          'first_full_sync_completed' | 'last_incremental_sync_at' | 'first_full_sync_at'
        >
      >
    | null;
};

export type ScheduledAccountSyncResult = {
  consideredCount: number;
  queuedCount: number;
  skippedCount: number;
  failedCount: number;
  results: Array<{
    businessId: string;
    integrationId: string;
    adAccountId: string | null;
    status: 'queued' | 'skipped' | 'failed';
    message: string;
  }>;
};

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const DEFAULT_LOOKBACK_DAYS = 7;
const MAX_LOOKBACK_DAYS = 30;
const DEFAULT_STALE_AFTER_MINUTES = 60;

function isScheduledSyncEligibleStatus(status: string): boolean {
  return status === 'connected' || status === 'error';
}

function latestTimestampMs(values: Array<string | null | undefined>): number | null {
  let latest: number | null = null;

  for (const value of values) {
    if (!value) {
      continue;
    }

    const parsed = new Date(value).getTime();
    if (!Number.isFinite(parsed)) {
      continue;
    }

    latest = latest === null ? parsed : Math.max(latest, parsed);
  }

  return latest;
}

function clampPositiveInteger(value: number | undefined, fallback: number, max: number): number {
  if (!Number.isFinite(value) || !value || value <= 0) {
    return fallback;
  }

  return Math.min(Math.floor(value), max);
}

function resolveSyncState(input: AdAccountWithSyncState) {
  return Array.isArray(input.ad_account_sync_state)
    ? input.ad_account_sync_state[0] ?? null
    : input.ad_account_sync_state ?? null;
}

function shouldSkipFreshAccount(input: {
  adAccount: AdAccountWithSyncState;
  staleAfterMinutes: number;
}): boolean {
  if (input.staleAfterMinutes <= 0) {
    return false;
  }

  const syncState = resolveSyncState(input.adAccount);
  const latestSyncMs = latestTimestampMs([
    syncState?.last_incremental_sync_at,
    syncState?.first_full_sync_at,
    input.adAccount.last_synced,
  ]);

  if (latestSyncMs === null) {
    return false;
  }

  return Date.now() - latestSyncMs < input.staleAfterMinutes * 60_000;
}

async function listLatestMetaIntegrations(input: {
  businessId?: string | null;
}): Promise<IntegrationRow[]> {
  const supabase = createAdminClient();
  let query = supabase
    .from('platform_integrations')
    .select('*, platforms ( key )')
    .order('updated_at', { ascending: false });

  if (input.businessId) {
    query = query.eq('business_id', input.businessId);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  const latestByBusinessPlatformId = new Map<string, IntegrationRow>();

  for (const row of (data ?? []) as IntegrationRow[]) {
    const platform = Array.isArray(row.platforms) ? row.platforms[0] : row.platforms;
    const platformKey = toSupportedIntegrationPlatform(platform?.key);

    if (platformKey !== 'meta') {
      continue;
    }

    if (!isScheduledSyncEligibleStatus(row.status)) {
      continue;
    }

    const dedupeKey = `${row.business_id}:${row.platform_id}`;
    if (latestByBusinessPlatformId.has(dedupeKey)) {
      continue;
    }

    latestByBusinessPlatformId.set(dedupeKey, row);
  }

  return Array.from(latestByBusinessPlatformId.values());
}

export async function enqueueScheduledAccountSyncJobs(input?: {
  limit?: number;
  lookbackDays?: number;
  staleAfterMinutes?: number;
  businessId?: string | null;
  adAccountId?: string | null;
}): Promise<ScheduledAccountSyncResult> {
  const supabase = createAdminClient();
  const limit = clampPositiveInteger(input?.limit, DEFAULT_LIMIT, MAX_LIMIT);
  const lookbackDays = clampPositiveInteger(input?.lookbackDays, DEFAULT_LOOKBACK_DAYS, MAX_LOOKBACK_DAYS);
  const staleAfterMinutes = clampPositiveInteger(
    input?.staleAfterMinutes,
    DEFAULT_STALE_AFTER_MINUTES,
    24 * 60
  );
  const integrations = await listLatestMetaIntegrations({
    businessId: input?.businessId ?? null,
  });
  const results: ScheduledAccountSyncResult['results'] = [];

  for (const integration of integrations) {
    if (results.length >= limit) {
      break;
    }

    try {
      const primarySelection = getPrimaryAdAccountSelection(integration.integration_details);

      if (!primarySelection.externalAccountId) {
        results.push({
          businessId: integration.business_id,
          integrationId: integration.id,
          adAccountId: null,
          status: 'skipped',
          message: 'Meta integration has no selected primary ad account.',
        });
        continue;
      }

      let adAccountQuery = supabase
        .from('ad_accounts')
        .select(
          'id,business_id,external_account_id,last_synced,platform_id,ad_account_sync_state ( first_full_sync_completed, last_incremental_sync_at, first_full_sync_at )'
        )
        .eq('business_id', integration.business_id)
        .eq('platform_id', integration.platform_id)
        .eq('external_account_id', primarySelection.externalAccountId);

      if (input?.adAccountId) {
        adAccountQuery = adAccountQuery.eq('id', input.adAccountId);
      }

      const { data: adAccount, error: adAccountError } = await adAccountQuery.maybeSingle();

      if (adAccountError) {
        throw adAccountError;
      }

      if (!adAccount?.id) {
        results.push({
          businessId: integration.business_id,
          integrationId: integration.id,
          adAccountId: null,
          status: 'skipped',
          message: 'Selected Meta ad account is not registered.',
        });
        continue;
      }

      const typedAdAccount = adAccount as AdAccountWithSyncState;
      const syncState = resolveSyncState(typedAdAccount);
      const firstFullSyncCompleted = Boolean(syncState?.first_full_sync_completed);

      if (firstFullSyncCompleted && shouldSkipFreshAccount({ adAccount: typedAdAccount, staleAfterMinutes })) {
        results.push({
          businessId: integration.business_id,
          integrationId: integration.id,
          adAccountId: typedAdAccount.id,
          status: 'skipped',
          message: `Ad account synced within the last ${staleAfterMinutes} minutes.`,
        });
        continue;
      }

      const syncWindow = firstFullSyncCompleted
        ? resolveMetaBackfillWindow(lookbackDays)
        : resolveMetaBackfillWindow(FULL_HISTORY_BACKFILL_DAYS);
      const syncType = firstFullSyncCompleted ? 'incremental' : 'initial_historical';

      await createOrReuseQueuedSyncJob(supabase, {
        businessId: integration.business_id,
        platformIntegrationId: integration.id,
        adAccountId: typedAdAccount.id,
        requestedStartDate: syncWindow.since,
        requestedEndDate: syncWindow.until,
        syncType,
        metadata: {
          externalAccountId: primarySelection.externalAccountId,
          queuedFrom: 'scheduled_refresh',
          trigger: 'cron',
          syncMode: firstFullSyncCompleted ? 'default' : 'first_sync',
          current_step: 'queued',
          date_cursor: syncWindow.since,
          attempt: 0,
          last_processed_ids: {},
        } satisfies Json,
      });

      results.push({
        businessId: integration.business_id,
        integrationId: integration.id,
        adAccountId: typedAdAccount.id,
        status: 'queued',
        message: firstFullSyncCompleted
          ? 'Incremental account sync queued.'
          : 'Initial historical account sync queued.',
      });
    } catch (error) {
      results.push({
        businessId: integration.business_id,
        integrationId: integration.id,
        adAccountId: null,
        status: 'failed',
        message: error instanceof Error ? error.message : 'Failed to queue scheduled account sync.',
      });
    }
  }

  return {
    consideredCount: results.length,
    queuedCount: results.filter((item) => item.status === 'queued').length,
    skippedCount: results.filter((item) => item.status === 'skipped').length,
    failedCount: results.filter((item) => item.status === 'failed').length,
    results,
  };
}
