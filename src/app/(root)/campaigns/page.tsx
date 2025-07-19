import CampaignDashboard from "@/components/campaigns/CampaignDashboard";
import { getCampaignMetrics } from "@/lib/quieries/campaigns/getCampaignsMetrics";
import { createSupabaseClient } from "@/lib/utils/supabase/clients/server";
import { cookies } from "next/headers";
import { EmptyCampaignState } from "@/components/campaigns/EmptyStates";
import { getPlatformDetails } from "@/lib/quieries/platforms/getPlatformDetails";
import { getLoggedInUser } from "@/lib/actions/user";

// Define interfaces for better type safety
interface AggregatedMetrics {
  spend: number;
  impressions: number;
  clicks: number;
  link_clicks: number;
  reach: number;
  leads: number;
  messages: number;
  ctr: number;
  cpc: number;
  cpm: number;
}

interface AdAccount {
  id: string;
  ad_account_id: string;
  name: string;
  aggregated_metrics: AggregatedMetrics | null;
}

interface CampaignData {
  campaign_id: string;
  name: string;
  status: string;
  type?: string;
  objective: string;
  start_date: string;
  end_date?: string;
  spend: number;
  leads: number;
  messages: number;
  reach: number;
  clicks: number;
  impressions: number;
  cpm: number;
  ctr: number;
  cpc: number;
}

interface FormattedCampaign {
  id: string;
  name: string;
  delivery: boolean;
  type: string;
  status: string;
  objective: string;
  startDate: string;
  endDate: string;
  attribution: string;
  spend: number;
  results: string;
  reach: number;
  clicks: number;
  impressions: number;
  frequency: string;
  costPerResult: string;
  cpm: number;
  ctr: number;
  cpc: number;
  platform: string;
  accountName: string;
  ad_account_id: string;
}

export default async function CampaignPage() {
  const userId = await getLoggedInUser().then((user) => user?.id);
  const supabase = await createSupabaseClient();

  const cookieStore = await cookies();
  const selectedPlatformId = cookieStore.get('platform_integration_id')?.value;

  if (!selectedPlatformId) {

    return <EmptyCampaignState type="platform" />;
  }
  const platformDetails = await getPlatformDetails(selectedPlatformId, userId);


  // Get ad accounts WITH aggregated metrics for the selected platform
  const { data: adAccounts, error: adAccountError } = await supabase
    .from("ad_accounts")
    .select("id, ad_account_id, name, aggregated_metrics")
    .eq("platform_integration_id", selectedPlatformId)
    .eq("user_id", userId);

  if (adAccountError || !adAccounts || adAccounts.length === 0) {
    return <EmptyCampaignState type="adAccount" platformName={platformDetails.platform_name} />;
  }

  // Type assertion for ad accounts
  const typedAdAccounts = adAccounts as AdAccount[];

  // Combine metrics from all ad accounts for this platform
  const accountMetrics: AggregatedMetrics = {
    spend: 0,
    impressions: 0,
    clicks: 0,
    link_clicks: 0,
    reach: 0,
    leads: 0,
    messages: 0,
    ctr: 0,
    cpc: 0,
    cpm: 0
  };

  // Update the metrics summation
  typedAdAccounts.forEach((account: AdAccount) => {
    if (account.aggregated_metrics) {
      accountMetrics.spend += account.aggregated_metrics.spend || 0;
      accountMetrics.impressions += account.aggregated_metrics.impressions || 0;
      accountMetrics.clicks += account.aggregated_metrics.clicks || 0;
      accountMetrics.link_clicks += account.aggregated_metrics.link_clicks || 0;
      accountMetrics.reach += account.aggregated_metrics.reach || 0;
      accountMetrics.leads += account.aggregated_metrics.leads || 0;
      accountMetrics.messages += account.aggregated_metrics.messages || 0;
      accountMetrics.ctr += account.aggregated_metrics.ctr || 0;
      accountMetrics.cpc += account.aggregated_metrics.cpc || 0;
      accountMetrics.cpm += account.aggregated_metrics.cpm || 0;
    }
  });

  // Get campaigns as before
  const allCampaigns: FormattedCampaign[] = [];

  for (const adAccount of typedAdAccounts) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const campaignsData: any = await getCampaignMetrics(
      supabase,
      platformDetails.platform_name,
      adAccount.ad_account_id
    );
    // Jesus create this into a function so its not so messy
    if (campaignsData?.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const formattedCampaigns: FormattedCampaign[] = campaignsData.map((campaign: any) => ({
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
        results: campaign.leads + campaign.messages > 0
          ? `${campaign.leads + campaign.messages} Leads`
          : "0 Leads",
        reach: campaign.reach,
        clicks: campaign.clicks,
        impressions: campaign.impressions,
        frequency: campaign.reach && campaign.impressions
          ? (campaign.impressions / campaign.reach).toFixed(2)
          : "0",
        costPerResult: campaign.leads + campaign.messages > 0 && campaign.spend
          ? `$${(campaign.spend / (campaign.leads + campaign.messages)).toFixed(2)}`
          : "$0.00",
        cpm: campaign.cpm,
        ctr: campaign.ctr,
        cpc: campaign.cpc,
        platform: platformDetails.platform_name,
        accountName: adAccount.name,
        ad_account_id: adAccount.ad_account_id
      }));

      allCampaigns.push(...formattedCampaigns);
    }
  }

  // Return dashboard with account-level metrics
  return (
    <CampaignDashboard
      campaigns={allCampaigns}
      userId={userId as string}
      platform={{
        id: platformDetails.id,
        name: platformDetails.platform_name
      }}
      accountMetrics={accountMetrics}
    />
  );
}
