import { createSupabaseClient } from "@/lib/utils/supabase/clients/server";

interface AdAccountMetric {
    ad_account_id: string;
    ad_account_name: string;
    leads: number;
    spend: number;
    messages: number;
    link_clicks: number;
    total_conversions: number;
}

interface CampaignMetric {
    campaign_id: string;
    campaign_name: string;
    leads: number;
    messages: number;
    link_clicks: number;
    spend: number;
    conversion: number;
    conversion_rate: number;
    status: string;
}


export async function getTopCampaignsForAdAccounts(platform: string, userId: string,): Promise<{ topAdAccounts: AdAccountMetric[]; campaignMetrics: { [key: string]: CampaignMetric[] }; topCampaigns: CampaignMetric[]; }> {
    const supabase = await createSupabaseClient();

    try {
        // Step 1: Fetch Ad Accounts
        const { data, error } = await supabase
            .from("ad_accounts")
            .select(`
                ad_account_id,
                name,
                aggregated_metrics
            `)
            .eq("user_id", userId)
            .eq("platform_name", platform);

        if (error) {
            console.warn("Error fetching ad accounts:", error.message);
            return { topAdAccounts: [], campaignMetrics: {}, topCampaigns: [] };
        }

        if (!data || data.length === 0) {
            console.warn(`No ad accounts found for user ${userId} on platform ${platform}`);
            return { topAdAccounts: [], campaignMetrics: {}, topCampaigns: [] };
        }

        const adAccountMetrics: AdAccountMetric[] = data.map((row) => {
            const metricsData = row.aggregated_metrics;

            const totalConversions =
                parseInt(metricsData.leads || "0", 10) +
                parseInt(metricsData.messages || "0", 10) +
                parseInt(metricsData.link_clicks || "0", 10)

            return {
                ad_account_id: row.ad_account_id,
                ad_account_name: row.name || "Unknown",
                leads: parseInt(metricsData.leads || "0", 10),
                spend: parseFloat(metricsData.spend || "0"),
                messages: parseInt(metricsData.messages || "0", 10),
                link_clicks: parseInt(metricsData.link_clicks || "0", 10),
                total_conversions: totalConversions
            };
        });


        // Step 2: Determine Top 3 Ad Accounts
        const topAdAccounts = adAccountMetrics
            .sort((a, b) => b.total_conversions - a.total_conversions)
            .slice(0, 4);

        if (topAdAccounts.length === 0) {
            console.warn("No top ad accounts found");
            return { topAdAccounts: [], campaignMetrics: {}, topCampaigns: [] };
        }

        // Step 3: Fetch Campaigns for Each Top Ad Account
        const campaignMetrics: { [key: string]: CampaignMetric[] } = {};
        const allCampaigns: CampaignMetric[] = [];

        for (const adAccount of topAdAccounts) {
            const { data: campaigns, error: campaignsError } = await supabase
                .from("campaign_metrics")
                .select(`
                    campaign_id,
                    name,
                    leads,
                    link_clicks,
                    messages,
                    spend,
                    status
                    `)
                .eq("ad_account_id", adAccount.ad_account_id);

            if (campaignsError) {
                console.error(
                    `Error fetching campaigns for ad account ${adAccount.ad_account_name}:`,
                    campaignsError.message
                );
                continue;
            }

            if (!campaigns || campaigns.length === 0) {
                console.warn(`No campaigns found for ad account ${adAccount.ad_account_name}`);
                continue;
            }

            const processedCampaigns: CampaignMetric[] = campaigns.map((campaign) => {
                const totalConversions =
                    (campaign.leads || 0) +
                    (campaign.messages || 0) +
                    (campaign.link_clicks || 0);

                const conversionRate =
                    adAccount.total_conversions > 0
                        ? (totalConversions / adAccount.total_conversions) * 100
                        : 0;

                const campaignMetric: CampaignMetric = {
                    campaign_id: campaign.campaign_id,
                    campaign_name: campaign.name || "Unknown Campaign",
                    leads: campaign.leads || 0,
                    messages: campaign.messages || 0,
                    link_clicks: campaign.link_clicks || 0,
                    spend: campaign.spend || 0,
                    conversion: totalConversions,
                    conversion_rate: parseFloat(conversionRate.toFixed(2)),
                    status: campaign.status || "Unknown",
                };

                allCampaigns.push(campaignMetric);
                return campaignMetric;
            });

            campaignMetrics[adAccount.ad_account_id] = processedCampaigns
                .sort((a, b) => b.conversion - a.conversion)
                .slice(0, 5);
        }

        // Step 4: Determine Top Campaigns Overall
        const topCampaigns = allCampaigns
            .sort((a, b) => b.conversion - a.conversion)
            .slice(0, 4);

        return { topAdAccounts, campaignMetrics, topCampaigns };
    } catch (error) {
        console.error("Error in getTopCampaignsForAdAccounts:", error);
        throw error;
    }
}
