import 'server-only';

import {
  aggregateDailyMetricsRows,
  hasMeaningfulPerformance,
  type AdAccountDailyMetricsRow,
} from '@/lib/server/repositories/ad_accounts/normalizers';
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
  fetchMetaAdPerformanceSeeds,
  fetchMetaAdsetPerformanceSeeds,
  fetchMetaCampaignPerformanceSeeds,
  type MetaDateRange,
} from './fetch';

type AdAccountRow = Database['public']['Tables']['ad_accounts']['Row'];
type CampaignDimRow = Database['public']['Tables']['campaign_dims']['Row'];
type AdsetDimRow = Database['public']['Tables']['adset_dims']['Row'];
type AdDimRow = Database['public']['Tables']['ad_dims']['Row'];

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
  let adAccountPerformanceRows = 0;
  let historicalDataAvailable = false;
  let hasMeaningfulHistory = false;
  let firstActivityDate: string | null = null;
  let latestActivityDate: string | null = null;
  let insightsSyncedThrough: string | null = null;

  for (const adAccount of input.adAccounts) {
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
  }

  const [adAccountPerformance, campaignPerformance, adsetPerformance, adPerformance] =
    await Promise.all([
      upsertAdAccountPerformanceDaily(input.supabase, adAccountPerformanceInputs),
      upsertCampaignPerformanceDaily(input.supabase, campaignPerformanceInputs),
      upsertAdsetPerformanceDaily(input.supabase, adsetPerformanceInputs),
      upsertAdPerformanceDaily(input.supabase, adPerformanceInputs),
    ]);

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
