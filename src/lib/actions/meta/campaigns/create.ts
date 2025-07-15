import { getCampaignStrategy } from "./strategies/CampaignStrategyFactory";
import { AdAccount, Campaign, FacebookAdsApi } from "../sdk/client";
import { logApiCallResult } from "../sdk/utils";

/**
 * Creates a campaign in the Meta Ads platform using the SDK
 * 
 * @param params - Campaign creation parameters
 * @returns Campaign ID from Meta API
 */
export async function createCampaign(params: any): Promise<string> {
    const { adAccountId, formData, isSmartCampaign } = params;

    try {



        const baseParams = {
            name: `${formData.campaignName}${isSmartCampaign ? ' Smart Campaign' : ''}`,
            status: "PAUSED", // Paused For Testing
        };

        // Get the appropriate strategy based on campaign objective
        const strategy = getCampaignStrategy(formData.objective);

        const campaignParams = strategy.buildCampaignParams(
            baseParams,
            formData,
            isSmartCampaign
        );

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
