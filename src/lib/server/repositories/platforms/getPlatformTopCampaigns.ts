import { createSupabaseClient } from '@/lib/server/supabase/server';
import { getCampaignSummaries } from '../campaigns/getCampaignSummaries';
import type { CampaignMetric } from '../types';

/**
 * Fetches top campaigns for a connected platform integration and business scope.
 * @param selectedPlatformIntegrationId - The selected platform integration row id
 * @param businessId - The business profile id
 * @returns An object containing the top 5 campaigns for the platform
 */
export async function getPlatformsTopCampaigns(
  selectedPlatformIntegrationId: string,
  businessId: string
) {
  const supabase = await createSupabaseClient();

  try {
    const { data: integration, error: integrationError } = await supabase
      .from('platform_integrations')
      .select('platform_id')
      .eq('id', selectedPlatformIntegrationId)
      .eq('business_id', businessId)
      .maybeSingle();

    if (integrationError || !integration) {
      console.error(
        'Error fetching platform integration for top campaigns:',
        integrationError?.message
      );
      return [];
    }

    const { data: adAccounts, error: adAccountsError } = await supabase
      .from('ad_accounts')
      .select('id, name')
      .eq('business_id', businessId)
      .eq('platform_id', integration.platform_id);

    if (adAccountsError) {
      console.error('Error fetching ad accounts:', adAccountsError.message);
      throw new Error('Failed to fetch ad accounts');
    }

    if (!adAccounts || adAccounts.length === 0) {
      console.warn('No ad accounts found for platform');
      return [];
    }

    const adAccountNameById = new Map(
      (adAccounts ?? []).map((adAccount) => [adAccount.id, adAccount.name ?? 'Unknown account'])
    );
    const campaigns = await getCampaignSummaries({
      adAccountIds: (adAccounts ?? []).map((adAccount) => adAccount.id),
      limit: 3,
    });

    return campaigns.map(
      (campaign) =>
        ({
          ad_account_id: campaign.adAccountId,
          campaign_id: campaign.campaignId,
          campaign_name: campaign.campaignName,
          leads: campaign.leads,
          clicks: campaign.clicks,
          messages: campaign.messages,
          spend: campaign.spend,
          link_clicks: campaign.linkClicks,
          conversion: campaign.conversion,
          conversion_rate: campaign.conversionRate,
          status: campaign.status ?? 'UNKNOWN',
          impressions: campaign.impressions,
          ctr: campaign.ctr,
          cpc: campaign.cpc,
          cpm: campaign.cpm,
          cost_per_result: campaign.costPerResult,
          ad_account_name: adAccountNameById.get(campaign.adAccountId) ?? 'Unknown account',
        }) satisfies CampaignMetric
    );
  } catch (error) {
    console.error('Error in getTopCampaignsForPlatform:', error);
    throw error;
  }
}
