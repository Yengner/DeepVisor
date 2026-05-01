import 'server-only';

import { asNumber, asRecord, asString } from '@/lib/shared';
import type { Json } from '@/lib/shared/types/supabase';
import { fetchMetaAdAccountSnapshots } from '@/lib/server/integrations/adapters/meta';
import { fetchMetaCollection, fetchMetaObject, getBackfillDateRange } from './client';
import type {
  MetaAdAccountPerformanceSeed,
  MetaAdCreativeSeed,
  MetaAudienceBreakdownSeed,
  MetaActionMetric,
  MetaAdPerformanceSeed,
  MetaHourlyPerformanceSeed,
  MetaAdSeed,
  MetaAdsetPerformanceSeed,
  MetaAdsetSeed,
  MetaCampaignPerformanceSeed,
  MetaCampaignSeed,
} from './types';

type MetaCampaignNode = {
  id?: string;
  name?: string;
  objective?: string;
  status?: string;
  effective_status?: string;
  created_time?: string;
  updated_time?: string;
};

type MetaAdsetNode = {
  id?: string;
  campaign_id?: string;
  name?: string;
  optimization_goal?: string;
  status?: string;
  effective_status?: string;
  created_time?: string;
  updated_time?: string;
};

type MetaAdNode = {
  id?: string;
  adset_id?: string;
  name?: string;
  creative?: {
    id?: string;
  };
  status?: string;
  effective_status?: string;
  created_time?: string;
  updated_time?: string;
};

type MetaAdCreativeNode = {
  id?: string;
  name?: string;
  object_type?: string;
  call_to_action_type?: string;
  image_hash?: string;
  image_url?: string;
  thumbnail_url?: string;
  object_story_id?: string;
  object_story_spec?: unknown;
  asset_feed_spec?: unknown;
  instagram_actor_id?: string;
};

type MetaInsightRow = {
  campaign_id?: string;
  adset_id?: string;
  ad_id?: string;
  date_start?: string;
  date_stop?: string;
  hourly_stats_aggregated_by_advertiser_time_zone?: string;
  account_currency?: string;
  spend?: string;
  reach?: string;
  impressions?: string;
  clicks?: string;
  inline_link_clicks?: string;
  ctr?: string;
  cpc?: string;
  cpm?: string;
  actions?: MetaActionMetric[];
  cost_per_action_type?: MetaActionMetric[];
};

type MetaInsightLevel = 'account' | 'campaign' | 'adset' | 'ad';
export type MetaDateRange = {
  since: string;
  until: string;
};

const META_HOURLY_DEBUG_PREFIX = '[meta-hourly-sync]';

const META_INSIGHTS_WINDOW_DAYS_BY_LEVEL: Record<MetaInsightLevel, number> = {
  account: 180,
  campaign: 90,
  adset: 60,
  ad: 30,
};

const INSIGHTS_BREAKDOWNS = new Set([
  'age',
  'country',
  'device_platform',
  'dma',
  'gender',
  'hourly_stats_aggregated_by_advertiser_time_zone',
  'hourly_stats_aggregated_by_audience_time_zone',
  'impression_device',
  'platform_position',
  'publisher_platform',
  'region',
]);

function toJson(value: unknown): Json | null {
  if (value == null) {
    return null;
  }

  return value as Json;
}

function normalizeMetaStatus(value: unknown): string | null {
  const normalized = asString(value).trim();
  return normalized.length > 0 ? normalized.toLowerCase() : null;
}

function firstNonEmptyString(...values: unknown[]): string | null {
  for (const value of values) {
    const normalized = asString(value).trim();
    if (normalized.length > 0) {
      return normalized;
    }
  }

  return null;
}

function extractTextAsset(value: unknown): string | null {
  if (!Array.isArray(value)) {
    return null;
  }

  for (const item of value) {
    const record = asRecord(item);
    const text = firstNonEmptyString(record.text, record.name, record.value);
    if (text) {
      return text;
    }
  }

  return null;
}

function extractUrl(value: unknown): string | null {
  if (typeof value === 'string') {
    return firstNonEmptyString(value);
  }

  const record = asRecord(value);
  return firstNonEmptyString(record.link, record.url, asRecord(record.value).link);
}

function extractCtaType(value: unknown): string | null {
  const record = asRecord(value);
  return firstNonEmptyString(record.type, record.call_to_action_type);
}

