import { createSupabaseClient } from '@/lib/server/supabase/server';

export interface CampaignTreeAdNode {
  id: string;
  name: string;
}

export interface CampaignTreeAdsetNode {
  id: string;
  name: string;
  ads_metrics: CampaignTreeAdNode[];
}

export interface CampaignTreeNode {
  id: string;
  name: string;
  objective: string | null;
  status: string | null;
  adset_metrics: CampaignTreeAdsetNode[];
}

export async function getCampaignsWithAdSetsAndAds(adAccountId: string): Promise<CampaignTreeNode[]> {
  const supabase = await createSupabaseClient();
  const [{ data: campaigns, error: campaignsError }, { data: adsets, error: adsetsError }, { data: ads, error: adsError }] =
    await Promise.all([
      supabase
        .from('campaign_dims')
        .select('external_id, name, objective, status')
        .eq('ad_account_id', adAccountId)
        .order('name', { ascending: true }),
      supabase
        .from('adset_dims')
        .select('external_id, campaign_external_id, name')
        .eq('ad_account_id', adAccountId)
        .order('name', { ascending: true }),
      supabase
        .from('ad_dims')
        .select('external_id, adset_external_id, name')
        .eq('ad_account_id', adAccountId)
        .order('name', { ascending: true }),
    ]);

  if (campaignsError || adsetsError || adsError) {
    const error = campaignsError || adsetsError || adsError;
    console.error('Supabase fetch error:', error);
    throw error;
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
    items.push({
      id: adset.external_id,
      name: adset.name || 'Unnamed ad set',
      ads_metrics: adsByAdsetExternalId.get(adset.external_id) ?? [],
    });
    adsetsByCampaignExternalId.set(adset.campaign_external_id, items);
  }

  return (campaigns ?? []).map((campaign) => ({
    id: campaign.external_id,
    name: campaign.name || 'Unnamed campaign',
    objective: campaign.objective ?? null,
    status: campaign.status ?? null,
    adset_metrics: adsetsByCampaignExternalId.get(campaign.external_id) ?? [],
  }));
}
