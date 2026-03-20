import 'server-only';

import { upsertCampaignDims } from '@/lib/server/repositories/campaigns/upsertCampaignDims';
import type { Database } from '@/lib/shared/types/supabase';
import type { RepositoryClient } from '@/lib/server/repositories/utils';
import { fetchMetaCampaignSeeds } from './fetch';

type AdAccountRow = Database['public']['Tables']['ad_accounts']['Row'];

export async function syncMetaCampaigns(input: {
  supabase: RepositoryClient;
  adAccounts: AdAccountRow[];
  accessToken: string;
  syncedAt: string;
}) {
  const campaignInputs: Parameters<typeof upsertCampaignDims>[1] = [];

  for (const adAccount of input.adAccounts) {
    const campaigns = await fetchMetaCampaignSeeds({
      accessToken: input.accessToken,
      adAccountExternalId: adAccount.external_account_id,
    });

    campaignInputs.push(
      ...campaigns.map((campaign) => ({
        adAccountId: adAccount.id,
        externalId: campaign.externalId,
        name: campaign.name,
        objective: campaign.objective,
        status: campaign.status,
        createdTime: campaign.createdTime,
        updatedTime: campaign.updatedTime,
        raw: campaign.raw,
        syncedAt: input.syncedAt,
      }))
    );
  }

  return upsertCampaignDims(input.supabase, campaignInputs);
}
