import { createSupabaseClient } from '@/lib/server/supabase/server';
import { formatDisplayDate } from '@/lib/shared';
import type { Database } from '@/lib/shared/types/supabase';
import { asRecord, asString } from '@/lib/shared/utils/format';
import { derivePerformanceMetrics } from '../campaigns/normalizers';
import { chunkArray } from '../utils';

type SupabaseClient = Awaited<ReturnType<typeof createSupabaseClient>>;

type AdDimRow = Pick<
  Database['public']['Tables']['ad_dims']['Row'],
  'id' | 'external_id' | 'adset_external_id' | 'name' | 'creative_id' | 'status' | 'raw' | 'created_time'
>;

type AdPerformanceRow = Pick<
  Database['public']['Tables']['ad_performance_summary']['Row'],
  | 'ad_id'
  | 'spend'
  | 'reach'
  | 'impressions'
  | 'clicks'
  | 'inline_link_clicks'
  | 'leads'
  | 'messages'
  | 'first_day'
  | 'last_day'
>;

type AdsetLookupRow = Pick<
  Database['public']['Tables']['adset_dims']['Row'],
  'external_id' | 'campaign_external_id' | 'name'
>;

type CampaignLookupRow = Pick<
  Database['public']['Tables']['campaign_dims']['Row'],
  'external_id' | 'name'
>;

type AdsetDebugLookupRow = Pick<
  Database['public']['Tables']['adset_dims']['Row'],
  'id' | 'external_id' | 'campaign_external_id' | 'name'
>;

export interface AdLifetimeRow {
  id: string;
  ad_id: string;
  name: string;
  status: string;
  creative_id: string | null;
  adset_id: string;
  adset_name: string;
  campaign_id: string;
  campaign_name: string;
  clicks: number;
  impressions: number;
  spend: string;
  leads: number;
  reach: number;
  link_clicks: number;
  messages: number;
  cpm: string | null;
  ctr: string | null;
  cpc: string | null;
  cpl: string | null;
  frequency: string | null;
  start_date: string;
  end_date: string;
  platform_name: 'meta' | 'google' | 'tiktok';
  raw_data: Database['public']['Tables']['ad_dims']['Row']['raw'];
  ad_format: string | null;
}

async function listAdDims(input: {
  supabase: SupabaseClient;
  adAccountId: string;
  adsetExternalId?: string;
  adExternalId?: string;
}): Promise<AdDimRow[]> {
  let query = input.supabase
    .from('ad_dims')
    .select('id, external_id, adset_external_id, name, creative_id, status, raw, created_time')
    .eq('ad_account_id', input.adAccountId);

  if (input.adsetExternalId) {
    query = query.eq('adset_external_id', input.adsetExternalId);
  }

  if (input.adExternalId) {
    query = query.eq('external_id', input.adExternalId);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return (data ?? []) as AdDimRow[];
}

async function listAdPerformanceRows(input: {
  supabase: SupabaseClient;
  adIds: string[];
}): Promise<AdPerformanceRow[]> {
  const rows: AdPerformanceRow[] = [];

  for (const adIdsChunk of chunkArray(input.adIds, 200)) {
    const { data, error } = await input.supabase
      .from('ad_performance_summary')
      .select(
        'ad_id, spend, reach, impressions, clicks, inline_link_clicks, leads, messages, first_day, last_day'
      )
      .in('ad_id', adIdsChunk);

    if (error) {
      throw error;
    }

    rows.push(...((data ?? []) as AdPerformanceRow[]));
  }

  return rows;
}

async function listAdsetLookups(input: {
  supabase: SupabaseClient;
  adAccountId: string;
  adsetExternalIds: string[];
}): Promise<Map<string, AdsetLookupRow>> {
  const rowsByExternalId = new Map<string, AdsetLookupRow>();

  for (const adsetExternalIdsChunk of chunkArray(input.adsetExternalIds, 200)) {
    const { data, error } = await input.supabase
      .from('adset_dims')
      .select('external_id, campaign_external_id, name')
      .eq('ad_account_id', input.adAccountId)
      .in('external_id', adsetExternalIdsChunk);

    if (error) {
      throw error;
    }

    for (const row of (data ?? []) as AdsetLookupRow[]) {
      rowsByExternalId.set(row.external_id, row);
    }
  }

  return rowsByExternalId;
}

async function listCampaignNames(input: {
  supabase: SupabaseClient;
  adAccountId: string;
  campaignExternalIds: string[];
}): Promise<Map<string, string>> {
  const campaignNameByExternalId = new Map<string, string>();

  for (const campaignExternalIdsChunk of chunkArray(input.campaignExternalIds, 200)) {
    const { data, error } = await input.supabase
      .from('campaign_dims')
      .select('external_id, name')
      .eq('ad_account_id', input.adAccountId)
      .in('external_id', campaignExternalIdsChunk);

    if (error) {
      throw error;
    }

    for (const row of (data ?? []) as CampaignLookupRow[]) {
      campaignNameByExternalId.set(row.external_id, row.name || 'Unnamed campaign');
    }
  }

  return campaignNameByExternalId;
}

function deriveAdFormat(raw: Database['public']['Tables']['ad_dims']['Row']['raw']): string | null {
  const rawRecord = asRecord(raw);
  const creative = asRecord(rawRecord.creative);

  return asString(rawRecord.ad_format) || asString(rawRecord.format) || asString(creative.object_type) || null;
}

const ADS_METRICS_LOG_PREFIX = '[getAdsLifetimeIncludingZeros]';

function sampleStrings(values: Array<string | null | undefined>, limit = 5): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value)))).slice(0, limit);
}

