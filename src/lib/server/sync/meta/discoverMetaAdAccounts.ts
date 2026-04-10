import 'server-only';

import {
  enqueueInitialHistoricalSyncJobs,
  ensureAdAccountSyncStates,
} from '@/lib/server/repositories/ad_accounts/syncState';
import { upsertAdAccounts } from '@/lib/server/repositories/ad_accounts/upsertAdAccounts';
import type { RepositoryClient } from '@/lib/server/repositories/utils';
import { fetchMetaAdAccountSnapshots } from './fetch';

export async function discoverMetaAdAccounts(input: {
  supabase: RepositoryClient;
  businessId: string;
  platformId: string;
  platformIntegrationId: string;
  accessToken: string;
  requestedStartDate: string;
  requestedEndDate: string;
}) {
  // Step 01 is discovery/registration only. It records accessible accounts and queues
  // historical work, but it never updates `last_synced` or stores metrics on `ad_accounts`.
  const snapshots = await fetchMetaAdAccountSnapshots(input.accessToken);

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
  await enqueueInitialHistoricalSyncJobs(input.supabase, {
    businessId: input.businessId,
    platformIntegrationId: input.platformIntegrationId,
    adAccounts: discoveredAccounts.rows,
    requestedStartDate: input.requestedStartDate,
    requestedEndDate: input.requestedEndDate,
  });

  return discoveredAccounts;
}
