import 'server-only';

import { upsertAdAccounts } from '@/lib/server/repositories/ad_accounts/upsertAdAccounts';
import type { RepositoryClient } from '@/lib/server/repositories/utils';
import { fetchMetaAdAccountSnapshots } from './fetch';

export async function syncMetaAdAccounts(input: {
  supabase: RepositoryClient;
  businessId: string;
  platformId: string;
  accessToken: string;
  syncedAt: string;
  primaryExternalAccountId: string;
}) {
  const snapshots = await fetchMetaAdAccountSnapshots(input.accessToken, {
    externalAccountId: input.primaryExternalAccountId,
    includeMetrics: true,
  });

  if (snapshots.length === 0) {
    throw new Error('Selected Meta ad account is no longer accessible for this integration');
  }

  return upsertAdAccounts(
    input.supabase,
    snapshots.map((snapshot) => ({
      businessId: input.businessId,
      platformId: input.platformId,
      externalAccountId: snapshot.externalAccountId,
      name: snapshot.name,
      status: snapshot.status,
      currencyCode: snapshot.currencyCode,
      timezone: snapshot.timezone,
      aggregatedMetrics: snapshot.aggregatedMetrics,
      timeIncrementMetrics: snapshot.timeIncrementMetrics,
      syncedAt: input.syncedAt,
    }))
  );
}
