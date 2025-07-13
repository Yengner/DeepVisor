import { createSupabaseClient } from "@/lib/utils/supabase/clients/server";
import { AggregatedMetric, CampaignMetric, PlatformDetails } from "./types";


/**
 * Fetches platform details by ID
 * @param selectedPlatformId - The ID of the platform to fetch details for
 * @return An object containing the platform details or an error response
 */
export async function getPlatformDetails(selectedPlatformId: string, userId: string): Promise<PlatformDetails> {

    const supabase = await createSupabaseClient();

    const { data, error: platformError } = await supabase
        .from("platform_integrations")
        .select("*")
        .eq("id", selectedPlatformId)
        .eq("user_id", userId)
        .single();

    if (platformError) {
        console.error("Error fetching platform details:", platformError);

    }

    const platformDetails: PlatformDetails = {
        id: data.id,
        platform_name: data.platform_name,
        is_integrated: data.is_integrated,
        access_token: data.access_token,
        updated_at: data.updated_at,
    }
    return platformDetails
}

/**
 * Fetches platform data including aggregated metrics
 * @param selectedPlatformId - The ID of the platform to fetch data for
 * @returns An object containing the aggregated metrics for the platform
 */
export async function getPlatformData(selectedPlatformId: string, userId: string) {
    const supabase = await createSupabaseClient();

    try {
        const { data, error: PlatformDataError } = await supabase
            .from('platform_aggregated_metrics')
            .select(`
                total_leads,
                total_spend,
                total_clicks,
                total_messages,
                total_ctr,
                total_link_clicks,
                total_conversions,
                total_impressions
                `)
            .eq('platform_integration_id', selectedPlatformId)
            .eq('platform_integration_id.user_id', userId)
            .single();

        if (PlatformDataError) {
            console.error('Error fetching aggregated metrics:', PlatformDataError.message);
            throw new Error('Failed to fetch aggregated metrics');
        }

        if (!data) {
            throw new Error('No aggregated metrics found');
        }

        // normalize the data
        const platformData: AggregatedMetric = {
            total_spend: data.total_spend,
            total_leads: data.total_leads || 0,
            total_clicks: data.total_clicks || 0,
            total_ctr: data.total_ctr || 0,
            total_link_clicks: data.total_link_clicks || 0,
            total_impressions: data.total_impressions || 0,
            total_messages: data.total_messages || 0,
            total_conversions: data.total_conversions || 0,
        };

        return platformData;
    } catch (error) {
        console.error('Error in getPlatformData Function:', error);
        throw error;
    }
}

/**
 * Fetches top campaigns for a specific platform
 * @param selectedPlatformId - The ID of the platform to fetch campaigns for
 * @returns An object containing the top 5 campaigns for the platform
 */
export async function getTopPlatformsCampaigns(selectedPlatformId: string, userId: string) {
    const supabase = await createSupabaseClient();

    try {
        // Get all add accounts for the platform
        const { data: adAccounts, error: adAccountsError } = await supabase
            .from("ad_accounts")
            .select("ad_account_id, name")
            .eq("platform_integration_id", selectedPlatformId)
            .eq("user_id", userId);
        if (adAccountsError) {
            console.error("Error fetching ad accounts:", adAccountsError.message);
            throw new Error("Failed to fetch ad accounts");
        }

        if (!adAccounts || adAccounts.length === 0) {
            console.warn("No ad accounts found for platform");
            return { topCampaigns: [] };
        }

        // Get all campaigns for these ad accounts
        const campaignMetrics: CampaignMetric[] = [];

        for (const adAccount of adAccounts) {
            const { data: campaigns, error: campaignError } = await supabase
                .from("campaigns_metrics")
                .select(`
                    ad_account_id,
                    campaign_id,
                    name,
                    objective,
                    leads,
                    clicks,
                    messages,
                    spend,
                    link_clicks,
                    status,
                    impressions,
                    ctr,
                    cpc,
                    cpm
                `)
                .eq("ad_account_id", adAccount.ad_account_id);

            if (campaignError) {
                console.error(`Error fetching campaigns for ad account ${adAccount.name}:`, campaignError.message);
                continue;
            }

            if (campaigns) {
                campaignMetrics.push(
                    ...campaigns.map((campaign: any) => {
                        const totalConversions = (campaign.leads || 0) + (campaign.messages || 0);
                        const costPerResult = totalConversions > 0 ? (campaign.spend || 0) / totalConversions : 0;

                        return {
                            ad_account_id: campaign.ad_account_id,
                            campaign_id: campaign.campaign_id,
                            campaign_name: campaign.name,
                            leads: campaign.leads || 0,
                            clicks: campaign.clicks || 0,
                            messages: campaign.messages || 0,
                            spend: campaign.spend || 0,
                            link_clicks: campaign.link_clicks || 0,
                            conversion: totalConversions,
                            conversion_rate: campaign.clicks > 0 ? (totalConversions / campaign.clicks) * 100 : 0,
                            status: campaign.status || 'UNKNOWN',
                            impressions: campaign.impressions || 0,
                            ctr: campaign.ctr || 0,
                            cpc: campaign.cpc || 0,
                            cpm: campaign.cpm || 0,
                            cost_per_result: costPerResult,
                            ad_account_name: adAccount.name
                        };
                    })
                );
            }
        }

        // Step 4: Sort by conversions and get top 5
        const topCampaigns = campaignMetrics
            .sort((a, b) => b.conversion - a.conversion)
            .slice(0, 3);

        return topCampaigns;
    } catch (error) {
        console.error("Error in getTopCampaignsForPlatform:", error);
        throw error;
    }
}


/**
 * Fetches ad account data for a specific platform
 * @param selectedAdAccountId - The ID of the ad account to fetch data for
 * @param selectedPlatformId - The ID of the platform to fetch data for
 * @returns An object containing the ad account data
 */
export async function getAdAccountData(selectedAdAccountId: string, selectedPlatformId: string, userId: string) {
    const supabase = await createSupabaseClient();

    try {
        const { data, error } = await supabase
            .from('ad_accounts')
            .select('*')
            .eq('id', selectedAdAccountId)
            .eq('platform_integration_id', selectedPlatformId)
            .eq('user_id', userId)
            .single();

        if (error) {
            console.error('Error fetching ad account data:', error.message);
            throw new Error('Failed to fetch ad account data');
        }

        if (!data) {
            throw new Error('No ad account data found');
        }

        return data;
    } catch (error) {
        console.error('Error in getAdAccountData Function:', error);
        throw error;
    }
}

/**
 * Fetches top campaigns for a specific ad account
 * @param adAccountId - The ID of the ad account to fetch campaigns for
 * @returns An array of the top 5 campaigns for the ad account
*/
export async function getTopAdAccountCampaigns(adAccountId: string,) {
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

        // Process the data to add calculated fields
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

        // Sort by conversions and return the top 5
        const topCampaigns = processedCampaigns
            .sort((a: any, b: any) => b.conversion - a.conversion)
            .slice(0, 5);

        return topCampaigns;

    } catch (error) {
        console.error('Error in getTopAdAccountCampaigns Function:', error);
        throw error;
    }
}


