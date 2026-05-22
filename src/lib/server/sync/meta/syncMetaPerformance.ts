import 'server-only';

import {
  aggregateDailyMetricsRows,
  hasMeaningfulPerformance,
  type AdAccountDailyMetricsRow,
} from '@/lib/server/repositories/ad_accounts/normalizers';
import { upsertMetaAudienceBreakdownsSummary } from '@/lib/server/repositories/audience/upsertMetaAudienceBreakdownsSummary';
import { upsertMetaHourlyPerformance } from '@/lib/server/repositories/hourly/upsertMetaHourlyPerformance';
import { upsertAdAccountPerformanceDaily } from '@/lib/server/repositories/ad_accounts/upsertAdAccountPerformanceDaily';
import { upsertAdPerformanceDaily } from '@/lib/server/repositories/ads/upsertAdPerformanceDaily';
import { upsertAdsetPerformanceDaily } from '@/lib/server/repositories/adsets/upsertAdsetPerformanceDaily';
import { upsertCampaignPerformanceDaily } from '@/lib/server/repositories/campaigns/upsertCampaignPerformanceDaily';
import { upsertAdEntityPerformanceSummaries } from '@/lib/server/repositories/ad_entities/upsertAdEntityPerformanceSummaries';
import { asRecord, asString } from '@/lib/shared';
import type { AdEntityRow } from '@/lib/server/repositories/ad_entities/types';
import type { AdDimRow } from '@/lib/server/repositories/ads/upsertAdDims';
import type { AdsetDimRow } from '@/lib/server/repositories/adsets/upsertAdsetDims';
import type { CampaignDimRow } from '@/lib/server/repositories/campaigns/upsertCampaignDims';
import type { BusinessDataPolicy } from '@/lib/server/repositories/business_data_policies/getBusinessDataPolicy';
import type { Database } from '@/lib/shared/types/supabase';
import type { RepositoryClient } from '@/lib/server/repositories/utils';
import {
  fetchMetaAdAccountPerformanceSeeds,
  fetchMetaAdAudienceBreakdownSeeds,
  fetchMetaAdHourlyPerformanceSeeds,
  fetchMetaAdPerformanceSeeds,
  fetchMetaAdPerformanceSummarySeeds,
  fetchMetaAdsetAudienceBreakdownSeeds,
  fetchMetaAdsetHourlyPerformanceSeeds,
  fetchMetaAdsetPerformanceSeeds,
  fetchMetaAdsetPerformanceSummarySeeds,
  fetchMetaCampaignPerformanceSeeds,
  fetchMetaCampaignPerformanceSummarySeeds,
  type MetaDateRange,
} from './fetch';
import type { MetaEntityPerformanceSummarySeed } from './types';

type AdAccountRow = Database['public']['Tables']['ad_accounts']['Row'];

const META_HOURLY_DEBUG_PREFIX = '[meta-hourly-sync]';

function hasDeliverySignal(row: AdAccountDailyMetricsRow): boolean {
  return (
    row.spend > 0 ||
    row.impressions > 0 ||
    row.clicks > 0 ||
    row.inline_link_clicks > 0 ||
    row.leads > 0 ||
    row.messages > 0
  );
}

function resolveEntitySummaryStartDay(entity: AdEntityRow): string | null {
  const raw = asRecord(entity.raw);

  return (
    asString(raw.start_time) ||
    asString(raw.created_time) ||
    entity.created_time ||
    null
  );
}

function resolveEntitySummaryEndDay(
  entity: AdEntityRow,
  seed: MetaEntityPerformanceSummarySeed | undefined
): string | null {
  const raw = asRecord(entity.raw);

  return asString(raw.stop_time) || asString(raw.end_time) || seed?.dateStop || null;
}

const META_HOURLY_SYNC_MAX_DAYS = 90;
const DEFAULT_PERFORMANCE_POLICY: Pick<
  BusinessDataPolicy,
  | 'daily_history_days'
  | 'hourly_history_days'
  | 'audience_history_days'
  | 'allowed_breakdowns'
  | 'allow_ad_level_hourly'
  | 'allow_ad_level_audience'
