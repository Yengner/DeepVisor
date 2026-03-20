import type { Database } from '@/lib/shared/types/supabase';
import { chunkArray, dedupeBy, type RepositoryClient } from '../utils';

type AdsetPerformanceInsert =
  Database['public']['Tables']['adsets_performance_daily']['Insert'];

export interface UpsertAdsetPerformanceDailyInput {
  adsetId: string;
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

export async function upsertAdsetPerformanceDaily(
  supabase: RepositoryClient,
  inputs: UpsertAdsetPerformanceDailyInput[]
): Promise<{ count: number }> {
  const rows = dedupeBy(
    inputs.filter((input) => input.adsetId && input.day),
    (input) => `${input.adsetId}::${input.day}`
  ).map(
    (input) =>
      ({
        adset_id: input.adsetId,
        day: input.day,
        currency_code: input.currencyCode,
        objective: input.objective,
        source: input.source,
        status: input.status,
        spend: input.spend,
        reach: input.reach,
        impressions: input.impressions,
        clicks: input.clicks,
        inline_link_clicks: input.inlineLinkClicks,
        leads: input.leads,
        messages: input.messages,
        calls: input.calls,
        created_at: input.syncedAt,
        updated_at: input.syncedAt,
      }) satisfies AdsetPerformanceInsert
  );

  if (rows.length === 0) {
    return { count: 0 };
  }

  const adsetIds = Array.from(new Set(rows.map((row) => row.adset_id)));
  const days = Array.from(new Set(rows.map((row) => row.day)));

  for (const adsetIdsChunk of chunkArray(adsetIds, 200)) {
    for (const daysChunk of chunkArray(days, 50)) {
      const { error } = await supabase
        .from('adsets_performance_daily')
        .delete()
        .in('adset_id', adsetIdsChunk)
        .in('day', daysChunk);

      if (error) {
        throw error;
      }
    }
  }

  for (const chunk of chunkArray(rows, 500)) {
    const { error } = await supabase.from('adsets_performance_daily').insert(chunk);

    if (error) {
      throw error;
    }
  }

  return { count: rows.length };
}
