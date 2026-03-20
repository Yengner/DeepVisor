import type { Database } from '@/lib/shared/types/supabase';
import { chunkArray, dedupeBy, type RepositoryClient } from '../utils';

type AdAccountPerformanceInsert =
  Database['public']['Tables']['ad_accounts_performance_daily']['Insert'];

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

export async function upsertAdAccountPerformanceDaily(
  supabase: RepositoryClient,
  inputs: UpsertAdAccountPerformanceDailyInput[]
): Promise<{ count: number }> {
  const rows = dedupeBy(
    inputs.filter((input) => input.adAccountId && input.day),
    (input) => `${input.adAccountId}::${input.day}`
  ).map(
    (input) =>
      ({
        ad_account_id: input.adAccountId,
        day: input.day,
        currency_code: input.currencyCode,
        source: input.source ?? undefined,
        status: input.status,
        spend: input.spend,
        reach: input.reach,
        impressions: input.impressions,
        clicks: input.clicks,
        inline_link_clicks: input.inlineLinkClicks,
        leads: input.leads,
        messages: input.messages,
        created_at: input.syncedAt,
        updated_at: input.syncedAt,
      }) satisfies AdAccountPerformanceInsert
  );

  if (rows.length === 0) {
    return { count: 0 };
  }

  const adAccountIds = Array.from(new Set(rows.map((row) => row.ad_account_id)));
  const days = Array.from(new Set(rows.map((row) => row.day)));

  for (const adAccountIdsChunk of chunkArray(adAccountIds, 200)) {
    for (const daysChunk of chunkArray(days, 50)) {
      const { error } = await supabase
        .from('ad_accounts_performance_daily')
        .delete()
        .in('ad_account_id', adAccountIdsChunk)
        .in('day', daysChunk);

      if (error) {
        throw error;
      }
    }
  }

  for (const chunk of chunkArray(rows, 500)) {
    const { error } = await supabase
      .from('ad_accounts_performance_daily')
      .insert(chunk as AdAccountPerformanceInsert[]);

    if (error) {
      throw error;
    }
  }

  return { count: rows.length };
}
