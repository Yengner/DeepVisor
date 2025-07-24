// supabase/functions/_shared/adsets/create.ts
import { AdSet, AdAccount } from "../sdk/client.ts";
import { getAdSetStrategy } from "./strategies/AdSetStrategyFactory.ts";
import { MetaAdSetParams } from "../types.ts";
import { logApiCallResult } from "../utils.ts";  

/**
 * Creates an ad set in Meta Ads platform using the SDK
 * @param params - Parameters for ad set creation
 * @returns Ad Set ID from Meta API
 */
export async function createAdSet(params: any): Promise<string> {
    const { adAccountId, campaignId, formData, isSmartCampaign } = params;
    console.log("Creating ad set with params:", formData);
    try {
        // Use adSetName from ad set object, and schedule from formData if available
        const baseParams = {
            name: `${formData.adSetName || 'Ad Set'}`,
            campaign_id: campaignId,
            status: "PAUSED",
            start_time: formData.schedule?.startDate
                ? new Date(formData.schedule.startDate).toISOString()
                : undefined,
            end_time: formData.schedule?.endDate
                ? new Date(formData.schedule.endDate).toISOString()
                : undefined
        };
        console.log("Base ad set parameters:", baseParams);

        const strategy = getAdSetStrategy(formData.campaign.destinationType);

        // Apply the strategy to get objective-specific parameters
        const adSetParams = strategy.buildAdSetParams(
            baseParams,
            formData,
            isSmartCampaign
        );
        console.log("Final ad set parameters:", adSetParams);

        // Use the SDK to create the ad set
        const account = new AdAccount(adAccountId);
        const adset = await account.createAdSet(
            [AdSet.Fields.id, AdSet.Fields.name],
            adSetParams
        );

        logApiCallResult("createAdSet", adset);

        return adset.id;
    } catch (err) {
        logApiCallResult("createAdSet ERROR", err, true);
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