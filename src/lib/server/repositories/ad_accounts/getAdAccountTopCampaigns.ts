import { createSupabaseClient } from '@/lib/server/supabase/server';
import { deriveCampaignResultMetrics } from '../campaigns/normalizers';

/**
 * Fetches top campaigns for a specific ad account
 * @param adAccountId - The ID of the ad account to fetch campaigns for
 * @returns An array of the top 5 campaigns for the ad account
 */
export async function getAdAccountTopCampaigns(adAccountId: string) {
  const supabase = await createSupabaseClient();

  try {
    const { data, error } = await supabase
      .from('campaigns_metrics')
      .select('*')
      .eq('ad_account_id', adAccountId)
      .order('spend', { ascending: false })
      .limit(5);

    if (error) {
      console.error('Error fetching top campaigns for ad account:', error.message);
      throw new Error('Failed to fetch top campaigns for ad account');
    }

    const processedCampaigns = (data ?? []).map((campaign) => ({
      ...campaign,
      ...deriveCampaignResultMetrics(campaign),
    }));

    const topCampaigns = processedCampaigns
      .sort((a, b) => b.conversion - a.conversion)
      .slice(0, 5);

    return topCampaigns;
  } catch (error) {
    console.error('Error in getTopAdAccountCampaigns Function:', error);
    throw error;
  }
}
