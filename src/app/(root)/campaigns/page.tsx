import { loadTableDelivery } from '@/lib/server/campaigns/tableDelivery';
import CampaignDashboard from "@/components/campaigns/CampaignDashboard";
import { EmptyCampaignState } from "@/components/campaigns/EmptyStates";
import { Suspense } from "react";
import CampaignClientFallback from "./CampaignClientFallback";
import { resolveCurrentSelection } from "@/lib/server/actions/app/selection";
import { getRequiredAppContext } from "@/lib/server/actions/app/context";
import {
  getAdAccountData,
  getAdSetsLifetimeIncludingZeros,
  getAdsLifetimeIncludingZeros,
  getCampaignLifetimeIncludingZeros,
  getPlatformDetails,
} from '@/lib/server/data';
import type { AdLifetimeRow, AdSetLifetimeRow, CampaignLifetimeRow } from '@/lib/server/data';

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
  calls?: number;
  metricsAvailable?: boolean;
  link_clicks?: number;
  reach: number | null;
  clicks: number;
  impressions: number;
  frequency: string;
  costPerResult: number | null;
  cpm: number | null;
  ctr: number | null;
  cpc: number | null;
  platform: string;
  accountName: string;
  ad_account_id: string;
}

export default async function CampaignPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { businessId } = await getRequiredAppContext();

  const { selectedPlatformId, selectedAdAccountId } = await resolveCurrentSelection(businessId);

  if (!selectedPlatformId || !selectedAdAccountId) {
    return <EmptyCampaignState type="platform" />;
  }

  const [platformDetails, adAccountDetails] = await Promise.all([
    getPlatformDetails(selectedPlatformId, businessId),
    getAdAccountData(selectedAdAccountId, selectedPlatformId, businessId),
  ]);

  if (!platformDetails || platformDetails.status !== "connected") {
    return <EmptyCampaignState type="platform" />;
  }

  if (!adAccountDetails) {
    return <EmptyCampaignState type="adAccount" platformName={platformDetails.vendor} />;
  }
  //
  //Refactor # Too many calculation on pre-server load, Do this on the database to pre fetch dashboard data and then grab it. 
  //
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

  const campaignsData = await getCampaignLifetimeIncludingZeros(
    selectedAdAccountId,
    undefined,
    platformDetails.vendor
  );

  const deliveryState = await loadTableDelivery(businessId, selectedAdAccountId, selectedPlatformId);
  const activeKeys = new Set(deliveryState.activeKeys);

  const allCampaigns: FormattedCampaign[] = (campaignsData ?? []).map((c: CampaignLifetimeRow) => {
    const totalResults = Number(c.leads || 0) + Number(c.messages || 0) + Number(c.calls || 0);
    const spendNum = Number(c.spend || 0);

    return {
      id: c.id,
      name: c.name,
      delivery: activeKeys.has(`campaign:${c.id}`),
      type: "Manual",
      status: c.status,
      objective: c.objective,
      startDate: c.start_date,
      endDate: c.end_date || "",
      attribution: "Unavailable",
      spend: spendNum,
      results: c.metricsAvailable ? `${totalResults} Results` : "Unavailable",
      metricsAvailable: c.metricsAvailable,
      calls: c.calls,
      reach: c.reach,
      clicks: Number(c.clicks || 0),
      impressions: Number(c.impressions || 0),
      frequency: "Unavailable",
      costPerResult: c.metricsAvailable && totalResults > 0 ? spendNum / totalResults : null,
      cpm: c.cpm != null ? Number(c.cpm) : null,
      ctr: c.ctr != null ? Number(c.ctr) : null,
      cpc: c.cpc != null ? Number(c.cpc) : null,
      leads: Number(c.leads || 0),
      messages: Number(c.messages || 0),
      link_clicks: Number(c.link_clicks || 0),
      platform: platformDetails.vendor,
      accountName: adAccountDetails.name ?? "Unknown account",
      ad_account_id: adAccountDetails.ad_account_id,
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

  let initialAdSets: AdSetLifetimeRow[] | undefined;
  let initialAds: AdLifetimeRow[] | undefined;

  if (initialSelection.tab !== 'campaigns' && initialSelection.campaignId) {
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
          deliveryState={deliveryState}
          platform={{ id: platformDetails.id, name: platformDetails.vendor }}
          adAccountId={selectedAdAccountId}
          currencyCode={adAccountDetails.currency_code}
          accountTimezone={adAccountDetails.timezone ?? null}
          accountMetrics={accountMetrics}
          initialSelection={initialSelection}
          initialAdSets={initialAdSets}
          initialAds={initialAds}
        />
      </Suspense>
    </>
  );
}
