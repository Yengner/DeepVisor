import 'server-only';

import { upsertAdsetDims } from '@/lib/server/repositories/adsets/upsertAdsetDims';
import type { CampaignDimRow } from '@/lib/server/repositories/campaigns/upsertCampaignDims';
import type { Database } from '@/lib/shared/types/supabase';
import type { RepositoryClient } from '@/lib/server/repositories/utils';
import { fetchMetaAdsetSeeds } from './fetch';
import { learningLabel } from '../resources/insightModel';

type AdAccountRow = Database['public']['Tables']['ad_accounts']['Row'];

export async function syncMetaAdsets(input: {
  supabase: RepositoryClient;
  businessId?: string;
  platformIntegrationId?: string | null;
  adAccounts: AdAccountRow[];
  campaignsByExternalId: Map<string, CampaignDimRow>;
  accessToken: string;
  syncedAt: string;
}) {
  const adsetInputs: Parameters<typeof upsertAdsetDims>[1] = [];
  /** Meta learning status per ad set external id, from the same listing (no extra request). */
  const learning: Record<string, string> = {};

  for (const adAccount of input.adAccounts) {
    const adsets = await fetchMetaAdsetSeeds({
      accessToken: input.accessToken,
      adAccountExternalId: adAccount.external_account_id,
    });

    for (const adset of adsets) {
      const raw = adset.raw && typeof adset.raw === 'object' && !Array.isArray(adset.raw) ? adset.raw : {};
      learning[adset.externalId] = learningLabel((raw as Record<string, unknown>).learning_stage_info);
    }

    adsetInputs.push(
      ...adsets
        .filter((adset) => Boolean(adset.campaignExternalId))
        .map((adset) => {
          const campaign = input.campaignsByExternalId.get(adset.campaignExternalId!);

          return {
            adAccountId: adAccount.id,
            businessId: input.businessId ?? adAccount.business_id,
            platformId: adAccount.platform_id,
            platformIntegrationId: input.platformIntegrationId ?? null,
            campaignExternalId: adset.campaignExternalId!,
            campaignId: campaign?.id ?? null,
            externalId: adset.externalId,
            name: adset.name,
            optimizationGoal: adset.optimizationGoal,
            status: adset.status,
            createdTime: adset.createdTime,
            updatedTime: adset.updatedTime,
            raw: adset.raw,
            syncedAt: input.syncedAt,
          };
        })
    );
  }

  return { ...(await upsertAdsetDims(input.supabase, adsetInputs)), learning };
}
