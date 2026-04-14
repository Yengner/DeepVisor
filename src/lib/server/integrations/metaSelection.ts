import type { SupabaseClient } from '@supabase/supabase-js';
import type { NextResponse } from 'next/server';
import {
  enqueueBackfillSyncJob,
  getAdAccountSyncCoverage,
} from '@/lib/server/repositories/ad_accounts/syncState';
import type { Database } from '@/lib/shared/types/supabase';
import { syncBusinessPlatform } from '@/lib/server/sync';
import type { SyncTrigger } from '@/lib/server/sync/types';
import { FULL_HISTORY_BACKFILL_DAYS, RECENT_SEED_SYNC_DAYS } from '@/lib/server/sync/types';
import { resolveMetaBackfillWindow } from '@/lib/server/sync/meta/client';
import type { SyncCoverage } from '@/lib/shared/types/integrations';
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
  counts: Awaited<ReturnType<typeof syncBusinessPlatform>>['counts'];
  startedAt: string;
  completedAt: string;
};

// Routes should update one primary ad account, then run the real sync flow once.
// Keeping that sequence here avoids duplicated route logic and keeps cookies consistent.
/**
 * Promotes the selected Meta ad account to primary, runs the recent-first sync, and queues backfill when needed.
 *
 * @param input - Business, integration, and selected account context for the sync kickoff.
 * @returns The selected integration/account identifiers, sync coverage, and sync timing metadata.
 */
export async function syncSelectedMetaAdAccount(
  input: SyncSelectedMetaAdAccountInput
): Promise<SyncSelectedMetaAdAccountResult> {
  await setPrimaryMetaAdAccount(input.supabase, {
    integrationId: input.integrationId,
    externalAccountId: input.externalAccountId,
    name: input.name,
  });

  const summary = await syncBusinessPlatform({
    businessId: input.businessId,
    integrationId: input.integrationId,
    trigger: input.trigger,
    backfillDays: input.backfillDays ?? RECENT_SEED_SYNC_DAYS,
    syncMode: 'seed_recent',
    primaryExternalAccountId: input.externalAccountId,
  });

  const { data: syncedAccount, error: syncedAccountError } = await input.supabase
    .from('ad_accounts')
    .select('id, name')
    .eq('business_id', input.businessId)
    .eq('platform_id', input.platformId)
    .eq('external_account_id', input.externalAccountId)
    .maybeSingle();

  if (syncedAccountError) {
    throw syncedAccountError;
  }

  let syncCoverage: SyncCoverage | null = null;

  if (syncedAccount?.id) {
    syncCoverage = await getAdAccountSyncCoverage(input.supabase, syncedAccount.id);

    if (!syncCoverage || syncCoverage.historicalAnalysisPending) {
      const fullHistoryWindow = resolveMetaBackfillWindow(FULL_HISTORY_BACKFILL_DAYS);
      await enqueueBackfillSyncJob(input.supabase, {
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
    }
  }

  return {
    integrationId: input.integrationId,
    platformId: input.platformId,
    externalAccountId: input.externalAccountId,
    adAccountId: syncedAccount?.id ?? null,
    adAccountName: syncedAccount?.name ?? input.name,
    syncCoverage,
    counts: summary.counts,
    startedAt: summary.startedAt,
    completedAt: summary.completedAt,
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
