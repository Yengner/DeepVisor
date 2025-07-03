import { useState } from 'react';
import { CampaignFormValues } from '@/lib/actions/meta/types';
import { createMetaCampaign } from '@/lib/actions/meta/campaign.actions';

/**
 * Response from campaign submission API
 */
interface CampaignSubmitResponse {
  success: boolean;
  campaignId?: string;
  error?: string;
  message?: string;
  adsetIds?: string[];
  creativeIds?: string[];
  adIds?: string[];
}

/**
 * Return type for the useCampaignSubmit hook
 */
interface UseCampaignSubmitReturn {
  /** Submit the campaign to the API */
  submitCampaign: (values: CampaignFormValues) => Promise<CampaignSubmitResponse>;
  /** Whether the campaign is currently being submitted */
  isSubmitting: boolean;
  /** Error message if submission failed */
  submitError: string | null;
  /** Whether submission was successful */
  submitSuccess: boolean;
  /** Reset submission state */
  resetSubmission: () => void;
  /** Campaign ID if submission was successful */
  campaignId: string | null;
}

/**
 * Hook for handling campaign submission to API
 * 
 * Manages submission state, error handling, and success tracking
 * 
 * @returns Object with submission functions and state
 */
export function useCampaignSubmit(): UseCampaignSubmitReturn {
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<boolean>(false);
  const [campaignId, setCampaignId] = useState<string | null>(null);

  /**
   * Submit campaign data to API
   * 
   * @param values - Form values from useCampaignForm
   * @returns Response from API with success status and campaign ID
   */
  const submitCampaign = async (values: CampaignFormValues): Promise<CampaignSubmitResponse> => {
    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);
    setCampaignId(null);

    try {
      // Transform campaign data to ensure field naming consistency
      const campaignData = transformCampaignData(values);

      // Call server action to create campaign
      const result = await createMetaCampaign(campaignData);

      if (!result.success) {
        const errorMessage = 'Failed to create campaign';
        setSubmitError(errorMessage);
        return {
          success: false,
          error: errorMessage
        };
      }

      // Success
      setSubmitSuccess(true);
      setCampaignId(result.campaignId || null);

      return {
        success: true,
        campaignId: result.campaignId,
        adsetIds: result.adsetIds,
        creativeIds: result.creativeIds,
        adIds: result.adIds
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      setSubmitError(errorMessage);

      return {
        success: false,
        error: errorMessage
      };
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Reset submission state
   */
  const resetSubmission = () => {
    setIsSubmitting(false);
    setSubmitError(null);
    setSubmitSuccess(false);
    setCampaignId(null);
  };

  /**
   * Transform campaign form data into API-ready format
   * Standardizes field names and handles empty values
   * 
   * @param values - Raw form values
   * @returns Transformed data for API
   */
  const transformCampaignData = (values: CampaignFormValues): CampaignFormValues => {
    // Create a new object with standardized field names
    const transformedData: Partial<CampaignFormValues> = { ...values };

    // Standardize field names (handle duplicates)
    // Creative assets to standard API fields
    transformedData.headline = values.adHeadline || values.headline;
    transformedData.primaryText = values.adPrimaryText || values.primaryText;
    transformedData.description = values.adDescription || values.description;
    transformedData.callToAction = values.adCallToAction || values.callToAction;
    transformedData.destination_type = values.adDestinationType || values.destinationType || values.destination_type;

    // Format dates as ISO strings for API
    if (transformedData.startDate) {
      transformedData.startDate = new Date(transformedData.startDate);
    }

    if (transformedData.endDate) {
      transformedData.endDate = new Date(transformedData.endDate);
    }

    // Handle empty arrays to avoid API errors
    Object.entries(transformedData).forEach(([key, value]) => {
      if (Array.isArray(value) && value.length === 0) {
        // Don't delete empty arrays as some APIs may expect them
      }
    });

    // Remove file objects - they need to be handled separately
    // We keep the reference in the transformed data but must process separately

    return transformedData as CampaignFormValues;
  };

  return {
    submitCampaign,
    isSubmitting,
    submitError,
    submitSuccess,
    resetSubmission,
    campaignId
  };
}