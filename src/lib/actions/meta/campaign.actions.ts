"use server";
import { createSupabaseClient } from "../../utils/supabase/clients/server";
import { createAdSet } from "./adsets/create";
import { createCampaign } from "./campaigns/create";
import { CampaignFormValues, SmartCampaignResult } from "./types";
import { createAd } from "./ads/create";
import { getAccessToken } from "../common/accessToken";
import { FacebookAdsApi } from "../../sdk/client";
import { getLoggedInUser } from "../user";
import { createCreative } from "./creatives/create";

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
    const adAccountId = formData.campaign.adAccountId;

    FacebookAdsApi.init(accessToken, APP_SECRET).setDebug(true);

    const isSmartCampaign = formData.type === 'AI Auto';

    console.log("Creating Meta campaign with formData:", formData);

    try {
        // 1. Create The Campaign
        const campaignId = await createCampaign({
            adAccountId,
            formData: formData,
            budgetData: formData.budget,
            isSmartCampaign
        });

        // 2. Create all Ad Sets and collect their IDs
        const adsetIds: string[] = [];
        const creativeIds: string[] = [];
        const adIds: string[] = [];

        // Loop through each ad set in the form
        for (const adSet of formData.adSets) {
            console.log("Creating ad set:");
            // Create Ad Set
            const adsetId = await createAdSet({
                adAccountId,
                campaignId,
                formData: {
                    ...formData,
                    ...adSet,
                },
                isSmartCampaign
            });
            adsetIds.push(adsetId);

            // For each creative in this ad set, use the existing creative ID for testing
            for (const creative of adSet.creatives) {
                // Use the first existing creative ID if available
                const creativeId =
                    creative.existingCreativeIds && creative.existingCreativeIds.length > 0
                        ? creative.existingCreativeIds[0]
                        : null;

                if (creativeId) {
                    creativeIds.push(creativeId);

                    // Create Ad for this adset/creative pair
                    const adId = await createAd({
                        adAccountId,
                        accessToken,
                        adsetId,
                        creativeId,
                        formData: {
                            ...formData,
                            ...adSet,
                            ...creative,
                        },
                        isSmartCampaign
                    });
                    adIds.push(adId);
                } else {
                    // Optionally handle the case where no existing creative ID is present
                    console.warn("No existing creative ID found for creative in ad set", adSet.adSetName);
                }
            }
        }

        // 5. Store campaign information in database (optional, unchanged)
        try {
            // Store main campaign record
            const campaignParams = {
                user_id: userId,
                name: formData.campaign.campaignName,
                platform: "meta",
                platform_campaign_id: campaignId,
                platform_adset_ids: adsetIds.join(','),
                platform_creative_ids: creativeIds.join(','),
                platform_ad_ids: adIds.join(','),
                status: "PAUSED",
                created_by_deepvisor: true,
                is_smart_campaign: isSmartCampaign,
                budget: formData.budget?.amount,
                budget_type: formData.budget?.type,
                objective: formData.campaign.objective,
                optimization_goal: formData.adSets[0]?.optimization_goal,
                start_date: formData.schedule?.startDate,
                end_date: formData.schedule?.endDate || null,
                location_data: formData.adSets[0]?.targeting?.location
                    ? JSON.stringify(formData.adSets[0].targeting.location)
                    : null,
                content_source: formData.adSets[0]?.creatives[0]?.contentSource,
                destination_type: formData.campaign.destinationType,

                // Add JSONB data for complete parameters
                campaign_data: formData.campaign,
                adset_data: formData.adSets,
                creative_data: formData.adSets.flatMap(a => a.creatives),
                ad_data: {
                    name: `${formData.campaign.campaignName} - Ad`,
                    status: "PAUSED"
                    // Add more ad params if needed
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

