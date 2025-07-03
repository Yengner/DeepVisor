import { MetaAdSetParams } from "./types";
import { buildPromotedObject, DESTINATION_TYPES } from '@/components/campaigns/create/common/utils/objectiveMappings';

/**
 * Creates a single ad set in Meta Ads
 */
export async function createAdSet(params: MetaAdSetParams): Promise<string> {
    const {
        adAccountId,
        accessToken,
        campaignId,
        formData,
        isSmartCampaign,
        adSetType
    } = params;

    try {
        const url = `https://graph.facebook.com/v21.0/${adAccountId}/adsets`;

        // ===== PREPARE AD SET PARAMETERS =====

        // 1. OPTIMIZATION & DESTINATION
        const optimizationGoal = formData.optimization_goal;
            // ||  getOptimizationGoal(formData.objective, formData.destinationType || '');

        // 2. GEOGRAPHIC TARGETING
        const geoLocations = prepareGeoLocationTargeting(formData);

        // 3. AUDIENCE TARGETING
        const targeting = buildTargeting(geoLocations, adSetType);

        // 4. BUILD AD SET PARAMETERS
        const adSetParams = {
            // Basic information
            name: isSmartCampaign
                ? `[DeepVisor Smart] ${formData.campaignName} - ${getAdSetName(adSetType)}`
                : `[DeepVisor] ${formData.campaignName} - Ad Set`,
            campaign_id: campaignId,
            status: "PAUSED",

            // Optimization parameters
            billing_event: "IMPRESSIONS",
            optimization_goal: optimizationGoal,
            destination_type: formData.destination_type,

            // Attribution settings
            // attribution_spec: [
            //     { event_type: "CLICK_THROUGH", window_days: 7 },
            //     { event_type: "VIEW_THROUGH", window_days: 1 }
            // ],

            // Promoted object - connects to Page, Lead Form, WhatsApp, etc.
            promoted_object: {
                page_id: formData.page_id
            },
            //  buildPromotedObject(
            //     formData.objective,
            //     formData.destination_type || '',
            //     {
            //         page_id: formData.page_id, // Page ID for the ad set
            //         // Add other optional parameters as needed:
            //         // pixelId: formData.pixelId,
            //         // eventType: formData.eventType,
            //         // appId: formData.appId,
            //         // appStoreUrl: formData.appStoreUrl
            //     }
            // ),

            // Audience targeting
            targeting: targeting,

            // Tracking labels for analytics and automation
            adlabels: isSmartCampaign ? [
                {
                    name: "adset_type",
                    value: adSetType || "standard"
                },
                {
                    name: "smart_campaign",
                    value: "true"
                }
            ] : undefined,

            // Dynamic creative settings
            // is_dynamic_creative: isSmartCampaign ? true : false, // Enable dynamic creative for smart campaigns
            // Authorization
            access_token: accessToken
        };

        // ===== EXECUTE API REQUEST =====

        // Log for debugging
        console.log("Creating Ad Set with params:", JSON.stringify(adSetParams, null, 2));

        // Send request to Meta API
        const adSetRes = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(adSetParams)
        });

        // ===== HANDLE RESPONSE =====

        if (!adSetRes.ok) {
            const text = await adSetRes.text();
            console.error("❌ Facebook API Error (Ad Set):", text);
            throw new Error("Failed to create ad set. Check logs for full response.");
        }

        const adsetData = await adSetRes.json();
        console.log(`✅ Ad Set created (${adSetType || 'standard'}):`, adsetData);

        return adsetData.id;
    } catch (err) {
        console.error("Error in Ad Set creation:", err);
        throw err;
    }
}

/**
 * Creates multiple ad sets for smart campaigns with different targeting strategies
 */
export async function createSmartAdSets(params: Omit<MetaAdSetParams, 'adSetType'>): Promise<string[]> {
    const adSetTypes = ['broad', 'high-intent', 'control'] as const;
    const adSetIds: string[] = [];

    // Create the 3 different ad set variations for smart campaigns
    for (const adSetType of adSetTypes) {
        const adSetId = await createAdSet({
            ...params,
            adSetType,
            isSmartCampaign: true
        });
        adSetIds.push(adSetId);
    }

    return adSetIds;
}

// ===== HELPER FUNCTIONS =====

/**
 * Prepares geo-location targeting parameters
 */
function prepareGeoLocationTargeting(formData: any): any {
    let geoLocations: any = {
        location_types: ["home", "recent"]
    };

    // Add custom location if provided
    if (formData.location?.markerPosition) {
        geoLocations.custom_locations = [{
            latitude: formData.location.markerPosition.lat,
            longitude: formData.location.markerPosition.lng,
            radius: formData.location.radius,
            distance_unit: "mile"
        }];
    }

    return geoLocations;
}

/**
 * Returns a user-friendly name for each ad set type
 */
function getAdSetName(adSetType?: string): string {
    switch (adSetType) {
        case 'broad': return 'Broad Audience';
        case 'high-intent': return 'High-Intent Audience';
        case 'control': return 'Control Group';
        default: return 'Ad Set';
    }
}

/**
 * Builds targeting parameters based on ad set type
 */
function buildTargeting(geoLocations: any, adSetType?: string): any {
    // Base targeting that applies to all ad sets
    const baseTargeting = {
        age_max: 65,
        age_min: 18,
        geo_locations: geoLocations,
        targeting_automation: {
            advantage_audience: 1
        },
    };

    // Customize targeting based on ad set type
    switch (adSetType) {
        case 'broad':
            // Broad audience with minimal restrictions - good for discovering new audiences
            return {
                ...baseTargeting,
                // targeting_expansion: {
                //     expansion_level: 1 // Higher expansion
                // },
            };

        case 'high-intent':
            // High-intent users interested in local services
            return {
                ...baseTargeting,
                // targeting_expansion: {
                //     expansion_level: 0 // Lower expansion for more specific targeting
                // },
                // behaviors: [
                //     { id: 6002714898572, name: "Engaged with Local Businesses" } // This ID is a placeholder
                // ],
                // demographics: [
                //     { id: 6006371120132, name: "Homeowners" } // This ID is a placeholder
                // ],
                user_os: ["iOS", "Android"]
            };

        case 'control':
            // Control group - standard demographic targeting
            return {
                ...baseTargeting,
                // age_min: 18, // Slightly older demographic
                // age_max: 85, // Core adult demographic
                // No additional targeting parameters - this serves as a baseline
                // flexible_spec: [
                //     {
                //         // interests: [
                //         //     { id: 6003385849508, name: "Local Services" } // This ID is a placeholder
                //         // ]
                //     }
                // ]
            };

        default:
            // Standard targeting with advantage audience
            return {
                ...baseTargeting,
            };
    }
}