function extractActionMetric(
  actions: MetaActionMetric[] | undefined,
  actionTypes: string[]
): number {
  if (!Array.isArray(actions)) {
    return 0;
  }

  let total = 0;

  for (const action of actions) {
    if (!actionTypes.includes(asString(action.action_type))) {
      continue;
    }

    total += asNumber(action.value);
  }

  return total;
}

function chunkStrings(values: string[], size: number): string[][] {
  if (values.length === 0) {
    return [];
  }

  const chunks: string[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
}

function addUtcDays(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function buildDateWindows(input: {
  since: string;
  until: string;
  windowDays: number;
}): Array<{ since: string; until: string }> {
  const windows: Array<{ since: string; until: string }> = [];
  let cursor = input.since;

  while (cursor <= input.until) {
    const candidateEnd = addUtcDays(cursor, Math.max(input.windowDays - 1, 0));
    const until = candidateEnd < input.until ? candidateEnd : input.until;

    windows.push({
      since: cursor,
      until,
    });

    cursor = addUtcDays(until, 1);
  }

  return windows;
}

function sanitizeInsightsFields(fields: string[]): string[] {
  const sanitized: string[] = [];
  const seen = new Set<string>();

  for (const field of fields) {
    const normalized = field.trim();
    if (!normalized || INSIGHTS_BREAKDOWNS.has(normalized) || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    sanitized.push(normalized);
  }

  return sanitized;
}

async function fetchMetaInsightsRows(input: {
  accessToken: string;
  adAccountExternalId: string;
  backfillDays?: number;
  dateRange?: MetaDateRange;
  level: MetaInsightLevel;
  fields: string[];
  params?: Record<string, string | number | boolean | undefined>;
}): Promise<MetaInsightRow[]> {
  const range = input.dateRange ?? getBackfillDateRange(input.backfillDays ?? 30);
  const sanitizedFields = sanitizeInsightsFields(input.fields);
  const windows = buildDateWindows({
    since: range.since,
    until: range.until,
    windowDays: META_INSIGHTS_WINDOW_DAYS_BY_LEVEL[input.level],
  });
  const rows: MetaInsightRow[] = [];

  for (const window of windows) {
    const insights = await fetchMetaCollection<MetaInsightRow>({
      path: `${input.adAccountExternalId}/insights`,
      accessToken: input.accessToken,
      params: {
        level: input.level,
        time_increment: '1',
        time_range: JSON.stringify(window),
        fields: sanitizedFields.join(','),
        limit: 500,
        ...(input.params ?? {}),
      },
    });

    rows.push(...insights);
  }

  return rows;
}

function normalizeMetaAdCreativeSeed(creative: MetaAdCreativeNode): MetaAdCreativeSeed | null {
  const externalId = asString(creative.id);
  if (!externalId) {
    return null;
  }

  const objectStorySpec = asRecord(creative.object_story_spec);
  const linkData = asRecord(objectStorySpec.link_data);
  const videoData = asRecord(objectStorySpec.video_data);
  const photoData = asRecord(objectStorySpec.photo_data);
  const templateData = asRecord(objectStorySpec.template_data);
  const assetFeedSpec = asRecord(creative.asset_feed_spec);

  const primaryText = firstNonEmptyString(
    linkData.message,
    videoData.message,
    photoData.message,
    templateData.message,
    extractTextAsset(assetFeedSpec.bodies)
  );
  const headline = firstNonEmptyString(
    linkData.name,
    videoData.title,
    photoData.caption,
    templateData.name,
    extractTextAsset(assetFeedSpec.titles)
  );
  const description = firstNonEmptyString(
    linkData.description,
    templateData.description,
    videoData.description,
    extractTextAsset(assetFeedSpec.descriptions)
  );
  const linkUrl = firstNonEmptyString(
    extractUrl(linkData.link),
    extractUrl(templateData.link),
    extractUrl(asRecord(linkData.call_to_action).value),
    extractUrl(asRecord(videoData.call_to_action).value),
    extractUrl(Array.isArray(assetFeedSpec.link_urls) ? assetFeedSpec.link_urls[0] : null)
  );
  const videoId = firstNonEmptyString(videoData.video_id);
  const pageId = firstNonEmptyString(objectStorySpec.page_id);
  const instagramActorId = firstNonEmptyString(
    creative.instagram_actor_id,
    objectStorySpec.instagram_actor_id
  );
  const ctaType = firstNonEmptyString(
    creative.call_to_action_type,
    extractCtaType(linkData.call_to_action),
    extractCtaType(videoData.call_to_action)
  );
  const creativeType = firstNonEmptyString(
    creative.object_type,
    Array.isArray(linkData.child_attachments) && linkData.child_attachments.length > 1
      ? 'carousel'
      : null,
    videoId ? 'video' : null,
    creative.image_url || creative.image_hash ? 'image' : null
  );

  return {
    externalId,
    name: firstNonEmptyString(creative.name),
    creativeType,
    ctaType,
    primaryText,
    headline,
    description,
    linkUrl,
    imageUrl: firstNonEmptyString(creative.image_url, photoData.url),
    imageHash: firstNonEmptyString(creative.image_hash),
    thumbnailUrl: firstNonEmptyString(creative.thumbnail_url),
    videoId,
    pageId,
    instagramActorId,
    objectStoryId: firstNonEmptyString(creative.object_story_id),
    objectStorySpec: toJson(creative.object_story_spec),
    assetFeedSpec: toJson(creative.asset_feed_spec),
    raw: toJson(creative),
  } satisfies MetaAdCreativeSeed;
}

function normalizeInsightMetrics(row: MetaInsightRow) {
  const directInlineLinkClicks = asNumber(row.inline_link_clicks);

  return {
    day: asString(row.date_start),
    currencyCode: asString(row.account_currency) || null,
    spend: asNumber(row.spend),
    reach: asNumber(row.reach),
    impressions: asNumber(row.impressions),
    clicks: asNumber(row.clicks),
    inlineLinkClicks:
      directInlineLinkClicks > 0
        ? directInlineLinkClicks
        : extractActionMetric(row.actions, ['link_click', 'inline_link_click']),
    leads: extractActionMetric(row.actions, [
      'onsite_conversion.lead_grouped',
      'lead',
      'offsite_conversion.fb_pixel_lead',
    ]),
    messages: extractActionMetric(row.actions, [
      'onsite_conversion.total_messaging_connection',
      'onsite_conversion.messaging_first_reply',
    ]),
    calls: extractActionMetric(row.actions, [
      'onsite_conversion.phone_call_click',
      'phone_call',
      'click_to_call',
    ]),
  };
}

function computeCtr(clicks: number, impressions: number): number {
  if (impressions <= 0) {
    return 0;
  }

  return Number((((clicks / impressions) * 100) || 0).toFixed(6));
}

function computeCpc(spend: number, clicks: number): number {
  if (clicks <= 0) {
    return 0;
  }

  return Number((spend / clicks).toFixed(6));
}

function computeCpm(spend: number, impressions: number): number {
  if (impressions <= 0) {
    return 0;
  }

  return Number(((spend / impressions) * 1000).toFixed(6));
}

function parseAdvertiserHourBucket(bucket: string): number | null {
  const match = bucket.trim().match(/^(\d{2}):00:00\s*-\s*(\d{2}):59:59$/);

  if (!match) {
    return null;
  }

  const startHour = Number.parseInt(match[1], 10);
  const endHour = Number.parseInt(match[2], 10);

  if (!Number.isFinite(startHour) || startHour < 0 || startHour > 23) {
    return null;
  }

  if (!Number.isFinite(endHour) || endHour !== startHour) {
    return null;
  }

  return startHour;
}

function resolveIsoDayOfWeek(day: string): number | null {
  const date = new Date(`${day}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return (date.getUTCDay() + 6) % 7;
}

function resolveIsoWeekStart(day: string): string | null {
  const date = new Date(`${day}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const isoDayOfWeek = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - isoDayOfWeek);
  return date.toISOString().slice(0, 10);
}

type MetaAudienceBreakdownConfig = {
  breakdownType: string;
  breakdowns: string;
  dimension1Key: string;
  dimension2Key?: string;
};

const META_AUDIENCE_BREAKDOWN_CONFIGS: MetaAudienceBreakdownConfig[] = [
  {
    breakdownType: 'publisher_platform',
    breakdowns: 'publisher_platform',
    dimension1Key: 'publisher_platform',
  },
  {
    breakdownType: 'platform_position',
    breakdowns: 'platform_position',
    dimension1Key: 'platform_position',
  },
  {
    breakdownType: 'age_gender',
    breakdowns: 'age,gender',
    dimension1Key: 'age',
    dimension2Key: 'gender',
  },
  {
    breakdownType: 'country',
    breakdowns: 'country',
    dimension1Key: 'country',
  },
  {
    breakdownType: 'region',
    breakdowns: 'region',
    dimension1Key: 'region',
  },
  {
    breakdownType: 'impression_device',
    breakdowns: 'impression_device',
    dimension1Key: 'impression_device',
  },
  {
    breakdownType: 'dma',
    breakdowns: 'dma',
    dimension1Key: 'dma',
  },
];

const META_PLACEMENT_BREAKDOWN_TYPES = new Set([
  'publisher_platform',
  'platform_position',
  'impression_device',
  'device_platform',
]);

function isPlacementBreakdown(breakdownType: string): boolean {
  return META_PLACEMENT_BREAKDOWN_TYPES.has(breakdownType);
}

function getInsightsFieldsForBreakdown(config: MetaAudienceBreakdownConfig): string[] {
  const deliveryFields = [
    'campaign_id',
    'ad_id',
    'adset_id',
    'date_start',
    'date_stop',
    'account_currency',
    'spend',
    'impressions',
    'clicks',
    'inline_link_clicks',
    'ctr',
    'cpc',
    'cpm',
  ];

  if (isPlacementBreakdown(config.breakdownType)) {
    return deliveryFields;
  }

  return [...deliveryFields, 'reach', 'actions', 'cost_per_action_type'];
}

export { fetchMetaAdAccountSnapshots };

export async function fetchMetaAdAccountPerformanceSeeds(input: {
  accessToken: string;
  adAccountExternalId: string;
  backfillDays?: number;
  dateRange?: MetaDateRange;
}): Promise<MetaAdAccountPerformanceSeed[]> {
  const insights = await fetchMetaInsightsRows({
    accessToken: input.accessToken,
    adAccountExternalId: input.adAccountExternalId,
    backfillDays: input.backfillDays,
    dateRange: input.dateRange,
    level: 'account',
    fields: [
      'date_start',
      'account_currency',
      'spend',
      'reach',
      'impressions',
      'clicks',
      'actions',
    ],
  });

  return insights
    .map((row) => {
      const metrics = normalizeInsightMetrics(row);

      if (!metrics.day) {
        return null;
      }

      return {
        day: metrics.day,
        currencyCode: metrics.currencyCode,
        spend: metrics.spend,
        reach: metrics.reach,
        impressions: metrics.impressions,
        clicks: metrics.clicks,
        inlineLinkClicks: metrics.inlineLinkClicks,
        leads: metrics.leads,
        messages: metrics.messages,
      } satisfies MetaAdAccountPerformanceSeed;
    })
    .filter((row): row is MetaAdAccountPerformanceSeed => row !== null);
}

export async function fetchMetaCampaignSeeds(input: {
  accessToken: string;
  adAccountExternalId: string;
}): Promise<MetaCampaignSeed[]> {
  const campaigns = await fetchMetaCollection<MetaCampaignNode>({
    path: `${input.adAccountExternalId}/campaigns`,
    accessToken: input.accessToken,
    params: {
      fields: [
        'id',
        'name',
        'objective',
        'status',
        'effective_status',
        'created_time',
        'updated_time',
      ].join(','),
      limit: 200,
    },
  });

  return campaigns
    .map((campaign) => {
      const externalId = asString(campaign.id);
      if (!externalId) {
        return null;
      }

      return {
        externalId,
        name: asString(campaign.name) || null,
        objective: asString(campaign.objective) || null,
        status: normalizeMetaStatus(campaign.effective_status ?? campaign.status),
        createdTime: asString(campaign.created_time) || null,
        updatedTime: asString(campaign.updated_time) || null,
        raw: toJson(campaign),
      } satisfies MetaCampaignSeed;
    })
    .filter((campaign): campaign is MetaCampaignSeed => campaign !== null);
}

export async function fetchMetaAdsetSeeds(input: {
  accessToken: string;
  adAccountExternalId: string;
}): Promise<MetaAdsetSeed[]> {
  const adsets = await fetchMetaCollection<MetaAdsetNode>({
    path: `${input.adAccountExternalId}/adsets`,
    accessToken: input.accessToken,
    params: {
      fields: [
        'id',
        'campaign_id',
        'name',
        'optimization_goal',
        'status',
        'effective_status',
        'created_time',
        'updated_time',
      ].join(','),
      limit: 200,
    },
  });

  return adsets
    .map((adset) => {
      const externalId = asString(adset.id);
      if (!externalId) {
        return null;
      }

      return {
        externalId,
        campaignExternalId: asString(adset.campaign_id) || null,
        name: asString(adset.name) || null,
        optimizationGoal: asString(adset.optimization_goal) || null,
        status: normalizeMetaStatus(adset.effective_status ?? adset.status),
        createdTime: asString(adset.created_time) || null,
        updatedTime: asString(adset.updated_time) || null,
        raw: toJson(adset),
      } satisfies MetaAdsetSeed;
    })
    .filter((adset): adset is MetaAdsetSeed => adset !== null);
}

export async function fetchMetaAdSeeds(input: {
  accessToken: string;
  adAccountExternalId: string;
}): Promise<MetaAdSeed[]> {
  const ads = await fetchMetaCollection<MetaAdNode>({
    path: `${input.adAccountExternalId}/ads`,
    accessToken: input.accessToken,
    params: {
      fields: [
        'id',
        'adset_id',
        'name',
        'creative{id}',
        'status',
        'effective_status',
        'created_time',
        'updated_time',
      ].join(','),
      limit: 200,
    },
  });

  return ads
    .map((ad) => {
      const externalId = asString(ad.id);
      if (!externalId) {
        return null;
      }

      const creative = asRecord(ad.creative);

      return {
        externalId,
        adsetExternalId: asString(ad.adset_id) || null,
        name: asString(ad.name) || null,
        creativeId: asString(creative.id) || null,
        status: normalizeMetaStatus(ad.effective_status ?? ad.status),
        createdTime: asString(ad.created_time) || null,
        updatedTime: asString(ad.updated_time) || null,
        raw: toJson(ad),
      } satisfies MetaAdSeed;
    })
    .filter((ad): ad is MetaAdSeed => ad !== null);
}

export async function fetchMetaAdCreativeSeeds(input: {
  accessToken: string;
  adAccountExternalId: string;
  creativeExternalIds?: string[];
}): Promise<MetaAdCreativeSeed[]> {
  const fields = [
    'id',
    'name',
    'object_type',
    'call_to_action_type',
    'image_hash',
    'image_url',
    'thumbnail_url',
    'object_story_id',
    'object_story_spec',
    'asset_feed_spec',
    'instagram_actor_id',
  ].join(',');

  const scopedCreativeIds = Array.from(
    new Set(
      (input.creativeExternalIds ?? [])
        .map((creativeId) => asString(creativeId).trim())
        .filter((creativeId) => creativeId.length > 0)
    )
  );

  if (scopedCreativeIds.length > 0) {
    const creatives: MetaAdCreativeNode[] = [];

    for (const creativeIdsChunk of chunkStrings(scopedCreativeIds, 10)) {
      const chunkResults = await Promise.all(
        creativeIdsChunk.map(async (creativeId) => {
          try {
            return await fetchMetaObject<MetaAdCreativeNode>({
              path: creativeId,
              accessToken: input.accessToken,
              params: {
                fields,
              },
            });
          } catch (error) {
            console.warn(
              `Skipping Meta creative ${creativeId} for ad account ${input.adAccountExternalId}:`,
              error
            );
            return null;
          }
        })
      );

      creatives.push(...chunkResults.filter((creative): creative is MetaAdCreativeNode => creative !== null));
    }

    return creatives
      .map(normalizeMetaAdCreativeSeed)
      .filter((creative): creative is MetaAdCreativeSeed => creative !== null);
  }

  const creatives = await fetchMetaCollection<MetaAdCreativeNode>({
    path: `${input.adAccountExternalId}/adcreatives`,
    accessToken: input.accessToken,
    params: {
      fields,
      limit: 200,
    },
  });

  return creatives
    .map(normalizeMetaAdCreativeSeed)
    .filter((creative): creative is MetaAdCreativeSeed => creative !== null);
}

export async function fetchMetaCampaignPerformanceSeeds(input: {
  accessToken: string;
  adAccountExternalId: string;
  backfillDays?: number;
  dateRange?: MetaDateRange;
}): Promise<MetaCampaignPerformanceSeed[]> {
  const insights = await fetchMetaInsightsRows({
    accessToken: input.accessToken,
    adAccountExternalId: input.adAccountExternalId,
    backfillDays: input.backfillDays,
    dateRange: input.dateRange,
    level: 'campaign',
    fields: [
      'campaign_id',
      'date_start',
      'account_currency',
      'spend',
      'reach',
      'impressions',
      'clicks',
      'actions',
    ],
  });

  return insights
    .map((row) => {
      const campaignExternalId = asString(row.campaign_id);
      const metrics = normalizeInsightMetrics(row);

      if (!campaignExternalId || !metrics.day) {
        return null;
      }

      return {
        campaignExternalId,
        ...metrics,
      } satisfies MetaCampaignPerformanceSeed;
    })
    .filter((row): row is MetaCampaignPerformanceSeed => row !== null);
}

export async function fetchMetaAdsetPerformanceSeeds(input: {
  accessToken: string;
  adAccountExternalId: string;
  backfillDays?: number;
  dateRange?: MetaDateRange;
}): Promise<MetaAdsetPerformanceSeed[]> {
  const insights = await fetchMetaInsightsRows({
    accessToken: input.accessToken,
    adAccountExternalId: input.adAccountExternalId,
    backfillDays: input.backfillDays,
    dateRange: input.dateRange,
    level: 'adset',
    fields: [
      'adset_id',
      'date_start',
      'account_currency',
      'spend',
      'reach',
      'impressions',
      'clicks',
      'actions',
    ],
  });

  return insights
    .map((row) => {
      const adsetExternalId = asString(row.adset_id);
      const metrics = normalizeInsightMetrics(row);

      if (!adsetExternalId || !metrics.day) {
        return null;
      }

      return {
        adsetExternalId,
        ...metrics,
      } satisfies MetaAdsetPerformanceSeed;
    })
    .filter((row): row is MetaAdsetPerformanceSeed => row !== null);
}

export async function fetchMetaAdPerformanceSeeds(input: {
  accessToken: string;
  adAccountExternalId: string;
  backfillDays?: number;
  dateRange?: MetaDateRange;
}): Promise<MetaAdPerformanceSeed[]> {
  const insights = await fetchMetaInsightsRows({
    accessToken: input.accessToken,
    adAccountExternalId: input.adAccountExternalId,
    backfillDays: input.backfillDays,
    dateRange: input.dateRange,
    level: 'ad',
    fields: [
      'ad_id',
      'date_start',
      'account_currency',
      'spend',
      'reach',
      'impressions',
      'clicks',
      'actions',
    ],
  });

  return insights
    .map((row) => {
      const adExternalId = asString(row.ad_id);
      const metrics = normalizeInsightMetrics(row);

      if (!adExternalId || !metrics.day) {
        return null;
      }

      return {
        adExternalId,
        ...metrics,
      } satisfies MetaAdPerformanceSeed;
    })
    .filter((row): row is MetaAdPerformanceSeed => row !== null);
}

export async function fetchMetaAdsetAudienceBreakdownSeeds(input: {
  accessToken: string;
  adAccountExternalId: string;
  backfillDays?: number;
  dateRange?: MetaDateRange;
}): Promise<MetaAudienceBreakdownSeed[]> {
  return fetchMetaAudienceBreakdownSeedsByLevel({
    ...input,
    level: 'adset',
  });
}

export async function fetchMetaAdAudienceBreakdownSeeds(input: {
  accessToken: string;
  adAccountExternalId: string;
  backfillDays?: number;
  dateRange?: MetaDateRange;
}): Promise<MetaAudienceBreakdownSeed[]> {
  return fetchMetaAudienceBreakdownSeedsByLevel({
    ...input,
    level: 'ad',
  });
}

export async function fetchMetaAdsetHourlyPerformanceSeeds(input: {
  accessToken: string;
  adAccountExternalId: string;
  backfillDays?: number;
  dateRange?: MetaDateRange;
}): Promise<MetaHourlyPerformanceSeed[]> {
  return fetchMetaHourlyPerformanceSeedsByLevel({
    ...input,
    level: 'adset',
  });
}

export async function fetchMetaAdHourlyPerformanceSeeds(input: {
  accessToken: string;
  adAccountExternalId: string;
  backfillDays?: number;
  dateRange?: MetaDateRange;
}): Promise<MetaHourlyPerformanceSeed[]> {
  return fetchMetaHourlyPerformanceSeedsByLevel({
    ...input,
    level: 'ad',
  });
}

async function fetchMetaAudienceBreakdownSeedsByLevel(input: {
  accessToken: string;
  adAccountExternalId: string;
  backfillDays?: number;
  dateRange?: MetaDateRange;
  level: 'adset' | 'ad';
}): Promise<MetaAudienceBreakdownSeed[]> {
  const rows: MetaAudienceBreakdownSeed[] = [];

  for (const config of META_AUDIENCE_BREAKDOWN_CONFIGS) {
    try {
      const insights = await fetchMetaInsightsRows({
        accessToken: input.accessToken,
        adAccountExternalId: input.adAccountExternalId,
        backfillDays: input.backfillDays,
        dateRange: input.dateRange,
        level: input.level,
        fields: getInsightsFieldsForBreakdown(config),
        params: {
          breakdowns: config.breakdowns,
        },
      });

      for (const row of insights) {
        const adsetExternalId = asString(row.adset_id);
        const adExternalId = asString(row.ad_id) || null;
        const day = asString(row.date_start);
        const dimension1Value = asString(
          asRecord(row)[config.dimension1Key]
        ).trim();
        const dimension2Value = asString(
          config.dimension2Key ? asRecord(row)[config.dimension2Key] : ''
        ).trim();
        const metrics = normalizeInsightMetrics(row);
        const entityExternalId = input.level === 'ad' ? adExternalId : adsetExternalId;

        if (!adsetExternalId || !entityExternalId || !day || !dimension1Value) {
          continue;
        }

        rows.push({
          entityLevel: input.level,
          entityExternalId,
          adsetExternalId,
          adExternalId,
          campaignExternalId: asString(row.campaign_id) || null,
          day,
          breakdownType: config.breakdownType,
          dimension1Key: config.dimension1Key,
          dimension1Value,
          dimension2Key: config.dimension2Key ?? '',
          dimension2Value,
          publisherPlatform:
            config.breakdownType === 'publisher_platform' ? dimension1Value : null,
          platformPosition:
            config.breakdownType === 'platform_position' ? dimension1Value : null,
          impressionDevice:
            config.breakdownType === 'impression_device' ? dimension1Value : null,
          currencyCode: metrics.currencyCode,
          spend: metrics.spend,
          reach: metrics.reach,
          impressions: metrics.impressions,
          clicks: metrics.clicks,
          inlineLinkClicks: metrics.inlineLinkClicks,
          leads: metrics.leads,
          messages: metrics.messages,
          calls: metrics.calls,
          actions: toJson(row.actions ?? []) ?? [],
          costPerActionType: toJson(row.cost_per_action_type ?? []) ?? [],
          raw: toJson(row),
        } satisfies MetaAudienceBreakdownSeed);
      }
    } catch (error) {
      console.warn(
        `Skipping Meta audience breakdown "${config.breakdownType}" at ${input.level} level for ${input.adAccountExternalId}:`,
        error
      );
    }
  }

  return rows;
}

async function fetchMetaHourlyPerformanceSeedsByLevel(input: {
  accessToken: string;
  adAccountExternalId: string;
  backfillDays?: number;
  dateRange?: MetaDateRange;
  level: 'adset' | 'ad';
}): Promise<MetaHourlyPerformanceSeed[]> {
  const fields = [
    'campaign_id',
    'ad_id',
    'adset_id',
    'date_start',
    'date_stop',
    'account_currency',
    'spend',
    'reach',
    'impressions',
    'clicks',
    'inline_link_clicks',
    'cpc',
    'ctr',
    'cpm',
    'actions',
    'cost_per_action_type',
  ];

  console.info(`${META_HOURLY_DEBUG_PREFIX} fetch:start`, {
    adAccountExternalId: input.adAccountExternalId,
    level: input.level,
    dateRange: input.dateRange ?? null,
    backfillDays: input.backfillDays ?? null,
    fields,
  });

  let insights: MetaInsightRow[];

  try {
    insights = await fetchMetaInsightsRows({
      accessToken: input.accessToken,
      adAccountExternalId: input.adAccountExternalId,
      backfillDays: input.backfillDays,
      dateRange: input.dateRange,
      level: input.level,
      fields,
      params: {
        breakdowns: 'hourly_stats_aggregated_by_advertiser_time_zone',
      },
    });
  } catch (error) {
    console.error(`${META_HOURLY_DEBUG_PREFIX} fetch:error`, {
      adAccountExternalId: input.adAccountExternalId,
      level: input.level,
      dateRange: input.dateRange ?? null,
      backfillDays: input.backfillDays ?? null,
      message: error instanceof Error ? error.message : 'Unknown hourly fetch error',
    });
    throw error;
  }

  const rows: MetaHourlyPerformanceSeed[] = [];
  const skipped = {
    missingAdsetExternalId: 0,
    missingEntityExternalId: 0,
    missingDay: 0,
    missingBucket: 0,
    invalidHourBucket: 0,
    invalidDayOfWeek: 0,
    invalidWeekStart: 0,
  };
  const invalidBucketSamples = new Set<string>();

  for (const row of insights) {
    const adsetExternalId = asString(row.adset_id);
    const adExternalId = asString(row.ad_id) || null;
    const entityExternalId = input.level === 'ad' ? adExternalId : adsetExternalId;
    const day = asString(row.date_start);
    const advertiserTimeBucket = asString(
      row.hourly_stats_aggregated_by_advertiser_time_zone
    ).trim();
    const hourOfDay = parseAdvertiserHourBucket(advertiserTimeBucket);
    const dayOfWeek = day ? resolveIsoDayOfWeek(day) : null;
    const weekStart = day ? resolveIsoWeekStart(day) : null;
    const metrics = normalizeInsightMetrics(row);

    if (!adsetExternalId) {
      skipped.missingAdsetExternalId += 1;
      continue;
    }

    if (!entityExternalId) {
      skipped.missingEntityExternalId += 1;
      continue;
    }

    if (!day) {
      skipped.missingDay += 1;
      continue;
    }

    if (!advertiserTimeBucket) {
      skipped.missingBucket += 1;
      continue;
    }

    if (hourOfDay == null) {
      skipped.invalidHourBucket += 1;
      if (invalidBucketSamples.size < 5) {
        invalidBucketSamples.add(advertiserTimeBucket);
      }
      continue;
    }

    if (dayOfWeek == null) {
      skipped.invalidDayOfWeek += 1;
      continue;
    }

    if (!weekStart) {
      skipped.invalidWeekStart += 1;
      continue;
    }

    rows.push({
      entityLevel: input.level,
      entityExternalId,
      adsetExternalId,
      adExternalId,
      campaignExternalId: asString(row.campaign_id) || null,
      day,
      weekStart,
      dayOfWeek,
      hourOfDay,
      advertiserTimeBucket,
      timeBasis: 'advertiser',
      currencyCode: metrics.currencyCode,
      spend: metrics.spend,
      reach: metrics.reach,
      impressions: metrics.impressions,
      clicks: metrics.clicks,
      inlineLinkClicks: metrics.inlineLinkClicks,
      leads: metrics.leads,
      messages: metrics.messages,
      calls: metrics.calls,
      ctr: asNumber(row.ctr) || computeCtr(metrics.clicks, metrics.impressions),
      cpc: asNumber(row.cpc) || computeCpc(metrics.spend, metrics.clicks),
      cpm: asNumber(row.cpm) || computeCpm(metrics.spend, metrics.impressions),
      actions: (toJson(row.actions ?? []) ?? []) as Json,
      costPerActionType: (toJson(row.cost_per_action_type ?? []) ?? []) as Json,
      raw: toJson(row),
    });
  }

  console.info(`${META_HOURLY_DEBUG_PREFIX} fetch:result`, {
    adAccountExternalId: input.adAccountExternalId,
    level: input.level,
    fetchedRows: insights.length,
    normalizedRows: rows.length,
    skipped,
    invalidBucketSamples: Array.from(invalidBucketSamples),
    firstDay: rows[0]?.day ?? null,
    lastDay: rows[rows.length - 1]?.day ?? null,
  });

  return rows;
}
