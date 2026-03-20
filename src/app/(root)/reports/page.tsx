import { EmptyCampaignState } from "@/components/campaigns/EmptyStates";
import { ReportsClient } from "./components/ReportsClient";
import { Suspense } from "react";
import ReportsClientFallback from "./components/ReportClientFallback";
import {
  getAdAccountData,
  getAdSetsLifetimeIncludingZeros,
  getAdsLifetimeIncludingZeros,
  getCampaignLifetimeIncludingZeros,
} from '@/lib/server/data';
import { formatDate } from "@/components/utils/utils";
import { getCurrentSelection } from "@/lib/server/actions/app/selection";
import { getRequiredAppContext } from "@/lib/server/actions/app/context";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { businessId } = await getRequiredAppContext();

  const { selectedPlatformId, selectedAdAccountId } = await getCurrentSelection();

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

  const adAccountData = await getAdAccountData(selectedAdAccountId, selectedPlatformId, businessId);
  if (!adAccountData) {
    return <EmptyCampaignState type="adAccount" />;
  }

  const rawArray = adAccountData.time_increment_metrics[timeIncrement] ?? [];

  const timeIncrementArray = rawArray.map((row) => ({
    ...row,
    date_stop: formatDate(row.date_stop ?? ''),
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
