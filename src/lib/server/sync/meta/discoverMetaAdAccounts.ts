import 'server-only';

import type { MetaAdAccountSnapshot } from '@/lib/server/integrations/types';
import { ensureAdAccountSyncStates } from '@/lib/server/repositories/ad_accounts/syncState';
import { upsertAdAccounts } from '@/lib/server/repositories/ad_accounts/upsertAdAccounts';
import type { RepositoryClient } from '@/lib/server/repositories/utils';
import { fetchMetaAdAccountSnapshots } from './fetch';

/**
 * Registers every Meta ad account accessible to the integration without starting a data sync.
 *
 * This is the discovery-only step used immediately after OAuth so the app can present
 * account-selection UI before any account is chosen as the primary sync target.
 *
 * @param input - Repository client plus the business/platform context and either a Meta access token
 * or a pre-fetched snapshot list to register.
 * @returns The upsert result containing the discovered ad account rows.
 * @throws When neither snapshots nor an access token is provided, or when Meta returns no
 * accessible ad accounts for the integration.
 */
export async function discoverMetaAdAccounts(input: {
  supabase: RepositoryClient;
  businessId: string;
  platformId: string;
  accessToken?: string;
  snapshots?: MetaAdAccountSnapshot[];
}) {
  // Step 01 is discovery/registration only. It records accessible accounts and sync state,
  // but it never updates `last_synced`, stores metrics, or queues backfill work until the
  // user chooses a primary account.
  const snapshots =
    input.snapshots ??
    (input.accessToken ? await fetchMetaAdAccountSnapshots(input.accessToken) : null);

  if (!snapshots) {
    throw new Error('Meta discovery requires an access token or pre-fetched snapshots');
  }

  if (snapshots.length === 0) {
    throw new Error('No accessible Meta ad accounts were found for this integration');
  }

  const discoveredAccounts = await upsertAdAccounts(
    input.supabase,
    snapshots.map((snapshot) => ({
      businessId: input.businessId,
      platformId: input.platformId,
      externalAccountId: snapshot.externalAccountId,
      name: snapshot.name,
      status: snapshot.status,
      currencyCode: snapshot.currencyCode,
      timezone: snapshot.timezone,
    }))
  );

  await ensureAdAccountSyncStates(input.supabase, discoveredAccounts.rows);

  return discoveredAccounts;
}
