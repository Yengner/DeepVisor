import 'server-only';

import { asNumber, asRecord, asString } from '@/lib/shared';
import type { Json } from '@/lib/shared/types/supabase';
import { fetchMetaAdAccountSnapshots } from '@/lib/server/integrations/adapters/meta';
import { fetchMetaCollection, getBackfillDateRange } from './client';
import type {
  MetaAdAccountPerformanceSeed,
  MetaActionMetric,
  MetaAdPerformanceSeed,
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

type MetaInsightRow = {
  campaign_id?: string;
  adset_id?: string;
  ad_id?: string;
  date_start?: string;
  account_currency?: string;
  spend?: string;
  reach?: string;
  impressions?: string;
  clicks?: string;
  actions?: MetaActionMetric[];
};

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

function normalizeInsightMetrics(row: MetaInsightRow) {
  return {
    day: asString(row.date_start),
    currencyCode: asString(row.account_currency) || null,
    spend: asNumber(row.spend),
    reach: asNumber(row.reach),
    impressions: asNumber(row.impressions),
    clicks: asNumber(row.clicks),
    inlineLinkClicks: extractActionMetric(row.actions, ['link_click', 'inline_link_click']),
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

export { fetchMetaAdAccountSnapshots };

export async function fetchMetaAdAccountPerformanceSeeds(input: {
  accessToken: string;
  adAccountExternalId: string;
  backfillDays: number;
}): Promise<MetaAdAccountPerformanceSeed[]> {
  const insights = await fetchMetaCollection<MetaInsightRow>({
    path: `${input.adAccountExternalId}/insights`,
    accessToken: input.accessToken,
    params: {
      level: 'account',
      time_increment: '1',
      time_range: JSON.stringify(getBackfillDateRange(input.backfillDays)),
      fields: [
        'date_start',
        'account_currency',
        'spend',
        'reach',
        'impressions',
        'clicks',
        'actions',
      ].join(','),
      limit: 500,
    },
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

export async function fetchMetaCampaignPerformanceSeeds(input: {
  accessToken: string;
  adAccountExternalId: string;
  backfillDays: number;
}): Promise<MetaCampaignPerformanceSeed[]> {
  const insights = await fetchMetaCollection<MetaInsightRow>({
    path: `${input.adAccountExternalId}/insights`,
    accessToken: input.accessToken,
    params: {
      level: 'campaign',
      time_increment: '1',
      time_range: JSON.stringify(getBackfillDateRange(input.backfillDays)),
      fields: [
        'campaign_id',
        'date_start',
        'account_currency',
        'spend',
        'reach',
        'impressions',
        'clicks',
        'actions',
      ].join(','),
      limit: 500,
    },
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
  backfillDays: number;
}): Promise<MetaAdsetPerformanceSeed[]> {
  const insights = await fetchMetaCollection<MetaInsightRow>({
    path: `${input.adAccountExternalId}/insights`,
    accessToken: input.accessToken,
    params: {
      level: 'adset',
      time_increment: '1',
      time_range: JSON.stringify(getBackfillDateRange(input.backfillDays)),
      fields: [
        'adset_id',
        'date_start',
        'account_currency',
        'spend',
        'reach',
        'impressions',
        'clicks',
        'actions',
      ].join(','),
      limit: 500,
    },
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
  backfillDays: number;
}): Promise<MetaAdPerformanceSeed[]> {
  const insights = await fetchMetaCollection<MetaInsightRow>({
    path: `${input.adAccountExternalId}/insights`,
    accessToken: input.accessToken,
    params: {
      level: 'ad',
      time_increment: '1',
      time_range: JSON.stringify(getBackfillDateRange(input.backfillDays)),
      fields: [
        'ad_id',
        'date_start',
        'account_currency',
        'spend',
        'reach',
        'impressions',
        'clicks',
        'actions',
      ].join(','),
      limit: 500,
    },
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
