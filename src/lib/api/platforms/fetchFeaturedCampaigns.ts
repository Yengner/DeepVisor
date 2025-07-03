import { createSupabaseClient } from "@/lib/utils/supabase/clients/server";

interface AggregatedMetric {
  platform_integration_id: string;
  total_spend: number;
  total_leads: number;
  total_clicks: number;
  total_ctr: number;
  total_link_clicks: number;
  total_impressions: number;
  total_messages: number;
  total_conversions: number;
  platform_name: string;
}

interface AdAccount {
  ad_account_id: string;
  name: string;
}

interface CampaignMetric {
  campaign_id: string;
  campaign_name: string;
  leads: number;
  clicks: number;
  messages: number;
  spend: number;
  platform_name: string;
  link_clicks: number;
  conversion: number;
  conversion_rate: number;
  status: string;
}

interface CampaignData {
  campaign_id: string;
  name: string;
  leads: number | null;
  clicks: number | null;
  messages: number | null;
  spend: number | null;
  link_clicks: number | null;
  status: string;
}

export async function getTopCampaignsForPlatforms(userId: string) {
  const supabase = await createSupabaseClient();

  try {
    // Step 1: Fetch Top Platforms
    const { data: platformMetrics, error: platformError } = await supabase
      .from("platform_aggregated_metrics")
      .select(`
        platform_integration_id,
        total_spend,
        total_leads,
        total_clicks,
        total_ctr,
        total_link_clicks,
        total_impressions,
        total_messages,
        total_conversions,
        platform_integrations!inner (
          user_id,
          platform_name
        )
      `)
      .eq("platform_integrations.user_id", userId);

    if (platformError) {
      console.error("Error fetching aggregated metrics:", platformError.message);
      throw new Error("Failed to fetch aggregated metrics");
    }

    if (!platformMetrics || platformMetrics.length === 0) {
      throw new Error("No platforms found for the user");
    }

    const normalizedPlatforms: AggregatedMetric[] = platformMetrics.map((item) => {
      // Safely handle platform_integrations as an object or array
      const platformIntegration = Array.isArray(item.platform_integrations)
        ? item.platform_integrations[0] // Use the first object if it's an array
        : item.platform_integrations;

      if (!platformIntegration || typeof platformIntegration !== "object") {
        throw new Error("Invalid platform integrations data");
      }

      return {
        platform_integration_id: item.platform_integration_id,
        total_spend: item.total_spend || 0,
        total_leads: item.total_leads || 0,
        total_clicks: item.total_clicks || 0,
        total_ctr: item.total_ctr || 0,
        total_link_clicks: item.total_link_clicks || 0,
        total_impressions: item.total_impressions || 0,
        total_messages: item.total_messages || 0,
        total_conversions: item.total_conversions || 0,
        platform_name: platformIntegration.platform_name || "Unknown",
      };
    });

    // Step 2: Fetch Ad Accounts for Top Platforms
    const topPlatforms = normalizedPlatforms
      .sort((a, b) => b.total_conversions - a.total_conversions)
      .slice(0, 3);

    const campaignMetrics: CampaignMetric[] = [];

    for (const platform of topPlatforms) {
      const { data: adAccounts, error: adAccountsError } = await supabase
        .from("ad_accounts")
        .select(`
          ad_account_id,
          name
        `)
        .eq("platform_integration_id", platform.platform_integration_id);

      if (adAccountsError) {
        console.error(`Error fetching ad accounts for ${platform.platform_name}:`, adAccountsError.message);
        continue;
      }

      if (!adAccounts || adAccounts.length === 0) {
        console.warn(`No ad accounts found for platform: ${platform.platform_name}`);
        continue;
      }

      // Step 3: Fetch Campaigns for Ad Accounts
      for (const adAccount of adAccounts as AdAccount[]) {
        const { data: campaigns, error: campaignError } = await supabase
          .from("campaigns_metrics")
          .select(`
            campaign_id,
            name,
            leads,
            clicks,
            messages,
            spend,
            link_clicks,
            status
          `)
          .eq("ad_account_id", adAccount.ad_account_id);

        if (campaignError) {
          console.error(`Error fetching campaigns for ad account ${adAccount.name}:`, campaignError.message);
          continue;
        }

        if (campaigns && campaigns.length > 0) {
          campaignMetrics.push(
            ...campaigns.map((campaign: CampaignData) => {
              const totalConversions =
                (campaign.leads || 0) +
                (campaign.messages || 0) +
                (campaign.link_clicks || 0);

              const conversionRate =
                platform.total_conversions > 0
                  ? (totalConversions / platform.total_conversions) * 100
                  : 0;

              return {
                campaign_id: campaign.campaign_id,
                campaign_name: campaign.name,
                leads: campaign.leads || 0,
                clicks: campaign.clicks || 0,
                messages: campaign.messages || 0,
                spend: campaign.spend || 0,
                platform_name: platform.platform_name,
                link_clicks: campaign.link_clicks || 0,
                conversion: totalConversions,
                conversion_rate: parseFloat(conversionRate.toFixed(2)), // Limit to 2 decimals
                status: campaign.status,
              };
            })
          );
        }
      }
    }

    // Step 4: Determine Top Campaigns Overall
    const topCampaigns = campaignMetrics
      .sort((a, b) => b.conversion - a.conversion)
      .slice(0, 5);

    return { topPlatforms, topCampaigns };
  } catch (error) {
    console.error("Error in getTopCampaignsForPlatforms:", error);
    throw error;
  }
}
