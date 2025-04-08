import CampaignTabs from "@/components/campaigns/CampaignTabs";
import { getLoggedInUser } from "@/lib/actions/user.actions";
import { getAllCampaigns } from "@/lib/api/adAccount/getAllCampaigns";
import { createSupabaseClient } from "@/lib/utils/supabase/clients/server";

export default async function CampaignPage() {
  // Fetch ad account data
  const loggedIn = await getLoggedInUser();
  const userId = loggedIn?.id;
  const supabase = await createSupabaseClient();

  const { data, error } = await supabase
    .from("ad_accounts")
    .select("ad_account_id")
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    return <div>Error loading ad account data.</div>;
  }

  // Get all campaigns for platform "meta" for the given ad account
  const campaignsData = await getAllCampaigns("meta", data.ad_account_id);
  if (!campaignsData || campaignsData.length === 0) {
    return <div>Error loading campaign data.</div>;
  }

  // Map each campaign from Supabase to the shape expected by CampaignTable
  const formattedCampaigns = campaignsData.map((campaign: any) => {
    const raw = campaign.raw_data;
    let insights = null;
    if (raw && raw.insights && raw.insights.data && raw.insights.data.length > 0) {
      insights = raw.insights.data[0];
    }
    const reach = insights ? Number(insights.reach) : 0;
    const impressions = insights ? Number(insights.impressions) : 0;
    const clicks = insights ? Number(insights.clicks) : 0;
    const spend = insights ? Number(insights.spend) : 0;


    const conversionActions = campaign.leads + campaign.messages
    const costPerResult = conversionActions > 0 ? `$${(spend / conversionActions).toFixed(2)}` : "$0.00";

    return {
      id: campaign.campaign_id,
      name: campaign.name,
      delivery: campaign.status === "ACTIVE",
      type: "Manual" as "Manual",
      status: campaign.status,
      objective: campaign.objective,
      startDate: campaign.start_date,
      endDate: campaign.end_date || "No End Date",
      attribution: "7-day click or view", // Modify if you have a different attribution model
      spend: campaign.spend,
      results: conversionActions ? `${conversionActions} Leads` : "0 Leads",
      reach: campaign.reach,
      clicks: campaign.clicks, 
      impressions: campaign.impressions,
      frequency: reach ? (impressions / reach).toFixed(2) : "0",
      costPerResult: costPerResult,
      cpm: campaign.cpm,
      ctr: campaign.ctr,
      cpc: campaign.cpc,
      platform: campaign.platform_name || "meta",

    };
  });
  return <CampaignTabs campaigns={formattedCampaigns} />;

}
