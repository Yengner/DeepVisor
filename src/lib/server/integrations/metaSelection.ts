import type { SupabaseClient } from '@supabase/supabase-js';
import type { NextResponse } from 'next/server';
import {
  buildFirstSyncJobStatus,
  createOrReuseFirstSyncJob,
  getAdAccountSyncCoverage,
} from '@/lib/server/repositories/ad_accounts/syncState';
import type { Database } from '@/lib/shared/types/supabase';
import { syncBusinessPlatform } from '@/lib/server/sync';
import type { SyncTrigger } from '@/lib/server/sync/types';
import { FULL_HISTORY_BACKFILL_DAYS } from '@/lib/server/sync/types';
import { resolveMetaBackfillWindow } from '@/lib/server/sync/meta/client';
import type { FirstSyncJobStatus, SyncCoverage } from '@/lib/shared/types/integrations';
import { setPrimaryMetaAdAccount } from './service';

type AppSupabaseClient = SupabaseClient<Database>;

const SELECTION_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

type SyncSelectedMetaAdAccountInput = {
  supabase: AppSupabaseClient;
  businessId: string;
  integrationId: string;
  platformId: string;
  externalAccountId: string;
  name: string | null;
  trigger: SyncTrigger;
  backfillDays?: number;
};

export type SyncSelectedMetaAdAccountResult = {
  integrationId: string;
  platformId: string;
  externalAccountId: string;
  adAccountId: string | null;
  adAccountName: string | null;
  syncCoverage: SyncCoverage | null;
  firstSyncJob: FirstSyncJobStatus | null;
  counts: Awaited<ReturnType<typeof syncBusinessPlatform>>['counts'] | null;
  startedAt: string | null;
  completedAt: string | null;
};

// Routes should update one primary ad account, then either queue the durable first-history sync
// or run the lightweight follow-up sync for already-initialized accounts.
// Keeping that sequence here avoids duplicated route logic and keeps cookies consistent.
/**
 * Promotes the selected Meta ad account to primary and starts the correct sync path for it.
 *
 * @param input - Business, integration, and selected account context for the sync kickoff.
 * @returns The selected integration/account identifiers, sync coverage, optional first-sync job,
 * and any inline sync timing metadata for already-initialized accounts.
 */
export async function syncSelectedMetaAdAccount(
  input: SyncSelectedMetaAdAccountInput
): Promise<SyncSelectedMetaAdAccountResult> {
  await setPrimaryMetaAdAccount(input.supabase, {
    integrationId: input.integrationId,
    externalAccountId: input.externalAccountId,
    name: input.name,
  });

  const { data: syncedAccount, error: syncedAccountError } = await input.supabase
    .from('ad_accounts')
    .select(
      'id, name, ad_account_sync_state ( first_full_sync_completed, first_activity_date, latest_activity_date, insights_synced_through )'
    )
    .eq('business_id', input.businessId)
    .eq('platform_id', input.platformId)
    .eq('external_account_id', input.externalAccountId)
    .maybeSingle();

  if (syncedAccountError) {
    throw syncedAccountError;
  }

  const syncState = Array.isArray(syncedAccount?.ad_account_sync_state)
    ? syncedAccount.ad_account_sync_state[0] ?? null
    : syncedAccount?.ad_account_sync_state ?? null;
  let syncCoverage: SyncCoverage | null = null;
  let firstSyncJob: FirstSyncJobStatus | null = null;
  let counts: Awaited<ReturnType<typeof syncBusinessPlatform>>['counts'] | null = null;
  let startedAt: string | null = null;
  let completedAt: string | null = null;

  if (syncedAccount?.id) {
    if (!syncState?.first_full_sync_completed) {
      const fullHistoryWindow = resolveMetaBackfillWindow(FULL_HISTORY_BACKFILL_DAYS);
      const job = await createOrReuseFirstSyncJob(input.supabase, {
        businessId: input.businessId,
        platformIntegrationId: input.integrationId,
        adAccountId: syncedAccount.id,
        requestedStartDate: fullHistoryWindow.since,
        requestedEndDate: fullHistoryWindow.until,
        metadata: {
          externalAccountId: input.externalAccountId,
          queuedFrom: 'meta_selection',
        },
      });
      syncCoverage = await getAdAccountSyncCoverage(input.supabase, syncedAccount.id);
      firstSyncJob = buildFirstSyncJobStatus(job, syncCoverage);
    } else {
      const summary = await syncBusinessPlatform({
        businessId: input.businessId,
        integrationId: input.integrationId,
        trigger: input.trigger,
        backfillDays: input.backfillDays ?? 7,
        syncMode: 'default',
        primaryExternalAccountId: input.externalAccountId,
      });
      syncCoverage = await getAdAccountSyncCoverage(input.supabase, syncedAccount.id);
      counts = summary.counts;
      startedAt = summary.startedAt;
      completedAt = summary.completedAt;
    }
  }

  return {
    integrationId: input.integrationId,
    platformId: input.platformId,
    externalAccountId: input.externalAccountId,
    adAccountId: syncedAccount?.id ?? null,
    adAccountName: syncedAccount?.name ?? input.name,
    syncCoverage,
    firstSyncJob,
    counts,
    startedAt,
    completedAt,
  };
}

/**
 * Persists the app's current integration and ad-account selection into response cookies.
 *
 * @param response - Outgoing response that should carry the selection cookies.
 * @param input - Selected platform integration id and ad-account row id, or `null` to clear them.
 * @returns Nothing. The response is mutated in place.
 */
export function applyAppSelectionCookies(
  response: NextResponse,
  input: {
    platformIntegrationId: string | null;
    adAccountId: string | null;
  }
): void {
  if (input.platformIntegrationId) {
    response.cookies.set('platform_integration_id', input.platformIntegrationId, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: SELECTION_COOKIE_MAX_AGE,
    });
  } else {
    response.cookies.set('platform_integration_id', '', {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
  }

  if (input.adAccountId) {
    response.cookies.set('ad_account_row_id', input.adAccountId, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: SELECTION_COOKIE_MAX_AGE,
    });
  } else {
    response.cookies.set('ad_account_row_id', '', {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
  }
}
