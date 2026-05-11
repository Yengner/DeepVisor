import { upsertAdEntityPerformanceDaily } from '../ad_entities/upsertAdEntityPerformanceDaily';
import type { RepositoryClient } from '../utils';

export interface UpsertCampaignPerformanceDailyInput {
  campaignId: string;
  adAccountId: string;
  campaignExternalId: string;
  day: string;
  currencyCode: string | null;
  objective: string | null;
  source: string | null;
  status: string | null;
  spend: number;
  reach: number;
  impressions: number;
  clicks: number;
  inlineLinkClicks: number;
  leads: number;
  messages: number;
  calls: number;
  syncedAt: string;
}

export async function upsertCampaignPerformanceDaily(
  supabase: RepositoryClient,
  inputs: UpsertCampaignPerformanceDailyInput[]
): Promise<{ count: number }> {
  return upsertAdEntityPerformanceDaily(
    supabase,
    inputs.map((input) => ({
      entityId: input.campaignId,
      adAccountId: input.adAccountId,
      entityLevel: 'campaign',
      day: input.day,
      currencyCode: input.currencyCode,
      objective: input.objective,
      source: input.source,
      status: input.status,
      spend: input.spend,
      reach: input.reach,
      impressions: input.impressions,
      clicks: input.clicks,
      inlineLinkClicks: input.inlineLinkClicks,
      leads: input.leads,
      messages: input.messages,
      calls: input.calls,
      syncedAt: input.syncedAt,
    }))
  );
}
