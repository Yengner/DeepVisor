import { MetaCreativeParams } from "../types";

export async function createCreative(params: MetaCreativeParams): Promise<string> {
    const { adAccountId, creativeVariation = 0 } = params;

    try {
        const url = `https://graph.facebook.com/v21.0/${adAccountId}/adcreatives`;
        let creativeParams;

        // Generate different creative message variants for smart campaigns
        // const message = getCreativeMessage(formData.campaign.campaignName, isSmartCampaign, creativeVariation);

        // switch (formData.adSets[0].creatives[0].contentSource) {
        //     case 'upload':
        //         if (formData.uploadedFiles && formData.uploadedFiles.length > 0) {
        //             // For demo purposes, using a placeholder image hash
        //             // In production, you would upload files to Meta first using formData.uploadedFiles
        //             creativeParams = {
        //                 name: `[DeepVisor${isSmartCampaign ? ' Smart' : ''}] ${formData.campaignName} - Creative ${creativeVariation || ''}`,
        //                 object_story_spec: {
        //                     page_id: pageId,
        //                     link_data: {
        //                         image_hash: "b01f66bb94e8ac207b4c407d4b2197aa",
        //                         message: message,
        //                         call_to_action: {
        //                             type: formData.destinationType || 'LEARN_MORE',
        //                             value: { app_destination: formData.destinationType }
        //                         }
        //                     }
        //                 },
        //                 adlabels: isSmartCampaign ? [
        //                     {
        //                         name: "creative_variation",
        //                         value: String(creativeVariation)
        //                     }
        //                 ] : undefined,
        //                 access_token: accessToken
        //             };
        //         } else {
        //             throw new Error("No files were uploaded for the creative");
        //         }
        //         break;

        //     case 'existing':
        //         if (formData.existingCreativeIds && formData.existingCreativeIds.length > 0) {
        //             const postIndex = Math.min(
        //                 creativeVariation,
        //                 formData.existingCreativeIds.length - 1
        //             );

        //             creativeParams = {
        //                 name: `[DeepVisor${isSmartCampaign ? ' Smart' : ''}] ${formData.campaignName} - Existing Post ${creativeVariation || ''}`,
        //                 object_story_spec: {
        //                     page_id: pageId,
        //                     link_data: {
        //                         message: getCreativeMessage(formData.campaignName, isSmartCampaign, 0), // Use a static message for existing posts
        //                         link: "https://www.deepvisor.com",           // must be a full https://… URL
        //                         call_to_action: {
        //                             type: "LEARN_MORE",
        //                             value: { link: "https://www.deepvisor.com" }
        //                         }
        //                     },

        //                     // This tells FB you want to repurpose an existing post’s media:
        //                     video_data: {
        //                         source_post_id: formData.existingCreativeIds[postIndex]
        //                     }
        //                 },
        //                 adlabels: isSmartCampaign ? [
        //                     {
        //                         name: "creative_variation",
        //                         value: String(creativeVariation)
        //                     }
        //                 ] : undefined,
        //                 access_token: accessToken
        //             };
        //         } else {
        //             throw new Error("No existing posts were selected");
        //         }
        //         break;

        //     case 'auto':
        //     default:
        //         // AI auto-selection - using placeholders, but in production would use different images
        //         creativeParams = {
        //             name: `[DeepVisor${isSmartCampaign ? ' Smart' : ''}] ${formData.campaignName} - AI Selected ${creativeVariation || ''}`,
        //             object_story_spec: {
        //                 page_id: pageId,
        //                 link_data: {
        //                     image_hash: "b01f66bb94e8ac207b4c407d4b2197aa", // Default image
        //                     message: message,
        //                     call_to_action: {
        //                         type: formData.destinationType || 'LEARN_MORE',
        //                         value: { app_destination: formData.destinationType }
        //                     }
        //                 }
        //             },
        //             adlabels: isSmartCampaign ? [
        //                 {
        //                     name: "creative_variation",
        //                     value: String(creativeVariation)
        //                 },
        //                 {
        //                     name: "ai_selected",
        //                     value: "true"
        //                 }
        //             ] : undefined,
        //             access_token: accessToken
        //         };
        //         break;
        // }

        const creativeRes = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(creativeParams)
        });

        if (!creativeRes.ok) {
            const text = await creativeRes.text();
            console.error("❌ Facebook API Error (Creative):", text);
            throw new Error("Failed to create creative. Check logs for full response.");
        }

        const creativeData = await creativeRes.json();
        console.log(`✅ Creative created (variation ${creativeVariation}):`, creativeData);

        return creativeData.id;
    } catch (err) {
        console.error("Error in Creative creation:", err);
        throw err;
    }
}

// Create multiple creatives for smart campaigns
export async function createSmartCreatives(params: Omit<MetaCreativeParams, 'creativeVariation'>): Promise<string[]> {
    const creativeIds: string[] = [];

    // Create 3 different creative variations
    for (let i = 0; i < 3; i++) {
        const creativeId = await createCreative({
            ...params,
            isSmartCampaign: true,
            creativeVariation: i
        });
        creativeIds.push(creativeId);
    }

    return creativeIds;
}

// Helper function to generate different creative messages
// function getCreativeMessage(campaignName: string, isSmartCampaign: boolean = false, variation: number = 0): string {
//     if (!isSmartCampaign) {
//         return "Chat with us for more information!";
//     }

//     // Different message variations for testing
//     const messages = [
//         `Don't miss out! Chat with us now for more information about ${campaignName}! 🔥`,
//         `Looking for the best solution? We've got you covered. Message us today! ✅`,
//         `Limited time offer! Get answers to your questions - reach out now! 📱`
//     ];

//     return messages[variation % messages.length];
// }