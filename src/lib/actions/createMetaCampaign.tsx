"use server";
import { createSupabaseClient } from "../utils/supabase/clients/server";
import { getLoggedInUser } from "./user.actions";

export async function createMetaCampaign() {
  try {
    const supabase = await createSupabaseClient();
    const loggedIn = await getLoggedInUser();
    const userId = loggedIn?.id;

    if (!userId) {
      throw new Error("User not authenticated");
    }

    // Get Meta access token from platform_integrations
    const { data: integration, error: integrationError } = await supabase
        .from("platform_integrations")
        .select("access_token, id")
        .eq("user_id", userId)
        .eq("platform_name", "meta")
        .single();
    
    if (integrationError || !integration?.access_token) {
        throw new Error("Failed to fetch access token");
    }
    //
    // Get first ad account associated with this user
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

    const url = `https://graph.facebook.com/v21.0/${adAccountId}/campaigns`;

    const params = {
      name: "Test 2",
      objective: "OUTCOME_LEADS",
      status: "PAUSED",
      special_ad_categories: "NONE",
      campaign_budget_optimization: "true",
      daily_budget: "20000",
      bid_strategy: "LOWEST_COST_WITHOUT_CAP"
    };

    // Create Campaign
    let response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...params, access_token: accessToken })
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("❌ Facebook API Error (Campaign):", text);
      throw new Error("Failed to create campaign. Check logs for full response.");
    }

    const campaignData = await response.json();
    const campaignId = campaignData.id;

    // Create Ad Set after Campaign
    const adsetUrl = `https://graph.facebook.com/v21.0/${adAccountId}/adsets`;

    const adsetParams = {
      name: "Test Ad Set",
      campaign_id: campaignId,
      billing_event: "IMPRESSIONS",
      optimization_goal: "CONVERSATIONS",
      destination_type: "WHATSAPP",
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

    response = await fetch(adsetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...adsetParams, access_token: accessToken })
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("❌ Facebook API Error (Ad Set):", text);
      throw new Error("Failed to create ad set. Check logs for full response.");
    }

    const adsetData = await response.json();
    const adsetId = adsetData.id;
    console.log("✅ Ad Set created:", adsetData);

    // Create Ad Creative
    const creativeUrl = `https://graph.facebook.com/v21.0/${adAccountId}/adcreatives`;

    const creativeParams = {
      name: "WA Click-to-Chat Creative",
      degrees_of_freedom_spec: {
        creative_features_spec: {
          standard_enhancements: {enroll_status: "OPT_IN" },
          image_touchups: { enroll_status: "OPT_IN" },
          STANDARD_ENHANCEMENTS_CATALOG:{ enroll_status: "OPT_IN" },
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

    response = await fetch(creativeUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...creativeParams, access_token: accessToken })
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("❌ Facebook API Error (Creative):", text);
      throw new Error("Failed to create creative. Check logs for full response.");
    }

    const creativeData = await response.json();
    console.log("✅ Creative Created:", creativeData);

    // Create Ad
    const adUrl = `https://graph.facebook.com/v21.0/${adAccountId}/ads`;

    const adParams = {
      name: "Test Ad",
      adset_id: adsetId,
      creative: {
        creative_id: creativeData.id
      },
      status: "PAUSED",
      access_token: accessToken
    };

    response = await fetch(adUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(adParams)
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("❌ Facebook API Error (Ad):", text);
      throw new Error("Failed to create ad. Check logs for full response.");
    }

    const adData = await response.json();
    console.log("✅ Ad Created:", adData);

    return { success: true };
  } catch (error: any) {
    console.error("Error in createMetaCampaign:", error);
    throw new Error("Failed to create meta campaign: " + error.message);
  }
}
