import 'server-only';

import { upsertAdDims } from '@/lib/server/repositories/ads/upsertAdDims';
import type { AdsetDimRow } from '@/lib/server/repositories/adsets/upsertAdsetDims';
import type { CampaignDimRow } from '@/lib/server/repositories/campaigns/upsertCampaignDims';
import type { Database } from '@/lib/shared/types/supabase';
import type { RepositoryClient } from '@/lib/server/repositories/utils';
import { fetchMetaAdSeeds } from './fetch';

type AdAccountRow = Database['public']['Tables']['ad_accounts']['Row'];

export async function syncMetaAds(input: {
  supabase: RepositoryClient;
  businessId?: string;
  platformIntegrationId?: string | null;
  adAccounts: AdAccountRow[];
  campaignsByExternalId: Map<string, CampaignDimRow>;
  adsetsByExternalId: Map<string, AdsetDimRow>;
  accessToken: string;
  syncedAt: string;
}) {
  const adInputs: Parameters<typeof upsertAdDims>[1] = [];

  for (const adAccount of input.adAccounts) {
    const ads = await fetchMetaAdSeeds({
      accessToken: input.accessToken,
      adAccountExternalId: adAccount.external_account_id,
    });

    adInputs.push(
      ...ads
        .filter((ad) => Boolean(ad.adsetExternalId))
        .map((ad) => {
          const adset = input.adsetsByExternalId.get(ad.adsetExternalId!);
          const campaign =
            adset?.campaign_external_id
              ? input.campaignsByExternalId.get(adset.campaign_external_id)
              : null;

          return {
            adAccountId: adAccount.id,
            businessId: input.businessId ?? adAccount.business_id,
            platformId: adAccount.platform_id,
            platformIntegrationId: input.platformIntegrationId ?? null,
            adsetExternalId: ad.adsetExternalId!,
            adsetId: adset?.id ?? null,
            campaignId: adset?.campaign_id ?? campaign?.id ?? null,
            externalId: ad.externalId,
            name: ad.name,
            creativeId: ad.creativeId,
            status: ad.status,
            createdTime: ad.createdTime,
            updatedTime: ad.updatedTime,
            raw: ad.raw,
            syncedAt: input.syncedAt,
          };
        })
    );
  }

  return upsertAdDims(input.supabase, adInputs);
}
