import { useForm } from '@mantine/form';
import { CampaignFormValues } from '@/lib/actions/meta/types';
import { CAMPAIGN_OBJECTIVES, OPTIMIZATION_GOALS, DESTINATION_TYPES } from '@/components/campaigns/create/common/utils/objectiveMappings';

/**
 * Hook for managing campaign creation form state
 * 
 * @param isSmartCampaign - Whether the form is for a Smart Campaign (simplified)
 * @returns Form object with values, validation, and methods
 */
export function useCampaignForm(isSmartCampaign = false) {
  return useForm<CampaignFormValues>({
    initialValues: {
      // Campaign basics
      platform: 'meta',
      campaignName: '',
      page_id: '',
      adAccountId: '',
      buying_type: 'AUCTION',
      ab_testing: false,
      objective: CAMPAIGN_OBJECTIVES.LEADS,
      type: isSmartCampaign ? 'AI Auto' : 'Manual',

      // Budget and schedule
      budget: 20,
      budgetType: 'daily',
      startDate: new Date(),
      endDate: null,

      // Location targeting
      location: {
        markerPosition: null,
        radius: 10,
      },

      // Audience targeting
      ageMin: 18,
      ageMax: 65,
      genders: [],
      languages: [],
      interests: [],
      behaviors: [],

      // Creative assets
      contentSource: isSmartCampaign ? 'auto' : 'upload',
      existingPostIds: [],
      uploadedFiles: [],
      adHeadline: '',
      adPrimaryText: '',
      adDescription: '',
      adCallToAction: 'LEARN_MORE',
      adDestinationType: 'WEBSITE',
      adDestinationUrl: '',
      adDestinationPhone: '',
      adDestinationForm: '',

      // Campaign optimization
      optimization_goal: OPTIMIZATION_GOALS.LEAD_GENERATION,
      optimization: OPTIMIZATION_GOALS.LEAD_GENERATION, // Duplicate for compatibility
      destination_type: DESTINATION_TYPES.FORM,
      destinationType: DESTINATION_TYPES.FORM, // Duplicate for compatibility
      campaign_budget_optimization: true,
      bidStrategy: 'LOWEST_COST_WITHOUT_CAP',
      billingEvent: 'IMPRESSIONS',
      placementTypes: ['facebook', 'instagram'],

      // Ad content (duplicate fields for API compatibility)
      headline: '',
      primaryText: '',
      description: '',
      callToAction: 'LEARN_MORE',

      // Tracking and measurement
      trackingPixel: '',
      customParameters: '',

      // Ad set configuration
      adSetName: '',
      useAdvantageAudience: isSmartCampaign ? true : false,
      useSavedAudience: false,
      savedAudienceId: '',
      useAdvantagePlacements: true,
    },
    validate: {
      campaignName: (value) => (!value ? 'Campaign name is required' : null),
      budget: (value) => (value < 5 ? 'Minimum budget is $5' : null),
      startDate: (value) => (!value ? 'Start date is required' : null),
      page_id: (value) => (!value ? 'Facebook Page is required' : null),
      adHeadline: (value) => (!value ? 'Ad headline is required' : null),
      adPrimaryText: (value) => (!value ? 'Ad primary text is required' : null),
      adDestinationUrl: (value, values) =>
        values.adDestinationType === 'WEBSITE' && !value ? 'Website URL is required' : null,
      adDestinationPhone: (value, values) =>
        values.adDestinationType === 'PHONE' && !value ? 'Phone number is required' : null,
      adDestinationForm: (value, values) =>
        values.adDestinationType === 'FORM' && !value ? 'Please select a lead form' : null,
    }
  });
}