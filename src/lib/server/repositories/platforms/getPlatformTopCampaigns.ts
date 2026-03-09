import { createSupabaseClient } from "@/lib/server/supabase/server";
import { CampaignMetric } from "../types";

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
            .from("platform_integrations")
            .select("platform_id")
            .eq("id", selectedPlatformIntegrationId)
            .eq("business_id", businessId)
            .maybeSingle();

        if (integrationError || !integration) {
            console.error("Error fetching platform integration for top campaigns:", integrationError?.message);
            return [];
        }

        // Get all ad accounts for the platform + business
        const { data: adAccounts, error: adAccountsError } = await supabase
            .from("ad_accounts")
            .select("external_account_id, name")
            .eq("business_id", businessId)
            .eq("platform_id", integration.platform_id);

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
                .eq("ad_account_id", adAccount.external_account_id);

            if (campaignError) {
                console.error(`Error fetching campaigns for ad account ${adAccount.name}:`, campaignError.message);
                continue;
            }

            if (campaigns) {
                campaignMetrics.push(
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
