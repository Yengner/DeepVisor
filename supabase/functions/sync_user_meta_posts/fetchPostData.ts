import { fetchMetaPostData } from "/Users/yb/Desktop/deepvisor/supabase/functions/sync_user_meta_posts/platforms/meta.ts";
// Import future platform-specific metrics functions here

/**
 * Fetch aggregated metrics for a given platform and ad account.
 * @param platform - The name of the platform (e.g., "meta", "tiktok", "google")
 * @param adAccountId - The ID of the ad account
 * @param accessToken - The access token for the platform
 * @returns Aggregated metrics as a record
 */
export const fetchPostData = async (platform: string, pageId: string, instagramAccountId: string, accessToken: string ): Promise<Record<string, any>> => {
  switch (platform) {
    case "meta":
      return await fetchMetaPostData(pageId, instagramAccountId, accessToken);

    // Future cases for other platforms
    // case "tiktok":
    //   return await fetchTiktokPostData();

    // case "youtube":
    //   return "youtube function not implemented";

    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
};
