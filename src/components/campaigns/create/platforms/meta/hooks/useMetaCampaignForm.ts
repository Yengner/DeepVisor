import { useForm } from '@mantine/form';
import { CampaignFormValues } from '@/lib/actions/meta/types';
import { CAMPAIGN_OBJECTIVES, DESTINATION_TYPES, OPTIMIZATION_GOALS } from '../utils/objectiveMappings';

/**
 * Hook for managing campaign creation form state
 * 
 * @param isSmartCampaign - Whether the form is for a Smart Campaign (simplified)
 * @returns Form object with values, validation, and methods
 */
export function useMetaCampaignForm(isSmartCampaign = false) {
  return useForm<CampaignFormValues>({
    initialValues: {

      // For internal use - platform details
      type: isSmartCampaign ? 'AI Auto' : 'Manual',
      platform: 'meta',
      adAccountId: '',

      // Campaign basics --- 
      campaignName: '',
      objective: CAMPAIGN_OBJECTIVES.LEADS,
      buying_type: 'AUCTION',
      special_ad_categories: ['NONE'],
      bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
      destinationType: DESTINATION_TYPES.FORM,

      // Budget and schedule
      budget: 20,
      budgetType: 'daily',
      startDate: new Date(),
      endDate: null,
      bidStrategy: 'LOWEST_COST_WITHOUT_CAP',
      campaign_budget_optimization: true,

      // Ad Set Configuration --
      adSetName: '',
      page_id: '',
      useAdvantageAudience: true,
      useAdvantagePlacements: true,
      billingEvent: 'IMPRESSIONS',
      optimization_goal: OPTIMIZATION_GOALS.LEAD_GENERATION,

      // Location and audience targeting
      location: {
        markerPosition: null,
        radius: 10,
      },
      ageMin: 18,
      ageMax: 65,
      genders: [],
      interests: [],

      // Creative content
      contentSource: isSmartCampaign ? 'auto' : 'upload',
      existingCreatives: [],
      selectedCreativeName: '',
      selectedCreativeThumbnail: '',
      existingCreativeIds: [],
      uploadedFiles: [],
      imageHash: '',
      adHeadline: '',
      adPrimaryText: '',
      adDescription: '',
      adCallToAction: 'LEARN_MORE',
      creativeIdTesting: '',

      // Destination configurations
      adDestinationForm: '',
      adDestinationUrl: '',

      // Additional fields from the extended form
      // useSavedAudience: false,
      // savedAudienceId: '',
      // languages: [],
      // behaviors: [],
      // adDestinationType: 'WEBSITE',
      // adDestinationPhone: '',
      // placementTypes: ['facebook', 'instagram'],
      // headline: '',
      // primaryText: '',
      // description: '',
      // callToAction: 'LEARN_MORE',
      // trackingPixel: '',
      // customParameters: '',
    },
    validate: {
      campaignName: (value) => (!value ? 'Campaign name is required' : null),
      budget: (value) => (value < 5 ? 'Minimum budget is $5' : null),
      startDate: (value) => (!value ? 'Start date is required' : null),
      page_id: (value) => (!value ? 'Facebook Page is required' : null),
      adHeadline: (value) => (!value ? 'Ad headline is required' : null),
      adPrimaryText: (value) => (!value ? 'Ad primary text is required' : null),
      // adDestinationUrl: (value, values) =>
      //   values.adDestinationType === 'WEBSITE' && !value ? 'Website URL is required' : null,
      // adDestinationPhone: (value, values) =>
      //   values.adDestinationType === 'PHONE' && !value ? 'Phone number is required' : null,
      adDestinationForm: (value, values) =>
        values.destinationType === 'FORM' && !value ? 'Please select a lead form' : null,
    }
  });
}