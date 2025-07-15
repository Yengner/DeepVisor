"use server";
import { createSupabaseClient } from "../../utils/supabase/clients/server";
import { getLoggedInUser } from "../user.actions";
import { createAdSet } from "./adsets/create";
import { createCampaign } from "./campaigns/create";
import { CampaignFormValues, SmartCampaignResult } from "./types";
import { createAd } from "./ads/create";
import { getAccessToken } from "../common/accessToken";
import { FacebookAdsApi } from "./sdk/client";

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
    const accessToken = await getAccessToken(formData.platformIntegrationId);
    const APP_SECRET = process.env.META_APP_SECRET!;
    const adAccountId = formData.adAccountId;

    FacebookAdsApi.init(accessToken, APP_SECRET);

    const isSmartCampaign = formData.type === 'AI Auto';

    try {

        // 1. Create The Campaign
        const campaignId = await createCampaign({
            adAccountId,
            accessToken,
            formData: formData,
            isSmartCampaign
        });

        // 2. Create a single Ad Set 
        const adsetId = await createAdSet({
            adAccountId,
            accessToken,
            campaignId,
            formData: formData,
            isSmartCampaign
        });

        const adsetIds = [adsetId];

        // Skip for now as I need to have my app in live mode for testing.
        // 3. Create a single Creative (with optimized parameters if smart campaign)
        // const creativeId = await createCreative({
        //   adAccountId,
        //   accessToken,
        //   pageId: formData.page_id,
        //   formData: formData,
        //   isSmartCampaign
        // });

        const creativeId = formData.existingCreativeIds?.[0]
        const creativeIds = [creativeId];

        // 4. Create a single Ad
        const adId = await createAd({
            adAccountId,
            accessToken,
            adsetId,
            creativeId,
            formData: formData,
            isSmartCampaign
        });

        const adIds = [adId];

        // 5. Store campaign information in database
        try {
            // Store main campaign record
            const campaignParams = {
                user_id: userId,
                name: formData.campaignName,
                platform: "meta",
                platform_campaign_id: campaignId,
                platform_adset_ids: adsetIds.join(','),
                platform_creative_ids: creativeIds.join(','), // Added this line
                platform_ad_ids: adIds.join(','),
                status: "PAUSED",
                created_by_deepvisor: true,
                is_smart_campaign: isSmartCampaign,
                budget: formData.budget,
                budget_type: formData.budgetType,
                objective: formData.objective,
                optimization_goal: formData.optimization_goal,
                start_date: formData.startDate,
                end_date: formData.endDate || null,
                location_data: formData.location ? JSON.stringify(formData.location) : null,
                content_source: formData.contentSource,
                destination_type: formData.destinationType,

                // Add JSONB data for complete parameters
                campaign_data: {
                    name: formData.campaignName,
                    objective: formData.objective,
                    special_ad_categories: formData.special_ad_categories || ["NONE"],
                    buying_type: formData.buying_type,
                    bid_strategy: formData.bidStrategy,
                    budget: formData.budget,
                    budget_type: formData.budgetType,
                    // Include all other campaign params
                },

                adset_data: {
                    targeting: formData.location,
                    optimization_goal: formData.optimization_goal,
                    destination_type: formData.destinationType,
                    billing_event: formData.billingEvent,
                    // Include all other adset params
                },

                creative_data: {
                    page_id: formData.page_id,
                    headline: formData.adHeadline,
                    primary_text: formData.adPrimaryText,
                    description: formData.adDescription,
                    call_to_action: formData.adCallToAction,
                    image_hash: formData.imageHash,
                    destination_form: formData.adDestinationForm,
                    // Include all other creative params
                },

                ad_data: {
                    name: `${formData.campaignName} - Ad`,
                    status: "PAUSED"
                    // Include all other ad params
                }
            };

            const { data: campaignRecord, error: campaignRecordError } = await supabase
                .from("campaigns")
                .insert(campaignParams)
                .select();

            if (campaignRecordError) {
                console.error("Failed to store campaign in DeepVisor database:", campaignRecordError);
            } else {
                console.log("✅ Campaign stored in DeepVisor database:", campaignRecord);
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

