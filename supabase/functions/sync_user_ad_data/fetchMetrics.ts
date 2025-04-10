import { fetchMetaCampaignMetrics, fetchMetaAdSetMetrics, fetchMetaAdMetrics } from "/Users/yb/Desktop/deepvisor/supabase/functions/sync_user_ad_data/platforms/meta.ts";
// import { fetchGoogleCampaignMetrics, fetchGoogleAdSetMetrics, fetchGoogleAdMetrics } from "./platforms/google.ts";

export async function fetchCampaignMetricsByPlatform(platform_name, ad_account_id, accessToken, industry) {

  switch (platform_name.toLowerCase()) {
    case "meta":
      return await fetchMetaCampaignMetrics(platform_name, ad_account_id, accessToken, industry);
    // case "google":
    //   return await fetchGoogleCampaignMetrics(platform_name, supabase, accessToken);
    default:
      throw new Error(`Unsupported platform: ${platform_name}`);
  }
}

export async function fetchAdSetMetricsByPlatform(platform_name, campaignId, accessToken, industry) {
  switch (platform_name.toLowerCase()) {
    case "meta":
      console.log('started fetching meta ad set metrics')
      return await fetchMetaAdSetMetrics(platform_name, campaignId, accessToken, industry);
    // case "google":
    //   return await fetchGoogleAdSetMetrics(platform_name, campaign, supabase, accessToken);
    default:
      throw new Error(`Unsupported platform: ${platform_name}`);
  }
}

export async function fetchAdMetricsByPlatform(platform_name, adSetId, accessToken, industry) {
  switch (platform_name.toLowerCase()) {
    case "meta":
      return await fetchMetaAdMetrics(platform_name, adSetId, accessToken, industry);
    // case "google":
    //   return await fetchGoogleAdMetrics(platform_name, campaign, adSet, supabase, accessToken);
    default:
      throw new Error(`Unsupported platform: ${platform_name}`);
  }
}
