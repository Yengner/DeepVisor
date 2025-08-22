import { cookies } from "next/headers";
import { EmptyCampaignState } from "@/components/campaigns/EmptyStates";
import { getLoggedInUser } from "@/lib/actions/user";
import { ReportsClient } from "./components/ReportsClient";
import { getAdAccountData } from "@/lib/quieries/ad_accounts";
import { getAdSetsLifetimeIncludingZeros } from "@/lib/quieries/adsets/getAdSetsMetrics";
import { getAdsLifetimeIncludingZeros } from "@/lib/quieries/ads/getAdsMetrics";
import { Suspense } from "react";
import ReportsClientFallback from "./components/ReportClientFallback";
import { getCampaignLifetimeIncludingZeros } from "@/lib/quieries/campaigns";

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

  const cookieStore = await cookies();
  const selectedPlatformId = cookieStore.get('platform_integration_id')?.value;
  const selectedAdAccountId = cookieStore.get('ad_account_id')?.value;

  if (!selectedPlatformId || !selectedAdAccountId) {
    return <EmptyCampaignState type="platform" />;
  }

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const timeIncrementArray = rawArray.map((row: any) => ({
    ...row,
    date_stop: formatDate(row.date_stop),
  }));

  let data;
  if (viewType === "adAccount") {
    data = {
      campaignsMetrics: await getCampaignLifetimeIncludingZeros(selectedAdAccountId),
      adAccountData,
      timeIncrementArray
    };
  } else if (viewType === "campaigns") {
    data = {
      campaignMetrics: await getCampaignLifetimeIncludingZeros(selectedAdAccountId, campaignIds[0]),
      adSetsMetrics: await getAdSetsLifetimeIncludingZeros(selectedAdAccountId, { campaignExternalId: campaignIds[0] }),
    };
  } else if (viewType === "adsets") {
    data = {
      adSetMetrics: await getAdSetsLifetimeIncludingZeros(selectedAdAccountId, { campaignExternalId: campaignIds[0], adsetExternalId: adsetIds[0] }),
      adsMetrics: await getAdsLifetimeIncludingZeros(selectedAdAccountId, { adsetExternalId: adsetIds[0] }),
    };
  } else if (viewType === "ads") {
    data = { adMetrics: await getAdsLifetimeIncludingZeros(selectedAdAccountId, { adsetExternalId: adsetIds[0], adExternalId: adIds[0] }) };
  }

  return (
    <>
      <Suspense fallback={<ReportsClientFallback />}>
        <ReportsClient data={data} viewType={viewType} />
      </Suspense>
    </>
  );
};

