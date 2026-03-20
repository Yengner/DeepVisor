import { getCampaignSummaries } from '../campaigns/getCampaignSummaries';

/**
 * Fetches top campaigns for a specific ad account
 * @param adAccountId - The internal ad account UUID to fetch campaigns for
 * @returns An array of the top 5 campaigns for the ad account
 */
export async function getAdAccountTopCampaigns(adAccountId: string) {
  try {
    const campaigns = await getCampaignSummaries({
      adAccountIds: [adAccountId],
      limit: 5,
    });

    return campaigns.map((campaign) => ({
      id: campaign.campaignId,
      ad_account_id: campaign.adAccountId,
      campaign_id: campaign.campaignId,
      name: campaign.campaignName,
      campaign_name: campaign.campaignName,
      objective: campaign.objective,
      status: campaign.status ?? 'UNKNOWN',
      spend: campaign.spend,
      reach: campaign.reach,
      impressions: campaign.impressions,
      clicks: campaign.clicks,
      link_clicks: campaign.linkClicks,
      messages: campaign.messages,
      leads: campaign.leads,
      ctr: campaign.ctr,
      cpc: campaign.cpc,
      cpm: campaign.cpm,
      conversion: campaign.conversion,
      conversion_rate: campaign.conversionRate,
      cost_per_result: campaign.costPerResult,
    }));
  } catch (error) {
    console.error('Error in getTopAdAccountCampaigns Function:', error);
    throw error;
  }
}
