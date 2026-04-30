import type {
  AdAccountData,
  PlatformDetails,
} from '@/lib/server/data/types';
import { hasMeaningfulMetrics } from '@/lib/server/data';
import type { ReportBreakdownRow } from '@/lib/server/reports/types';
import { resolveDashboardState } from './state';
import type {
  DashboardAdDimension,
  DashboardAdsetDimension,
  DashboardAudienceBreakdowns,
  DashboardFeaturedAdsetHistory,
  DashboardAudienceMetricRow,
  DashboardAudienceSlice,
  DashboardCampaignDimension,
  DashboardLiveAdItem,
  DashboardLiveAdsetItem,
  DashboardLiveCampaignContainer,
  DashboardLiveComparisons,
  DashboardLiveSummary,
  DashboardTrendPoint,
  DashboardLiveWindow,
  DashboardPayload,
  DashboardPlatformBreakdowns,
  DashboardPlatformSlice,
} from './types';

type BaseMetrics = {
  spend: number;
  impressions: number;
  clicks: number;
  results: number;
  ctr: number;
  costPerResult: number;
};

type PerformanceAverages = {
  spend: number;
  conversion: number;
  ctr: number;
  costPerResult: number;
};

type LiveAdSeed = {
  id: string;
  internalId: string | null;
  adsetId: string;
  adsetInternalId: string | null;
  campaignId: string | null;
  campaignInternalId: string | null;
  adsetName: string | null;
  campaignName: string | null;
  name: string;
  status: string;
  spend: number;
  impressions: number;
  clicks: number;
  results: number;
  ctr: number;
  costPerResult: number;
};

type LiveAdsetSeed = {
  id: string;
  internalId: string | null;
  campaignId: string | null;
  campaignInternalId: string | null;
  campaignName: string | null;
  name: string;
  status: string;
  optimizationGoal: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  results: number;
  ctr: number;
  costPerResult: number;
  adCount: number;
};

type BreakdownAggregationSeed = {
  label: string;
  secondaryLabel: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  results: number;
};

const GEO_BREAKDOWN_TYPES = ['country', 'region', 'dma'] as const;

function toFixedNumber(value: number, digits = 2): number {
  return Number((Number.isFinite(value) ? value : 0).toFixed(digits));
}

function computeCtr(clicks: number, impressions: number): number {
  if (impressions <= 0) {
    return 0;
  }

  return toFixedNumber((clicks / impressions) * 100, 2);
}

function computeCostPerResult(spend: number, results: number): number {
  if (results <= 0) {
    return 0;
  }

  return toFixedNumber(spend / results, 2);
}

function potentialCustomersFromRow(
  row: Pick<ReportBreakdownRow, 'leads' | 'messages' | 'calls'>
): number {
  return (row.leads ?? 0) + (row.messages ?? 0) + (row.calls ?? 0);
}

function hasLiveDeliveryMetrics(row: Pick<ReportBreakdownRow, 'spend' | 'impressions'>): boolean {
  return row.spend > 0 || row.impressions > 0;
}

export function isLikelyActiveStatus(status: string | null | undefined): boolean {
  const normalized = (status ?? '').trim().toLowerCase();

  if (!normalized) {
    return false;
  }

  const inactiveTokens = [
    'paused',
    'archived',
    'completed',
    'ended',
    'disabled',
    'inactive',
    'deleted',
    'removed',
    'rejected',
    'disapproved',
    'error',
    'failed',
    'draft',
  ];

  if (inactiveTokens.some((token) => normalized.includes(token))) {
    return false;
  }

  const activeTokens = [
    'active',
    'enabled',
    'learning',
    'limited',
    'pending',
    'review',
    'running',
    'serving',
  ];

  return activeTokens.some((token) => normalized.includes(token));
}

function computePerformanceIndex(input: {
  spend: number;
  conversion: number;
  ctr: number;
  costPerResult: number;
  averages: PerformanceAverages;
}): number {
  const ctrScore =
    input.averages.ctr > 0 ? input.ctr / input.averages.ctr : input.ctr > 0 ? 1 : 0;
  const conversionScore =
    input.averages.conversion > 0
      ? input.conversion / input.averages.conversion
      : input.conversion > 0
        ? 1
        : 0;
  const costScore =
    input.conversion <= 0
      ? 0
      : input.averages.costPerResult > 0
        ? input.averages.costPerResult / Math.max(input.costPerResult, 0.01)
        : 1;
  const spendScore =
    input.averages.spend > 0 ? input.spend / input.averages.spend : input.spend > 0 ? 1 : 0;

  return toFixedNumber(
    ctrScore * 0.25 + conversionScore * 0.4 + costScore * 0.25 + spendScore * 0.1,
    2
  );
}

