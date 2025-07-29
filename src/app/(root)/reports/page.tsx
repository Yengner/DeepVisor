import { cookies } from "next/headers";
import { EmptyCampaignState } from "@/components/campaigns/EmptyStates";
import { getLoggedInUser } from "@/lib/actions/user";
import { ReportsClient } from "./components/ReportsClient";
import { getAdAccountData } from "@/lib/quieries/ad_accounts";
import { getCampaignMetrics } from "@/lib/quieries/campaigns";
import { getAdSetsMetrics } from "@/lib/quieries/adsets/getAdSetsMetrics";
import { getAdsMetrics } from "@/lib/quieries/ads/getAdsMetrics";
import { Suspense } from "react";
import ReportsClientFallback from "./components/ReportClientFallback";

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
};

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const userId = await getLoggedInUser().then((user: { id: string }) => user?.id);

  // Get platform ID & Selected Ad Account Id from cookies
  const cookieStore = await cookies();
  const selectedPlatformId = cookieStore.get('platform_integration_id')?.value;
  if (!selectedPlatformId) {
    return <EmptyCampaignState type="platform" />;
  }

  const selectedAdAccountId = cookieStore.get('ad_account_id')?.value;
  if (!selectedAdAccountId) {
    return <EmptyCampaignState type="adAccount" platformName={selectedPlatformId} />;
  }
  // 

  const params = await searchParams;
  const timeIncrement = params.time_increment?.toString() || "30";
  const campaignIds = params.campaign_id?.toString().split(',').filter(Boolean) || [];
  const adsetIds = params.adset_id?.toString().split(',').filter(Boolean) || [];
  const adIds = params.ad_id?.toString().split(',').filter(Boolean) || [];

  let viewType: "adAccount" | "campaigns" | "adsets" | "ads" = "adAccount";
  if (adIds.length) viewType = "ads";
  else if (adsetIds.length) viewType = "adsets";
  else if (campaignIds.length) viewType = "campaigns";

  const adAccountData = await getAdAccountData(selectedAdAccountId, selectedPlatformId, userId);
  const rawArray = adAccountData?.time_increment_metrics[timeIncrement];

  const timeIncrementArray = rawArray.map((row: any) => ({
    ...row,
    date_stop: formatDate(row.date_stop),
  }));

  let data;
  if (viewType === "adAccount") {
    data = {
      campaignsMetrics: await getCampaignMetrics(adAccountData.ad_account_id),
      adAccountData,
      timeIncrementArray
    };
  } else if (viewType === "campaigns") {
    data = {
      campaignMetrics: await getCampaignMetrics(adAccountData.ad_account_id, campaignIds[0]),
      adSetsMetrics: await getAdSetsMetrics(campaignIds[0]),
    };
  } else if (viewType === "adsets") {
    data = {
      adSetMetrics: await getAdSetsMetrics(campaignIds[0], adsetIds[0]),
      adsMetrics: await getAdsMetrics(adsetIds[0]),
    };
  } else if (viewType === "ads") {
    data = { adMetrics: await getAdsMetrics(adsetIds[0], adIds[0]) };
  }

  return (
    <>
      <Suspense fallback={<ReportsClientFallback />}>
        <ReportsClient data={data} viewType={viewType} />
      </Suspense>
    </>
  );
};

