import CampaignDashboard from "@/components/campaigns/CampaignDashboard";
import { getLoggedInUser } from "@/lib/actions/user.actions";
import { getAllCampaigns } from "@/lib/api/adAccount/getAllCampaigns";
import { createSupabaseClient } from "@/lib/utils/supabase/clients/server";

export default async function CampaignPage() {
  // Fetch user and ad account data
  const loggedIn = await getLoggedInUser();
  const userId = loggedIn?.id;
  const supabase = await createSupabaseClient();

  const { data, error } = await supabase
    .from("ad_accounts")
    .select("ad_account_id, platform_integration_id, name, platform_integrations(platform_name)")
    .eq("user_id", userId);

  // Check if the user has any ad accounts
  if (error || !data || data.length === 0) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-medium mb-4">No Ad Accounts Found</h2>
        <p className="text-gray-600 mb-6">
          You need to connect an ad platform to view and manage campaigns.
        </p>
        <a href="/integration" className="text-blue-500 hover:underline">
          Connect a platform
        </a>
      </div>
    );
  }

  // Get all campaigns for all ad accounts
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let allCampaigns: any = [];

  // Loop through each ad account and fetch campaigns
  for (const adAccount of data) {
    const campaignsData = await getAllCampaigns(
      supabase,
      // @ts-expect-error Ignoring platform_integrations type for now since typscript sees it as an array
      adAccount.platform_integrations?.platform_name,
      adAccount.ad_account_id
    );

    if (campaignsData && campaignsData.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const formattedCampaigns = campaignsData.map((campaign: any) => {
        const raw = campaign.raw_data;
        let insights = null;
        if (raw && raw.insights && raw.insights.data && raw.insights.data.length > 0) {
          insights = raw.insights.data[0];
        }

        const reach = insights ? Number(insights.reach) : 0;
        const impressions = insights ? Number(insights.impressions) : 0;
        const spend = insights ? Number(insights.spend) : 0;

        const conversionActions = campaign.leads + campaign.messages;
        const costPerResult = conversionActions > 0 ? `$${(spend / conversionActions).toFixed(2)}` : "$0.00";

        return {
          id: campaign.campaign_id,
          name: campaign.name,
          delivery: (campaign.status ?? "").toUpperCase() === "ACTIVE",
          type: campaign.type || "Manual",
          status: campaign.status,
          objective: campaign.objective,
          startDate: campaign.start_date,
          endDate: campaign.end_date || "No End Date",
          attribution: "7-day click or view",
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
          // @ts-expect-error Ignoring platform_integrations type for now since typscript doesn't recognize it for whatever reason again
          platform: adAccount.platform_integrations?.platform_name,
          accountName: adAccount.name,
          auto_optimize: campaign.auto_optimize,
          ad_account_id: adAccount.ad_account_id
        };
      });

      allCampaigns = [...allCampaigns, ...formattedCampaigns];
    }
  }
  return <CampaignDashboard campaigns={allCampaigns} userId={userId} />;
}
