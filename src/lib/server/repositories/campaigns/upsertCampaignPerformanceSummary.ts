import type { Database } from '@/lib/shared/types/supabase';
import {
  PERFORMANCE_SUMMARY_HISTORY_STATUS,
  PERFORMANCE_SUMMARY_SOURCE,
  aggregatePerformanceSummaryRows,
  deriveSummaryMetricFields,
  type PerformanceSummaryDailyRow,
} from '../performanceSummary/shared';
import { chunkArray, dedupeBy, type RepositoryClient } from '../utils';

type CampaignDimRow = Pick<
  Database['public']['Tables']['campaign_dims']['Row'],
  'id' | 'ad_account_id'
>;
type CampaignPerformanceDailyRow = Pick<
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
  | 'calls'
>;
type CampaignPerformanceSummaryInsert =
  Database['public']['Tables']['campaign_performance_summary']['Insert'];

async function listCampaignPerformanceDailyRows(input: {
  supabase: RepositoryClient;
  campaignIds: string[];
}): Promise<CampaignPerformanceDailyRow[]> {
  const rows: CampaignPerformanceDailyRow[] = [];

  for (const campaignIdsChunk of chunkArray(input.campaignIds, 200)) {
    const { data, error } = await input.supabase
      .from('campaigns_performance_daily')
      .select(
        'campaign_id, day, spend, reach, impressions, clicks, inline_link_clicks, leads, messages, calls'
      )
      .in('campaign_id', campaignIdsChunk);

    if (error) {
      throw error;
    }

    rows.push(...((data ?? []) as CampaignPerformanceDailyRow[]));
  }

  return rows;
}

export async function upsertCampaignPerformanceSummary(
  supabase: RepositoryClient,
  input: {
    campaigns: CampaignDimRow[];
    syncedAt: string;
    historyStatus?: string;
    summarySource?: string;
  }
): Promise<{ count: number }> {
  const campaigns = dedupeBy(
    input.campaigns.filter((campaign) => campaign.id && campaign.ad_account_id),
    (campaign) => campaign.id
  );

  if (campaigns.length === 0) {
    return { count: 0 };
  }

  const campaignIds = campaigns.map((campaign) => campaign.id);
  const dailyRows = await listCampaignPerformanceDailyRows({
    supabase,
    campaignIds,
  });
  const dailyRowsByCampaignId = new Map<string, PerformanceSummaryDailyRow[]>();

  for (const row of dailyRows) {
    const existingRows = dailyRowsByCampaignId.get(row.campaign_id) ?? [];
    existingRows.push(row);
    dailyRowsByCampaignId.set(row.campaign_id, existingRows);
  }

  const rows = campaigns.flatMap((campaign) => {
    const totals = aggregatePerformanceSummaryRows(dailyRowsByCampaignId.get(campaign.id) ?? []);
    if (totals.rowCount === 0) {
      return [];
    }

    const metrics = deriveSummaryMetricFields(totals);

    return [
      {
        ad_account_id: campaign.ad_account_id,
        campaign_id: campaign.id,
        spend: totals.spend,
        reach: totals.reach,
        impressions: totals.impressions,
        clicks: totals.clicks,
        inline_link_clicks: totals.inlineLinkClicks,
        leads: totals.leads,
        messages: totals.messages,
        calls: totals.calls,
        ctr: metrics.ctr,
        cpc: metrics.cpc,
        cpm: metrics.cpm,
        frequency: metrics.frequency,
        cost_per_result: metrics.cost_per_result,
        first_day: totals.firstDay,
        last_day: totals.lastDay,
        history_status: input.historyStatus ?? PERFORMANCE_SUMMARY_HISTORY_STATUS,
        summary_source: input.summarySource ?? PERFORMANCE_SUMMARY_SOURCE,
        synced_at: input.syncedAt,
        created_at: input.syncedAt,
        updated_at: input.syncedAt,
      } satisfies CampaignPerformanceSummaryInsert,
    ];
  });

  for (const campaignIdsChunk of chunkArray(campaignIds, 200)) {
    const { error } = await supabase
      .from('campaign_performance_summary')
      .delete()
      .in('campaign_id', campaignIdsChunk);

    if (error) {
      throw error;
    }
  }

  for (const chunk of chunkArray(rows, 500)) {
    const { error } = await supabase.from('campaign_performance_summary').insert(chunk);

    if (error) {
      throw error;
    }
  }

  return { count: rows.length };
}
