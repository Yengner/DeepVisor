import { CampaignFormValues } from "../../types";
import { CampaignStrategy } from "./CampaignStrategy";

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
        // Start with base parameters
        const params = { ...baseParams };

        // Add lead gen specific parameters
        params.objective = "OUTCOME_LEADS";
        params.special_ad_categories = "NONE";
        params.buying_type = "AUCTION";

        // Apply optimal parameters for smart campaigns
        if (isSmartCampaign) {
            params.bid_strategy = "LOWEST_COST_WITHOUT_CAP";
            params.campaign_budget_optimization = true;
        } else {
            params.bid_strategy = formData.bidStrategy || "LOWEST_COST_WITHOUT_CAP";
            params.campaign_budget_optimization = formData.campaign_budget_optimization || false;
        }

        // Add budget parameters
        if (formData.budgetType === 'daily') {
            params.daily_budget = Math.floor(formData.budget * 100); // Convert to cents
        } else if (formData.budgetType === 'lifetime') {
            params.lifetime_budget = Math.floor(formData.budget * 100); // Convert to cents
        }

        // Add schedule parameters if provided
        if (formData.startDate) {
            params.start_time = new Date(formData.startDate).toISOString();
        }

        if (formData.endDate) {
            params.end_time = new Date(formData.endDate).toISOString();
        }

        return params;
    }
}