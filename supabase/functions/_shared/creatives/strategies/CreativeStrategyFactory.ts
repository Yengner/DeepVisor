import { CreativeStrategy } from "./CreativeStrategy";
import { LeadGenerationStrategy } from "./LeadGenerationStrategy";
// import { TrafficStrategy } from "./TrafficStrategy";
import { CAMPAIGN_OBJECTIVES } from "@/components/campaigns/create/common/utils/objectiveMappings";

export function getCreativeStrategy(objective: string): CreativeStrategy {
    switch (objective) {
        case CAMPAIGN_OBJECTIVES.LEADS:
        case 'LEAD_GENERATION':
            return new LeadGenerationStrategy();
        case CAMPAIGN_OBJECTIVES.TRAFFIC:
        case 'TRAFFIC':
            return new LeadGenerationStrategy();
        // Add other strategies as needed
        default:
            return new LeadGenerationStrategy(); // Default fallback
    }
}

// Similar updates for campaign and ad set strategy factories