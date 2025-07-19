import { createSupabaseClient } from "@/lib/utils/supabase/clients/server";
import { CampaignMetric } from "../types";

/**
 * Fetches top campaigns for a specific platform
 * @param selectedPlatformId - The ID of the platform to fetch campaigns for
 * @returns An object containing the top 5 campaigns for the platform
 */
export async function getPlatformsTopCampaigns(selectedPlatformId: string, userId: string) {
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