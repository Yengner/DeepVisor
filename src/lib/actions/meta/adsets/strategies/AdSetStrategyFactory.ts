import { DESTINATION_TYPES } from "@/components/campaigns/create/common/utils/objectiveMappings";
import { AdSetStrategy } from "./AdSetStrategy";
import { LeadGenAdSetStrategy } from "./LeadGenAdSetStrategy";


export function getAdSetStrategy(destinationType?: string): AdSetStrategy {
    switch (destinationType) {
        case DESTINATION_TYPES.FORM:
        case 'ON_AD':
            return new LeadGenAdSetStrategy();
            
        // Add more cases as you support more adset destinationType
            
        default:
            // Default to lead gen strategy as fallback
            console.warn(`No specific ad set strategy found for objective: ${destinationType}, using LeadGenAdSetStrategy as fallback`);
            return new LeadGenAdSetStrategy();
    }
}