import { getDateRangeForLast365Days, getDateRangeForLastDays } from "/Users/yb/Desktop/deepvisor/supabase/functions/utils/getDynamicTimeRanges.ts";

export async function fetchMetaPostData( pageId: string, instagramAccountId: string | null, accessToken: string ) {
  console.log(`Fetching Meta post data for pageId: ${pageId}`);

  const batchUrl = `https://graph.facebook.com/v21.0`;

  // Batch Requests for Facebook & Instagram
  const batchRequests = [];

  // Fetch Facebook posts
  batchRequests.push({
    method: "GET",
    relative_url: `/${pageId}/feed?fields=id,message,created_time,attachments{media_type,media}`,
  });

  // Fetch Instagram posts if available the ID is available
  if (instagramAccountId) {
    batchRequests.push({
      method: "GET",
      relative_url: `/${instagramAccountId}/media?fields=id,caption,media_type,media_url,thumbnail_url,timestamp`,
    });
  }

  try {
    // Send batched request for both Facebook & Instagram
    const batchResponse = await fetch(batchUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ batch: batchRequests }),
    });

    if (!batchResponse.ok) {
      console.error("Batch API request failed:", await batchResponse.text());
      throw new Error(`Failed to fetch posts for account: ${pageId}`);
    }

    const batchResults = await batchResponse.json();

    // Extract data separately for Facebook and Instagram
    let facebookPosts = [];
    let instagramPosts = [];

    batchResults.forEach((result, index) => {
      if (result.code === 200) {
        const parsedBody = JSON.parse(result.body);
        if (index === 0) {
          facebookPosts = parsedBody.data || [];
        } else if (instagramAccountId) {
          instagramPosts = parsedBody.data || [];
        }
      } else {
        console.warn(`Batch API error at index ${index}:`, result);
      }
    });

    // Extract Post IDs for insights
    const facebookPostIds = facebookPosts.map((post) => post.id);
    const instagramPostIds = instagramPosts.map((post) => post.id);

    let facebookPostInsights = [];
    let instagramPostInsights = [];

    // Fetch Facebook Insights
    if (facebookPostIds.length > 0) {
      const facebookInsightsBatch = facebookPostIds.map((postId) => ({
        method: "GET",
        relative_url: `/${postId}/insights?metric=post_impressions,post_impressions_unique,post_clicks,post_reactions_like_total,post_video_views`,
      }));

      const fbInsightsResponse = await fetch(batchUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ batch: facebookInsightsBatch }),
      });

      if (fbInsightsResponse.ok) {
        const fbInsightsResults = await fbInsightsResponse.json();
        fbInsightsResults.forEach((result, index) => {
          if (result.code === 200) {
            const insights = JSON.parse(result.body).data || [];
            facebookPostInsights.push({
              post_id: facebookPostIds[index],
              insights: insights.reduce((acc, item) => {
                acc[item.name] = item.values[0].value;
                return acc;
              }, {}),
            });
          }
        });
      } else {
        console.warn("Failed to fetch Facebook insights.");
      }
    }

    // Fetch Instagram Insights
    if (instagramPostIds.length > 0) {
      const instagramInsightsBatch = instagramPostIds.map((postId) => ({
        method: "GET",
        relative_url: `/${postId}/insights?metric=impressions,reach,total_interactions,likes,comments,shares,saved,profile_visits`,
      }));

      const igInsightsResponse = await fetch(batchUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ batch: instagramInsightsBatch }),
      });

      if (igInsightsResponse.ok) {
        const igInsightsResults = await igInsightsResponse.json();
        igInsightsResults.forEach((result, index) => {
          if (result.code === 200) {
            const insights = JSON.parse(result.body).data || [];
            instagramPostInsights.push({
              post_id: instagramPostIds[index],
              insights: insights.reduce((acc, item) => {
                acc[item.name] = item.values[0].value;
                return acc;
              }, {}),
            });
          }
        });
      } else {
        console.warn("Failed to fetch Instagram insights.");
      }
    }

    // Format the final returnable data
    const formattedFacebookPosts = facebookPosts.map((post) => ({
      platform_name: "facebook",
      post_id: post.id,
      caption: post.message || null,
      media_type: post.attachments?.data?.[0]?.media_type || null,
      media_url: post.attachments?.data?.[0]?.media?.image?.src || null,
      video_url: post.attachments?.data?.[0]?.media?.source || null,
      timestamp: post.created_time,
      raw_json: JSON.stringify(
        facebookPostInsights.find((insight) => insight.post_id === post.id)
          ?.insights || {}
      ),
      created_at: new Date(),
    }));

    const formattedInstagramPosts = instagramPosts.map((post) => ({
      platform_name: "instagram",
      post_id: post.id,
      caption: post.caption || null,
      media_type: post.media_type,
      media_url: post.media_url || post.thumbnail_url || null,
      video_url: post.media_type === "VIDEO" ? post.media_url : null,
      timestamp: post.timestamp,
      raw_json: JSON.stringify(
        instagramPostInsights.find((insight) => insight.post_id === post.id)
          ?.insights || {}
      ),
      created_at: new Date(),
    }));

    return {
      facebookPosts: formattedFacebookPosts,
      instagramPosts: formattedInstagramPosts,
    };
  } catch (error) {
    console.error("Error fetching post or insights:", error);
    throw new Error("Failed to fetch post or insights.");
  }
}
