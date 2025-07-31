import DashboardClient from "./components/DashboardClient";
import { cookies } from "next/headers";
import { EmptyCampaignState } from "@/components/campaigns/EmptyStates";
import { getLoggedInUser } from "@/lib/actions/user";
import { getPlatformDetails } from "@/lib/quieries/platforms";
import { getAdAccountData } from "@/lib/quieries/ad_accounts";

export default async function MainDashboardPage() {

  const user = await getLoggedInUser();
  const userId = user?.id;

  const cookieStore = await cookies();
  const selectedPlatformId = cookieStore.get('platform_integration_id')?.value;
  const selectedAdAccountId = cookieStore.get('ad_account_id')?.value;

  if (selectedPlatformId === undefined) {
    return <EmptyCampaignState type="platform" />;
  } else if (selectedAdAccountId === undefined) {
    const platformDetails = await getPlatformDetails(selectedPlatformId, userId);
    return <EmptyCampaignState type="adAccount" platformName={platformDetails.platform_name} />;
  }


  const platformDetails = await getPlatformDetails(selectedPlatformId, userId);
  const adAccountData = await getAdAccountData(selectedAdAccountId, selectedPlatformId, userId);
  // const topAdAccountCampaigns = await getAdAccountTopCampaigns(adAccountData.ad_account_id);

  // const platformData = await getPlatformData(selectedPlatformId);
  // const topCampaigns = await getTopPlatformsCampaigns(selectedPlatformId, selectedAdAccountId);
  // const recommendations = await getRecommendations(userId);
  return (
    <DashboardClient
      userData={user}
      platform={platformDetails}
      adAccountData={adAccountData}
    />
  );
}

