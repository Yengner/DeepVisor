import { createSupabaseClient } from "@/lib/utils/supabase/clients/server";

/**
 * Fetches top campaigns for a specific ad account
 * @param adAccountId - The ID of the ad account to fetch campaigns for
 * @returns An array of the top 5 campaigns for the ad account
*/
export async function getAdAccountTopCampaigns(adAccountId: string,) {
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const processedCampaigns = (data || []).map((campaign: any) => {
            const totalConversions = (campaign.leads || 0) + (campaign.messages || 0);
            const costPerResult = totalConversions > 0 ? (campaign.spend || 0) / totalConversions : 0;

            return {
                ...campaign,
                conversion: totalConversions,
                conversion_rate: campaign.clicks > 0 ? (totalConversions / campaign.clicks) * 100 : 0,
                cost_per_result: costPerResult
            };
        });

        // Sort by conversions and return the top 5 for now
        const topCampaigns = processedCampaigns
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .sort((a: any, b: any) => b.conversion - a.conversion)
            .slice(0, 5);

        return topCampaigns;

    } catch (error) {
        console.error('Error in getTopAdAccountCampaigns Function:', error);
        throw error;
    }
}

