

import type { DashboardAudienceBreakdowns, DashboardAudienceMetricRow, DashboardAudienceSlice, DashboardPlatformBreakdowns, DashboardPlatformSlice } from './types';

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
