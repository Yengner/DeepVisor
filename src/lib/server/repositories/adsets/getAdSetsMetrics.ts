import { createSupabaseClient } from '@/lib/server/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { formatDisplayDate } from '@/lib/shared';
import type { Database } from '@/lib/shared/types/supabase';
import { derivePerformanceMetrics } from '../campaigns/normalizers';
import { chunkArray } from '../utils';

type QuerySupabaseClient = SupabaseClient<Database>;

type AdsetDimRow = {
  id: string;
  external_id: string;
  campaign_external_id: string;
  name: string | null;
  optimization_goal: string | null;
  status: string | null;
  created_time: string | null;
};

type AdsetPerformanceRow = {
  adset_id: string;
  spend: number;
  reach: number;
  impressions: number;
  clicks: number;
  inline_link_clicks: number;
  leads: number;
  messages: number;
  first_day: string | null;
  last_day: string | null;
};

type CampaignLookupRow = {
  external_id: string;
  name: string | null;
};

export interface AdSetLifetimeRow {
  id: string;
  name: string;
  status: string;
  objective: string;
  optimization_goal: string | null;
  campaign_id: string;
  campaign_name: string;
  clicks: number;
  impressions: number;
  spend: string;
  leads: number;
  reach: number;
  link_clicks: number;
  messages: number;
  cpm: string | null;
  ctr: string | null;
  cpc: string | null;
  cpl: string | null;
  frequency: string | null;
  start_date: string;
  end_date: string;
  platform_name: 'meta' | 'google' | 'tiktok';
}

async function listAdsetDims(input: {
  supabase: QuerySupabaseClient;
  adAccountId: string;
  campaignExternalId?: string;
  adsetExternalId?: string;
}): Promise<AdsetDimRow[]> {
  let query = input.supabase
    .from('adset_dims')
    .select('id, external_id, campaign_external_id, name, optimization_goal, status, created_time')
    .eq('ad_account_id', input.adAccountId);

  if (input.campaignExternalId) {
    query = query.eq('campaign_external_id', input.campaignExternalId);
  }

  if (input.adsetExternalId) {
    query = query.eq('external_id', input.adsetExternalId);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return (data ?? []) as AdsetDimRow[];
}

async function listAdsetPerformanceRows(input: {
  supabase: QuerySupabaseClient;
  adsetIds: string[];
}): Promise<AdsetPerformanceRow[]> {
  const rows: AdsetPerformanceRow[] = [];

  for (const adsetIdsChunk of chunkArray(input.adsetIds, 200)) {
    const { data, error } = await input.supabase
      .from('adset_performance_summary')
      .select(
        'adset_id, spend, reach, impressions, clicks, inline_link_clicks, leads, messages, first_day, last_day'
      )
      .in('adset_id', adsetIdsChunk);

    if (error) {
      throw error;
    }

    rows.push(...((data ?? []) as AdsetPerformanceRow[]));
  }

  return rows;
}

async function listCampaignNames(input: {
  supabase: QuerySupabaseClient;
  adAccountId: string;
  campaignExternalIds: string[];
}): Promise<Map<string, string>> {
  const campaignNames = new Map<string, string>();

  for (const externalIdsChunk of chunkArray(input.campaignExternalIds, 200)) {
    const { data, error } = await input.supabase
      .from('campaign_dims')
      .select('external_id, name')
      .eq('ad_account_id', input.adAccountId)
      .in('external_id', externalIdsChunk);

    if (error) {
      throw error;
    }

    for (const campaign of (data ?? []) as CampaignLookupRow[]) {
      campaignNames.set(campaign.external_id, campaign.name || 'Unnamed campaign');
    }
  }

  return campaignNames;
}

export async function getAdSetsLifetimeIncludingZeros(
  adAccountUuid: string,
  opts?: {
    campaignExternalId?: string;
    adsetExternalId?: string;
    vendor?: 'meta' | 'google' | 'tiktok';
    supabase?: QuerySupabaseClient;
  }
): Promise<AdSetLifetimeRow[]> {
  const supabase = opts?.supabase ?? (await createSupabaseClient());
  const vendor = opts?.vendor ?? 'meta';
  const adsets = await listAdsetDims({
    supabase,
    adAccountId: adAccountUuid,
    campaignExternalId: opts?.campaignExternalId,
    adsetExternalId: opts?.adsetExternalId,
  });

  if (adsets.length === 0) {
    return [];
  }

  const performanceRows = await listAdsetPerformanceRows({
    supabase,
    adsetIds: adsets.map((adset) => adset.id),
  });
  const totalsByAdsetId = new Map(
    adsets.map((adset) => [
      adset.id,
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
      },
    ])
  );

  for (const row of performanceRows) {
    const totals = totalsByAdsetId.get(row.adset_id);
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

    if (row.first_day && (!totals.firstDay || row.first_day < totals.firstDay)) {
      totals.firstDay = row.first_day;
    }

    if (row.last_day && (!totals.lastDay || row.last_day > totals.lastDay)) {
      totals.lastDay = row.last_day;
    }
  }

  const campaignNameByExternalId = await listCampaignNames({
    supabase,
    adAccountId: adAccountUuid,
    campaignExternalIds: Array.from(new Set(adsets.map((adset) => adset.campaign_external_id))),
  });

  return adsets
    .map((adset) => {
      const totals = totalsByAdsetId.get(adset.id)!;
      const spend = totals.spend;
      const metrics = derivePerformanceMetrics({
        spend,
        reach: totals.reach,
        impressions: totals.impressions,
        clicks: totals.clicks,
        leads: totals.leads,
        messages: totals.messages,
      });

      return {
        id: adset.external_id,
        name: adset.name || 'Unnamed ad set',
        status: adset.status || 'UNKNOWN',
        objective: adset.optimization_goal || 'UNKNOWN',
        optimization_goal: adset.optimization_goal,
        campaign_id: adset.campaign_external_id,
        campaign_name: campaignNameByExternalId.get(adset.campaign_external_id) || 'Unnamed campaign',
        clicks: totals.clicks,
        impressions: totals.impressions,
        spend: spend.toFixed(2),
        leads: totals.leads,
        reach: totals.reach,
        link_clicks: totals.linkClicks,
        messages: totals.messages,
        cpm: totals.impressions > 0 ? metrics.cpm.toFixed(2) : null,
        ctr: totals.impressions > 0 ? metrics.ctr.toFixed(4) : null,
        cpc: totals.clicks > 0 ? metrics.cpc.toFixed(2) : null,
        cpl: totals.leads > 0 ? (spend / totals.leads).toFixed(2) : null,
        frequency: totals.reach > 0 ? metrics.frequency.toFixed(2) : null,
        start_date: formatDisplayDate(totals.firstDay || adset.created_time),
        end_date: formatDisplayDate(totals.lastDay),
        platform_name: vendor,
      } satisfies AdSetLifetimeRow;
    })
    .sort((left, right) => {
      const spendDifference = Number(right.spend) - Number(left.spend);
      if (spendDifference !== 0) {
        return spendDifference;
      }

      return left.name.localeCompare(right.name);
    });
}
