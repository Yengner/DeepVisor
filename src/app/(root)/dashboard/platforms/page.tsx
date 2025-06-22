import { getTopPlatforms } from '@/lib/api/platforms/getTopPlatforms';
import { getTopCampaignsForPlatforms } from '@/lib/api/platforms/fetchFeaturedCampaigns';
import { getRecommendations } from '@/lib/api/openai.ts/getRecommendations';
import { getLoggedInUser } from '@/lib/actions/user.actions';
import DashboardComponent from '@/components/dashboard/DashboardComponent';
// import { createSupabaseClient } from '@/lib/utils/supabase/clients/server';
// import { redirect } from 'next/navigation';


export default async function PlatformDashboardPage() {
  // const supabase = await createSupabaseClient()

  const loggedIn = await getLoggedInUser();
  const userId = loggedIn?.id;
  const featuredPlatformsCampaigns = await getTopCampaignsForPlatforms(userId) // Getting the top campaigns for the top platforms
  // const { metrics, topPlatform, topPlatforms } = await getTopPlatforms(userId);
  const metrics = await getTopPlatforms(userId); // Getting the top platform(s) metrics
  const recommendations = await getRecommendations(userId); // Getting Chatgpt generated recommendations

  return (
      <DashboardComponent
        featuredPlatformsCampaigns={featuredPlatformsCampaigns}
        Topmetrics={metrics}
        recommendations={recommendations} />
  );
}
