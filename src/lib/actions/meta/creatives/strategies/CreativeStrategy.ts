import { CampaignFormValues } from "../../types";

/**
 * Base interface for all creative parameter strategies
 * Each campaign objective will implement this interface
 */
export interface CreativeStrategy {
  /**
   * Build the creative parameters based on campaign objective
   * 
   * @param baseParams - Starting parameters common to all creatives
   * @param formData - Form data from campaign creation
   * @param pageId - Facebook page ID for the ad
   * @param isSmartCampaign - Whether this is a smart campaign
   * @param creativeVariation - Variation number for smart campaigns
   * @returns Complete creative parameters ready for API
   */
  buildCreativeParams(
    baseParams: any, // eslint-disable-line @typescript-eslint/no-explicit-any
    formData: CampaignFormValues, 
    pageId: string,
    isSmartCampaign: boolean,
    creativeVariation: number
  ): any; // eslint-disable-line @typescript-eslint/no-explicit-any
}