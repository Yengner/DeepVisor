import { AdSetStrategy } from "./AdSetStrategy";
import { AdSet } from "../../../../sdk/client"; // Import the SDK AdSet class

/**
 * Strategy for Lead Generation ad sets
 * Uses ON_AD destination_type as required for lead forms
 */
export class LeadGenAdSetStrategy implements AdSetStrategy {
    /* eslint-disable @typescript-eslint/no-explicit-any */

    buildAdSetParams(
        baseParams: any,
        formData: any,
        isSmartCampaign: boolean
    ): any {
        const params: Record<string, any> = { ...baseParams };
        params[AdSet.Fields.billing_event] = AdSet.BillingEvent.impressions;
        params[AdSet.Fields.optimization_goal] = AdSet.OptimizationGoal.lead_generation;
        params[AdSet.Fields.destination_type] = AdSet.DestinationType.on_ad;


        params[AdSet.Fields.promoted_object] = {
            page_id: formData.page_id
        };

        params[AdSet.Fields.targeting] = this.buildTargeting(formData, isSmartCampaign);

        return params;
    }

    /* eslint-disable @typescript-eslint/no-explicit-any */
    private buildTargeting(formData: any, isSmartCampaign: boolean): any {
        const geoLocations: any = {
            location_types: ["home", "recent"]
        };

        if (formData.targeting.location?.markerPosition) {
            geoLocations.custom_locations = [{
                latitude: formData.targeting.location.markerPosition.lat,
                longitude: formData.targeting.location.markerPosition.lng,
                radius: formData.targeting.location.radius || 10,
                distance_unit: "mile"
            }];
        }

        const targeting = {
            age_max: formData.targeting.ageMax || 65,
            age_min: formData.targeting.ageMin || 18,
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
    /* eslint-enable @typescript-eslint/no-explicit-any */

}