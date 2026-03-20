import 'server-only';

import { upsertAdPerformanceDaily } from '@/lib/server/repositories/ads/upsertAdPerformanceDaily';
import { upsertAdsetPerformanceDaily } from '@/lib/server/repositories/adsets/upsertAdsetPerformanceDaily';
import { upsertCampaignPerformanceDaily } from '@/lib/server/repositories/campaigns/upsertCampaignPerformanceDaily';
import type { Database } from '@/lib/shared/types/supabase';
import type { RepositoryClient } from '@/lib/server/repositories/utils';
import {
  fetchMetaAdPerformanceSeeds,
  fetchMetaAdsetPerformanceSeeds,
  fetchMetaCampaignPerformanceSeeds,
} from './fetch';

type AdAccountRow = Database['public']['Tables']['ad_accounts']['Row'];
type CampaignDimRow = Database['public']['Tables']['campaign_dims']['Row'];
type AdsetDimRow = Database['public']['Tables']['adset_dims']['Row'];
type AdDimRow = Database['public']['Tables']['ad_dims']['Row'];

export async function syncMetaPerformance(input: {
  supabase: RepositoryClient;
  adAccounts: AdAccountRow[];
  campaignsByExternalId: Map<string, CampaignDimRow>;
  adsetsByExternalId: Map<string, AdsetDimRow>;
  adsByExternalId: Map<string, AdDimRow>;
  accessToken: string;
  backfillDays: number;
  syncedAt: string;
}) {
  const campaignPerformanceInputs: Parameters<typeof upsertCampaignPerformanceDaily>[1] = [];
  const adsetPerformanceInputs: Parameters<typeof upsertAdsetPerformanceDaily>[1] = [];
  const adPerformanceInputs: Parameters<typeof upsertAdPerformanceDaily>[1] = [];

  for (const adAccount of input.adAccounts) {
    const [campaignRows, adsetRows, adRows] = await Promise.all([
      fetchMetaCampaignPerformanceSeeds({
        accessToken: input.accessToken,
        adAccountExternalId: adAccount.external_account_id,
        backfillDays: input.backfillDays,
      }),
      fetchMetaAdsetPerformanceSeeds({
        accessToken: input.accessToken,
        adAccountExternalId: adAccount.external_account_id,
        backfillDays: input.backfillDays,
      }),
      fetchMetaAdPerformanceSeeds({
        accessToken: input.accessToken,
        adAccountExternalId: adAccount.external_account_id,
        backfillDays: input.backfillDays,
      }),
    ]);

    for (const row of campaignRows) {
      const campaign = input.campaignsByExternalId.get(row.campaignExternalId);
      if (!campaign) {
        continue;
      }

      campaignPerformanceInputs.push({
        campaignId: campaign.id,
        campaignExternalId: row.campaignExternalId,
        day: row.day,
        currencyCode: row.currencyCode,
        objective: campaign.objective,
        source: 'meta',
        status: campaign.status,
        spend: row.spend,
        reach: row.reach,
        impressions: row.impressions,
        clicks: row.clicks,
        inlineLinkClicks: row.inlineLinkClicks,
        leads: row.leads,
        messages: row.messages,
        calls: row.calls,
        syncedAt: input.syncedAt,
      });
    }

    for (const row of adsetRows) {
      const adset = input.adsetsByExternalId.get(row.adsetExternalId);
      if (!adset) {
        continue;
      }

      const campaign = input.campaignsByExternalId.get(adset.campaign_external_id);

      adsetPerformanceInputs.push({
        adsetId: adset.id,
        day: row.day,
        currencyCode: row.currencyCode,
        objective: campaign?.objective ?? null,
        source: 'meta',
        status: adset.status,
        spend: row.spend,
        reach: row.reach,
        impressions: row.impressions,
        clicks: row.clicks,
        inlineLinkClicks: row.inlineLinkClicks,
        leads: row.leads,
        messages: row.messages,
        calls: row.calls,
        syncedAt: input.syncedAt,
      });
    }

    for (const row of adRows) {
      const ad = input.adsByExternalId.get(row.adExternalId);
      if (!ad) {
        continue;
      }

      const adset = input.adsetsByExternalId.get(ad.adset_external_id);
      const campaign = adset
        ? input.campaignsByExternalId.get(adset.campaign_external_id)
        : null;

      adPerformanceInputs.push({
        adId: ad.id,
        day: row.day,
        currencyCode: row.currencyCode,
        objective: campaign?.objective ?? null,
        source: 'meta',
        status: ad.status,
        spend: row.spend,
        reach: row.reach,
        impressions: row.impressions,
        clicks: row.clicks,
        inlineLinkClicks: row.inlineLinkClicks,
        leads: row.leads,
        messages: row.messages,
        calls: row.calls,
        syncedAt: input.syncedAt,
      });
    }
  }

  const [campaignPerformance, adsetPerformance, adPerformance] = await Promise.all([
    upsertCampaignPerformanceDaily(input.supabase, campaignPerformanceInputs),
    upsertAdsetPerformanceDaily(input.supabase, adsetPerformanceInputs),
    upsertAdPerformanceDaily(input.supabase, adPerformanceInputs),
  ]);

  return {
    campaignPerformanceRows: campaignPerformance.count,
    adsetPerformanceRows: adsetPerformance.count,
    adPerformanceRows: adPerformance.count,
  };
}
