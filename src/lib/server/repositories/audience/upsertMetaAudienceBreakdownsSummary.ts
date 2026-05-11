import type { Json } from '@/lib/shared/types/supabase';
import { chunkArray, dedupeBy, type RepositoryClient } from '../utils';

export interface UpsertMetaAudienceBreakdownsSummaryInput {
  adAccountId: string;
  entityLevel: 'adset' | 'ad';
  entityId: string;
  campaignId: string | null;
  adsetId: string;
  adId: string | null;
  firstDay: string | null;
  lastDay: string | null;
  breakdownType: string;
  dimension1Key: string;
  dimension1Value: string;
  dimension2Key: string;
  dimension2Value: string;
  publisherPlatform: string | null;
  platformPosition: string | null;
  impressionDevice: string | null;
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
  actionsJson: Json;
  costPerActionTypeJson: Json;
  raw: Json | null;
  syncedAt: string;
}

function toDay(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? null;
}

export async function upsertMetaAudienceBreakdownsSummary(
  supabase: RepositoryClient,
  inputs: UpsertMetaAudienceBreakdownsSummaryInput[]
): Promise<{ count: number }> {
  const rows = dedupeBy(
    inputs.filter(
      (input) =>
        input.adAccountId &&
        input.entityId &&
        input.breakdownType &&
        input.dimension1Value.trim().length > 0 &&
        (input.entityLevel === 'adset' || input.adId)
    ),
    (input) =>
      [
        input.entityId,
        input.breakdownType,
        input.dimension1Key,
        input.dimension1Value,
        input.dimension2Key,
        input.dimension2Value,
      ].join('::')
  ).map((input) => ({
    ad_account_id: input.adAccountId,
    entity_id: input.entityId,
    entity_level: input.entityLevel,
    breakdown_type: input.breakdownType,
    dimension_1_key: input.dimension1Key,
    dimension_1_value: input.dimension1Value,
    dimension_2_key: input.dimension2Key,
    dimension_2_value: input.dimension2Value,
    publisher_platform: input.publisherPlatform,
    platform_position: input.platformPosition,
    impression_device: input.impressionDevice,
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
    first_day: toDay(input.firstDay),
    last_day: toDay(input.lastDay),
    synced_at: input.syncedAt,
    updated_at: input.syncedAt,
  }));

  if (rows.length === 0) {
    return { count: 0 };
  }

  const client = supabase as any;

  for (const chunk of chunkArray(rows, 500)) {
    const { error } = await client.from('ad_audience_breakdowns_summary').upsert(chunk, {
      onConflict:
        'entity_id,breakdown_type,dimension_1_key,dimension_1_value,dimension_2_key,dimension_2_value',
    });

    if (error) {
      throw error;
    }
  }

  return { count: rows.length };
}