> = {
  daily_history_days: 30,
  hourly_history_days: 7,
  audience_history_days: 14,
  allowed_breakdowns: ['publisher_platform', 'platform_position', 'impression_device'],
  allow_ad_level_hourly: true,
  allow_ad_level_audience: true,
};

function addUtcDays(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function resolveHourlyDateRange(input: {
  backfillDays?: number;
  dateRange?: MetaDateRange;
  syncedAt: string;
  policyDays?: number;
}): MetaDateRange | { backfillDays: number } | null {
  const maxDays = Math.max(1, Math.min(input.policyDays ?? 7, META_HOURLY_SYNC_MAX_DAYS));
  if (input.dateRange) {
    const syncedDay = input.syncedAt.slice(0, 10);
    const floorDay = addUtcDays(syncedDay, -(maxDays - 1));

    if (input.dateRange.until < floorDay) {
      return null;
    }

    return {
      since: input.dateRange.since > floorDay ? input.dateRange.since : floorDay,
      until: input.dateRange.until,
    };
  }

  return {
    backfillDays: Math.min(input.backfillDays ?? maxDays, maxDays),
  };
}

async function runPerformanceFetchStage<T>(label: string, operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected Meta performance fetch error';
    throw new Error(`Meta ${label} performance fetch failed: ${message}`);
  }
}

export async function refreshMetaPerformanceSummaries(input: {
  supabase: RepositoryClient;
  adAccounts: AdAccountRow[];
  campaignsByExternalId: Map<string, CampaignDimRow>;
  adsetsByExternalId: Map<string, AdsetDimRow>;
  adsByExternalId: Map<string, AdDimRow>;
  accessToken: string;
  syncedAt: string;
}) {
  const summarySeedsByEntityKey = new Map<string, MetaEntityPerformanceSummarySeed>();

  for (const adAccount of input.adAccounts) {
    const [campaignSummaries, adsetSummaries, adSummaries] = await Promise.all([
      runPerformanceFetchStage('campaign max-range summary', () =>
        fetchMetaCampaignPerformanceSummarySeeds({
          accessToken: input.accessToken,
          adAccountExternalId: adAccount.external_account_id,
        })
      ),
      runPerformanceFetchStage('ad set max-range summary', () =>
        fetchMetaAdsetPerformanceSummarySeeds({
          accessToken: input.accessToken,
          adAccountExternalId: adAccount.external_account_id,
        })
      ),
      runPerformanceFetchStage('ad max-range summary', () =>
        fetchMetaAdPerformanceSummarySeeds({
          accessToken: input.accessToken,
          adAccountExternalId: adAccount.external_account_id,
        })
      ),
    ]);

    for (const seed of [...campaignSummaries, ...adsetSummaries, ...adSummaries]) {
      summarySeedsByEntityKey.set(
        `${adAccount.id}::${seed.entityLevel}::${seed.entityExternalId}`,
        seed
      );
    }
  }

  const buildSummaryInputs = <T extends CampaignDimRow | AdsetDimRow | AdDimRow>(
    entityLevel: 'campaign' | 'adset' | 'ad',
    entities: T[]
  ) =>
    entities.map((entity) => {
      const seed = summarySeedsByEntityKey.get(
        `${entity.ad_account_id}::${entityLevel}::${entity.external_id}`
      );
      const hasPerformance =
        Boolean(seed) &&
        ((seed?.spend ?? 0) > 0 ||
          (seed?.impressions ?? 0) > 0 ||
          (seed?.clicks ?? 0) > 0 ||
          (seed?.inlineLinkClicks ?? 0) > 0 ||
          (seed?.leads ?? 0) > 0 ||
          (seed?.messages ?? 0) > 0 ||
          (seed?.calls ?? 0) > 0);

      return {
        entityId: entity.id,
        adAccountId: entity.ad_account_id,
        entityLevel,
        spend: seed?.spend ?? 0,
        reach: seed?.reach ?? 0,
        impressions: seed?.impressions ?? 0,
        clicks: seed?.clicks ?? 0,
        inlineLinkClicks: seed?.inlineLinkClicks ?? 0,
        leads: seed?.leads ?? 0,
        messages: seed?.messages ?? 0,
        calls: seed?.calls ?? 0,
        firstDay: resolveEntitySummaryStartDay(entity),
        lastDay: resolveEntitySummaryEndDay(entity, seed),
        summarySource: seed ? 'meta_max_range' : 'meta_max_range_empty',
        historyStatus: hasPerformance ? 'synced' : 'not_started',
        syncedAt: input.syncedAt,
      };
    });

  const [campaignPerformanceSummary, adsetPerformanceSummary, adPerformanceSummary] =
    await Promise.all([
      upsertAdEntityPerformanceSummaries(
        input.supabase,
        buildSummaryInputs('campaign', Array.from(input.campaignsByExternalId.values()))
      ),
      upsertAdEntityPerformanceSummaries(
        input.supabase,
        buildSummaryInputs('adset', Array.from(input.adsetsByExternalId.values()))
      ),
      upsertAdEntityPerformanceSummaries(
        input.supabase,
        buildSummaryInputs('ad', Array.from(input.adsByExternalId.values()))
      ),
    ]);

  return {
    campaignPerformanceSummaries: campaignPerformanceSummary.count,
    adsetPerformanceSummaries: adsetPerformanceSummary.count,
    adPerformanceSummaries: adPerformanceSummary.count,
  };
}

