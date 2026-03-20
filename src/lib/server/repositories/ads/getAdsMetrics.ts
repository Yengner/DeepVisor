import { createSupabaseClient } from '@/lib/server/supabase/server';
import type { Database } from '@/lib/shared/types/supabase';
import { asRecord, asString } from '@/lib/shared/utils/format';
import { derivePerformanceMetrics } from '../campaigns/normalizers';
import { chunkArray } from '../utils';

const formatDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';

type SupabaseClient = Awaited<ReturnType<typeof createSupabaseClient>>;

type AdDimRow = Pick<
  Database['public']['Tables']['ad_dims']['Row'],
  'id' | 'external_id' | 'adset_external_id' | 'name' | 'creative_id' | 'status' | 'raw' | 'created_time'
>;

type AdPerformanceRow = Pick<
  Database['public']['Tables']['ads_performance_daily']['Row'],
  | 'ad_id'
  | 'day'
  | 'spend'
  | 'reach'
  | 'impressions'
  | 'clicks'
  | 'inline_link_clicks'
  | 'leads'
  | 'messages'
>;

type AdsetLookupRow = Pick<
  Database['public']['Tables']['adset_dims']['Row'],
  'external_id' | 'campaign_external_id' | 'name'
>;

type CampaignLookupRow = Pick<
  Database['public']['Tables']['campaign_dims']['Row'],
  'external_id' | 'name'
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
      .from('ads_performance_daily')
      .select('ad_id, day, spend, reach, impressions, clicks, inline_link_clicks, leads, messages')
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

export async function getAdsLifetimeIncludingZeros(
  adAccountUuid: string,
  opts?: { adsetExternalId?: string; adExternalId?: string; vendor?: 'meta' | 'google' | 'tiktok' }
): Promise<AdLifetimeRow[]> {
  const supabase = await createSupabaseClient();
  const vendor = opts?.vendor ?? 'meta';
  const ads = await listAdDims({
    supabase,
    adAccountId: adAccountUuid,
    adsetExternalId: opts?.adsetExternalId,
    adExternalId: opts?.adExternalId,
  });

  if (ads.length === 0) {
    return [];
  }

  const performanceRows = await listAdPerformanceRows({
    supabase,
    adIds: ads.map((ad) => ad.id),
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
    totals.firstDay = totals.firstDay === null || row.day < totals.firstDay ? row.day : totals.firstDay;
    totals.lastDay = totals.lastDay === null || row.day > totals.lastDay ? row.day : totals.lastDay;
  }

  const adsetLookupByExternalId = await listAdsetLookups({
    supabase,
    adAccountId: adAccountUuid,
    adsetExternalIds: Array.from(new Set(ads.map((ad) => ad.adset_external_id))),
  });
  const campaignNameByExternalId = await listCampaignNames({
    supabase,
    adAccountId: adAccountUuid,
    campaignExternalIds: Array.from(
      new Set(
        Array.from(adsetLookupByExternalId.values())
          .map((adset) => adset.campaign_external_id)
          .filter(Boolean)
      )
    ),
  });

  return ads
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
        start_date: formatDate(totals.firstDay || ad.created_time),
        end_date: formatDate(totals.lastDay),
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
}
