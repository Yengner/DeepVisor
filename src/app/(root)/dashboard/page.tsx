import { getLoggedInUser } from "@/lib/actions/user.actions";
import { createSupabaseClient } from "@/lib/utils/supabase/clients/server";
import { redirect } from "next/navigation";
import { getTopPlatforms } from '@/lib/api/platforms/getTopPlatforms';
import { getTopCampaignsForPlatforms } from '@/lib/api/platforms/fetchFeaturedCampaigns';
import { getRecommendations } from '@/lib/api/openai.ts/getRecommendations';
import DashboardClient from "./components/DashboardClient";

export default async function MainDashboardPage() {
  const supabase = await createSupabaseClient();
  const loggedIn = await getLoggedInUser();
  
  if (!loggedIn) {
    return redirect("/login");
  }
  
  const userId = loggedIn?.id;

  // Check if onboarding is completed
  const { data: profileData } = await supabase
    .from("profiles")
    .select("onboarding_completed, business_name")
    .eq("id", userId)
    .single();

  if (!profileData?.onboarding_completed) {
    return redirect("/onboarding");
  }

  // Fetch all data needed for the dashboard
  const { metrics, topPlatform, topPlatforms } = await getTopPlatforms(userId);
  const { topCampaigns } = await getTopCampaignsForPlatforms(userId);
  const recommendations = await getRecommendations(userId);
  
  // Get profile/business info
  const businessName = profileData?.business_name || loggedIn?.first_name + "'s Business";

  // Return the client component with all data
  return (
    <DashboardClient
      userData={loggedIn}
      businessName={businessName}
      platforms={topPlatforms || []}
      featuredPlatform={topPlatform}
      platformMetrics={metrics || []}
      campaigns={topCampaigns || []}
      recommendations={recommendations || []}
    />
  );
}

