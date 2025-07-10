import { CampaignStrategy } from "./CampaignStrategy";
import { LeadGenCampaignStrategy } from "./LeadGenCampaignStrategy";
import { CAMPAIGN_OBJECTIVES } from "@/components/campaigns/create/common/utils/objectiveMappings";

/**
 * Factory function to return the appropriate campaign strategy
 * based on the campaign objective
 * 
 * @param objective - Campaign objective from form data
 * @returns The appropriate campaign strategy
 */
export function getCampaignStrategy(objective: string): CampaignStrategy {
    switch (objective) {
        case CAMPAIGN_OBJECTIVES.LEADS:
            console.log("hit")
        case 'OUTCOME_LEADS':
            console.log("hit")
            return new LeadGenCampaignStrategy();
        // Add more cases as you support more campaign objectives

        default:
            // Default to traffic strategy as fallback
            console.warn(`No specific strategy found for objective: ${objective}, using TrafficCampaignStrategy as fallback`);
            return new LeadGenCampaignStrategy();
    }
}