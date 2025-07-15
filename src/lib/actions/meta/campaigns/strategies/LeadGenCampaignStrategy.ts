import { CampaignFormValues } from "../../types";
import { CampaignStrategy } from "./CampaignStrategy";
import { Campaign } from "../../sdk/client";

/**
 * Strategy for Lead Generation campaigns
 * Uses Meta's OUTCOME_LEADS objective (new API version)
 */
export class LeadGenCampaignStrategy implements CampaignStrategy {
    buildCampaignParams(
        baseParams: any,
        formData: CampaignFormValues,
        isSmartCampaign: boolean
    ): any {
        const params: Record<string, any> = { ...baseParams };

        params[Campaign.Fields.objective] = "OUTCOME_LEADS";
        params[Campaign.Fields.special_ad_categories] = ["NONE"];
        params[Campaign.Fields.buying_type] = "AUCTION";

        if (isSmartCampaign) {
            params[Campaign.Fields.bid_strategy] = "LOWEST_COST_WITHOUT_CAP";
        } else {
            params[Campaign.Fields.bid_strategy] = formData.bidStrategy || "LOWEST_COST_WITHOUT_CAP";

        }

        if (formData.budgetType === 'daily') {
            params[Campaign.Fields.daily_budget] = Math.floor(formData.budget * 100);
        } else if (formData.budgetType === 'lifetime') {
            params[Campaign.Fields.lifetime_budget] = Math.floor(formData.budget * 100);
        }


        if (formData.startDate) {
            params[Campaign.Fields.start_time] = new Date(formData.startDate).toISOString();
        }

        if (formData.endDate) {
            params[Campaign.Fields.stop_time] = new Date(formData.endDate).toISOString();
        }

        return params;
    }
}