import { fetchMetaAdAccountMetrics } from "/Users/yb/Desktop/deepvisor/supabase/functions/sync_ad_account_metrics/platforms/meta.ts";
// Import future platform-specific metrics functions here
import { fetchTikTokAggregatedMetrics } from "/Users/yb/Desktop/deepvisor/supabase/functions/sync_ad_account_metrics/platforms/tiktok.ts";
// import { fetchGoogleAggregatedMetrics } from "./platforms/google";

/**
 * Fetch aggregated metrics for a given platform and ad account.
 * @param platform - The name of the platform (e.g., "meta", "tiktok", "google")
 * @param adAccountId - The ID of the ad account
 * @param accessToken - The access token for the platform
 * @returns Aggregated metrics as a record
 */
export const fetchAggregatedMetrics = async (platform: string, adAccountId: string, accessToken: string ): Promise<Record<string, any>> => {
  switch (platform) {
    case "meta":
      return await fetchMetaAdAccountMetrics(adAccountId, accessToken);

    // Future cases for other platforms
    case "tiktok":
      return await fetchTikTokAggregatedMetrics();

    case "youtube":
      return "youtube function not implemented";

    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
};
