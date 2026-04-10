import type { Database, Json } from '@/lib/shared/types/supabase';
import { chunkArray, dedupeBy, type RepositoryClient } from '../utils';
import {
  aggregateDailyMetricsRows,
  buildTimeIncrementMetricsFromDailyRows,
  parseDailyMetricsRowsFromTimeIncrementMetrics,
  type AdAccountDailyMetricsRow,
} from './normalizers';

type AdAccountMetricsRow = Pick<
  Database['public']['Tables']['ad_accounts']['Row'],
  'id' | 'aggregated_metrics' | 'time_increment_metrics' | 'currency_code'
>;

export interface UpsertAdAccountPerformanceDailyInput {
  adAccountId: string;
  day: string;
  currencyCode: string | null;
  source: string | null;
  status: string | null;
  spend: number;
  reach: number;
  impressions: number;
  clicks: number;
  inlineLinkClicks: number;
  leads: number;
  messages: number;
  syncedAt: string;
}

async function selectAdAccountsByIds(
  supabase: RepositoryClient,
  adAccountIds: string[]
): Promise<AdAccountMetricsRow[]> {
  const rows: AdAccountMetricsRow[] = [];

  for (const idsChunk of chunkArray(adAccountIds, 200)) {
    const { data, error } = await supabase
      .from('ad_accounts')
      .select('id, aggregated_metrics, time_increment_metrics, currency_code')
      .in('id', idsChunk);

    if (error) {
      throw error;
    }

    rows.push(...(data ?? []));
  }

  return rows;
}

export async function upsertAdAccountPerformanceDaily(
  supabase: RepositoryClient,
  inputs: UpsertAdAccountPerformanceDailyInput[]
): Promise<{ count: number }> {
  const rows = dedupeBy(
    inputs.filter((input) => input.adAccountId && input.day),
    (input) => `${input.adAccountId}::${input.day}`
  ).map((input) => ({
    ad_account_id: input.adAccountId,
    day: input.day,
    currency_code: input.currencyCode,
    spend: input.spend,
    reach: input.reach,
    impressions: input.impressions,
    clicks: input.clicks,
    inline_link_clicks: input.inlineLinkClicks,
    leads: input.leads,
    messages: input.messages,
    updated_at: input.syncedAt,
  }));

  if (rows.length === 0) {
    return { count: 0 };
  }

  const adAccountIds = Array.from(new Set(rows.map((row) => row.ad_account_id)));
  const existingRows = await selectAdAccountsByIds(supabase, adAccountIds);
  const existingById = new Map(
    existingRows.map((row) => [row.id, row] satisfies [string, AdAccountMetricsRow])
  );

  for (const adAccountId of adAccountIds) {
    const existing = existingById.get(adAccountId);
    if (!existing) {
      throw new Error(`Ad account not found for performance sync: ${adAccountId}`);
    }

    const mergedRowsByDay = new Map<string, AdAccountDailyMetricsRow>(
      parseDailyMetricsRowsFromTimeIncrementMetrics(existing.time_increment_metrics, {
        currencyCode: existing.currency_code,
      }).map((row) => [row.day, row] satisfies [string, AdAccountDailyMetricsRow])
    );

    const accountRows = rows
      .filter((row) => row.ad_account_id === adAccountId)
      .map(
        (row) =>
          ({
            day: row.day,
            spend: row.spend ?? 0,
            reach: row.reach ?? 0,
            impressions: row.impressions ?? 0,
            clicks: row.clicks ?? 0,
            inline_link_clicks: row.inline_link_clicks ?? 0,
            leads: row.leads ?? 0,
            messages: row.messages ?? 0,
            currency_code: row.currency_code ?? existing.currency_code ?? null,
          }) satisfies AdAccountDailyMetricsRow
      );

    for (const row of accountRows) {
      mergedRowsByDay.set(row.day, row);
    }

    const mergedRows = Array.from(mergedRowsByDay.values()).sort((left, right) =>
      left.day.localeCompare(right.day)
    );
    const latestUpdatedAt =
      rows
        .filter((row) => row.ad_account_id === adAccountId)
        .reduce(
          (current, row) =>
            new Date(row.updated_at).getTime() > new Date(current).getTime()
              ? row.updated_at
              : current,
          rows[0]?.updated_at ?? new Date().toISOString()
        ) ?? new Date().toISOString();

    const { error } = await supabase
      .from('ad_accounts')
      .update({
        time_increment_metrics:
          buildTimeIncrementMetricsFromDailyRows(mergedRows) as unknown as Json,
        aggregated_metrics:
          aggregateDailyMetricsRows(mergedRows) as unknown as Json,
        currency_code:
          [...accountRows].reverse().find((row) => row.currency_code)?.currency_code ??
          existing.currency_code ??
          null,
        updated_at: latestUpdatedAt,
      })
      .eq('id', adAccountId);

    if (error) {
      throw error;
    }
  }

  return { count: rows.length };
}
