import 'server-only';

import {
  aggregateDailyMetricsRows,
  hasMeaningfulPerformance,
  type AdAccountDailyMetricsRow,
} from '@/lib/server/repositories/ad_accounts/normalizers';
import { upsertMetaAudienceBreakdownsDaily } from '@/lib/server/repositories/audience/upsertMetaAudienceBreakdownsDaily';
import { upsertMetaHourlyPerformance } from '@/lib/server/repositories/hourly/upsertMetaHourlyPerformance';
import { upsertAdAccountPerformanceDaily } from '@/lib/server/repositories/ad_accounts/upsertAdAccountPerformanceDaily';
import { upsertAdPerformanceSummary } from '@/lib/server/repositories/ads/upsertAdPerformanceSummary';
import { upsertAdPerformanceDaily } from '@/lib/server/repositories/ads/upsertAdPerformanceDaily';
import { upsertAdsetPerformanceSummary } from '@/lib/server/repositories/adsets/upsertAdsetPerformanceSummary';
import { upsertAdsetPerformanceDaily } from '@/lib/server/repositories/adsets/upsertAdsetPerformanceDaily';
import { upsertCampaignPerformanceSummary } from '@/lib/server/repositories/campaigns/upsertCampaignPerformanceSummary';
import { upsertCampaignPerformanceDaily } from '@/lib/server/repositories/campaigns/upsertCampaignPerformanceDaily';
import type { Database } from '@/lib/shared/types/supabase';
import type { RepositoryClient } from '@/lib/server/repositories/utils';
import {
  fetchMetaAdAccountPerformanceSeeds,
  fetchMetaAdAudienceBreakdownSeeds,
  fetchMetaAdHourlyPerformanceSeeds,
  fetchMetaAdPerformanceSeeds,
  fetchMetaAdsetAudienceBreakdownSeeds,
  fetchMetaAdsetHourlyPerformanceSeeds,
  fetchMetaAdsetPerformanceSeeds,
  fetchMetaCampaignPerformanceSeeds,
  type MetaDateRange,
} from './fetch';

type AdAccountRow = Database['public']['Tables']['ad_accounts']['Row'];
type CampaignDimRow = Database['public']['Tables']['campaign_dims']['Row'];
type AdsetDimRow = Database['public']['Tables']['adset_dims']['Row'];
type AdDimRow = Database['public']['Tables']['ad_dims']['Row'];

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

const META_HOURLY_SYNC_MAX_DAYS = 90;

function addUtcDays(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function resolveHourlyDateRange(input: {
  backfillDays?: number;
  dateRange?: MetaDateRange;
  syncedAt: string;
}): MetaDateRange | { backfillDays: number } | null {
  if (input.dateRange) {
    const syncedDay = input.syncedAt.slice(0, 10);
    const floorDay = addUtcDays(syncedDay, -(META_HOURLY_SYNC_MAX_DAYS - 1));

    if (input.dateRange.until < floorDay) {
      return null;
    }

    return {
      since: input.dateRange.since > floorDay ? input.dateRange.since : floorDay,
      until: input.dateRange.until,
    };
  }

  return {
    backfillDays: Math.min(input.backfillDays ?? 30, META_HOURLY_SYNC_MAX_DAYS),
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
  campaignsByExternalId: Map<string, CampaignDimRow>;
  adsetsByExternalId: Map<string, AdsetDimRow>;
  adsByExternalId: Map<string, AdDimRow>;
  syncedAt: string;
}) {
  const [campaignPerformanceSummary, adsetPerformanceSummary, adPerformanceSummary] =
    await Promise.all([
      upsertCampaignPerformanceSummary(input.supabase, {
        campaigns: Array.from(input.campaignsByExternalId.values()),
        syncedAt: input.syncedAt,
      }),
      upsertAdsetPerformanceSummary(input.supabase, {
        adsets: Array.from(input.adsetsByExternalId.values()),
        syncedAt: input.syncedAt,
      }),
      upsertAdPerformanceSummary(input.supabase, {
        ads: Array.from(input.adsByExternalId.values()),
        syncedAt: input.syncedAt,
      }),
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
  refreshSummaries?: boolean;
  syncedAt: string;
}) {
  const adAccountPerformanceInputs: Parameters<typeof upsertAdAccountPerformanceDaily>[1] = [];
  const campaignPerformanceInputs: Parameters<typeof upsertCampaignPerformanceDaily>[1] = [];
  const adsetPerformanceInputs: Parameters<typeof upsertAdsetPerformanceDaily>[1] = [];
  const adPerformanceInputs: Parameters<typeof upsertAdPerformanceDaily>[1] = [];
  const audienceBreakdownInputs: Parameters<typeof upsertMetaAudienceBreakdownsDaily>[1] = [];
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
    const audienceBreakdownRows = await runPerformanceFetchStage('audience breakdown', () =>
      fetchMetaAdsetAudienceBreakdownSeeds({
        accessToken: input.accessToken,
        adAccountExternalId: adAccount.external_account_id,
        backfillDays: input.backfillDays,
        dateRange: input.dateRange,
      })
    );
    const adAudienceBreakdownRows = await runPerformanceFetchStage('ad audience breakdown', () =>
      fetchMetaAdAudienceBreakdownSeeds({
        accessToken: input.accessToken,
        adAccountExternalId: adAccount.external_account_id,
        backfillDays: input.backfillDays,
        dateRange: input.dateRange,
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
      hourlyRange == null
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
        day: row.day,
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
        source: 'meta_insights',
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
        day: row.day,
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
        source: 'meta_insights',
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
        impressions: row.impressions,
        clicks: row.clicks,
        inlineLinkClicks: row.inlineLinkClicks,
        ctr: row.ctr,
        cpc: row.cpc,
        cpm: row.cpm,
        actionsJson: row.actions,
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
        impressions: row.impressions,
        clicks: row.clicks,
        inlineLinkClicks: row.inlineLinkClicks,
        ctr: row.ctr,
        cpc: row.cpc,
        cpm: row.cpm,
        actionsJson: row.actions,
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
      upsertMetaAudienceBreakdownsDaily(input.supabase, audienceBreakdownInputs),
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
          campaignsByExternalId: input.campaignsByExternalId,
          adsetsByExternalId: input.adsetsByExternalId,
          adsByExternalId: input.adsByExternalId,
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
