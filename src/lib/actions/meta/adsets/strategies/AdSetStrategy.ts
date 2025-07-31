import { CampaignFormValues } from "../../types";

/**
 * Base interface for all ad set parameter strategies
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export interface AdSetStrategy {
  /**
   * Build the ad set parameters based on campaign objective and ad set type
   * 
   * @param baseParams - Base ad set parameters
   * @param formData - Form data from campaign creation
   * @param isSmartCampaign - Whether this is a smart campaign
   * @returns Complete ad set parameters ready for API
   */
  buildAdSetParams(
    baseParams: any, 
    formData: CampaignFormValues, 
    isSmartCampaign: boolean
  ): any;
}