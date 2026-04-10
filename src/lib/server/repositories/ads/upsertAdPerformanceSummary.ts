import type { Database } from '@/lib/shared/types/supabase';
import {
  PERFORMANCE_SUMMARY_HISTORY_STATUS,
  PERFORMANCE_SUMMARY_SOURCE,
  aggregatePerformanceSummaryRows,
  deriveSummaryMetricFields,
  type PerformanceSummaryDailyRow,
} from '../performanceSummary/shared';
import { chunkArray, dedupeBy, type RepositoryClient } from '../utils';

type AdDimRow = Pick<
  Database['public']['Tables']['ad_dims']['Row'],
  'id' | 'ad_account_id' | 'adset_id' | 'campaign_id'
>;
type AdPerformanceDailyRow = Pick<
  Database['public']['Tables']['ads_performance_daily']['Row'],
  | 'ad_id'
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
type AdPerformanceSummaryInsert =
  Database['public']['Tables']['ad_performance_summary']['Insert'];

async function listAdPerformanceDailyRows(input: {
  supabase: RepositoryClient;
  adIds: string[];
}): Promise<AdPerformanceDailyRow[]> {
  const rows: AdPerformanceDailyRow[] = [];

  for (const adIdsChunk of chunkArray(input.adIds, 200)) {
    const { data, error } = await input.supabase
      .from('ads_performance_daily')
      .select(
        'ad_id, day, spend, reach, impressions, clicks, inline_link_clicks, leads, messages, calls'
      )
      .in('ad_id', adIdsChunk);

    if (error) {
      throw error;
    }

    rows.push(...((data ?? []) as AdPerformanceDailyRow[]));
  }

  return rows;
}

export async function upsertAdPerformanceSummary(
  supabase: RepositoryClient,
  input: {
    ads: AdDimRow[];
    syncedAt: string;
    historyStatus?: string;
    summarySource?: string;
  }
): Promise<{ count: number }> {
  const ads = dedupeBy(
    input.ads.filter((ad) => ad.id && ad.ad_account_id),
    (ad) => ad.id
  );

  if (ads.length === 0) {
    return { count: 0 };
  }

  const adIds = ads.map((ad) => ad.id);
  const dailyRows = await listAdPerformanceDailyRows({
    supabase,
    adIds,
  });
  const dailyRowsByAdId = new Map<string, PerformanceSummaryDailyRow[]>();

  for (const row of dailyRows) {
    const existingRows = dailyRowsByAdId.get(row.ad_id) ?? [];
    existingRows.push(row);
    dailyRowsByAdId.set(row.ad_id, existingRows);
  }

  const rows = ads.flatMap((ad) => {
    const totals = aggregatePerformanceSummaryRows(dailyRowsByAdId.get(ad.id) ?? []);
    if (totals.rowCount === 0) {
      return [];
    }

    const metrics = deriveSummaryMetricFields(totals);

    return [
      {
        ad_account_id: ad.ad_account_id,
        ad_id: ad.id,
        adset_id: ad.adset_id,
        campaign_id: ad.campaign_id,
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
      } satisfies AdPerformanceSummaryInsert,
    ];
  });

  for (const adIdsChunk of chunkArray(adIds, 200)) {
    const { error } = await supabase
      .from('ad_performance_summary')
      .delete()
      .in('ad_id', adIdsChunk);

    if (error) {
      throw error;
    }
  }

  for (const chunk of chunkArray(rows, 500)) {
    const { error } = await supabase.from('ad_performance_summary').insert(chunk);

    if (error) {
      throw error;
    }
  }

  return { count: rows.length };
}
