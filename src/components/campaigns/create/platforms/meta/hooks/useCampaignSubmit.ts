import { useState } from 'react';
import { CampaignFormValues } from '@/lib/actions/meta/types';
import { createMetaCampaign } from '@/lib/actions/meta/campaign.actions';

/**
 * Static test data for different campaign types
 */
export const CAMPAIGN_TEST_DATA = {
  LEAD_GEN: {
    // Campaign basics
    campaignName: "Test Lead Generation Manual 2",
    page_id: "352168868872363", // Replace with a valid page ID
    objective: "OUTCOME_LEADS",
    type: "", // For smart campaign optimizations
    buying_type: "AUCTION",
    special_ad_categories: ["NONE"],

    // Budget and schedule
    budget: 25,
    budgetType: "daily",
    startDate: new Date(),
    endDate: "2025-12-31T23:59:59Z",
    bidStrategy: "LOWEST_COST_WITHOUT_CAP",

    // Ad Set level parameters
    billingEvent: "IMPRESSIONS",
    destinationType: "ON_AD",
    // Location and audience targeting
    location: {
      markerPosition: { lat: 37.7749, lng: -122.4194 }, // San Francisco
      radius: 10
    },
    ageMin: 25,
    ageMax: 65,

    // Creative content
    contentSource: "upload" as const,
    imageHash: "b01f66bb94e8ac207b4c407d4b2197aa", // Example image hash
    adHeadline: "Sign Up for Our Newsletter",
    adPrimaryText: "Get weekly updates on industry trends and insights.",
    adDescription: "Join thousands of professionals staying up to date.",
    adCallToAction: "SIGN_UP",

    // Creative ID for existing creative (for dev mode)
    creativeIdTesting: "120210349272830199", // Replace with a valid creative ID

    // Lead generation specific
    adDestinationForm: "987654321", // Replace with a valid form ID

    // Platform details
    platform: "meta"
  },

  TRAFFIC: {
    // Campaign basics
    campaignName: "Test Traffic Campaign",
    page_id: "123456789012345", // Replace with a valid page ID
    objective: "OUTCOME_TRAFFIC",
    buying_type: "AUCTION",

    // Budget and schedule
    budget: 15,
    budgetType: "daily",
    startDate: new Date(),
    endDate: null,

    // Ad Set level parameters
    billingEvent: "LINK_CLICKS",
    destinationType: "WEBSITE",

    // Location and audience targeting
    location: {
      markerPosition: { lat: 40.7128, lng: -74.0060 }, // NYC
      radius: 25
    },
    ageMin: 18,
    ageMax: 65,

    // Creative content
    adHeadline: "Visit Our Website Today",
    adPrimaryText: "Discover our latest products and special offers.",
    adDescription: "Limited time promotion for new customers.",
    adCallToAction: "LEARN_MORE",
    adDestinationUrl: "https://example.com/landing",

    // Platform details
    platform: "meta"
  }
};

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
  /** Submit a test campaign using static data */
  submitTestCampaign: (testCampaignType: keyof typeof CAMPAIGN_TEST_DATA) => Promise<CampaignSubmitResponse>;
  /** Currently selected test campaign type */
  testCampaignType: keyof typeof CAMPAIGN_TEST_DATA | null;
  /** Set the test campaign type */
  setTestCampaignType: (type: keyof typeof CAMPAIGN_TEST_DATA) => void;
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
  const [testCampaignType, setTestCampaignType] = useState<keyof typeof CAMPAIGN_TEST_DATA | null>("LEAD_GEN");

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

    if (!form && !testCampaignType) {
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
      // Call server action to create campaign
      const result = await createMetaCampaign(formData);

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
   * Submit a test campaign using the selected test data type
   * 
   * @param testType - Type of test campaign to submit
   * @returns Response from API with success status and campaign ID
   */
  const submitTestCampaign = async (testType: keyof typeof CAMPAIGN_TEST_DATA): Promise<CampaignSubmitResponse> => {
    setTestCampaignType(testType);
    return submitCampaign(CAMPAIGN_TEST_DATA[testType]);
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

  return {
    submitCampaign,
    isSubmitting,
    submitError,
    submitSuccess,
    resetSubmission,
    campaignId,
    submitTestCampaign,
    testCampaignType,
    setTestCampaignType
  };
}