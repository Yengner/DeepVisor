import { useState } from 'react';
import { CampaignFormValues } from '@/lib/actions/meta/types';


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
  submitCampaign: (values?: CampaignFormValues) => Promise<CampaignSubmitResponse>;
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
   * @param form - Form values from useCampaignForm (optional if using test data)
   * @returns Response from API with success status and campaign ID
   */
  const submitCampaign = async (form?: CampaignFormValues): Promise<CampaignSubmitResponse> => {
    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);
    setCampaignId(null);

    if (!form) {
      const errorMessage = "No form data provided and no test campaign type selected";
      setSubmitError(errorMessage);
      setIsSubmitting(false);
      return {
        success: false,
        error: errorMessage
      };
    }

    // Use provided form data or fall back to test data
    const formData = form;

    try {
      const res = await fetch('/api/meta/create-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await res.json();

      if (!result.success) {
        const errorMessage = result.error || 'Failed to create campaign';
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
   * Submit a test campaign using the selected test data type
   * 
   * @param testType - Type of test campaign to submit
   * @returns Response from API with success status and campaign ID
   */

  /**
   * Reset submission state
   */
  const resetSubmission = () => {
    setIsSubmitting(false);
    setSubmitError(null);
    setSubmitSuccess(false);
    setCampaignId(null);
  };

  return {
    submitCampaign,
    isSubmitting,
    submitError,
    submitSuccess,
    resetSubmission,
    campaignId,

  };
}