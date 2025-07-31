import { CampaignStrategy } from "./CampaignStrategy";
import { Campaign } from "../../../../sdk/client";

/**
 * Strategy for Lead Generation campaigns
 * Uses Meta's OUTCOME_LEADS objective (new API version)
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
export class LeadGenCampaignStrategy implements CampaignStrategy {
    buildCampaignParams(
        baseParams: any,
        formData: any,
        isSmartCampaign: boolean
    ): any {
        isSmartCampaign = true;
        const params: Record<string, any> = { ...baseParams };
        /* eslint-enable @typescript-eslint/no-explicit-any */
        params[Campaign.Fields.objective] = Campaign.Objective.outcome_leads;
        // params[Campaign.Fields.buying_type] = "AUCTION";

        params[Campaign.Fields.bid_strategy] = isSmartCampaign
            ? Campaign.BidStrategy.lowest_cost_without_cap
            : formData.budget?.bid_strategy
            // || formData.bidStrategy
            || Campaign.BidStrategy.lowest_cost_without_cap;

        // Support both new and legacy formData structure for budget
        const budgetType = formData.budget?.type
        const budgetAmount = formData.budget?.amount

        if (budgetType === 'daily') {
            params[Campaign.Fields.daily_budget] = Math.floor(budgetAmount * 100);
        } else if (budgetType === 'lifetime') {
            params[Campaign.Fields.lifetime_budget] = Math.floor(budgetAmount * 100);
        }

        // Support both new and legacy formData structure for dates
        const startDate = formData.schedule?.startDate || formData.startDate;
        const endDate = formData.schedule?.endDate || formData.endDate;

        if (startDate) {
            params[Campaign.Fields.start_time] = new Date(startDate).toISOString();
        }

        if (endDate) {
            params[Campaign.Fields.stop_time] = new Date(endDate).toISOString();
        }

        return params;
    }
}