import CampaignDashboard from "@/components/campaigns/CampaignDashboard";
import { getCampaignLifetimeIncludingZeros, type CampaignLifetimeRow } from "@/lib/quieries/campaigns/getCampaignsMetrics";
import { getCampaignReviewSummary } from "@/lib/quieries/campaigns/getCampaignReviewSummary";
import { cookies } from "next/headers";
import { EmptyCampaignState } from "@/components/campaigns/EmptyStates";
import { getPlatformDetails } from "@/lib/quieries/platforms/getPlatformDetails";
import { getLoggedInUser } from "@/lib/actions/user";
import { getAdAccountData } from "@/lib/quieries/ad_accounts";
import { getAdsLifetimeIncludingZeros } from "@/lib/quieries/ads/getAdsMetrics";
import { getAdSetsLifetimeIncludingZeros } from "@/lib/quieries/adsets/getAdSetsMetrics";
import { Suspense } from "react";
import CampaignClientFallback from "./CampaignClientFallback";

interface AggregatedMetrics {
  spend: number; impressions: number; clicks: number; link_clicks: number; reach: number;
  leads: number; messages: number; ctr: number; cpc: number; cpm: number;
}

export interface FormattedCampaign {
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
  leads: number;
  messages?: number;
  link_clicks?: number;
  reach: number;
  clicks: number;
  impressions: number;
  frequency: string;
  costPerResult: string;
  cpm: number | null;
  ctr: number | null;
  cpc: number | null;
  platform: string;
  accountName: string;
  ad_account_id: string;
  review?: {
    needsReview: boolean;
    pendingCount: number;
    lastDecisionId?: string | null;
  };
}

export default async function CampaignPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const userId = await getLoggedInUser().then((u: { id: string }) => u?.id);

  const cs = await cookies();
  const selectedPlatformId = cs.get("platform_integration_id")?.value;
  const selectedAdAccountId = cs.get("ad_account_id")?.value;

  if (!selectedPlatformId || !selectedAdAccountId) {
    return <EmptyCampaignState type="platform" />;
  }

  const [platformDetails, adAccountDetails] = await Promise.all([
    getPlatformDetails(selectedPlatformId, userId),
    getAdAccountData(selectedAdAccountId, selectedPlatformId, userId),
  ]);

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

  const [campaignsData, reviewSummary] = await Promise.all([
    getCampaignLifetimeIncludingZeros(selectedAdAccountId, undefined, platformDetails.vendor),
    getCampaignReviewSummary(selectedAdAccountId),
  ]);

  const { byId: reviewByCampaign } = reviewSummary;

  const allCampaigns: FormattedCampaign[] = (campaignsData ?? []).map((c: CampaignLifetimeRow) => {
    const review = reviewByCampaign[c.id];
    const totalResults = Number(c.leads || 0) + Number(c.messages || 0);
    const spendNum = Number(c.spend || 0);

    return {
      id: c.id,
      name: c.name,
      delivery: (c.status ?? "").toUpperCase() === "ACTIVE",
      type: "Manual",
      status: c.status,
      objective: c.objective,
      startDate: c.start_date,
      endDate: c.end_date || "No End Date",
      attribution: "7-day click or view",
      spend: spendNum,
      results: totalResults > 0 ? `${totalResults} Leads` : "0 Leads",
      reach: Number(c.reach || 0),
      clicks: Number(c.clicks || 0),
      impressions: Number(c.impressions || 0),
      frequency: c.reach && c.impressions ? (Number(c.impressions) / Number(c.reach)).toFixed(2) : "0",
      costPerResult: totalResults > 0 && spendNum > 0 ? `$${(spendNum / totalResults).toFixed(2)}` : "$0.00",
      cpm: c.cpm != null ? Number(c.cpm) : null,
      ctr: c.ctr != null ? Number(c.ctr) : null,
      cpc: c.cpc != null ? Number(c.cpc) : null,
      leads: Number(c.leads || 0),
      messages: Number(c.messages || 0),
      link_clicks: Number(c.link_clicks || 0),
      platform: platformDetails.vendor,
      accountName: adAccountDetails.name,
      ad_account_id: adAccountDetails.ad_account_id,
      review: review
        ? {
          needsReview: !!review.needs_review,
          pendingCount: Number(review.actions_requiring_human || 0),
          lastDecisionId: review.last_decision_id,
        }
        : { needsReview: false, pendingCount: 0, lastDecisionId: null },
    };
  });

  const params = await searchParams;
  const campaignIds = params.campaign_id?.toString().split(',').filter(Boolean) ?? [];
  const adsetIds = params.adset_id?.toString().split(',').filter(Boolean) ?? [];
  const tabParam = (params.tab?.toString() || '').toLowerCase();

  const initialTab =
    tabParam === 'ads' && adsetIds[0] ? 'ads' :
      tabParam === 'adsets' && campaignIds[0] ? 'adsets' :
        'campaigns';

  const initialSelection = {
    tab: initialTab as 'campaigns' | 'adsets' | 'ads',
    campaignId: campaignIds[0] ?? null,
    adsetId: adsetIds[0] ?? null,
  };

  // ⬇ Prefetch only when the URL is already on those tabs
  let initialAdSets: any[] | undefined;
  let initialAds: any[] | undefined;

  if (initialSelection.tab === 'adsets' && initialSelection.campaignId) {
    initialAdSets = await getAdSetsLifetimeIncludingZeros(
      selectedAdAccountId,
      { campaignExternalId: initialSelection.campaignId }
    );
  }

  if (initialSelection.tab === 'ads' && initialSelection.adsetId) {
    initialAds = await getAdsLifetimeIncludingZeros(
      selectedAdAccountId,
      { adsetExternalId: initialSelection.adsetId }
    );
  }

  return (
    <>
      <Suspense fallback={<CampaignClientFallback />}>
        <CampaignDashboard
          campaigns={allCampaigns}
          userId={userId as string}
          platform={{ id: platformDetails.id, name: platformDetails.vendor }}
          adAccountId={selectedAdAccountId}
          accountMetrics={accountMetrics}
          initialSelection={initialSelection}
          initialAdSets={initialAdSets}
          initialAds={initialAds}
        />
      </Suspense>
    </>
  );
}