export async function syncMetaPerformance(input: {
  supabase: RepositoryClient;
  adAccounts: AdAccountRow[];
  campaignsByExternalId: Map<string, CampaignDimRow>;
  adsetsByExternalId: Map<string, AdsetDimRow>;
  adsByExternalId: Map<string, AdDimRow>;
  accessToken: string;
  backfillDays?: number;
  dateRange?: MetaDateRange;
  dataPolicy?: Partial<BusinessDataPolicy>;
  refreshSummaries?: boolean;
  syncedAt: string;
}) {
  const dataPolicy = {
    ...DEFAULT_PERFORMANCE_POLICY,
    ...(input.dataPolicy ?? {}),
  };
  const adAccountPerformanceInputs: Parameters<typeof upsertAdAccountPerformanceDaily>[1] = [];
  const campaignPerformanceInputs: Parameters<typeof upsertCampaignPerformanceDaily>[1] = [];
  const adsetPerformanceInputs: Parameters<typeof upsertAdsetPerformanceDaily>[1] = [];
  const adPerformanceInputs: Parameters<typeof upsertAdPerformanceDaily>[1] = [];
  const audienceBreakdownInputs: Parameters<typeof upsertMetaAudienceBreakdownsSummary>[1] = [];
  const hourlyPerformanceInputs: Parameters<typeof upsertMetaHourlyPerformance>[1] = [];
  let adAccountPerformanceRows = 0;
  let historicalDataAvailable = false;
  let hasMeaningfulHistory = false;
  let firstActivityDate: string | null = null;
  let latestActivityDate: string | null = null;
  let insightsSyncedThrough: string | null = null;

  for (const adAccount of input.adAccounts) {
    const hourlyRange = resolveHourlyDateRange({
      backfillDays: input.backfillDays,
      dateRange: input.dateRange,
      syncedAt: input.syncedAt,
      policyDays: dataPolicy.hourly_history_days,
    });
    const adAccountRows = await runPerformanceFetchStage('account', () =>
      fetchMetaAdAccountPerformanceSeeds({
        accessToken: input.accessToken,
        adAccountExternalId: adAccount.external_account_id,
        backfillDays: input.backfillDays,
        dateRange: input.dateRange,
      })
    );
    const campaignRows = await runPerformanceFetchStage('campaign', () =>
      fetchMetaCampaignPerformanceSeeds({
        accessToken: input.accessToken,
        adAccountExternalId: adAccount.external_account_id,
        backfillDays: input.backfillDays,
        dateRange: input.dateRange,
      })
    );
    const adsetRows = await runPerformanceFetchStage('ad set', () =>
      fetchMetaAdsetPerformanceSeeds({
        accessToken: input.accessToken,
        adAccountExternalId: adAccount.external_account_id,
        backfillDays: input.backfillDays,
        dateRange: input.dateRange,
      })
    );
    const adRows = await runPerformanceFetchStage('ad', () =>
      fetchMetaAdPerformanceSeeds({
        accessToken: input.accessToken,
        adAccountExternalId: adAccount.external_account_id,
        backfillDays: input.backfillDays,
        dateRange: input.dateRange,
      })
    );
    const audienceBreakdownRows = await runPerformanceFetchStage('audience breakdown summary', () =>
      fetchMetaAdsetAudienceBreakdownSeeds({
        accessToken: input.accessToken,
        adAccountExternalId: adAccount.external_account_id,
        allowedBreakdowns: dataPolicy.allowed_breakdowns,
      })
    );
    const adAudienceBreakdownRows =
      !dataPolicy.allow_ad_level_audience
        ? []
        : await runPerformanceFetchStage('ad audience breakdown summary', () =>
            fetchMetaAdAudienceBreakdownSeeds({
              accessToken: input.accessToken,
              adAccountExternalId: adAccount.external_account_id,
              allowedBreakdowns: dataPolicy.allowed_breakdowns,
            })
          );
    const adsetHourlyRows =
      hourlyRange == null
        ? []
        : await runPerformanceFetchStage('ad set hourly advertiser-time', () =>
            fetchMetaAdsetHourlyPerformanceSeeds({
              accessToken: input.accessToken,
              adAccountExternalId: adAccount.external_account_id,
              ...( 'since' in hourlyRange
                ? { dateRange: hourlyRange }
                : { backfillDays: hourlyRange.backfillDays }),
            })
          );
    const adHourlyRows =
      hourlyRange == null || !dataPolicy.allow_ad_level_hourly
        ? []
        : await runPerformanceFetchStage('ad hourly advertiser-time', () =>
            fetchMetaAdHourlyPerformanceSeeds({
              accessToken: input.accessToken,
              adAccountExternalId: adAccount.external_account_id,
              ...( 'since' in hourlyRange
                ? { dateRange: hourlyRange }
                : { backfillDays: hourlyRange.backfillDays }),
            })
          );

    console.info(`${META_HOURLY_DEBUG_PREFIX} sync:fetched`, {
      adAccountId: adAccount.id,
      adAccountExternalId: adAccount.external_account_id,
      hourlyRange: hourlyRange ?? null,
      adsetHourlyRows: adsetHourlyRows.length,
      adHourlyRows: adHourlyRows.length,
    });

    const hourlySkipped = {
      adsetMissingDimension: 0,
      adMissingDimension: 0,
      adMissingParentAdset: 0,
    };
    let adsetHourlyPrepared = 0;
    let adHourlyPrepared = 0;

    if (adAccountRows.length > 0) {
      historicalDataAvailable = true;
      adAccountPerformanceRows += adAccountRows.length;

      const normalizedRows = adAccountRows
        .map(
          (row) =>
            ({
              day: row.day,
              currency_code: row.currencyCode ?? adAccount.currency_code,
              spend: row.spend,
              reach: row.reach,
              impressions: row.impressions,
              clicks: row.clicks,
              inline_link_clicks: row.inlineLinkClicks,
              leads: row.leads,
              messages: row.messages,
            }) satisfies AdAccountDailyMetricsRow
        )
        .sort((left, right) => left.day.localeCompare(right.day));
      const activeRows = normalizedRows.filter(hasDeliverySignal);
      const summary = aggregateDailyMetricsRows(normalizedRows);

      if (hasMeaningfulPerformance(summary)) {
        hasMeaningfulHistory = true;
      }

      const firstDay = activeRows[0]?.day ?? null;
      const lastDay = activeRows[activeRows.length - 1]?.day ?? null;
      const lastObservedDay = normalizedRows[normalizedRows.length - 1]?.day ?? null;

      if (firstDay && (!firstActivityDate || firstDay < firstActivityDate)) {
        firstActivityDate = firstDay;
      }

      if (lastDay && (!latestActivityDate || lastDay > latestActivityDate)) {
        latestActivityDate = lastDay;
      }

      if (lastObservedDay && (!insightsSyncedThrough || lastObservedDay > insightsSyncedThrough)) {
        insightsSyncedThrough = lastObservedDay;
      }
    }

    for (const row of adAccountRows) {
      adAccountPerformanceInputs.push({
        adAccountId: adAccount.id,
        day: row.day,
        currencyCode: row.currencyCode ?? adAccount.currency_code,
        source: 'meta',
        status: adAccount.status,
        spend: row.spend,
        reach: row.reach,
        impressions: row.impressions,
        clicks: row.clicks,
        inlineLinkClicks: row.inlineLinkClicks,
        leads: row.leads,
        messages: row.messages,
        syncedAt: input.syncedAt,
      });
    }

    for (const row of campaignRows) {
      const campaign = input.campaignsByExternalId.get(row.campaignExternalId);
      if (!campaign) {
        continue;
      }

      campaignPerformanceInputs.push({
        campaignId: campaign.id,
        adAccountId: campaign.ad_account_id,
        campaignExternalId: row.campaignExternalId,
        day: row.day,
        currencyCode: row.currencyCode,
        objective: campaign.objective,
        source: 'meta',
        status: campaign.status,
        spend: row.spend,
        reach: row.reach,
        impressions: row.impressions,
        clicks: row.clicks,
        inlineLinkClicks: row.inlineLinkClicks,
        leads: row.leads,
        messages: row.messages,
        calls: row.calls,
        syncedAt: input.syncedAt,
      });
    }

    for (const row of adsetRows) {
      const adset = input.adsetsByExternalId.get(row.adsetExternalId);
      if (!adset) {
        continue;
      }

      const campaign = input.campaignsByExternalId.get(adset.campaign_external_id);

      adsetPerformanceInputs.push({
        adsetId: adset.id,
        adAccountId: adset.ad_account_id,
        day: row.day,
        currencyCode: row.currencyCode,
        objective: campaign?.objective ?? null,
        source: 'meta',
        status: adset.status,
        spend: row.spend,
        reach: row.reach,
        impressions: row.impressions,
        clicks: row.clicks,
        inlineLinkClicks: row.inlineLinkClicks,
        leads: row.leads,
        messages: row.messages,
        calls: row.calls,
        syncedAt: input.syncedAt,
      });
    }

    for (const row of adRows) {
      const ad = input.adsByExternalId.get(row.adExternalId);
      if (!ad) {
        continue;
      }

      const adset = input.adsetsByExternalId.get(ad.adset_external_id);
      const campaign = adset
        ? input.campaignsByExternalId.get(adset.campaign_external_id)
        : null;

      adPerformanceInputs.push({
        adId: ad.id,
        adAccountId: ad.ad_account_id,
        day: row.day,
        currencyCode: row.currencyCode,
        objective: campaign?.objective ?? null,
        source: 'meta',
        status: ad.status,
        spend: row.spend,
        reach: row.reach,
        impressions: row.impressions,
        clicks: row.clicks,
        inlineLinkClicks: row.inlineLinkClicks,
        leads: row.leads,
        messages: row.messages,
        calls: row.calls,
        syncedAt: input.syncedAt,
      });
    }

    for (const row of audienceBreakdownRows) {
      const adset = input.adsetsByExternalId.get(row.adsetExternalId);
      if (!adset) {
        continue;
      }

      const campaign =
        input.campaignsByExternalId.get(row.campaignExternalId ?? '') ??
        input.campaignsByExternalId.get(adset.campaign_external_id);

      audienceBreakdownInputs.push({
        adAccountId: adAccount.id,
        entityLevel: row.entityLevel,
        entityId: adset.id,
        campaignId: campaign?.id ?? null,
        adsetId: adset.id,
        adId: null,
        firstDay: row.dateStart,
        lastDay: row.dateStop ?? row.day,
        breakdownType: row.breakdownType,
        dimension1Key: row.dimension1Key,
        dimension1Value: row.dimension1Value,
        dimension2Key: row.dimension2Key,
        dimension2Value: row.dimension2Value,
        publisherPlatform: row.publisherPlatform,
        platformPosition: row.platformPosition,
        impressionDevice: row.impressionDevice,
        currencyCode: row.currencyCode ?? adAccount.currency_code,
        objective: campaign?.objective ?? null,
        source: 'meta_insights_summary',
        spend: row.spend,
        reach: row.reach,
        impressions: row.impressions,
        clicks: row.clicks,
        inlineLinkClicks: row.inlineLinkClicks,
        leads: row.leads,
        messages: row.messages,
        calls: row.calls,
        actionsJson: row.actions,
        costPerActionTypeJson: row.costPerActionType,
        raw: row.raw,
        syncedAt: input.syncedAt,
      });
    }

    for (const row of adAudienceBreakdownRows) {
      const ad = row.adExternalId ? input.adsByExternalId.get(row.adExternalId) : null;
      if (!ad) {
        continue;
      }

      const adset = input.adsetsByExternalId.get(ad.adset_external_id);
      if (!adset) {
        continue;
      }

      const campaign =
        input.campaignsByExternalId.get(row.campaignExternalId ?? '') ??
        input.campaignsByExternalId.get(adset.campaign_external_id);

      audienceBreakdownInputs.push({
        adAccountId: adAccount.id,
        entityLevel: row.entityLevel,
        entityId: ad.id,
        campaignId: campaign?.id ?? null,
        adsetId: adset.id,
        adId: ad.id,
        firstDay: row.dateStart,
        lastDay: row.dateStop ?? row.day,
        breakdownType: row.breakdownType,
        dimension1Key: row.dimension1Key,
        dimension1Value: row.dimension1Value,
        dimension2Key: row.dimension2Key,
        dimension2Value: row.dimension2Value,
        publisherPlatform: row.publisherPlatform,
        platformPosition: row.platformPosition,
        impressionDevice: row.impressionDevice,
        currencyCode: row.currencyCode ?? adAccount.currency_code,
        objective: campaign?.objective ?? null,
        source: 'meta_insights_summary',
        spend: row.spend,
        reach: row.reach,
        impressions: row.impressions,
        clicks: row.clicks,
        inlineLinkClicks: row.inlineLinkClicks,
        leads: row.leads,
        messages: row.messages,
        calls: row.calls,
        actionsJson: row.actions,
        costPerActionTypeJson: row.costPerActionType,
        raw: row.raw,
        syncedAt: input.syncedAt,
      });
    }

    for (const row of adsetHourlyRows) {
      const adset = input.adsetsByExternalId.get(row.adsetExternalId);
      if (!adset) {
        hourlySkipped.adsetMissingDimension += 1;
        continue;
      }

      const campaign =
        input.campaignsByExternalId.get(row.campaignExternalId ?? '') ??
        input.campaignsByExternalId.get(adset.campaign_external_id);

      hourlyPerformanceInputs.push({
        adAccountId: adAccount.id,
        entityLevel: row.entityLevel,
        entityId: adset.id,
        campaignId: campaign?.id ?? null,
        adsetId: adset.id,
        adId: null,
        day: row.day,
        weekStart: row.weekStart,
        dayOfWeek: row.dayOfWeek,
        hourOfDay: row.hourOfDay,
        advertiserTimeBucket: row.advertiserTimeBucket,
        timeBasis: row.timeBasis,
        currencyCode: row.currencyCode ?? adAccount.currency_code,
        objective: campaign?.objective ?? null,
        source: 'meta_hourly_insights',
        spend: row.spend,
        reach: row.reach,
        impressions: row.impressions,
        clicks: row.clicks,
        inlineLinkClicks: row.inlineLinkClicks,
        leads: row.leads,
        messages: row.messages,
        calls: row.calls,
        ctr: row.ctr,
        cpc: row.cpc,
        cpm: row.cpm,
        actionsJson: row.actions,
        costPerActionTypeJson: row.costPerActionType,
        raw: row.raw,
        syncedAt: input.syncedAt,
      });
      adsetHourlyPrepared += 1;
    }

    for (const row of adHourlyRows) {
      const ad = row.adExternalId ? input.adsByExternalId.get(row.adExternalId) : null;
      if (!ad) {
        hourlySkipped.adMissingDimension += 1;
        continue;
      }

      const adset = input.adsetsByExternalId.get(ad.adset_external_id);
      if (!adset) {
        hourlySkipped.adMissingParentAdset += 1;
        continue;
      }

      const campaign =
        input.campaignsByExternalId.get(row.campaignExternalId ?? '') ??
        input.campaignsByExternalId.get(adset.campaign_external_id);

      hourlyPerformanceInputs.push({
        adAccountId: adAccount.id,
        entityLevel: row.entityLevel,
        entityId: ad.id,
        campaignId: campaign?.id ?? null,
        adsetId: adset.id,
        adId: ad.id,
        day: row.day,
        weekStart: row.weekStart,
        dayOfWeek: row.dayOfWeek,
        hourOfDay: row.hourOfDay,
        advertiserTimeBucket: row.advertiserTimeBucket,
        timeBasis: row.timeBasis,
        currencyCode: row.currencyCode ?? adAccount.currency_code,
        objective: campaign?.objective ?? null,
        source: 'meta_hourly_insights',
        spend: row.spend,
        reach: row.reach,
        impressions: row.impressions,
        clicks: row.clicks,
        inlineLinkClicks: row.inlineLinkClicks,
        leads: row.leads,
        messages: row.messages,
        calls: row.calls,
        ctr: row.ctr,
        cpc: row.cpc,
        cpm: row.cpm,
        actionsJson: row.actions,
        costPerActionTypeJson: row.costPerActionType,
        raw: row.raw,
        syncedAt: input.syncedAt,
      });
      adHourlyPrepared += 1;
    }

    console.info(`${META_HOURLY_DEBUG_PREFIX} sync:prepared`, {
      adAccountId: adAccount.id,
      adAccountExternalId: adAccount.external_account_id,
      adsetHourlyFetched: adsetHourlyRows.length,
      adHourlyFetched: adHourlyRows.length,
      adsetHourlyPrepared,
      adHourlyPrepared,
      skipped: hourlySkipped,
    });
  }

  const [
    adAccountPerformance,
    campaignPerformance,
    adsetPerformance,
    adPerformance,
    audienceBreakdowns,
    hourlyPerformance,
  ] =
    await Promise.all([
      upsertAdAccountPerformanceDaily(input.supabase, adAccountPerformanceInputs),
      upsertCampaignPerformanceDaily(input.supabase, campaignPerformanceInputs),
      upsertAdsetPerformanceDaily(input.supabase, adsetPerformanceInputs),
      upsertAdPerformanceDaily(input.supabase, adPerformanceInputs),
      upsertMetaAudienceBreakdownsSummary(input.supabase, audienceBreakdownInputs),
      upsertMetaHourlyPerformance(input.supabase, hourlyPerformanceInputs),
    ]);

  console.info(`${META_HOURLY_DEBUG_PREFIX} sync:upserted`, {
    adAccountCount: input.adAccounts.length,
    queuedHourlyRows: hourlyPerformanceInputs.length,
    insertedHourlyRows: hourlyPerformance.count,
  });

  const summaryCounts =
    input.refreshSummaries === false
      ? {
          campaignPerformanceSummaries: 0,
          adsetPerformanceSummaries: 0,
          adPerformanceSummaries: 0,
        }
      : await refreshMetaPerformanceSummaries({
          supabase: input.supabase,
          adAccounts: input.adAccounts,
          campaignsByExternalId: input.campaignsByExternalId,
          adsetsByExternalId: input.adsetsByExternalId,
          adsByExternalId: input.adsByExternalId,
          accessToken: input.accessToken,
          syncedAt: input.syncedAt,
        });

  return {
    adAccountPerformanceRows: adAccountPerformance.count || adAccountPerformanceRows,
    campaignPerformanceRows: campaignPerformance.count,
    adsetPerformanceRows: adsetPerformance.count,
    adPerformanceRows: adPerformance.count,
    audienceBreakdownRows: audienceBreakdowns.count,
    metaHourlyPerformanceRows: hourlyPerformance.count,
    campaignPerformanceSummaries: summaryCounts.campaignPerformanceSummaries,
    adsetPerformanceSummaries: summaryCounts.adsetPerformanceSummaries,
    adPerformanceSummaries: summaryCounts.adPerformanceSummaries,
    historicalDataAvailable,
    hasMeaningfulHistory,
    firstActivityDate,
    latestActivityDate,
    insightsSyncedThrough,
  };
}