async function lookupAdsetForDebug(input: {
  supabase: SupabaseClient;
  adAccountId: string;
  adsetExternalId: string;
}): Promise<AdsetDebugLookupRow | null> {
  const { data, error } = await input.supabase
    .from('adset_dims')
    .select('id, external_id, campaign_external_id, name')
    .eq('ad_account_id', input.adAccountId)
    .eq('external_id', input.adsetExternalId)
    .maybeSingle();

  if (error) {
    console.error(`${ADS_METRICS_LOG_PREFIX} Failed to load adset debug lookup`, {
      adAccountId: input.adAccountId,
      adsetExternalId: input.adsetExternalId,
      error,
    });
    return null;
  }

  return (data ?? null) as AdsetDebugLookupRow | null;
}

export async function getAdsLifetimeIncludingZeros(
  adAccountUuid: string,
  opts?: { adsetExternalId?: string; adExternalId?: string; vendor?: 'meta' | 'google' | 'tiktok' }
): Promise<AdLifetimeRow[]> {
  const supabase = await createSupabaseClient();
  const vendor = opts?.vendor ?? 'meta';
  const debugContext = {
    adAccountUuid,
    adsetExternalId: opts?.adsetExternalId ?? null,
    adExternalId: opts?.adExternalId ?? null,
    vendor,
  };

  console.info(`${ADS_METRICS_LOG_PREFIX} Fetching ads`, debugContext);

  try {
    const ads = await listAdDims({
      supabase,
      adAccountId: adAccountUuid,
      adsetExternalId: opts?.adsetExternalId,
      adExternalId: opts?.adExternalId,
    });

    console.info(`${ADS_METRICS_LOG_PREFIX} Loaded ad dims`, {
      ...debugContext,
      adCount: ads.length,
      adIdsSample: sampleStrings(ads.map((ad) => ad.external_id)),
      adsetIdsSample: sampleStrings(ads.map((ad) => ad.adset_external_id)),
    });

    if (ads.length === 0) {
      const matchedAdset =
        opts?.adsetExternalId != null
          ? await lookupAdsetForDebug({
              supabase,
              adAccountId: adAccountUuid,
              adsetExternalId: opts.adsetExternalId,
            })
          : null;

      console.warn(`${ADS_METRICS_LOG_PREFIX} No ads matched filters`, {
        ...debugContext,
        matchedAdset:
          matchedAdset == null
            ? null
            : {
                id: matchedAdset.id,
                externalId: matchedAdset.external_id,
                campaignExternalId: matchedAdset.campaign_external_id,
                name: matchedAdset.name,
              },
      });

      return [];
    }

    const performanceRows = await listAdPerformanceRows({
      supabase,
      adIds: ads.map((ad) => ad.id),
    });

    console.info(`${ADS_METRICS_LOG_PREFIX} Loaded ad performance rows`, {
      ...debugContext,
      adCount: ads.length,
      performanceRowCount: performanceRows.length,
      performanceAdIdsSample: sampleStrings(performanceRows.map((row) => row.ad_id)),
    });

    const totalsByAdId = new Map(
      ads.map((ad) => [
        ad.id,
        {
          spend: 0,
          reach: 0,
          impressions: 0,
          clicks: 0,
          linkClicks: 0,
          leads: 0,
          messages: 0,
          firstDay: null as string | null,
          lastDay: null as string | null,
        },
      ])
    );

    for (const row of performanceRows) {
      const totals = totalsByAdId.get(row.ad_id);
      if (!totals) {
        continue;
      }

      totals.spend += row.spend ?? 0;
      totals.reach += row.reach ?? 0;
      totals.impressions += row.impressions ?? 0;
      totals.clicks += row.clicks ?? 0;
      totals.linkClicks += row.inline_link_clicks ?? 0;
      totals.leads += row.leads ?? 0;
      totals.messages += row.messages ?? 0;

      if (row.first_day && (!totals.firstDay || row.first_day < totals.firstDay)) {
        totals.firstDay = row.first_day;
      }

      if (row.last_day && (!totals.lastDay || row.last_day > totals.lastDay)) {
        totals.lastDay = row.last_day;
      }
    }

    const adsetLookupByExternalId = await listAdsetLookups({
      supabase,
      adAccountId: adAccountUuid,
      adsetExternalIds: Array.from(new Set(ads.map((ad) => ad.adset_external_id))),
    });
    const missingAdsetLookupIds = sampleStrings(
      ads
        .filter((ad) => !adsetLookupByExternalId.has(ad.adset_external_id))
        .map((ad) => ad.adset_external_id)
    );

    if (missingAdsetLookupIds.length > 0) {
      console.warn(`${ADS_METRICS_LOG_PREFIX} Missing adset lookups for ads`, {
        ...debugContext,
        missingAdsetLookupIds,
      });
    }

    const campaignExternalIds = Array.from(
      new Set(
        Array.from(adsetLookupByExternalId.values())
          .map((adset) => adset.campaign_external_id)
          .filter(Boolean)
      )
    );
    const campaignNameByExternalId = await listCampaignNames({
      supabase,
      adAccountId: adAccountUuid,
      campaignExternalIds,
    });

    const missingCampaignLookupIds = sampleStrings(
      campaignExternalIds.filter((campaignExternalId) => !campaignNameByExternalId.has(campaignExternalId))
    );

    if (missingCampaignLookupIds.length > 0) {
      console.warn(`${ADS_METRICS_LOG_PREFIX} Missing campaign lookups for adsets`, {
        ...debugContext,
        missingCampaignLookupIds,
      });
    }

    const rows = ads
      .map((ad) => {
        const totals = totalsByAdId.get(ad.id)!;
        const adset = adsetLookupByExternalId.get(ad.adset_external_id);
        const spend = totals.spend;
        const metrics = derivePerformanceMetrics({
          spend,
          reach: totals.reach,
          impressions: totals.impressions,
          clicks: totals.clicks,
          leads: totals.leads,
          messages: totals.messages,
        });

        return {
          id: ad.external_id,
          ad_id: ad.external_id,
          name: ad.name || 'Unnamed ad',
          status: ad.status || 'UNKNOWN',
          creative_id: ad.creative_id,
          adset_id: ad.adset_external_id,
          adset_name: adset?.name || 'Unnamed ad set',
          campaign_id: adset?.campaign_external_id || '',
          campaign_name:
            (adset?.campaign_external_id
              ? campaignNameByExternalId.get(adset.campaign_external_id)
              : undefined) || 'Unnamed campaign',
          clicks: totals.clicks,
          impressions: totals.impressions,
          spend: spend.toFixed(2),
          leads: totals.leads,
          reach: totals.reach,
          link_clicks: totals.linkClicks,
          messages: totals.messages,
          cpm: totals.impressions > 0 ? metrics.cpm.toFixed(2) : null,
          ctr: totals.impressions > 0 ? metrics.ctr.toFixed(4) : null,
          cpc: totals.clicks > 0 ? metrics.cpc.toFixed(2) : null,
          cpl: totals.leads > 0 ? (spend / totals.leads).toFixed(2) : null,
          frequency: totals.reach > 0 ? metrics.frequency.toFixed(2) : null,
          start_date: formatDisplayDate(totals.firstDay || ad.created_time),
          end_date: formatDisplayDate(totals.lastDay),
          platform_name: vendor,
          raw_data: ad.raw,
          ad_format: deriveAdFormat(ad.raw),
        } satisfies AdLifetimeRow;
      })
      .sort((left, right) => {
        const spendDifference = Number(right.spend) - Number(left.spend);
        if (spendDifference !== 0) {
          return spendDifference;
        }

        return left.name.localeCompare(right.name);
      });

    console.info(`${ADS_METRICS_LOG_PREFIX} Returning ads`, {
      ...debugContext,
      returnedAdCount: rows.length,
      zeroMetricAdCount: rows.filter(
        (row) =>
          Number(row.spend) === 0 &&
          row.impressions === 0 &&
          row.clicks === 0 &&
          row.leads === 0 &&
          row.messages === 0
      ).length,
    });

    return rows;
  } catch (error) {
    console.error(`${ADS_METRICS_LOG_PREFIX} Failed to fetch ads`, {
      ...debugContext,
      error,
    });
    throw error;
  }
}
