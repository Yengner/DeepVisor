
/**
 * Base interface for all campaign parameter strategies
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface CampaignStrategy {
    /**
     * Build the campaign parameters based on campaign objective
     * 
     * @param baseParams - Base campaign parameters
     * @param formData - Form data from campaign creation
     * @param budgetData - Budget data from form
     * @param isSmartCampaign - Whether this is a smart campaign
     * @returns Complete campaign parameters ready for API
     */
    buildCampaignParams(
        baseParams: any,
        formData: any,
        budgetData: any,
        isSmartCampaign: boolean
    ): any;
}