import { createSupabaseClient } from '@/lib/server/supabase/server';
import type { Database } from '@/lib/shared/types/supabase';
import { chunkArray } from '../utils';
import { derivePerformanceMetrics } from './normalizers';

type SupabaseClient = Awaited<ReturnType<typeof createSupabaseClient>>;

type CampaignDimRow = Pick<
  Database['public']['Tables']['campaign_dims']['Row'],
  'id' | 'ad_account_id' | 'external_id' | 'name' | 'objective' | 'status' | 'created_time'
>;

type CampaignPerformanceRow = Pick<
  Database['public']['Tables']['campaigns_performance_daily']['Row'],
  | 'campaign_id'
  | 'day'
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
  frequency: number;
  startDay: string | null;
  endDay: string | null;
}

export type CampaignSummarySort = 'performance' | 'spend' | 'name';

const DEFAULT_WINDOW_DAYS = 30;

function resolveWindowStartDate(windowDays: number): string {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - Math.max(1, windowDays) + 1);

  return date.toISOString().slice(0, 10);
}

async function listCampaignDims(input: {
  supabase: SupabaseClient;
  adAccountIds: string[];
  campaignExternalIds?: string[];
}): Promise<CampaignDimRow[]> {
  const rows: CampaignDimRow[] = [];
  const campaignExternalIds = input.campaignExternalIds?.filter(Boolean) ?? [];

  for (const adAccountIdsChunk of chunkArray(input.adAccountIds, 100)) {
    if (campaignExternalIds.length === 0) {
      const { data, error } = await input.supabase
        .from('campaign_dims')
        .select('id, ad_account_id, external_id, name, objective, status, created_time')
        .in('ad_account_id', adAccountIdsChunk);

      if (error) {
        throw error;
      }

      rows.push(...((data ?? []) as CampaignDimRow[]));
      continue;
    }

    for (const externalIdsChunk of chunkArray(campaignExternalIds, 200)) {
      const { data, error } = await input.supabase
        .from('campaign_dims')
        .select('id, ad_account_id, external_id, name, objective, status, created_time')
        .in('ad_account_id', adAccountIdsChunk)
        .in('external_id', externalIdsChunk);

      if (error) {
        throw error;
      }

      rows.push(...((data ?? []) as CampaignDimRow[]));
    }
  }

  return rows;
}

async function listCampaignPerformanceRows(input: {
  supabase: SupabaseClient;
  campaignIds: string[];
  sinceDay?: string;
}): Promise<CampaignPerformanceRow[]> {
  const rows: CampaignPerformanceRow[] = [];

  for (const campaignIdsChunk of chunkArray(input.campaignIds, 200)) {
    let query = input.supabase
      .from('campaigns_performance_daily')
      .select(
        'campaign_id, day, spend, reach, impressions, clicks, inline_link_clicks, leads, messages'
      )
      .in('campaign_id', campaignIdsChunk);

    if (input.sinceDay) {
      query = query.gte('day', input.sinceDay);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    rows.push(...((data ?? []) as CampaignPerformanceRow[]));
  }

  return rows;
}

export async function getCampaignSummaries(input: {
  adAccountIds: string[];
  campaignExternalIds?: string[];
  windowDays?: number | null;
  includeEmpty?: boolean;
  limit?: number;
  sort?: CampaignSummarySort;
  supabase?: SupabaseClient;
}): Promise<CampaignSummary[]> {
  const adAccountIds = Array.from(new Set(input.adAccountIds.filter(Boolean)));
  if (adAccountIds.length === 0) {
    return [];
  }

  const supabase = input.supabase ?? (await createSupabaseClient());
  const campaignDims = await listCampaignDims({
    supabase,
    adAccountIds,
    campaignExternalIds: input.campaignExternalIds,
  });
  if (campaignDims.length === 0) {
    return [];
  }

  const performanceRows = await listCampaignPerformanceRows({
    supabase,
    campaignIds: campaignDims.map((campaign) => campaign.id),
    sinceDay:
      typeof input.windowDays === 'number'
        ? resolveWindowStartDate(input.windowDays)
        : input.windowDays === undefined
          ? resolveWindowStartDate(DEFAULT_WINDOW_DAYS)
          : undefined,
  });

  if (performanceRows.length === 0 && !input.includeEmpty) {
    return [];
  }

  const campaignDimById = new Map(
    campaignDims.map((campaign) => [campaign.id, campaign] satisfies [string, CampaignDimRow])
  );
  const totalsByCampaignId = new Map(
    campaignDims.map((campaign) => [
      campaign.id,
      {
        spend: 0,
        reach: 0,
        impressions: 0,
        clicks: 0,
        linkClicks: 0,
        leads: 0,
        messages: 0,
        firstDay: null as string | null,
        lastDay: null as string | null,
        rowCount: 0,
      },
    ])
  );

  for (const row of performanceRows) {
    const totals = totalsByCampaignId.get(row.campaign_id);
    if (!totals) {
      continue;
    }

    totals.spend += row.spend ?? 0;
    totals.reach += row.reach ?? 0;
    totals.impressions += row.impressions ?? 0;
    totals.clicks += row.clicks ?? 0;
    totals.linkClicks += row.inline_link_clicks ?? 0;
    totals.leads += row.leads ?? 0;
    totals.messages += row.messages ?? 0;
    totals.firstDay = totals.firstDay === null || row.day < totals.firstDay ? row.day : totals.firstDay;
    totals.lastDay = totals.lastDay === null || row.day > totals.lastDay ? row.day : totals.lastDay;
    totals.rowCount += 1;
  }

  const summaries = Array.from(totalsByCampaignId.entries())
    .map(([campaignInternalId, totals]) => {
      const campaign = campaignDimById.get(campaignInternalId);
      if (!campaign) {
        return null;
      }

      if (!input.includeEmpty && totals.rowCount === 0) {
        return null;
      }

      const metrics = derivePerformanceMetrics({
        spend: totals.spend,
        reach: totals.reach,
        impressions: totals.impressions,
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
        conversion: metrics.conversion,
        conversionRate: metrics.conversion_rate,
        costPerResult: metrics.cost_per_result,
        ctr: metrics.ctr,
        cpc: metrics.cpc,
        cpm: metrics.cpm,
        frequency: metrics.frequency,
        startDay: totals.firstDay ?? campaign.created_time ?? null,
        endDay: totals.lastDay,
      } satisfies CampaignSummary;
    })
    .filter((summary): summary is CampaignSummary => Boolean(summary))
    .sort((left, right) => {
      switch (input.sort ?? 'performance') {
        case 'spend':
          if (right.spend !== left.spend) {
            return right.spend - left.spend;
          }
          return left.campaignName.localeCompare(right.campaignName);
        case 'name':
          return left.campaignName.localeCompare(right.campaignName);
        default:
          if (right.conversion !== left.conversion) {
            return right.conversion - left.conversion;
          }

          if (right.spend !== left.spend) {
            return right.spend - left.spend;
          }

          return left.campaignName.localeCompare(right.campaignName);
      }
    });

  if (typeof input.limit === 'number' && Number.isFinite(input.limit) && input.limit > 0) {
    return summaries.slice(0, input.limit);
  }

  return summaries;
}
