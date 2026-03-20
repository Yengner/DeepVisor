import { createSupabaseClient } from '@/lib/server/supabase/server';
import type { Database } from '@/lib/shared/types/supabase';
import { chunkArray } from '../utils';
import { deriveCampaignResultMetrics } from './normalizers';

type CampaignDimRow = Pick<
  Database['public']['Tables']['campaign_dims']['Row'],
  'id' | 'ad_account_id' | 'external_id' | 'name' | 'objective' | 'status'
>;

type CampaignPerformanceRow = Pick<
  Database['public']['Tables']['campaigns_performance_daily']['Row'],
  | 'campaign_id'
  | 'spend'
  | 'reach'
  | 'impressions'
  | 'clicks'
  | 'inline_link_clicks'
  | 'leads'
  | 'messages'
>;

export interface CampaignSummary {
  adAccountId: string;
  campaignId: string;
  campaignInternalId: string;
  campaignName: string;
  objective: string | null;
  status: string | null;
  spend: number;
  reach: number;
  impressions: number;
  clicks: number;
  linkClicks: number;
  leads: number;
  messages: number;
  conversion: number;
  conversionRate: number;
  costPerResult: number;
  ctr: number;
  cpc: number;
  cpm: number;
}

const DEFAULT_WINDOW_DAYS = 30;

function resolveWindowStartDate(windowDays: number): string {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - Math.max(1, windowDays) + 1);

  return date.toISOString().slice(0, 10);
}

async function listCampaignDims(adAccountIds: string[]): Promise<CampaignDimRow[]> {
  const supabase = await createSupabaseClient();
  const rows: CampaignDimRow[] = [];

  for (const adAccountIdsChunk of chunkArray(adAccountIds, 100)) {
    const { data, error } = await supabase
      .from('campaign_dims')
      .select('id, ad_account_id, external_id, name, objective, status')
      .in('ad_account_id', adAccountIdsChunk);

    if (error) {
      console.error('Error fetching campaign dims:hdiuhwaiohdiwa', error);
      throw error;
    }
    console.log(`Fetched ${data?.length ?? 0} campaign dims for ad account chunk:`, adAccountIdsChunk);
    rows.push(...((data ?? []) as CampaignDimRow[]));
  }

  return rows;
}

async function listCampaignPerformanceRows(input: {
  campaignIds: string[];
  sinceDay: string;
}): Promise<CampaignPerformanceRow[]> {
  const supabase = await createSupabaseClient();
  const rows: CampaignPerformanceRow[] = [];

  for (const campaignIdsChunk of chunkArray(input.campaignIds, 200)) {
    const { data, error } = await supabase
      .from('campaigns_performance_daily')
      .select(
        'campaign_id, spend, reach, impressions, clicks, inline_link_clicks, leads, messages'
      )
      .in('campaign_id', campaignIdsChunk)
      .gte('day', input.sinceDay);

    if (error) {
      console.error('Error fetching campaign performance rows:', error);
      throw error;
    }
    

    rows.push(...((data ?? []) as CampaignPerformanceRow[]));
  }

  return rows;
}

export async function getCampaignSummaries(input: {
  adAccountIds: string[];
  windowDays?: number;
  limit?: number;
}): Promise<CampaignSummary[]> {
  const adAccountIds = Array.from(new Set(input.adAccountIds.filter(Boolean)));
  if (adAccountIds.length === 0) {
    return [];
  }
  console.log('Fetching campaign summaries for ad accounts:', adAccountIds, 'with window days:', input.windowDays);
  const campaignDims = await listCampaignDims(adAccountIds);
  console.log('Fetched campaign dims:', campaignDims.length);
  if (campaignDims.length === 0) {
    return [];
  }

  const campaignDimById = new Map(
    campaignDims.map((campaign) => [campaign.id, campaign] satisfies [string, CampaignDimRow])
  );
  const performanceRows = await listCampaignPerformanceRows({
    campaignIds: campaignDims.map((campaign) => campaign.id),
    sinceDay: resolveWindowStartDate(input.windowDays ?? DEFAULT_WINDOW_DAYS),
  });

  if (performanceRows.length === 0) {
    return [];
  }

  const totalsByCampaignId = new Map<
    string,
    {
      spend: number;
      reach: number;
      impressions: number;
      clicks: number;
      linkClicks: number;
      leads: number;
      messages: number;
    }
  >();

  for (const row of performanceRows) {
    const current = totalsByCampaignId.get(row.campaign_id) ?? {
      spend: 0,
      reach: 0,
      impressions: 0,
      clicks: 0,
      linkClicks: 0,
      leads: 0,
      messages: 0,
    };

    current.spend += row.spend ?? 0;
    current.reach += row.reach ?? 0;
    current.impressions += row.impressions ?? 0;
    current.clicks += row.clicks ?? 0;
    current.linkClicks += row.inline_link_clicks ?? 0;
    current.leads += row.leads ?? 0;
    current.messages += row.messages ?? 0;

    totalsByCampaignId.set(row.campaign_id, current);
  }

  const summaries = Array.from(totalsByCampaignId.entries())
    .map(([campaignInternalId, totals]) => {
      const campaign = campaignDimById.get(campaignInternalId);
      if (!campaign) {
        return null;
      }

      const { conversion, conversion_rate: conversionRate, cost_per_result: costPerResult } =
        deriveCampaignResultMetrics({
          spend: totals.spend,
          clicks: totals.clicks,
          leads: totals.leads,
          messages: totals.messages,
        });

      return {
        adAccountId: campaign.ad_account_id,
        campaignId: campaign.external_id,
        campaignInternalId,
        campaignName: campaign.name || 'Unnamed campaign',
        objective: campaign.objective,
        status: campaign.status,
        spend: totals.spend,
        reach: totals.reach,
        impressions: totals.impressions,
        clicks: totals.clicks,
        linkClicks: totals.linkClicks,
        leads: totals.leads,
        messages: totals.messages,
        conversion,
        conversionRate,
        costPerResult,
        ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
        cpc: totals.clicks > 0 ? totals.spend / totals.clicks : 0,
        cpm: totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0,
      } satisfies CampaignSummary;
    })
    .filter((summary): summary is CampaignSummary => Boolean(summary))
    .sort((left, right) => {
      if (right.conversion !== left.conversion) {
        return right.conversion - left.conversion;
      }

      if (right.spend !== left.spend) {
        return right.spend - left.spend;
      }

      return left.campaignName.localeCompare(right.campaignName);
    });

  if (typeof input.limit === 'number' && Number.isFinite(input.limit) && input.limit > 0) {
    return summaries.slice(0, input.limit);
  }

  return summaries;
}
