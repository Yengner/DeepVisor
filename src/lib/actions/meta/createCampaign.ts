import { MetaCampaignParams } from "./types";

/**
 * Creates a campaign in the Meta Ads platform
 * 
 * @param params - Campaign creation parameters
 * @returns Campaign ID from Meta API
 */
export async function createCampaign(params: MetaCampaignParams): Promise<string> {
    const { adAccountId, accessToken, formData, isSmartCampaign } = params;
    console.log("Creating campaign with params:", params);

    try {
        const url = `https://graph.facebook.com/v21.0/${adAccountId}/campaigns`;

        // Campaign params with standardized field handling
        const campaignParams = {
            // Basic campaign information
            name: `${formData.campaignName} ${isSmartCampaign ? ' Smart Campaign' : ''}`,
            objective: formData.objective,
            status: "PAUSED", // Always paused for testing
            page_id: formData.page_id, // Page ID for the campaign

            // Budget configuration - convert to cents for Meta API and use only the appropriate field
            ...(formData.budgetType === 'daily' ? { daily_budget: formData.budget * 100 } : {}),
            ...(formData.budgetType === 'lifetime' ? { lifetime_budget: formData.budget * 100 } : {}),

            // Smart campaign features
            campaign_budget_optimization: isSmartCampaign ? true : !!formData.campaign_budget_optimization,

            // Bidding strategy - use the one from form or default
            bid_strategy: formData.bidStrategy || "LOWEST_COST_WITHOUT_CAP",

            // Schedule - properly format dates
            start_time: formData.startDate ? new Date(formData.startDate).toISOString() : undefined,
            stop_time: formData.endDate ? new Date(formData.endDate).toISOString() : undefined,

            // Special settings and categorization
            special_ad_categories: "NONE", // No special categories for now

            // Smart campaign labeling
            ...(isSmartCampaign ? {
                adlabels: [
                    {
                        name: "campaign_type",
                        value: "deepvisor_smart"
                    }
                ]
            } : {}),

            // Authorization
            access_token: accessToken
        };

        // Create campaign - only include non-null/undefined fields
        const campaignRes = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(removeEmptyFields(campaignParams))
        });

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

/**
 * Utility function to remove null, undefined, and empty string fields
 * Meta's API will reject requests with empty/null values for some fields
 * 
 * @param obj - Object to clean
 * @returns Cleaned object without empty fields
 */
function removeEmptyFields(obj: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};

    for (const key in obj) {
        if (obj[key] !== null && obj[key] !== undefined && obj[key] !== '') {
            result[key] = obj[key];
        }
    }

    return result;
}