function buildPerformanceAverages(items: BaseMetrics[]): PerformanceAverages {
  if (items.length === 0) {
    return {
      spend: 0,
      conversion: 0,
      ctr: 0,
      costPerResult: 0,
    };
  }

  const spend = items.reduce((sum, item) => sum + item.spend, 0);
  const conversion = items.reduce((sum, item) => sum + item.results, 0);
  const ctr = items.reduce((sum, item) => sum + item.ctr, 0);
  const costEntries = items.filter((item) => item.results > 0 && item.costPerResult > 0);
  const costPerResult =
    costEntries.length > 0
      ? costEntries.reduce((sum, item) => sum + item.costPerResult, 0) / costEntries.length
      : 0;

  return {
    spend: spend / items.length,
    conversion: conversion / items.length,
    ctr: ctr / items.length,
    costPerResult,
  };
}

function sortByPerformance<T extends BaseMetrics & { performanceIndex: number; name: string }>(
  items: T[]
): T[] {
  return items
    .slice()
    .sort(
      (left, right) =>
        right.performanceIndex - left.performanceIndex ||
        right.results - left.results ||
        right.ctr - left.ctr ||
        right.spend - left.spend ||
        left.name.localeCompare(right.name)
    );
}

function titleizeSegment(value: string): string {
  return value
    .replace(/_/g, ' ')
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatPublisherPlatformLabel(value: string): string {
  const normalized = value.trim().toLowerCase();

  switch (normalized) {
    case 'facebook':
      return 'Facebook';
    case 'instagram':
      return 'Instagram';
    case 'messenger':
      return 'Messenger';
    case 'audience_network':
      return 'Audience Network';
    default:
      return titleizeSegment(value);
  }
}

function formatPlacementLabel(value: string): string {
  const normalized = value.trim().toLowerCase();

  switch (normalized) {
    case 'story':
      return 'Stories';
    case 'instream_video':
      return 'In-stream video';
    case 'right_hand_column':
      return 'Right-hand column';
    default:
      return titleizeSegment(value);
  }
}

function formatImpressionDeviceLabel(value: string): string {
  const normalized = value.trim().toLowerCase();

  switch (normalized) {
    case 'iphone':
      return 'iPhone';
    case 'ipad':
      return 'iPad';
    case 'android_smartphone':
      return 'Android smartphone';
    case 'android_tablet':
      return 'Android tablet';
    case 'mobile_app':
      return 'Mobile app';
    case 'mobile_web':
      return 'Mobile web';
    case 'desktop':
      return 'Desktop';
    default:
      return titleizeSegment(value);
  }
}

function formatGeoSecondaryLabel(value: string): string {
  switch (value) {
    case 'dma':
      return 'DMA';
    default:
      return titleizeSegment(value);
  }
}

function formatAgeGenderLabel(row: DashboardAudienceMetricRow): string {
  const age = row.dimension1Value.trim();
  const gender = row.dimension2Value.trim().toLowerCase();

  if (!gender || gender === 'unknown') {
    return age || 'Unknown age band';
  }

  return `${titleizeSegment(gender)} ${age}`.trim();
}

function resolvePlatformSliceValue(
  row: DashboardAudienceMetricRow,
  kind: DashboardPlatformSlice['kind']
): string {
  switch (kind) {
    case 'publisher_platform':
      return row.publisherPlatform?.trim() || row.dimension1Value.trim();
    case 'platform_position':
      return row.platformPosition?.trim() || row.dimension1Value.trim();
    case 'impression_device':
      return row.impressionDevice?.trim() || row.dimension1Value.trim();
    default:
      return row.dimension1Value.trim();
  }
}

function buildBreakdownState(input: {
  isMeta: boolean;
  hasLiveDelivery: boolean;
  audienceRows: DashboardAudienceMetricRow[];
}): DashboardPlatformBreakdowns['state'] {
  if (!input.isMeta) {
    return 'unsupported';
  }

  if (!input.hasLiveDelivery || input.audienceRows.length === 0) {
    return 'syncing';
  }

  return 'available';
}

function aggregateSliceRows<T extends DashboardPlatformSlice | DashboardAudienceSlice>(
  seeds: Array<{
    key: string;
    label: string;
    secondaryLabel: string | null;
    spend: number;
    impressions: number;
    clicks: number;
    results: number;
  }>,
  build: (input: {
    key: string;
    label: string;
    secondaryLabel: string | null;
    spend: number;
    impressions: number;
    clicks: number;
    results: number;
    shareOfSpend: number;
  }) => T
): T[] {
  const grouped = new Map<string, BreakdownAggregationSeed>();

  for (const seed of seeds) {
    const current = grouped.get(seed.key) ?? {
      label: seed.label,
      secondaryLabel: seed.secondaryLabel,
      spend: 0,
      impressions: 0,
      clicks: 0,
      results: 0,
    };
    current.spend += seed.spend;
    current.impressions += seed.impressions;
    current.clicks += seed.clicks;
    current.results += seed.results;
    grouped.set(seed.key, current);
  }

  const totalSpend = Array.from(grouped.values()).reduce((sum, item) => sum + item.spend, 0);

  return Array.from(grouped.entries())
    .map(([key, value]) =>
      build({
        key,
        label: value.label,
        secondaryLabel: value.secondaryLabel,
        spend: toFixedNumber(value.spend, 2),
        impressions: value.impressions,
        clicks: value.clicks,
        results: value.results,
        shareOfSpend: totalSpend > 0 ? toFixedNumber((value.spend / totalSpend) * 100, 1) : 0,
      })
    )
    .sort(
      (left, right) =>
        right.results - left.results ||
        right.spend - left.spend ||
        right.ctr - left.ctr ||
        left.label.localeCompare(right.label)
    );
}

function buildPlatformSlices(
  rows: DashboardAudienceMetricRow[],
  kind: DashboardPlatformSlice['kind']
): DashboardPlatformSlice[] {
  const seeds = rows
    .map((row) => ({
      row,
      value: resolvePlatformSliceValue(row, kind),
    }))
    .filter((item) => item.value.length > 0)
    .map((row) => {
      const label =
        kind === 'publisher_platform'
          ? formatPublisherPlatformLabel(row.value)
          : kind === 'platform_position'
            ? formatPlacementLabel(row.value)
            : formatImpressionDeviceLabel(row.value);

      return {
        key: `${kind}:${row.value}`,
        label,
        secondaryLabel: null,
        spend: row.row.spend,
        impressions: row.row.impressions,
        clicks: row.row.clicks,
        results: row.row.leads + row.row.messages + row.row.calls,
      };
    });

  return aggregateSliceRows(seeds, (input) => ({
    key: input.key,
    kind,
    label: input.label,
    spend: input.spend,
    impressions: input.impressions,
    clicks: input.clicks,
    results: input.results,
    ctr: computeCtr(input.clicks, input.impressions),
    costPerResult: computeCostPerResult(input.spend, input.results),
    shareOfSpend: input.shareOfSpend,
  }));
}

function buildAgeGenderSlices(rows: DashboardAudienceMetricRow[]): DashboardAudienceSlice[] {
  const seeds = rows
    .filter((row) => row.dimension1Value.trim().length > 0)
    .map((row) => ({
      key: `age_gender:${row.dimension1Value}:${row.dimension2Value}`,
      label: formatAgeGenderLabel(row),
      secondaryLabel: null,
      spend: row.spend,
      impressions: row.impressions,
      clicks: row.clicks,
      results: row.leads + row.messages + row.calls,
    }));

  return aggregateSliceRows(seeds, (input) => ({
    key: input.key,
    kind: 'age_gender',
    label: input.label,
    secondaryLabel: input.secondaryLabel,
    spend: input.spend,
    impressions: input.impressions,
    clicks: input.clicks,
    results: input.results,
    ctr: computeCtr(input.clicks, input.impressions),
    costPerResult: computeCostPerResult(input.spend, input.results),
    shareOfSpend: input.shareOfSpend,
  }));
}

function buildGeoSlices(rows: DashboardAudienceMetricRow[]): DashboardAudienceSlice[] {
  const seeds = rows
    .filter((row) => row.dimension1Value.trim().length > 0)
    .map((row) => ({
      key: `${row.breakdownType}:${row.dimension1Value}`,
      label: titleizeSegment(row.dimension1Value),
      secondaryLabel: formatGeoSecondaryLabel(row.breakdownType),
      spend: row.spend,
      impressions: row.impressions,
      clicks: row.clicks,
      results: row.leads + row.messages + row.calls,
    }));

  return aggregateSliceRows(seeds, (input) => ({
    key: input.key,
    kind: 'geo',
    label: input.label,
    secondaryLabel: input.secondaryLabel,
    spend: input.spend,
    impressions: input.impressions,
    clicks: input.clicks,
    results: input.results,
    ctr: computeCtr(input.clicks, input.impressions),
    costPerResult: computeCostPerResult(input.spend, input.results),
    shareOfSpend: input.shareOfSpend,
  }));
}

function preferEntityRows(
  rows: DashboardAudienceMetricRow[],
  breakdownTypes: string[]
): DashboardAudienceMetricRow[] {
  const filtered = rows.filter((row) => breakdownTypes.includes(row.breakdownType));
  const adsetRows = filtered.filter((row) => row.entityLevel === 'adset');
  return adsetRows.length > 0 ? adsetRows : filtered.filter((row) => row.entityLevel === 'ad');
}

export function buildPlatformBreakdowns(input: {
  isMeta: boolean;
  hasLiveDelivery: boolean;
  audienceRows: DashboardAudienceMetricRow[];
}): DashboardPlatformBreakdowns {
  const state = buildBreakdownState(input);

  if (state !== 'available') {
    return {
      state,
      publisherPlatforms: [],
      placements: [],
      impressionDevices: [],
    };
  }

  return {
    state,
    publisherPlatforms: buildPlatformSlices(
      preferEntityRows(input.audienceRows, ['publisher_platform']),
      'publisher_platform'
    ),
    placements: buildPlatformSlices(
      preferEntityRows(input.audienceRows, ['platform_position']),
      'platform_position'
    ),
    impressionDevices: buildPlatformSlices(
      preferEntityRows(input.audienceRows, ['impression_device']),
      'impression_device'
    ),
  };
}

export function buildAudienceBreakdowns(input: {
  isMeta: boolean;
  hasLiveDelivery: boolean;
  audienceRows: DashboardAudienceMetricRow[];
}): DashboardAudienceBreakdowns {
  const state = buildBreakdownState(input);

  if (state !== 'available') {
    return {
      state,
      ageGender: [],
      geo: [],
    };
  }

  return {
    state,
    ageGender: buildAgeGenderSlices(preferEntityRows(input.audienceRows, ['age_gender'])),
    geo: buildGeoSlices(preferEntityRows(input.audienceRows, [...GEO_BREAKDOWN_TYPES])),
  };
}

function buildEntityTopSliceMap(input: {
  rows: DashboardAudienceMetricRow[];
  breakdownType: string;
  entityLevel: 'adset' | 'ad';
  idField: 'adsetInternalId' | 'adInternalId';
  labelFormatter: (value: string) => string;
}): Map<string, string> {
  const directRows = input.rows.filter(
    (row) => row.breakdownType === input.breakdownType && row.entityLevel === input.entityLevel
  );
  const fallbackRows =
    input.entityLevel === 'adset'
      ? input.rows.filter(
          (row) => row.breakdownType === input.breakdownType && row.entityLevel === 'ad'
        )
      : [];
  const sourceRows = directRows.length > 0 ? directRows : fallbackRows;
  const grouped = new Map<string, Map<string, BreakdownAggregationSeed>>();

  for (const row of sourceRows) {
    const entityId =
      input.idField === 'adsetInternalId' ? row.adsetInternalId : row.adInternalId;
    const value = row.dimension1Value.trim();

    if (!entityId || !value) {
      continue;
    }

    const slices = grouped.get(entityId) ?? new Map<string, BreakdownAggregationSeed>();
    const key = value;
    const current = slices.get(key) ?? {
      label: input.labelFormatter(value),
      secondaryLabel: null,
      spend: 0,
      impressions: 0,
      clicks: 0,
      results: 0,
    };
    current.spend += row.spend;
    current.impressions += row.impressions;
    current.clicks += row.clicks;
    current.results += row.leads + row.messages + row.calls;
    slices.set(key, current);
    grouped.set(entityId, slices);
  }

  const result = new Map<string, string>();

  grouped.forEach((slices, entityId) => {
    const topSlice = Array.from(slices.values()).sort(
      (left, right) =>
        right.results - left.results ||
        right.spend - left.spend ||
        computeCtr(right.clicks, right.impressions) -
          computeCtr(left.clicks, left.impressions) ||
        left.label.localeCompare(right.label)
    )[0];

    if (topSlice) {
      result.set(entityId, topSlice.label);
    }
  });

  return result;
}

function emptySummary(): DashboardLiveSummary {
  return {
    liveCampaignCount: 0,
    liveAdsetCount: 0,
    liveAdCount: 0,
    spend: 0,
    impressions: 0,
    clicks: 0,
    results: 0,
    ctr: 0,
    costPerResult: 0,
    primaryOutcomeMetric: 'results',
    primaryOutcomeLabel: 'Results',
    primaryOutcomeValue: 0,
    servingPlatformLabels: [],
  };
}

function emptyLiveWindow(isMeta: boolean): DashboardLiveWindow {
  return {
    hasLiveDelivery: false,
    campaigns: [],
    adsets: [],
    ads: [],
    summary: emptySummary(),
    comparisons: {
      adsets: [],
      ads: [],
    },
    platformBreakdowns: {
      state: isMeta ? 'syncing' : 'unsupported',
      publisherPlatforms: [],
      placements: [],
      impressionDevices: [],
    },
    audienceBreakdowns: {
      state: isMeta ? 'syncing' : 'unsupported',
      ageGender: [],
      geo: [],
    },
  };
}

function emptyFeaturedAdsetHistory(isMeta: boolean): DashboardFeaturedAdsetHistory {
  return {
    adset: null,
    dailyTrend: [],
    hourlyTrend: [],
    hourlyTrendExpanded: [],
    platformBreakdowns: {
      state: isMeta ? 'syncing' : 'unsupported',
      publisherPlatforms: [],
      placements: [],
      impressionDevices: [],
    },
    audienceBreakdowns: {
      state: isMeta ? 'syncing' : 'unsupported',
      ageGender: [],
      geo: [],
    },
    dailyHistoryStartDate: null,
    dailyHistoryEndDate: null,
    hourlyHistoryStartDate: null,
    hourlyHistoryEndDate: null,
    hourlyHistoryDate: null,
  };
}

function buildLiveSummary(input: {
  campaigns: DashboardLiveCampaignContainer[];
  adsets: DashboardLiveAdsetItem[];
  ads: DashboardLiveAdItem[];
  servingPlatformLabels: string[];
}): DashboardLiveSummary {
  if (input.campaigns.length === 0) {
    return {
      ...emptySummary(),
      servingPlatformLabels: input.servingPlatformLabels,
    };
  }

  const sourceAds = input.ads.length > 0 ? input.ads : null;
  const sourceAdsets = !sourceAds && input.adsets.length > 0 ? input.adsets : null;
  const spend = sourceAds
    ? sourceAds.reduce((sum, item) => sum + item.spend, 0)
    : sourceAdsets
      ? sourceAdsets.reduce((sum, item) => sum + item.spend, 0)
      : input.campaigns.reduce((sum, item) => sum + item.spend, 0);
  const impressions = sourceAds
    ? sourceAds.reduce((sum, item) => sum + item.impressions, 0)
    : sourceAdsets
      ? sourceAdsets.reduce((sum, item) => sum + item.impressions, 0)
      : input.campaigns.reduce((sum, item) => sum + item.impressions, 0);
  const clicks = sourceAds
    ? sourceAds.reduce((sum, item) => sum + item.clicks, 0)
    : sourceAdsets
      ? sourceAdsets.reduce((sum, item) => sum + item.clicks, 0)
      : input.campaigns.reduce((sum, item) => sum + item.clicks, 0);
  const results = sourceAds
    ? sourceAds.reduce((sum, item) => sum + item.results, 0)
    : sourceAdsets
      ? sourceAdsets.reduce((sum, item) => sum + item.results, 0)
      : input.campaigns.reduce((sum, item) => sum + item.results, 0);

  return {
    liveCampaignCount: input.campaigns.length,
    liveAdsetCount: input.adsets.length,
    liveAdCount: input.ads.length,
    spend: toFixedNumber(spend, 2),
    impressions,
    clicks,
    results,
    ctr: computeCtr(clicks, impressions),
    costPerResult: computeCostPerResult(spend, results),
    primaryOutcomeMetric: 'results',
    primaryOutcomeLabel: 'Results',
    primaryOutcomeValue: results,
    servingPlatformLabels: input.servingPlatformLabels,
  };
}

function buildLiveComparisons(input: {
  adsets: DashboardLiveAdsetItem[];
  ads: DashboardLiveAdItem[];
}): DashboardLiveComparisons {
  const sortedAdsets = sortByPerformance(input.adsets);
  const strongestAdset = sortedAdsets[0] ?? null;
  const strongestAdsetAds = strongestAdset
    ? input.ads.filter((ad) => ad.adsetId === strongestAdset.id)
    : [];
  const adsSource = strongestAdsetAds.length >= 2 ? strongestAdsetAds : input.ads;

  return {
    adsets: sortedAdsets.slice(0, 8),
    ads: sortByPerformance(adsSource).slice(0, 8),
  };
}

function enrichAdsetsWithBreakdowns(input: {
  adsets: DashboardLiveAdsetItem[];
  audienceRows: DashboardAudienceMetricRow[];
}): DashboardLiveAdsetItem[] {
  const topPlatformByAdset = buildEntityTopSliceMap({
    rows: input.audienceRows,
    breakdownType: 'publisher_platform',
    entityLevel: 'adset',
    idField: 'adsetInternalId',
    labelFormatter: formatPublisherPlatformLabel,
  });
  const topPlacementByAdset = buildEntityTopSliceMap({
    rows: input.audienceRows,
    breakdownType: 'platform_position',
    entityLevel: 'adset',
    idField: 'adsetInternalId',
    labelFormatter: formatPlacementLabel,
  });

  return input.adsets.map((adset) => ({
    ...adset,
    topPublisherPlatform:
      (adset.internalId ? topPlatformByAdset.get(adset.internalId) : null) ?? null,
    topPlacement:
      (adset.internalId ? topPlacementByAdset.get(adset.internalId) : null) ?? null,
  }));
}

function enrichAdsWithBreakdowns(input: {
  ads: DashboardLiveAdItem[];
  audienceRows: DashboardAudienceMetricRow[];
}): DashboardLiveAdItem[] {
  const topPlatformByAd = buildEntityTopSliceMap({
    rows: input.audienceRows,
    breakdownType: 'publisher_platform',
    entityLevel: 'ad',
    idField: 'adInternalId',
    labelFormatter: formatPublisherPlatformLabel,
  });
  const topPlacementByAd = buildEntityTopSliceMap({
    rows: input.audienceRows,
    breakdownType: 'platform_position',
    entityLevel: 'ad',
    idField: 'adInternalId',
    labelFormatter: formatPlacementLabel,
  });

  return input.ads.map((ad) => ({
    ...ad,
    topPublisherPlatform: (ad.internalId ? topPlatformByAd.get(ad.internalId) : null) ?? null,
    topPlacement: (ad.internalId ? topPlacementByAd.get(ad.internalId) : null) ?? null,
  }));
}

export function buildDashboardLiveWindow(input: {
  isMeta: boolean;
  campaignRows: ReportBreakdownRow[];
  adsetRows: ReportBreakdownRow[];
  adRows: ReportBreakdownRow[];
  campaignDimensions: DashboardCampaignDimension[];
  adsetDimensions: DashboardAdsetDimension[];
  adDimensions: DashboardAdDimension[];
  audienceRows?: DashboardAudienceMetricRow[];
}): DashboardLiveWindow {
  const campaignRowByExternalId = new Map(input.campaignRows.map((row) => [row.id, row]));
  const adsetRowByExternalId = new Map(input.adsetRows.map((row) => [row.id, row]));
  const campaignDimByExternalId = new Map(
    input.campaignDimensions.map((campaign) => [campaign.externalId, campaign])
  );
  const adsetDimByExternalId = new Map(
    input.adsetDimensions.map((adset) => [adset.externalId, adset])
  );
  const adDimByExternalId = new Map(input.adDimensions.map((ad) => [ad.externalId, ad]));

  const candidateLiveAds: LiveAdSeed[] = [];

  for (const row of input.adRows) {
    if (!isLikelyActiveStatus(row.status) || !hasLiveDeliveryMetrics(row)) {
      continue;
    }

    const adDim = adDimByExternalId.get(row.id);
    const adsetDim = adDim ? adsetDimByExternalId.get(adDim.adsetExternalId) : null;
    const campaignRow = adsetDim
      ? campaignRowByExternalId.get(adsetDim.campaignExternalId) ?? null
      : null;
    const campaignDim = adsetDim
      ? campaignDimByExternalId.get(adsetDim.campaignExternalId) ?? null
      : null;

    if (!adDim || !adsetDim) {
      continue;
    }

    candidateLiveAds.push({
      id: row.id,
      internalId: adDim.internalId,
      adsetId: adsetDim.externalId,
      adsetInternalId: adsetDim.internalId,
      campaignId: adsetDim.campaignExternalId,
      campaignInternalId: campaignDim?.internalId ?? null,
      adsetName: adsetDim.name ?? row.primaryContext ?? null,
      campaignName: campaignRow?.name ?? campaignDim?.name ?? null,
      name: row.name,
      status: row.status ?? adDim.status ?? 'unknown',
      spend: toFixedNumber(row.spend, 2),
      impressions: row.impressions,
      clicks: row.clicks,
      results: potentialCustomersFromRow(row),
      ctr: row.ctr,
      costPerResult: computeCostPerResult(row.spend, potentialCustomersFromRow(row)),
    });
  }

  if (candidateLiveAds.length === 0) {
    return emptyLiveWindow(input.isMeta);
  }

  const candidateAdsetIds = new Set(candidateLiveAds.map((ad) => ad.adsetId));
  const campaignIdsFromActiveAdsets = new Set<string>();

  candidateAdsetIds.forEach((adsetId) => {
    const adsetRow = adsetRowByExternalId.get(adsetId);
    const adsetDim = adsetDimByExternalId.get(adsetId);

    if (!adsetRow || !adsetDim || !isLikelyActiveStatus(adsetRow.status ?? adsetDim.status)) {
      return;
    }

    const campaignRow = campaignRowByExternalId.get(adsetDim.campaignExternalId);
    const campaignDim = campaignDimByExternalId.get(adsetDim.campaignExternalId);

    if (!isLikelyActiveStatus(campaignRow?.status ?? campaignDim?.status)) {
      return;
    }

    campaignIdsFromActiveAdsets.add(adsetDim.campaignExternalId);
  });

  const liveAds = candidateLiveAds.filter((ad) => {
    if (!campaignIdsFromActiveAdsets.has(ad.campaignId ?? '')) {
      return false;
    }

    const adsetRow = adsetRowByExternalId.get(ad.adsetId);
    return isLikelyActiveStatus(adsetRow?.status);
  });

  if (liveAds.length === 0) {
    return emptyLiveWindow(input.isMeta);
  }

  const liveAdsByAdset = new Map<string, LiveAdSeed[]>();

  for (const ad of liveAds) {
    const current = liveAdsByAdset.get(ad.adsetId) ?? [];
    current.push(ad);
    liveAdsByAdset.set(ad.adsetId, current);
  }

  const liveAdsetSeeds: LiveAdsetSeed[] = [];

  for (const [adsetId, ads] of liveAdsByAdset.entries()) {
    const adsetRow = adsetRowByExternalId.get(adsetId);
    const adsetDim = adsetDimByExternalId.get(adsetId);

    if (!adsetRow || !adsetDim) {
      continue;
    }

    const spend = ads.reduce((sum, ad) => sum + ad.spend, 0);
    const impressions = ads.reduce((sum, ad) => sum + ad.impressions, 0);
    const clicks = ads.reduce((sum, ad) => sum + ad.clicks, 0);
    const results = ads.reduce((sum, ad) => sum + ad.results, 0);
    const campaignRow = campaignRowByExternalId.get(adsetDim.campaignExternalId);
    const campaignDim = campaignDimByExternalId.get(adsetDim.campaignExternalId);

    liveAdsetSeeds.push({
      id: adsetId,
      internalId: adsetDim.internalId,
      campaignId: adsetDim.campaignExternalId,
      campaignInternalId: campaignDim?.internalId ?? null,
      campaignName: campaignRow?.name ?? campaignDim?.name ?? null,
      name: adsetRow.name,
      status: adsetRow.status ?? adsetDim.status ?? 'unknown',
      optimizationGoal: adsetDim.optimizationGoal ?? adsetRow.secondaryContext,
      spend: toFixedNumber(spend, 2),
      impressions,
      clicks,
      results,
      ctr: computeCtr(clicks, impressions),
      costPerResult: computeCostPerResult(spend, results),
      adCount: ads.length,
    });
  }

  const adsetAverages = buildPerformanceAverages(liveAdsetSeeds);
  let liveAdsets: DashboardLiveAdsetItem[] = liveAdsetSeeds.map((adset) => ({
    ...adset,
    performanceIndex: computePerformanceIndex({
      spend: adset.spend,
      conversion: adset.results,
      ctr: adset.ctr,
      costPerResult: adset.costPerResult,
      averages: adsetAverages,
    }),
    topPublisherPlatform: null,
    topPlacement: null,
  }));

  const liveCampaignsBase = Array.from(
    liveAdsets.reduce<Map<string, DashboardLiveCampaignContainer>>((map, adset) => {
      const campaignId = adset.campaignId;

      if (!campaignId) {
        return map;
      }

      const campaignRow = campaignRowByExternalId.get(campaignId);
      const campaignDim = campaignDimByExternalId.get(campaignId);
      const current = map.get(campaignId) ?? {
        id: campaignId,
        internalId: campaignDim?.internalId ?? null,
        name: campaignRow?.name ?? campaignDim?.name ?? 'Unnamed campaign',
        status: campaignRow?.status ?? campaignDim?.status ?? 'unknown',
        objective: campaignDim?.objective ?? campaignRow?.secondaryContext ?? null,
        spend: 0,
        impressions: 0,
        clicks: 0,
        results: 0,
        ctr: 0,
        costPerResult: 0,
        adsetCount: 0,
        adCount: 0,
        performanceIndex: 0,
      };
      current.spend += adset.spend;
      current.impressions += adset.impressions;
      current.clicks += adset.clicks;
      current.results += adset.results;
      current.adsetCount += 1;
      current.adCount += adset.adCount;
      map.set(campaignId, current);
      return map;
    }, new Map<string, DashboardLiveCampaignContainer>())
  ).map(([, campaign]) => ({
    ...campaign,
    spend: toFixedNumber(campaign.spend, 2),
    ctr: computeCtr(campaign.clicks, campaign.impressions),
    costPerResult: computeCostPerResult(campaign.spend, campaign.results),
  }));

  const campaignAverages = buildPerformanceAverages(liveCampaignsBase);
  const liveCampaigns = sortByPerformance(
    liveCampaignsBase.map((campaign) => ({
      ...campaign,
      performanceIndex: computePerformanceIndex({
        spend: campaign.spend,
        conversion: campaign.results,
        ctr: campaign.ctr,
        costPerResult: campaign.costPerResult,
        averages: campaignAverages,
      }),
    }))
  );

  const adAverages = buildPerformanceAverages(liveAds);
  let liveAdItems: DashboardLiveAdItem[] = liveAds.map((ad) => ({
    id: ad.id,
    internalId: ad.internalId,
    adsetId: ad.adsetId,
    adsetName: ad.adsetName,
    campaignId: ad.campaignId,
    campaignName: ad.campaignName,
    name: ad.name,
    status: ad.status,
    spend: ad.spend,
    impressions: ad.impressions,
    clicks: ad.clicks,
    results: ad.results,
    ctr: ad.ctr,
    costPerResult: ad.costPerResult,
    performanceIndex: computePerformanceIndex({
      spend: ad.spend,
      conversion: ad.results,
      ctr: ad.ctr,
      costPerResult: ad.costPerResult,
      averages: adAverages,
    }),
    topPublisherPlatform: null,
    topPlacement: null,
  }));

  const audienceRows = input.audienceRows ?? [];
  const platformBreakdowns = buildPlatformBreakdowns({
    isMeta: input.isMeta,
    hasLiveDelivery: liveCampaigns.length > 0,
    audienceRows,
  });
  const audienceBreakdowns = buildAudienceBreakdowns({
    isMeta: input.isMeta,
    hasLiveDelivery: liveCampaigns.length > 0,
    audienceRows,
  });

  if (platformBreakdowns.state === 'available') {
    liveAdsets = enrichAdsetsWithBreakdowns({
      adsets: liveAdsets,
      audienceRows,
    });
    liveAdItems = enrichAdsWithBreakdowns({
      ads: liveAdItems,
      audienceRows,
    });
  }

  const sortedAdsets = sortByPerformance(liveAdsets);
  const sortedAds = sortByPerformance(liveAdItems);
  const comparisons = buildLiveComparisons({
    adsets: sortedAdsets,
    ads: sortedAds,
  });

  return {
    hasLiveDelivery: liveCampaigns.length > 0,
    campaigns: liveCampaigns,
    adsets: sortedAdsets,
    ads: sortedAds,
    summary: buildLiveSummary({
      campaigns: liveCampaigns,
      adsets: sortedAdsets,
      ads: sortedAds,
      servingPlatformLabels: platformBreakdowns.publisherPlatforms
        .slice(0, 3)
        .map((slice) => slice.label),
    }),
    comparisons,
    platformBreakdowns,
    audienceBreakdowns,
  };
}

export function buildDashboardPayload(input: {
  businessName: string;
  selectedPlatformIntegrationId: string | null;
  selectedAdAccountId: string | null;
  platform: PlatformDetails | null;
  adAccount: AdAccountData | null;
  syncCoverage: DashboardPayload['syncCoverage'];
  hasReportMetrics: boolean;
  liveToday?: DashboardLiveWindow | null;
  featuredAdsetHistory?: DashboardFeaturedAdsetHistory | null;
}): DashboardPayload {
  const platformConnected = Boolean(input.platform && input.platform.status === 'connected');
  const lastSyncedAt = input.adAccount?.last_synced ?? input.platform?.lastSyncedAt ?? null;
  const isMeta = input.platform?.vendor === 'meta';
  const adAccountHasMetrics = input.adAccount
    ? hasMeaningfulMetrics(input.adAccount.aggregated_metrics)
    : false;

  const state = resolveDashboardState({
    selectedPlatformId: input.selectedPlatformIntegrationId,
    platformConnected,
    selectedAdAccountId: input.selectedAdAccountId,
    adAccountPresent: Boolean(input.adAccount),
    adAccountHasMetrics: input.hasReportMetrics || adAccountHasMetrics,
  });

  return {
    state,
    selection: {
      selectedPlatformIntegrationId: input.selectedPlatformIntegrationId,
      selectedAdAccountId: input.selectedAdAccountId,
    },
    viewContext: {
      businessName: input.businessName,
      platformName: input.platform?.displayName ?? null,
      platformStatus: input.platform?.status ?? null,
      adAccountName: input.adAccount?.name ?? null,
      adAccountStatus: input.adAccount?.account_status ?? null,
      lastSyncedAt,
      currencyCode: input.adAccount?.currency_code ?? null,
      platformError: input.platform?.lastError ?? null,
      canRefresh: platformConnected,
    },
    liveToday: input.liveToday ?? emptyLiveWindow(isMeta),
    featuredAdsetHistory: input.featuredAdsetHistory ?? emptyFeaturedAdsetHistory(isMeta),
    syncCoverage: input.syncCoverage,
    platform: input.platform,
    adAccount: input.adAccount,
  };
}
