import type { Json, Database } from '@/lib/shared/types/supabase';
import { chunkArray, dedupeBy, type RepositoryClient } from '../utils';

type MetaHourlyPerformanceInsert =
  Database['public']['Tables']['meta_hourly_performance']['Insert'];

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
  const filteredInputs = inputs.filter(
    (input) =>
      input.adAccountId &&
      input.entityId &&
      input.adsetId &&
      (input.entityLevel === 'adset' || input.adId) &&
      input.day &&
      input.advertiserTimeBucket.trim().length > 0 &&
      input.hourOfDay >= 0 &&
      input.hourOfDay <= 23
  );
  const rows = dedupeBy(
    filteredInputs,
    (input) =>
      [
        input.adAccountId,
        input.entityLevel,
        input.entityId,
        input.day,
        input.hourOfDay,
        input.timeBasis,
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
        week_start: input.weekStart,
        day_of_week: input.dayOfWeek,
        hour_of_day: input.hourOfDay,
        advertiser_time_bucket: input.advertiserTimeBucket,
        time_basis: input.timeBasis,
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
        actions_json: input.actionsJson,
        cost_per_action_type_json: input.costPerActionTypeJson,
        raw: input.raw,
        created_at: input.syncedAt,
        updated_at: input.syncedAt,
      }) satisfies MetaHourlyPerformanceInsert
  );

  console.info(`${META_HOURLY_DEBUG_PREFIX} upsert:start`, {
    inputRows: inputs.length,
    validRows: filteredInputs.length,
    dedupedRows: rows.length,
  });

  if (rows.length === 0) {
    console.info(`${META_HOURLY_DEBUG_PREFIX} upsert:noop`, {
      inputRows: inputs.length,
      validRows: filteredInputs.length,
    });
    return { count: 0 };
  }

  const byAdAccount = new Map<
    string,
    {
      minDay: string;
      maxDay: string;
      entityLevels: Set<'adset' | 'ad'>;
      timeBases: Set<'advertiser'>;
    }
  >();

  for (const row of rows) {
    const current = byAdAccount.get(row.ad_account_id) ?? {
      minDay: row.day,
      maxDay: row.day,
      entityLevels: new Set<'adset' | 'ad'>(),
      timeBases: new Set<'advertiser'>(),
    };

    if (row.day < current.minDay) {
      current.minDay = row.day;
    }

    if (row.day > current.maxDay) {
      current.maxDay = row.day;
    }

    current.entityLevels.add(row.entity_level as 'adset' | 'ad');
    current.timeBases.add(row.time_basis as 'advertiser');
    byAdAccount.set(row.ad_account_id, current);
  }

  for (const [adAccountId, scope] of byAdAccount.entries()) {
    for (const entityLevel of scope.entityLevels) {
      const { error } = await supabase
        .from('meta_hourly_performance')
        .delete()
        .eq('ad_account_id', adAccountId)
        .eq('entity_level', entityLevel)
        .gte('day', scope.minDay)
        .lte('day', scope.maxDay)
        .in('time_basis', Array.from(scope.timeBases));

      if (error) {
        console.error(`${META_HOURLY_DEBUG_PREFIX} upsert:delete-error`, {
          adAccountId,
          entityLevel,
          minDay: scope.minDay,
          maxDay: scope.maxDay,
          timeBases: Array.from(scope.timeBases),
          message: error.message,
        });
        throw error;
      }
    }
  }

  for (const chunk of chunkArray(rows, 500)) {
    const { error } = await supabase.from('meta_hourly_performance').insert(chunk);

    if (error) {
      console.error(`${META_HOURLY_DEBUG_PREFIX} upsert:insert-error`, {
        chunkSize: chunk.length,
        firstRow: {
          adAccountId: chunk[0]?.ad_account_id ?? null,
          entityLevel: chunk[0]?.entity_level ?? null,
          entityId: chunk[0]?.entity_id ?? null,
          day: chunk[0]?.day ?? null,
          hourOfDay: chunk[0]?.hour_of_day ?? null,
          timeBasis: chunk[0]?.time_basis ?? null,
        },
        message: error.message,
      });
      throw error;
    }
  }

  console.info(`${META_HOURLY_DEBUG_PREFIX} upsert:done`, {
    insertedRows: rows.length,
    adAccountCount: byAdAccount.size,
  });

  return { count: rows.length };
}
