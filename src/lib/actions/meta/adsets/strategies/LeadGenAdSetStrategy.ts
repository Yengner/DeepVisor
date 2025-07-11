import { AdSetStrategy } from "./AdSetStrategy";
import { CampaignFormValues } from "../../types";

/**
 * Strategy for Lead Generation ad sets
 * Uses ON_AD destination_type as required for lead forms
 */
export class LeadGenAdSetStrategy implements AdSetStrategy {
    buildAdSetParams(
        baseParams: any,
        formData: CampaignFormValues,
        isSmartCampaign: boolean
    ): any {
        // Start with base parameters
        const params = { ...baseParams };

        // Lead gen specific parameters
        params.billing_event = "IMPRESSIONS";
        params.optimization_goal = "LEAD_GENERATION";
        params.destination_type = "ON_AD";  // Required for lead forms

        // Promoted object must include page_id for lead gen ads
        params.promoted_object = {
            page_id: formData.page_id
        };

        // Build targeting
        params.targeting = this.buildTargeting(formData, isSmartCampaign);

        return params;
    }

    private buildTargeting(formData: CampaignFormValues, isSmartCampaign: boolean): any {
        // Build geo locations targeting
        let geoLocations: any = {
            location_types: ["home", "recent"]
        };

        if (formData.location?.markerPosition) {
            geoLocations.custom_locations = [{
                latitude: formData.location.markerPosition.lat,
                longitude: formData.location.markerPosition.lng,
                radius: formData.location.radius || 10,
                distance_unit: "mile"
            }];
        }

        // Build base targeting parameters
        const targeting = {
            age_max: formData.ageMax || 65,
            age_min: formData.ageMin || 18,
            geo_locations: geoLocations
        };

        // Smart campaign optimization
        if (isSmartCampaign) {
            return {
                ...targeting,
                targeting_automation: {
                    advantage_audience: 1
                }
            };
        } else if (formData.useAdvantageAudience) {
            return {
                ...targeting,
                targeting_automation: {
                    advantage_audience: 1
                }
            }
        }

        return targeting;
    }
}