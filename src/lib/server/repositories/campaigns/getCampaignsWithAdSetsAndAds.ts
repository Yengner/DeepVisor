import { createSupabaseClient } from '@/lib/server/supabase/server';

export interface CampaignTreeAdNode {
  id: string;
  name: string;
}

export interface CampaignTreePerformanceSummary {
  spend: number;
  results: number;
  leads: number;
  messages: number;
  calls: number;
  costPerResult: number | null;
  ctr: number | null;
  lastDay: string | null;
  score: number;
}

export interface CampaignTreeAdsetNode {
  id: string;
  name: string;
  isBest: boolean;
  performance: CampaignTreePerformanceSummary | null;
  ads_metrics: CampaignTreeAdNode[];
}

export interface CampaignTreeNode {
  id: string;
  name: string;
  objective: string | null;
  status: string | null;
  isBest: boolean;
  performance: CampaignTreePerformanceSummary | null;
  adset_metrics: CampaignTreeAdsetNode[];
}

type PerformanceSummaryRow = {
  campaign_id?: string | null;
  adset_id?: string | null;
  spend: number | null;
  leads: number | null;
  messages: number | null;
  calls: number | null;
  cost_per_result: number | null;
  ctr: number | null;
  last_day: string | null;
};

function numberOrZero(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function buildPerformanceSummary(row: PerformanceSummaryRow | null | undefined): CampaignTreePerformanceSummary | null {
  if (!row) {
    return null;
  }

  const spend = numberOrZero(row.spend);
  const leads = numberOrZero(row.leads);
  const messages = numberOrZero(row.messages);
  const calls = numberOrZero(row.calls);
  const results = leads + messages + calls;
  const costPerResult =
    typeof row.cost_per_result === 'number' && Number.isFinite(row.cost_per_result)
      ? row.cost_per_result
      : results > 0
        ? spend / results
        : null;
  const ctr = typeof row.ctr === 'number' && Number.isFinite(row.ctr) ? row.ctr : null;
  const efficiencyPenalty = costPerResult != null ? Math.min(costPerResult, 500) : spend > 0 ? 100 : 0;
  const score = results * 100 + (ctr ?? 0) * 10 - efficiencyPenalty;

  return {
    spend,
    results,
    leads,
    messages,
    calls,
    costPerResult,
    ctr,
    lastDay: row.last_day ?? null,
    score,
  };
}

function hasUsefulPerformance(summary: CampaignTreePerformanceSummary | null): boolean {
  return Boolean(summary && (summary.results > 0 || summary.spend > 0));
}

function sortByPerformanceAndName<T extends { name: string; status?: string | null; performance: CampaignTreePerformanceSummary | null }>(
  left: T,
  right: T
): number {
  const leftActive = left.status?.toLowerCase() === 'active' ? 1 : 0;
  const rightActive = right.status?.toLowerCase() === 'active' ? 1 : 0;

  if (leftActive !== rightActive) {
    return rightActive - leftActive;
  }

  const scoreDiff = (right.performance?.score ?? Number.NEGATIVE_INFINITY) - (left.performance?.score ?? Number.NEGATIVE_INFINITY);
  if (scoreDiff !== 0) {
    return scoreDiff;
  }

  return left.name.localeCompare(right.name);
}

export async function getCampaignsWithAdSetsAndAds(adAccountId: string): Promise<CampaignTreeNode[]> {
  const supabase = await createSupabaseClient();
  const [
    { data: campaigns, error: campaignsError },
    { data: adsets, error: adsetsError },
    { data: ads, error: adsError },
    { data: campaignSummaries, error: campaignSummariesError },
    { data: adsetSummaries, error: adsetSummariesError },
  ] =
    await Promise.all([
      supabase
        .from('campaign_dims')
        .select('id, external_id, name, objective, status')
        .eq('ad_account_id', adAccountId)
        .order('name', { ascending: true }),
      supabase
        .from('adset_dims')
        .select('id, external_id, campaign_external_id, name')
        .eq('ad_account_id', adAccountId)
        .order('name', { ascending: true }),
      supabase
        .from('ad_dims')
        .select('external_id, adset_external_id, name')
        .eq('ad_account_id', adAccountId)
        .order('name', { ascending: true }),
      supabase
        .from('campaign_performance_summary')
        .select('campaign_id, spend, leads, messages, calls, cost_per_result, ctr, last_day')
        .eq('ad_account_id', adAccountId),
      supabase
        .from('adset_performance_summary')
        .select('adset_id, spend, leads, messages, calls, cost_per_result, ctr, last_day')
        .eq('ad_account_id', adAccountId),
    ]);

  if (campaignsError || adsetsError || adsError || campaignSummariesError || adsetSummariesError) {
    const error = campaignsError || adsetsError || adsError || campaignSummariesError || adsetSummariesError;
    console.error('Supabase fetch error:', error);
    throw error;
  }

  const campaignSummaryById = new Map<string, CampaignTreePerformanceSummary | null>();
  for (const row of campaignSummaries ?? []) {
    if (row.campaign_id) {
      campaignSummaryById.set(row.campaign_id, buildPerformanceSummary(row));
    }
  }

  const adsetSummaryById = new Map<string, CampaignTreePerformanceSummary | null>();
  for (const row of adsetSummaries ?? []) {
    if (row.adset_id) {
      adsetSummaryById.set(row.adset_id, buildPerformanceSummary(row));
    }
  }

  const adsByAdsetExternalId = new Map<string, CampaignTreeAdNode[]>();

  for (const ad of ads ?? []) {
    const items = adsByAdsetExternalId.get(ad.adset_external_id) ?? [];
    items.push({
      id: ad.external_id,
      name: ad.name || 'Unnamed ad',
    });
    adsByAdsetExternalId.set(ad.adset_external_id, items);
  }

  const adsetsByCampaignExternalId = new Map<string, CampaignTreeAdsetNode[]>();

  for (const adset of adsets ?? []) {
    const items = adsetsByCampaignExternalId.get(adset.campaign_external_id) ?? [];
    const performance = adsetSummaryById.get(adset.id) ?? null;
    items.push({
      id: adset.external_id,
      name: adset.name || 'Unnamed ad set',
      isBest: false,
      performance,
      ads_metrics: adsByAdsetExternalId.get(adset.external_id) ?? [],
    });
    adsetsByCampaignExternalId.set(adset.campaign_external_id, items);
  }

  const campaignTree = (campaigns ?? []).map((campaign) => {
    const adsetNodes = (adsetsByCampaignExternalId.get(campaign.external_id) ?? [])
      .sort(sortByPerformanceAndName);
    const bestAdset = adsetNodes.find((adset) => hasUsefulPerformance(adset.performance));
    const performance = campaignSummaryById.get(campaign.id) ?? null;

    return {
    id: campaign.external_id,
    name: campaign.name || 'Unnamed campaign',
    objective: campaign.objective ?? null,
    status: campaign.status ?? null,
      isBest: false,
      performance,
      adset_metrics: adsetNodes.map((adset) => ({
        ...adset,
        isBest: Boolean(bestAdset && adset.id === bestAdset.id),
      })),
    };
  }).sort(sortByPerformanceAndName);

  const bestCampaign = campaignTree.find((campaign) => hasUsefulPerformance(campaign.performance));

  return campaignTree.map((campaign) => ({
    ...campaign,
    isBest: Boolean(bestCampaign && campaign.id === bestCampaign.id),
  }));
}
