"use server";
import { createSupabaseClient } from "../../utils/supabase/clients/server";
import { getLoggedInUser } from "../user.actions";
import { createAd, createSmartAds } from "./createAd";
import { createAdSet, createSmartAdSets } from "./createAdset";
import { createCampaign } from "./createCampaign";
import { createCreative, createSmartCreatives } from "./createCreative";
import { CampaignFormValues, SmartCampaignResult } from "./types";

/**
 * Server action to create a Meta campaign
 * Handles the entire campaign creation flow including ad sets, creatives, and ads
 * 
 * @param formData - Form data from the campaign builder
 * @returns Result object with IDs of created resources
 */
export async function createMetaCampaign(formData: CampaignFormValues): Promise<SmartCampaignResult> {
  const supabase = await createSupabaseClient();
  const loggedIn = await getLoggedInUser();
  const userId = loggedIn?.id;

  if (!userId) {
    throw new Error("User not authenticated");
  }

  // Get Meta integration and ad account info
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

  // Determine if this is a smart campaign
  const isSmartCampaign = formData.type === 'AI Auto';

  try {
    // Standardize the form data for API calls
    const standardizedFormData = standardizeFormData(formData);

    // 1. Create The Campaign
    const campaignId = await createCampaign({
      adAccountId,
      accessToken,
      formData: standardizedFormData,
      isSmartCampaign
    });

    // 2. Create The Ad Sets
    let adsetIds: string[] = [];

    if (isSmartCampaign) {
      // Create multiple ad sets for smart campaigns
      adsetIds = await createSmartAdSets({
        adAccountId,
        accessToken,
        campaignId,
        formData: standardizedFormData
      });
    } else {
      // Create a single ad set for manual campaigns
      const adsetId = await createAdSet({
        adAccountId,
        accessToken,
        campaignId,
        formData: standardizedFormData,
        isSmartCampaign: false
      });
      adsetIds = [adsetId];
    }

    // 3. Create Creatives
    let creativeIds: string[] = [];

    if (isSmartCampaign) {
      // Create multiple creative variations for smart campaigns
      creativeIds = await createSmartCreatives({
        adAccountId,
        accessToken,
        pageId: standardizedFormData.page_id,
        formData: standardizedFormData
      });
    } else {
      // Create a single creative for manual campaigns
      const creativeId = await createCreative({
        adAccountId,
        accessToken,
        pageId: standardizedFormData.page_id,
        formData: standardizedFormData,
        isSmartCampaign: false
      });
      creativeIds = [creativeId];
    }

    // 4. Create Ads
    let adIds: string[] = [];

    if (isSmartCampaign) {
      // Create ads with different combinations for smart campaigns
      adIds = await createSmartAds(
        {
          adAccountId,
          accessToken,
          formData: standardizedFormData
        },
        adsetIds,
        creativeIds
      );
    } else {
      // Create a single ad for manual campaigns
      const adId = await createAd({
        adAccountId,
        accessToken,
        adsetId: adsetIds[0],
        creativeId: creativeIds[0],
        formData: standardizedFormData,
        isSmartCampaign: false
      });
      adIds = [adId];
    }

    // 5. Store campaign information in database
    try {
      // Store main campaign record
      const { data: campaignRecord, error: campaignRecordError } = await supabase
        .from("campaigns")
        .insert({
          user_id: userId,
          name: standardizedFormData.campaignName,
          platform: "meta",
          platform_campaign_id: campaignId,
          platform_adset_ids: adsetIds.join(','),
          platform_ad_ids: adIds.join(','),
          status: "PAUSED",
          created_by_deepvisor: true,
          is_smart_campaign: isSmartCampaign,
          budget: standardizedFormData.budget,
          budget_type: standardizedFormData.budgetType,
          objective: standardizedFormData.objective,
          optimization_goal: standardizedFormData.optimization_goal || standardizedFormData.optimization,
          start_date: standardizedFormData.startDate,
          end_date: standardizedFormData.endDate || null,
          location_data: JSON.stringify(standardizedFormData.location),
          content_source: standardizedFormData.contentSource,
          destination_type: standardizedFormData.destination_type || standardizedFormData.destinationType
        })
        .select();

      if (campaignRecordError) {
        console.error("Failed to store campaign in DeepVisor database:", campaignRecordError);
      } else {
        console.log("✅ Campaign stored in DeepVisor database:", campaignRecord);

        // For smart campaigns, schedule optimization check
        if (isSmartCampaign) {
          console.log("⚙️ Scheduled smart campaign optimization for campaign ID:", campaignRecord[0].id);
        }
      }
    } catch (storageErr) {
      console.error("Error storing campaign:", storageErr);
    }

    return {
      success: true,
      campaignId,
      adsetIds,
      creativeIds,
      adIds
    };
  } catch (error) {
    console.error("Error creating Meta campaign:", error);
    throw error;
  }
}

/**
 * Standardize form data to ensure consistent field naming
 * 
 * @param formData - Original form data
 * @returns Standardized form data
 */
function standardizeFormData(formData: CampaignFormValues): CampaignFormValues {
  // Create a copy to avoid modifying the original
  const standardized = { ...formData };

  // Ensure consistent field values between form and API
  standardized.headline = formData.adHeadline || formData.headline;
  standardized.primaryText = formData.adPrimaryText || formData.primaryText;
  standardized.description = formData.adDescription || formData.description;
  standardized.callToAction = formData.adCallToAction || formData.callToAction;
  standardized.destination_type = formData.adDestinationType || formData.destinationType || formData.destination_type;
  standardized.optimization_goal = formData.optimization || formData.optimization_goal;

  return standardized;
}

