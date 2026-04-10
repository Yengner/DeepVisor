import { createSupabaseClient } from '@/lib/server/supabase/server';
import type { Database } from '@/lib/shared/types/supabase';
import { chunkArray, type RepositoryClient } from '../utils';
import type {
  AdAccountDailyMetricsRow,
  AdAccountPerformanceSummary,
} from '../types';
import {
  aggregateDailyMetricsRows,
  sortAndAggregateDailyMetricsRows,
} from './normalizers';

type CampaignDimRow = Pick<
  Database['public']['Tables']['campaign_dims']['Row'],
  'id' | 'ad_account_id'
>;

type CampaignPerformanceRow = Pick<
  Database['public']['Tables']['campaigns_performance_daily']['Row'],
  | 'campaign_id'
  | 'day'
  | 'currency_code'
  | 'spend'
  | 'reach'
  | 'impressions'
  | 'clicks'
  | 'inline_link_clicks'
  | 'leads'
  | 'messages'
>;

async function listCampaignDimsByAdAccountIds(
  supabase: RepositoryClient,
  adAccountIds: string[]
): Promise<CampaignDimRow[]> {
  const rows: CampaignDimRow[] = [];

  for (const adAccountIdsChunk of chunkArray(adAccountIds, 200)) {
    const { data, error } = await supabase
      .from('campaign_dims')
      .select('id, ad_account_id')
      .in('ad_account_id', adAccountIdsChunk);

    if (error) {
      throw error;
    }

    rows.push(...((data ?? []) as CampaignDimRow[]));
  }

  return rows;
}

async function listCampaignPerformanceRows(
  supabase: RepositoryClient,
  input: {
    campaignIds: string[];
    dateFrom?: string;
    dateTo?: string;
  }
): Promise<CampaignPerformanceRow[]> {
  const rows: CampaignPerformanceRow[] = [];

  for (const campaignIdsChunk of chunkArray(input.campaignIds, 200)) {
    let query = supabase
      .from('campaigns_performance_daily')
      .select(
        'campaign_id, day, currency_code, spend, reach, impressions, clicks, inline_link_clicks, leads, messages'
      )
      .in('campaign_id', campaignIdsChunk);

    if (input.dateFrom) {
      query = query.gte('day', input.dateFrom);
    }

    if (input.dateTo) {
      query = query.lte('day', input.dateTo);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    rows.push(...((data ?? []) as CampaignPerformanceRow[]));
  }

  return rows;
}

export async function listAdAccountDailyMetricsRowsByAccount(input: {
  adAccountIds: string[];
  dateFrom?: string;
  dateTo?: string;
  supabase?: RepositoryClient;
}): Promise<Map<string, AdAccountDailyMetricsRow[]>> {
  const adAccountIds = Array.from(new Set(input.adAccountIds.filter(Boolean)));
  const results = new Map<string, AdAccountDailyMetricsRow[]>(
    adAccountIds.map((adAccountId) => [adAccountId, []] satisfies [string, AdAccountDailyMetricsRow[]])
  );

  if (adAccountIds.length === 0) {
    return results;
  }

  const supabase = input.supabase ?? (await createSupabaseClient());
  const campaignDims = await listCampaignDimsByAdAccountIds(supabase, adAccountIds);

  if (campaignDims.length === 0) {
    return results;
  }

  const campaignToAdAccountId = new Map(
    campaignDims.map((campaign) => [campaign.id, campaign.ad_account_id] satisfies [string, string])
  );
  const performanceRows = await listCampaignPerformanceRows(supabase, {
    campaignIds: campaignDims.map((campaign) => campaign.id),
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
  });

  const rowsByAccountAndDay = new Map<string, AdAccountDailyMetricsRow>();

  for (const row of performanceRows) {
    const adAccountId = campaignToAdAccountId.get(row.campaign_id);
    if (!adAccountId) {
      continue;
    }

    const key = `${adAccountId}::${row.day}`;
    const current = rowsByAccountAndDay.get(key);

    rowsByAccountAndDay.set(key, {
      day: row.day,
      currency_code: row.currency_code ?? current?.currency_code ?? null,
      spend: (current?.spend ?? 0) + (row.spend ?? 0),
      reach: (current?.reach ?? 0) + (row.reach ?? 0),
      impressions: (current?.impressions ?? 0) + (row.impressions ?? 0),
      clicks: (current?.clicks ?? 0) + (row.clicks ?? 0),
      inline_link_clicks:
        (current?.inline_link_clicks ?? 0) + (row.inline_link_clicks ?? 0),
      leads: (current?.leads ?? 0) + (row.leads ?? 0),
      messages: (current?.messages ?? 0) + (row.messages ?? 0),
    });
  }

  for (const [key, row] of rowsByAccountAndDay.entries()) {
    const [adAccountId] = key.split('::');
    const current = results.get(adAccountId) ?? [];
    current.push(row);
    results.set(adAccountId, current);
  }

  for (const [adAccountId, rows] of results.entries()) {
    results.set(adAccountId, sortAndAggregateDailyMetricsRows(rows).dailyRows);
  }

  return results;
}

export async function getAdAccountPerformanceSnapshot(input: {
  adAccountId: string;
  dateFrom?: string;
  dateTo?: string;
  supabase?: RepositoryClient;
}): Promise<{
  dailyRows: AdAccountDailyMetricsRow[];
  summary: AdAccountPerformanceSummary;
}> {
  const rowsByAccountId = await listAdAccountDailyMetricsRowsByAccount({
    adAccountIds: [input.adAccountId],
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
    supabase: input.supabase,
  });
  const dailyRows = rowsByAccountId.get(input.adAccountId) ?? [];

  return {
    dailyRows,
    summary: aggregateDailyMetricsRows(dailyRows),
  };
}
