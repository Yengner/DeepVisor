import { CreativeStrategy } from "./CreativeStrategy";
import { CampaignFormValues } from "../../types";

/**
 * Strategy for Lead Generation creatives
 * Implements the lead form parameters as required by Meta's API
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export class LeadGenerationStrategy implements CreativeStrategy {
    buildCreativeParams(
        baseParams: any,
        formData: CampaignFormValues,
        // pageId: string,
        // isSmartCampaign: boolean,
        // creativeVariation: number
    ): any {
        // Start with base parameters
        const params = { ...baseParams };

        // Validate required fields for lead gen fix later
        if (!formData) {
            throw new Error("Lead form ID is required for lead generation campaigns");
        }

        // Create object_story_spec exactly as required in the API docs
        params.object_story_spec = {
            // page_id: pageId,
            // link_data: {
            //     call_to_action: {
            //         type: formData.adCallToAction || "SIGN_UP",
            //         value: {
            //             lead_gen_form_id: formData.adDestinationForm
            //         }
            //     },
            //     description: formData.adDescription || "Learn more",
            //     // Use image hash if available, otherwise use a placeholder
            //     image_hash: formData.imageHash || "DEFAULT_IMAGE_HASH",
            //     link: "http://fb.me/",  // Required by Meta API
            //     message: formData.adPrimaryText || `Check out ${formData.campaignName}`,
            //     lead_gen_form_id: formData.adDestinationForm  // Include form ID here too
            // }
        };

        return params;
    }
}