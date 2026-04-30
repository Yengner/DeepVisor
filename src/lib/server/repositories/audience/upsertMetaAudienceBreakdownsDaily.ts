import type { Json, Database } from '@/lib/shared/types/supabase';
import { chunkArray, dedupeBy, type RepositoryClient } from '../utils';

type MetaAudienceBreakdownInsert =
  Database['public']['Tables']['meta_audience_breakdowns_daily']['Insert'];

export interface UpsertMetaAudienceBreakdownsDailyInput {
  adAccountId: string;
  entityLevel: 'adset' | 'ad';
  entityId: string;
  campaignId: string | null;
  adsetId: string;
  adId: string | null;
  day: string;
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

export async function upsertMetaAudienceBreakdownsDaily(
  supabase: RepositoryClient,
  inputs: UpsertMetaAudienceBreakdownsDailyInput[]
): Promise<{ count: number }> {
  const rows = dedupeBy(
    inputs.filter(
      (input) =>
        input.adAccountId &&
        input.entityId &&
        input.adsetId &&
        (input.entityLevel === 'adset' || input.adId) &&
        input.day &&
        input.breakdownType &&
        input.dimension1Value.trim().length > 0
    ),
    (input) =>
      [
        input.adAccountId,
        input.entityLevel,
        input.entityId,
        input.day,
        input.breakdownType,
        input.dimension1Key,
        input.dimension1Value,
        input.dimension2Key,
        input.dimension2Value,
      ].join('::')
  ).map(
    (input) =>
      ({
        ad_account_id: input.adAccountId,
        entity_level: input.entityLevel,
        entity_id: input.entityId,
        campaign_id: input.campaignId,
        adset_id: input.adsetId,
        ad_id: input.adId,
        day: input.day,
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
        actions_json: input.actionsJson,
        cost_per_action_type_json: input.costPerActionTypeJson,
        raw: input.raw,
        created_at: input.syncedAt,
        updated_at: input.syncedAt,
      }) satisfies MetaAudienceBreakdownInsert
  );

  if (rows.length === 0) {
    return { count: 0 };
  }

  const byAdAccount = new Map<
    string,
    {
      minDay: string;
      maxDay: string;
      breakdownTypes: Set<string>;
      entityLevels: Set<'adset' | 'ad'>;
    }
  >();

  for (const row of rows) {
    const current = byAdAccount.get(row.ad_account_id) ?? {
      minDay: row.day,
      maxDay: row.day,
      breakdownTypes: new Set<string>(),
      entityLevels: new Set<'adset' | 'ad'>(),
    };
    if (row.day < current.minDay) {
      current.minDay = row.day;
    }
    if (row.day > current.maxDay) {
      current.maxDay = row.day;
    }
    current.breakdownTypes.add(row.breakdown_type);
    current.entityLevels.add(row.entity_level as 'adset' | 'ad');
    byAdAccount.set(row.ad_account_id, current);
  }

  for (const [adAccountId, scope] of byAdAccount.entries()) {
    for (const entityLevel of scope.entityLevels) {
      const { error } = await supabase
        .from('meta_audience_breakdowns_daily')
        .delete()
        .eq('ad_account_id', adAccountId)
        .eq('entity_level', entityLevel)
        .gte('day', scope.minDay)
        .lte('day', scope.maxDay)
        .in('breakdown_type', Array.from(scope.breakdownTypes));

      if (error) {
        throw error;
      }
    }
  }

  for (const chunk of chunkArray(rows, 500)) {
    const { error } = await supabase.from('meta_audience_breakdowns_daily').insert(chunk);

    if (error) {
      throw error;
    }
  }

  return { count: rows.length };
}
