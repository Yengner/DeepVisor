import { MetaCampaignParams } from "../types";
import { getCampaignStrategy } from "../strategies/campaign/CampaignStrategyFactory";
import { removeEmptyFields } from "../helpers/apiHelpers";

/**
 * Creates a campaign in the Meta Ads platform
 * 
 * @param params - Campaign creation parameters
 * @returns Campaign ID from Meta API
 */
export async function createCampaign(params: MetaCampaignParams): Promise<string> {
    const { adAccountId, accessToken, formData, isSmartCampaign } = params;

    try {
        // Create base campaign parameters
        const baseParams = {
            name: `${formData.campaignName}${isSmartCampaign ? ' Smart Campaign' : ''}`,
            status: "PAUSED", // Paused For Testing
        };

        // Get the appropriate strategy based on campaign objective
        const strategy = getCampaignStrategy(formData.objective);

        // Apply the strategy to get objective-specific parameters
        const campaignParams = strategy.buildCampaignParams(
            baseParams,
            formData,
            isSmartCampaign
        );

        // Add access token
        campaignParams.access_token = accessToken;

        // Make the API request
        const url = `https://graph.facebook.com/v23.0/${adAccountId}/campaigns`;
        const campaignRes = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(removeEmptyFields(campaignParams))
        });

        // Handle response
        if (!campaignRes.ok) {
            const text = await campaignRes.text();
            console.error("❌ Facebook API Error (Campaign):", text);
            throw new Error("Failed to create campaign. Check logs for full response.");
        }

        const campaignData = await campaignRes.json();
        console.log("✅ Campaign created:", campaignData);

        return campaignData.id;
    } catch (err) {
        console.error("Error in Campaign creation:", err);
        throw err;
    }
}