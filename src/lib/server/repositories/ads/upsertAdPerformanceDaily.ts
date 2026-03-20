import type { Database } from '@/lib/shared/types/supabase';
import { chunkArray, dedupeBy, type RepositoryClient } from '../utils';

type AdPerformanceInsert = Database['public']['Tables']['ads_performance_daily']['Insert'];

export interface UpsertAdPerformanceDailyInput {
  adId: string;
  day: string;
  currencyCode: string | null;
  objective: string | null;
  source: string;
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

export async function upsertAdPerformanceDaily(
  supabase: RepositoryClient,
  inputs: UpsertAdPerformanceDailyInput[]
): Promise<{ count: number }> {
  const rows = dedupeBy(
    inputs.filter((input) => input.adId && input.day),
    (input) => `${input.adId}::${input.day}`
  ).map(
    (input) =>
      ({
        ad_id: input.adId,
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
      }) satisfies AdPerformanceInsert
  );

  if (rows.length === 0) {
    return { count: 0 };
  }

  const adIds = Array.from(new Set(rows.map((row) => row.ad_id)));
  const days = Array.from(new Set(rows.map((row) => row.day)));

  for (const adIdsChunk of chunkArray(adIds, 200)) {
    for (const daysChunk of chunkArray(days, 50)) {
      const { error } = await supabase
        .from('ads_performance_daily')
        .delete()
        .in('ad_id', adIdsChunk)
        .in('day', daysChunk);

      if (error) {
        throw error;
      }
    }
  }

  for (const chunk of chunkArray(rows, 500)) {
    const { error } = await supabase.from('ads_performance_daily').insert(chunk);

    if (error) {
      throw error;
    }
  }

  return { count: rows.length };
}
