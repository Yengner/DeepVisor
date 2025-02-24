import "https://deno.land/std@0.191.0/dotenv/load.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js";
import { fetchCampaignMetricsByPlatform, fetchAdSetMetricsByPlatform, fetchAdMetricsByPlatform } from "/Users/yb/Desktop/deepvisor/supabase/functions/sync_ad_data/fetchMetrics.ts";

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  //SUPABASE_URL
  //SUPABASE_SERVICE_ROLE_KEY
  try {
    console.log("Starting sync_ad_data edge function");

    // Fetch all ad accounts
    const { data: adAccounts, error: adAccountError } = await supabase
      .from("ad_accounts")
      .select(`
        ad_account_id,
        name,
        industry_id,
        platform_integration_id,
        platform_integrations 
          access_token,
          platform_name
        )
      `);

    if (adAccountError || !adAccounts || adAccounts.length === 0) {
      console.error("No ad accounts found or failed to fetch them:", adAccountError);
      return new Response("No ad accounts found", { status: 500 });
    }

    console.log(adAccounts);
    console.log(`Fetched ${adAccounts.length} ad accounts`);

    let successCount = 0;
    let failureCount = 0;

    for (const adAccount of adAccounts) {

      console.log(`Processing ad account: ${adAccount.name} (${adAccount.ad_account_id}) for platform: ${adAccount.platform_integrations.platform_name}`);

      try {
        // Fetch and upsert campaigns
        const { maximumMetrics, additionalMetrics } = await fetchCampaignMetricsByPlatform(adAccount.platform_integrations.platform_name, adAccount.ad_account_id, adAccount.platform_integrations.access_token, adAccount.industry_id);

        if (maximumMetrics && maximumMetrics.length > 0) {
          const campaignsToUpsert = maximumMetrics.map((campaign) => (
            {
              ...campaign,
              today_metrics: additionalMetrics['today_metrics']?.find((c) => c.campaign_id === campaign.campaign_id) || null,
              yesterday_metrics: additionalMetrics['yesterday_metrics']?.find((c) => c.campaign_id === campaign.campaign_id) || null,
              last_7d_metrics: additionalMetrics['last_7d_metrics']?.find((c) => c.campaign_id === campaign.campaign_id) || null,
              last_30d_metrics: additionalMetrics['last_30d_metrics']?.find((c) => c.campaign_id === campaign.campaign_id) || null,
              this_month_metrics: additionalMetrics['this_month_metrics']?.find((c) => c.campaign_id === campaign.campaign_id) || null,
              last_month_metrics: additionalMetrics['last_month_metrics']?.find((c) => c.campaign_id === campaign.campaign_id) || null,
            }));

          console.log(campaignsToUpsert)
          const { error: campaignsError } = await supabase
            .from("campaign_metrics")
            .upsert(campaignsToUpsert, { onConflict: ["campaign_id"] }); // Ensure campaign_id is unique

          if (campaignsError) throw campaignsError;

          console.log(`Upserted ${campaignsToUpsert.length} campaigns for ad account: ${adAccount.name}`);
        }

        for (const campaign of maximumMetrics) {
          // Fetch and upsert ad sets
          console.log(`Fetching ad sets for campaign: ${campaign.name}, platform: ${adAccount.platform_integrations.platform_name}, campaign_id: ${campaign.campaign_id}, access_token: ${adAccount.platform_integrations.access_token}`);
          const adSets = await fetchAdSetMetricsByPlatform(adAccount.platform_integrations.platform_name, campaign.campaign_id, adAccount.platform_integrations.access_token, adAccount.industry_id);
          if (adSets.length > 0) {
            const { error: adSetsError } = await supabase
              .from("adset_metrics")
              .upsert(adSets, { onConflict: ["adset_id"] }); // Ensure adset_id is unique
            if (adSetsError) throw adSetsError;
            console.log(`Upserted ${adSets.length} ad sets for campaign: ${campaign.name}`);
          }

          for (const adSet of adSets) {
            // Fetch and upsert ads
            const ads = await fetchAdMetricsByPlatform(adAccount.platform_integrations.platform_name, adSet.adset_id, adAccount.platform_integrations.access_token, adAccount.industry_id);
            if (ads.length > 0) {
              const { error: adsError } = await supabase
                .from("ad_metrics")
                .upsert(ads, { onConflict: ["ad_id"] }); // Ensure ad_id is unique
              if (adsError) throw adsError;
              console.log(`Upserted ${ads.length} ads for ad set: ${adSet.name}`);
              successCount += ads.length;
            }
          }
        }
      } catch (error) {
        console.error(`Error processing ad account ${adAccount.name}:`, error);
        failureCount++;
        continue;
      }
    }

    console.log(`Sync completed: ${successCount} successful upserts, ${failureCount} failures.`);
    return new Response("Sync complete", { status: 200 });
  } catch (error) {
    console.error("Unexpected error during sync:", error);
    return new Response("Internal server error", { status: 500 });
  }
});
