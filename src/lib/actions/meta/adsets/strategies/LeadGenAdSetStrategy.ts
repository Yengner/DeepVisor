import { AdSetStrategy } from "./AdSetStrategy";
import { CampaignFormValues } from "../../types";
import { AdSet } from "../../../../sdk/client"; // Import the SDK AdSet class

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
        const params: Record<string, any> = { ...baseParams };

        params[AdSet.Fields.billing_event] = "IMPRESSIONS";
        params[AdSet.Fields.optimization_goal] = "LEAD_GENERATION";
        params[AdSet.Fields.destination_type] = "ON_AD";


        params[AdSet.Fields.promoted_object] = {
            page_id: formData.page_id
        };

        params[AdSet.Fields.targeting] = this.buildTargeting(formData, isSmartCampaign);

        return params;
    }

    private buildTargeting(formData: CampaignFormValues, isSmartCampaign: boolean): any {
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

        const targeting = {
            age_max: formData.ageMax || 65,
            age_min: formData.ageMin || 18,
            geo_locations: geoLocations
        };

        if (isSmartCampaign || formData.useAdvantageAudience) {
            return {
                ...targeting,
                targeting_automation: {
                    advantage_audience: 1
                }
            };
        }

        return targeting;
    }
}