import { chunkArray, dedupeBy, type RepositoryClient } from '../utils';
import type { AdEntityLevel } from './types';

export type UpsertAdEntityPerformanceDailyInput = {
  entityId: string;
  adAccountId: string;
  entityLevel: AdEntityLevel;
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
};

type DailyRow = {
  entity_id: string;
  ad_account_id: string;
  entity_level: AdEntityLevel;
  day: string;
  currency_code: string | null;
  objective: string | null;
  source: string;
  status: string | null;
  spend: number;
  reach: number;
  impressions: number;
  clicks: number;
  inline_link_clicks: number;
  leads: number;
  messages: number;
  calls: number;
  updated_at: string;
};

export async function upsertAdEntityPerformanceDaily(
  supabase: RepositoryClient,
  inputs: UpsertAdEntityPerformanceDailyInput[]
): Promise<{ count: number }> {
  const rows = dedupeBy(
    inputs.filter((input) => input.entityId && input.adAccountId && input.day),
    (input) => `${input.entityId}::${input.day}`
  ).map(
    (input) =>
      ({
        entity_id: input.entityId,
        ad_account_id: input.adAccountId,
        entity_level: input.entityLevel,
        day: input.day,
        currency_code: input.currencyCode,
        objective: input.objective,
        source: input.source ?? 'api',
        status: input.status,
        spend: input.spend,
        reach: input.reach,
        impressions: input.impressions,
        clicks: input.clicks,
        inline_link_clicks: input.inlineLinkClicks,
        leads: input.leads,
        messages: input.messages,
        calls: input.calls,
        updated_at: input.syncedAt,
      }) satisfies DailyRow
  );

  if (rows.length === 0) {
    return { count: 0 };
  }

  const client = supabase as any;

  for (const chunk of chunkArray(rows, 500)) {
    const { error } = await client
      .from('ad_entity_performance_daily')
      .upsert(chunk, { onConflict: 'entity_id,day' });

    if (error) {
      throw error;
    }
  }

  return { count: rows.length };
}
