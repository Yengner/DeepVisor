import CampaignDashboard from "@/components/campaigns/CampaignDashboard";
import { getCampaignLifetimeIncludingZeros } from "@/lib/quieries/campaigns/getCampaignsMetrics";
import { cookies } from "next/headers";
import { EmptyCampaignState } from "@/components/campaigns/EmptyStates";
import { getPlatformDetails } from "@/lib/quieries/platforms/getPlatformDetails";
import { getLoggedInUser } from "@/lib/actions/user";
import { getAdAccountData } from "@/lib/quieries/ad_accounts";
import { CampaignMetrics } from "@/components/campaigns/types";

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
  const userId = await getLoggedInUser().then((user: { id: string }) => user?.id);

  const cookieStore = await cookies();
  const selectedPlatformId = cookieStore.get('platform_integration_id')?.value;
  const selectedAdAccountId = cookieStore.get('ad_account_id')?.value;

  if (!selectedPlatformId || !selectedAdAccountId) {
    return <EmptyCampaignState type="platform" />;
  }
  const platformDetails = await getPlatformDetails(selectedPlatformId, userId);
  const adAccountDetails = await getAdAccountData(selectedAdAccountId, selectedPlatformId, userId);

  const accountMetrics: AggregatedMetrics = {
    spend: adAccountDetails.aggregated_metrics?.spend || 0,
    impressions: adAccountDetails.aggregated_metrics?.impressions || 0,
    clicks: adAccountDetails.aggregated_metrics?.clicks || 0,
    link_clicks: adAccountDetails.aggregated_metrics?.link_clicks || 0,
    reach: adAccountDetails.aggregated_metrics?.reach || 0,
    leads: adAccountDetails.aggregated_metrics?.leads || 0,
    messages: adAccountDetails.aggregated_metrics?.messages || 0,
    ctr: adAccountDetails.aggregated_metrics?.ctr || 0,
    cpc: adAccountDetails.aggregated_metrics?.cpc || 0,
    cpm: adAccountDetails.aggregated_metrics?.cpm || 0,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const campaignsData: any = await getCampaignLifetimeIncludingZeros(
    adAccountDetails.id,
    undefined,
    platformDetails.platform_name,
  );

  const allCampaigns: FormattedCampaign[] = (campaignsData ?? []).map((campaign: CampaignMetrics) => ({
    id: campaign.id,
    name: campaign.name,
    delivery: (campaign.status ?? "").toUpperCase() === "ACTIVE",
    type: "Manual",
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
    costPerResult: Number(campaign.leads) + Number(campaign.messages) > 0 && Number(campaign.spend)
      ? `$${(Number(campaign.spend) / (Number(campaign.leads) + Number(campaign.messages))).toFixed(2)}`
      : "$0.00",
    cpm: campaign.cpm,
    ctr: campaign.ctr,
    cpc: campaign.cpc,
    platform: platformDetails.platform_name,
    accountName: adAccountDetails.name,
    ad_account_id: adAccountDetails.ad_account_id
  }));

  // Return dashboard with account-level metrics
  return (
    <CampaignDashboard
      campaigns={allCampaigns}
      userId={userId as string}
      platform={{
        id: platformDetails.id,
        name: platformDetails.platform_name
      }}
      adAccountId={selectedAdAccountId}
      accountMetrics={accountMetrics}
    />
  );
}
