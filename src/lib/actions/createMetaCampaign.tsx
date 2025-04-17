"use server";
import { createSupabaseClient } from "../utils/supabase/clients/server";
import { getLoggedInUser } from "./user.actions";

export async function createMetaCampaign(formData: any) {
  const supabase = await createSupabaseClient();
  const loggedIn = await getLoggedInUser();
  const userId = loggedIn?.id;

  if (!userId) {
    throw new Error("User not authenticated");
  }

  const { data: integration, error: integrationError } = await supabase
    .from("platform_integrations")
    .select("access_token, id")
    .eq("user_id", userId)
    .eq("platform_name", "meta")
    .single();

  if (integrationError || !integration?.access_token) {
    throw new Error("Failed to fetch access token");
  }

  const { data: adAccount, error: adError } = await supabase
    .from("ad_accounts")
    .select("ad_account_id")
    .eq("user_id", userId)
    .eq("platform_integration_id", integration.id)
    .single();

  if (adError || !adAccount?.ad_account_id) {
    throw new Error("Failed to fetch ad account");
  }

  const adAccountId = adAccount.ad_account_id;
  const accessToken = integration.access_token;

  let campaignId = "";
  let adsetId = "";
  let creativeId = "";


  // Create Campaign
  try {
    const url = `https://graph.facebook.com/v21.0/${adAccountId}/campaigns`;

    const params = {
      name: formData.campaignName,
      objective: formData.objective,
      status: "PAUSED",
      special_ad_categories: "NONE", // I am starting off with just salons and small service businesses like those. This should not be included then.
      campaign_budget_optimization: "true", // Always true
      daily_budget: formData.budget * 100, // Daily budget in cents to dollars
      bid_strategy: "LOWEST_COST_WITHOUT_CAP" // Always lowest cost without cap
    };

    let campaignRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...params, access_token: accessToken })
    });

    if (!campaignRes.ok) {
      const text = await campaignRes.text();
      console.error("❌ Facebook API Error (Campaign):", text);
      throw new Error("Failed to create campaign. Check logs for full response.");
    }

    const campaignData = await campaignRes.json();
    campaignId = campaignData.id;
    console.log("✅ Campaign created:", campaignData);
  } catch (err) {
    console.error("Error in Campaign creation:", err);
    throw err;
  }

  // Create Ad Set
  try {
    const adsetUrl = `https://graph.facebook.com/v21.0/${adAccountId}/adsets`;

    const adsetParams = {
      name: formData.adsetName || `${formData.campaignName} - ${formData.city || 'Area'} - ${new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} - WA`,  
      campaign_id: campaignId,
      billing_event: "IMPRESSIONS", // Always impressions
      optimization_goal: "CONVERSATIONS", // Always conversations
      destination_type: "WHATSAPP", // Always WhatsApp Remember this should be customizable but for now it is hard coded
      targeting: {
        age_max: 65,
        age_min: 18,
        geo_locations: {
          custom_locations: [
            {
              distance_unit: "mile",
              latitude: 27.979849,
              longitude: -82.41394,
              radius: 30,
              primary_city_id: 2429990,
              region_id: 3852,
              country: "US"
            }
          ],
          location_types: ["home", "recent"]
        },
        targeting_automation: {
          advantage_audience: 1
        }
      },
      promoted_object: {
        page_id: "363698073503849"
        // whatsapp_phone_number: "18138632868"
      },
      status: "PAUSED"
    };

    const adSetRes = await fetch(adsetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...adsetParams, access_token: accessToken })
    });

    if (!adSetRes.ok) {
      const text = await adSetRes.text();
      console.error("❌ Facebook API Error (Ad Set):", text);
      throw new Error("Failed to create ad set. Check logs for full response.");
    }

    const adsetData = await adSetRes.json();
    adsetId = adsetData.id;
    console.log("✅ Ad Set created:", adsetData);
  } catch (err) {
    console.error("Error in Ad Set creation:", err);
    throw err;
  }

  // Create Ad Creative
  try {
    const creativeUrl = `https://graph.facebook.com/v21.0/${adAccountId}/adcreatives`;

    const creativeParams = {
      name: "WA Click-to-Chat Creative",
      degrees_of_freedom_spec: {
        creative_features_spec: {
          standard_enhancements: { enroll_status: "OPT_IN" },
          image_touchups: { enroll_status: "OPT_IN" },
          STANDARD_ENHANCEMENTS_CATALOG: { enroll_status: "OPT_IN" },
          text_optimizations: { enroll_status: "OPT_IN" }
        }
      },
      object_story_spec: {
        page_id: "363698073503849",
        instagram_user_id: "17841464174216738",
        link_data: {
          image_hash: "b01f66bb94e8ac207b4c407d4b2197aa",
          message: "Chat with us on WhatsApp for more info!",
          call_to_action: {
            type: "WHATSAPP_MESSAGE",
            value: { app_destination: "WHATSAPP" }
          }
        },
        link: "https://api.whatsapp.com/send",
        page_welcome_message: "Hello, I am interested in the offer."
      }
    };

    const creativeRes = await fetch(creativeUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...creativeParams, access_token: accessToken })
    });

    if (!creativeRes.ok) {
      const text = await creativeRes.text();
      console.error("❌ Facebook API Error (Creative):", text);
      throw new Error("Failed to create creative. Check logs for full response.");
    }

    const creativeData = await creativeRes.json();
    creativeId = creativeData.id;
    console.log("✅ Creative created:", creativeData);
  } catch (err) {
    console.error("Error in Creative creation:", err);
    throw err;
  }

  // Create Ad
  try {
    const adUrl = `https://graph.facebook.com/v21.0/${adAccountId}/ads`;

    const adParams = {
      name: "Test Ad",
      adset_id: adsetId,
      creative: {
        creative_id: creativeId
      },
      status: "PAUSED",
      access_token: accessToken
    };

    const adsRes = await fetch(adUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(adParams)
    });

    if (!adsRes.ok) {
      const text = await adsRes.text();
      console.error("❌ Facebook API Error (Ad):", text);
      throw new Error("Failed to create ad. Check logs for full response.");
    }

    const adData = await adsRes.json();
    console.log("✅ Ad created:", adData);
  } catch (err) {
    console.error("Error in Ad creation:", err);
    throw err;
  }

  return { success: true };
}