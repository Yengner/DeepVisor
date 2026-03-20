import 'server-only';

import { upsertAdsetDims } from '@/lib/server/repositories/adsets/upsertAdsetDims';
import type { Database } from '@/lib/shared/types/supabase';
import type { RepositoryClient } from '@/lib/server/repositories/utils';
import { fetchMetaAdsetSeeds } from './fetch';

type AdAccountRow = Database['public']['Tables']['ad_accounts']['Row'];

export async function syncMetaAdsets(input: {
  supabase: RepositoryClient;
  adAccounts: AdAccountRow[];
  accessToken: string;
  syncedAt: string;
}) {
  const adsetInputs: Parameters<typeof upsertAdsetDims>[1] = [];

  for (const adAccount of input.adAccounts) {
    const adsets = await fetchMetaAdsetSeeds({
      accessToken: input.accessToken,
      adAccountExternalId: adAccount.external_account_id,
    });

    adsetInputs.push(
      ...adsets
        .filter((adset) => Boolean(adset.campaignExternalId))
        .map((adset) => ({
          adAccountId: adAccount.id,
          campaignExternalId: adset.campaignExternalId!,
          externalId: adset.externalId,
          name: adset.name,
          optimizationGoal: adset.optimizationGoal,
          status: adset.status,
          createdTime: adset.createdTime,
          updatedTime: adset.updatedTime,
          raw: adset.raw,
          syncedAt: input.syncedAt,
        }))
    );
  }

  return upsertAdsetDims(input.supabase, adsetInputs);
}
