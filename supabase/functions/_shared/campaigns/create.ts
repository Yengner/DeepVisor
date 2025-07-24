import { getCampaignStrategy } from "./strategies/CampaignStrategyFactory";
import { AdAccount, Campaign } from "../../../sdk/client";
import { logApiCallResult } from "../../../sdk/utils";

/**
 * Creates a campaign in the Meta Ads platform using the SDK
 * 
 * @param params - Campaign creation parameters
 * @returns Campaign ID from Meta API
 */
export async function createCampaign(params: any): Promise<string> {
    console.log("Creating campaign with params:", params);
    const { adAccountId, formData, isSmartCampaign, budgetData } = params;

    try {
        const baseParams = {
            [Campaign.Fields.name]: `${formData.campaign.campaignName}${isSmartCampaign ? ' Smart Campaign' : ''}`,
            [Campaign.Fields.status]: Campaign.Status.paused,
            [Campaign.Fields.special_ad_categories]: Campaign.SpecialAdCategories.none
        };

        // Get the appropriate strategy based on campaign objective
        const strategy = getCampaignStrategy(formData.campaign.objective);

        const campaignParams = strategy.buildCampaignParams(
            baseParams,
            formData,
            budgetData,
            isSmartCampaign
        );
        console.log("Campaign parameters:", campaignParams);

        const account = new AdAccount(adAccountId);
        const campaign = await account.createCampaign(
            [Campaign.Fields.id, Campaign.Fields.name],
            campaignParams
        );

        logApiCallResult("createCampaign", campaign);

        return campaign.id;
    } catch (err) {
        logApiCallResult("createCampaign ERROR", err, true);
        throw err;
    }
}
