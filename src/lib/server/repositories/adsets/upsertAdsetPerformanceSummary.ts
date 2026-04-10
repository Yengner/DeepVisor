import type { Database } from '@/lib/shared/types/supabase';
import {
  PERFORMANCE_SUMMARY_HISTORY_STATUS,
  PERFORMANCE_SUMMARY_SOURCE,
  aggregatePerformanceSummaryRows,
  deriveSummaryMetricFields,
  type PerformanceSummaryDailyRow,
} from '../performanceSummary/shared';
import { chunkArray, dedupeBy, type RepositoryClient } from '../utils';

type AdsetDimRow = Pick<
  Database['public']['Tables']['adset_dims']['Row'],
  'id' | 'ad_account_id' | 'campaign_id'
>;
type AdsetPerformanceDailyRow = Pick<
  Database['public']['Tables']['adsets_performance_daily']['Row'],
  | 'adset_id'
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
type AdsetPerformanceSummaryInsert =
  Database['public']['Tables']['adset_performance_summary']['Insert'];

async function listAdsetPerformanceDailyRows(input: {
  supabase: RepositoryClient;
  adsetIds: string[];
}): Promise<AdsetPerformanceDailyRow[]> {
  const rows: AdsetPerformanceDailyRow[] = [];

  for (const adsetIdsChunk of chunkArray(input.adsetIds, 200)) {
    const { data, error } = await input.supabase
      .from('adsets_performance_daily')
      .select(
        'adset_id, day, spend, reach, impressions, clicks, inline_link_clicks, leads, messages, calls'
      )
      .in('adset_id', adsetIdsChunk);

    if (error) {
      throw error;
    }

    rows.push(...((data ?? []) as AdsetPerformanceDailyRow[]));
  }

  return rows;
}

export async function upsertAdsetPerformanceSummary(
  supabase: RepositoryClient,
  input: {
    adsets: AdsetDimRow[];
    syncedAt: string;
    historyStatus?: string;
    summarySource?: string;
  }
): Promise<{ count: number }> {
  const adsets = dedupeBy(
    input.adsets.filter((adset) => adset.id && adset.ad_account_id),
    (adset) => adset.id
  );

  if (adsets.length === 0) {
    return { count: 0 };
  }

  const adsetIds = adsets.map((adset) => adset.id);
  const dailyRows = await listAdsetPerformanceDailyRows({
    supabase,
    adsetIds,
  });
  const dailyRowsByAdsetId = new Map<string, PerformanceSummaryDailyRow[]>();

  for (const row of dailyRows) {
    const existingRows = dailyRowsByAdsetId.get(row.adset_id) ?? [];
    existingRows.push(row);
    dailyRowsByAdsetId.set(row.adset_id, existingRows);
  }

  const rows = adsets.flatMap((adset) => {
    const totals = aggregatePerformanceSummaryRows(dailyRowsByAdsetId.get(adset.id) ?? []);
    if (totals.rowCount === 0) {
      return [];
    }

    const metrics = deriveSummaryMetricFields(totals);

    return [
      {
        ad_account_id: adset.ad_account_id,
        adset_id: adset.id,
        campaign_id: adset.campaign_id,
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
      } satisfies AdsetPerformanceSummaryInsert,
    ];
  });

  for (const adsetIdsChunk of chunkArray(adsetIds, 200)) {
    const { error } = await supabase
      .from('adset_performance_summary')
      .delete()
      .in('adset_id', adsetIdsChunk);

    if (error) {
      throw error;
    }
  }

  for (const chunk of chunkArray(rows, 500)) {
    const { error } = await supabase.from('adset_performance_summary').insert(chunk);

    if (error) {
      throw error;
    }
  }

  return { count: rows.length };
}
