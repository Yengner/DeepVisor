import { createSupabaseClient } from "@/lib/utils/supabase/clients/server";
import { cookies } from "next/headers";
import { EmptyCampaignState } from "@/components/campaigns/EmptyStates";
import { getCampaignsWithAdSetsAndAds } from "@/lib/quieries/campaigns/getCampaignsWithAdSetsAndAds";
import { getLoggedInUser } from "@/lib/actions/user";
import { getPlatformDetails } from "@/lib/quieries/platforms";
import { ReportsClient } from "./components/ReportsClient";


export default async function ReportsPage() {
  const user = await getLoggedInUser();
  const userId = user?.id;
  const supabase = await createSupabaseClient();

  // Get platform ID from cookies
  const cookieStore = await cookies();
  const selectedPlatformId = cookieStore.get('platform_integration_id')?.value;

  if (!selectedPlatformId) {

    return <EmptyCampaignState type="platform" />;
  }
  const platformDetails = await getPlatformDetails(selectedPlatformId, userId);


  const selectedAdAccountId = cookieStore.get('ad_account_id')?.value;

  if (!selectedAdAccountId) {
    return <EmptyCampaignState type="adAccount" platformName={platformDetails.platform_name} />;
  }

  const { data: adAccountData, error: adAccountError } = await supabase
    .from('ad_accounts')
    .select('ad_account_id, name')
    .eq('id', selectedAdAccountId)
    .single();

  if (adAccountError || !adAccountData) {
    return <EmptyCampaignState type="adAccount" platformName={platformDetails.platform_name} />
  }

  const data = await getCampaignsWithAdSetsAndAds(adAccountData.ad_account_id);
  return (
    // <ReportsClient
    //   rawData={data}
    // />
    <ReportsClient />
  );
};

