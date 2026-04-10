import type { SupabaseClient } from '@supabase/supabase-js';
import type { NextResponse } from 'next/server';
import type { Database } from '@/lib/shared/types/supabase';
import { syncBusinessPlatform } from '@/lib/server/sync';
import type { SyncTrigger } from '@/lib/server/sync/types';
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
  counts: Awaited<ReturnType<typeof syncBusinessPlatform>>['counts'];
  startedAt: string;
  completedAt: string;
};

// Routes should update one primary ad account, then run the real sync flow once.
// Keeping that sequence here avoids duplicated route logic and keeps cookies consistent.
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
    backfillDays: input.backfillDays,
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

  return {
    integrationId: input.integrationId,
    platformId: input.platformId,
    externalAccountId: input.externalAccountId,
    adAccountId: syncedAccount?.id ?? null,
    adAccountName: syncedAccount?.name ?? input.name,
    counts: summary.counts,
    startedAt: summary.startedAt,
    completedAt: summary.completedAt,
  };
}

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
