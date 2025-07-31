// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "https://deno.land/std@0.191.0/dotenv/load.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js";
import { fetchPostData } from "./fetchPostData.ts";


Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("DATABASE_URL")!,
    Deno.env.get("SERVICE_ROLE_KEY")!
  );

  try {
    console.log("Starting sync_page_account_data edge function");

    // Fetch all platform integrations
    console.log("Fetching platform integrations...");
    const { data: platforms, error: platformError } = await supabase
      .from("platform_integrations")
      .select("id, platform_name, access_token");

    if (platformError || !platforms || platforms.length === 0) {
      console.error("Error fetching platforms:", platformError);
      return new Response("No platforms found", { status: 500 });
    }
    console.log("Platforms fetched:", platforms);

    let successCount = 0;
    let failureCount = 0;

    for (const platform of platforms) {
      console.log(`Processing platform: ${platform.platform_name}`);

      // Fetch all page accounts for the platform
      const { data: pageAccounts, error: pageAccountsError } = await supabase
        .from("meta_pages")
        .select(`id, page_id, access_token, instagram_account_id, platform_integration_id, name, platform_integrations(platform_name)`)
        .eq("platform_integration_id", platform.id);

      if (pageAccountsError) {
        console.error(`❌ Error fetching page accounts for platform: ${platform.platform_name}`, pageAccountsError);
        continue; // Skip to the next platform if there's an error
      }

      if (!pageAccounts || pageAccounts.length === 0) {
        console.warn(`⚠️ No page accounts found for platform: ${platform.platform_name}`);
        continue;
      }

      console.log(`✅ Found ${pageAccounts.length} page accounts for platform: ${platform.platform_name}`);


      for (const account of pageAccounts) {
        const platformName = account.platform_integrations?.platform_name; // Get platform name from relation

        if (!platformName) {
          console.warn(`⚠️ Skipping page ${account.name} due to missing platform name`);
          continue;
        }

        console.log(`Processing page accounts: ${account.name}`);

        try {
          // Fetch metrics for the ad account
          const { facebookPosts, instagramPosts } = await fetchPostData(platformName, account.page_id, account.instagram_account_id, account.access_token);

          console.log("Posts fetched successfully.");

          const date = new Date().toISOString();

          // Combine Facebook & Instagram Posts into a single array for batch insert
          const allPosts = [...facebookPosts, ...instagramPosts].map((post) => ({
            meta_pages_id: account.id,
            platform_name: post.platform_name,
            post_id: post.post_id,
            caption: post.caption,
            media_type: post.media_type,
            media_url: post.media_url,
            video_url: post.video_url,
            timestamp: post.timestamp,
            raw_json: post.raw_json, // Insights stored as JSONB
            created_at: date,
          }));

          if (allPosts.length > 0) {
            // Insert posts into Supabase
            const { error: insertError } = await supabase
              .from("meta_posts")
              .upsert(allPosts, { onConflict: ["post_id"] });

            if (insertError) {
              console.error(`Failed to insert posts for page: ${account.name}`, insertError);
              failureCount++;
            } else {
              console.log(`Successfully inserted ${allPosts.length} posts for page: ${account.name}`);
              successCount += allPosts.length;
            }
          } else {
            console.log(`No posts found for page: ${account.name}`);
          }
        } catch (fetchError) {
          console.error(`Error fetching posts for page account: ${account.name}`, fetchError);
          failureCount++;
        }
      }
    }

    console.log("Sync complete: ", { successCount, failureCount });

    return new Response(
      JSON.stringify({
        message: "Page post sync complete",
        successCount,
        failureCount,
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in edge function:", error);
    return new Response("Internal server error", { status: 500 });
  }
});