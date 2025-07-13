import { fetchWithValidation } from "@/lib/actions/common/apiUtils";
import { CampaignMetric } from "../../types";

interface Campaign {
    id: string;
    name: string;
    status: string;
    start_time?: string | null;
    stop_time?: string | null;
}

interface Insights {
    impressions: string;
    clicks: string;
    spend: string;
    actions?: {
        action_type: string;
        value: string;
    }[];
}

export const fetchCampaignMetrics = async (
    adAccountId: string,
    accessToken: string
): Promise<{ top3ByLeads: CampaignMetric[] }> => {
    const API_BASE_URL = process.env.FACEBOOK_GRAPH_API_BASE_URL;

    if (!API_BASE_URL) {
        throw new Error("FACEBOOK_GRAPH_API_BASE_URL is not set in the environment variables");
    }

    try {
        // Fetch campaigns for the given ad account
        const campaignsUrl = `${API_BASE_URL}/${adAccountId}/campaigns?fields=id,name,status,start_time,stop_time`;
        const campaignsData: { data: Campaign[] } = await fetchWithValidation(campaignsUrl, accessToken);

        if (!campaignsData.data || campaignsData.data.length === 0) {
            throw new Error("No campaigns found");
        }

        // Fetch metrics for each campaign in parallel
        const campaignMetrics: CampaignMetric[] = await Promise.all(
            campaignsData.data.map(async (campaign: Campaign) => {
                try {
                    const insightsUrl = `${API_BASE_URL}/${campaign.id}/insights?fields=impressions,clicks,spend,actions&date_preset=maximum`;
                    const insightsData: { data: Insights[] } = await fetchWithValidation(insightsUrl, accessToken);

                    const actions = insightsData.data?.[0]?.actions || [];
                    const leads = parseInt(
                        actions.find((action) => action.action_type === "lead")?.value?.toString() || "0",
                        10
                    );
                    const messages = parseInt(
                        actions.find((action) => action.action_type === "onsite_conversion.messaging_conversation_started_7d")
                            ?.value?.toString() || "0",
                        10
                    );

                    return {
                        id: campaign.id,
                        name: campaign.name,
                        status: campaign.status,
                        start_time: campaign.start_time || null,
                        stop_time: campaign.stop_time || null,
                        impressions: parseInt(insightsData.data?.[0]?.impressions?.toString() || "0", 10),
                        clicks: parseInt(insightsData.data?.[0]?.clicks?.toString() || "0", 10),
                        spend: parseFloat(insightsData.data?.[0]?.spend?.toString() || "0"),
                        leads,
                        messages,
                    };
                } catch (error) {
                    console.warn(`Failed to fetch insights for campaign ${campaign.id}:`, error);
                    return {
                        id: campaign.id,
                        name: campaign.name,
                        status: campaign.status,
                        start_time: campaign.start_time || null,
                        stop_time: campaign.stop_time || null,
                        impressions: 0,
                        clicks: 0,
                        spend: 0,
                        leads: 0,
                        messages: 0,
                    };
                }
            })
        );

        // Sort and get the top 3 campaigns by leads
        const top3ByLeads = [...campaignMetrics].sort((a, b) => b.leads - a.leads).slice(0, 3);

        return { top3ByLeads };
    } catch (error) {
        console.error("Error fetching campaign metrics:", error);
        throw new Error("Failed to fetch campaign metrics.");
    }
};
