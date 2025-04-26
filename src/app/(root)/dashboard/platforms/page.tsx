import { getTopPlatforms } from '@/lib/api/platforms/getTopPlatforms';
import { getTopCampaignsForPlatforms } from '@/lib/api/platforms/fetchFeaturedCampaigns';
import { getRecommendations } from '@/lib/api/openai.ts/getRecommendations';
import { getLoggedInUser } from '@/lib/actions/user.actions';
import DashboardComponent from '@/components/dashboard/DashboardComponent';
// import { createSupabaseClient } from '@/lib/utils/supabase/clients/server';


export default async function DashboardPage() {
  // const supabase = await createSupabaseClient()

  const loggedIn = await getLoggedInUser();
  const userId = loggedIn?.id;
  const featuredPlatformsCampaigns = await getTopCampaignsForPlatforms(userId) // Getting the top campaigns for the top platforms
  // const { metrics, topPlatform, topPlatforms } = await getTopPlatforms(userId);
  const metrics = await getTopPlatforms(userId); // Getting the top platform(s) metrics
  const recommendations = await getRecommendations(userId); // Getting Chatgpt generated recommendations

  // const { data } = await supabase
  //   .from("user_onboarding")
  //   .select("completed")
  //   .eq("user_id", userId)
  //   .single();

  // // if (!data?.completed) {
  // //   return redirect("/onboarding"); // Force users to complete onboarding
  // // }

  return (
      <DashboardComponent
        featuredPlatformsCampaigns={featuredPlatformsCampaigns}
        Topmetrics={metrics}
        recommendations={recommendations} />
  );
}
