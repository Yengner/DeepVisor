import type { Json } from '@/lib/shared/types/supabase';
import { chunkArray, dedupeBy, type RepositoryClient } from '../utils';

const META_HOURLY_DEBUG_PREFIX = '[meta-hourly-sync]';

export interface UpsertMetaHourlyPerformanceInput {
  adAccountId: string;
  entityLevel: 'adset' | 'ad';
  entityId: string;
  campaignId: string | null;
  adsetId: string;
  adId: string | null;
  day: string;
  weekStart: string;
  dayOfWeek: number;
  hourOfDay: number;
  advertiserTimeBucket: string;
  timeBasis: 'advertiser';
  currencyCode: string | null;
  objective: string | null;
  source: string;
  spend: number;
  reach: number;
  impressions: number;
  clicks: number;
  inlineLinkClicks: number;
  leads: number;
  messages: number;
  calls: number;
  ctr: number;
  cpc: number;
  cpm: number;
  actionsJson: Json;
  costPerActionTypeJson: Json;
  raw: Json | null;
  syncedAt: string;
}

export async function upsertMetaHourlyPerformance(
  supabase: RepositoryClient,
  inputs: UpsertMetaHourlyPerformanceInput[]
): Promise<{ count: number }> {
  const rows = dedupeBy(
    inputs.filter(
      (input) =>
        input.adAccountId &&
        input.entityId &&
        input.day &&
        input.hourOfDay >= 0 &&
        input.hourOfDay <= 23 &&
        (input.entityLevel === 'adset' || input.adId)
    ),
    (input) => `${input.entityId}::${input.day}::${input.hourOfDay}`
  ).map((input) => ({
    entity_id: input.entityId,
    ad_account_id: input.adAccountId,
    entity_level: input.entityLevel,
    day: input.day,
    week_start: input.weekStart,
    day_of_week: input.dayOfWeek,
    hour_of_day: input.hourOfDay,
    currency_code: input.currencyCode,
    objective: input.objective,
    source: input.source,
    spend: input.spend,
    reach: input.reach,
    impressions: input.impressions,
    clicks: input.clicks,
    inline_link_clicks: input.inlineLinkClicks,
    leads: input.leads,
    messages: input.messages,
    calls: input.calls,
    ctr: input.ctr,
    cpc: input.cpc,
    cpm: input.cpm,
    updated_at: input.syncedAt,
  }));

  console.info(`${META_HOURLY_DEBUG_PREFIX} upsert:start`, {
    inputRows: inputs.length,
    dedupedRows: rows.length,
  });

  if (rows.length === 0) {
    return { count: 0 };
  }

  const client = supabase as any;

  for (const chunk of chunkArray(rows, 500)) {
    const { error } = await client
      .from('ad_entity_performance_hourly')
      .upsert(chunk, { onConflict: 'entity_id,day,hour_of_day' });

    if (error) {
      throw error;
    }
  }

  return { count: rows.length };
}
