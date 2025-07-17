import DashboardClient from "./components/DashboardClient";
import { cookies } from "next/headers";
import { EmptyCampaignState } from "@/components/campaigns/EmptyStates";
import { getAdAccountData, getPlatformData, getPlatformDetails, getTopAdAccountCampaigns, getTopPlatformsCampaigns } from "@/lib/api/platforms/actions";
import { getLoggedInUser } from "@/lib/actions/user.actions";


export default async function MainDashboardPage() {
  // Fetch user data
  const user = await getLoggedInUser();
  const userId = user?.id;
  // Get platform ID from cookies
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
  const topAdAccountCampaigns = await getTopAdAccountCampaigns(adAccountData.ad_account_id);

  // const platformData = await getPlatformData(selectedPlatformId);
  // const topCampaigns = await getTopPlatformsCampaigns(selectedPlatformId, selectedAdAccountId);
  // const recommendations = await getRecommendations(userId);
  return (
    <DashboardClient
      userData={user}
      platform={platformDetails}
      adAccountData={adAccountData}
      topAdAccountCampaigns={topAdAccountCampaigns}
    />
  );
}

