import { useForm } from '@mantine/form';
import { CAMPAIGN_OBJECTIVES, DESTINATION_TYPES, OPTIMIZATION_GOALS } from '../utils/objectiveMappings';

/**
 * Hook for managing campaign creation form state
 * 
 * @param isFastCampaign - Whether the form is for a Smart Campaign (simplified)
 * @returns Form object with values, validation, and methods
 */
export function useMetaCampaignForm(platformId: string, adAccountId: string, isFastCampaign = false) {
  return useForm({
    initialValues: {
      step: 'adset' as 'list' | 'adset' | 'creative',
      activeAdSetIdx: 0 as number | null,
      type: isFastCampaign ? 'Quick' : 'Manual',
      adSetSubStep: 'adset' as 'adset' | 'creative',

      mode: 'uncontrolled',
      platform: 'meta',
      platformIntegrationId: platformId,

      // —————————————————————————————————————————
      // 1. Campaign level
      // —————————————————————————————————————————
      campaign: {
        adAccountId,
        campaignName: '',
        objective: CAMPAIGN_OBJECTIVES.LEADS,
        buying_type: 'AUCTION',
        special_ad_categories: ['NONE'],
        bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
        destinationType: DESTINATION_TYPES.FORM,
        // destination: {
        //   form: '',      // lead‐form id
        //   url: '',       // website url
        // },
      },
      
      // —————————————————————————————————————————
      // 2. Budget & schedule
      // —————————————————————————————————————————
      budget: {
        amount: 20,
        type: 'daily',
        optimization: true, // campaign_budget_optimization
        bidstrategy: 'LOWEST_COST_WITHOUT_CAP',
        buying_type: 'AUCTION',
      },
      schedule: {
        startDate: new Date(),
        endDate: null as Date | null,
      },

      adSets: [
        {
          adSetName: '',
          page_id: '',
          useAdvantageAudience: true,
          useAdvantagePlacements: true,
          billingEvent: 'IMPRESSIONS',
          optimization_goal: OPTIMIZATION_GOALS.LEAD_GENERATION,

          // targeting sub‐object
          targeting: {
            location: {
              markerPosition: null as { lat: number; lng: number } | null,
              radius: 10,
            },
            age: {
              min: 18,
              max: 65,
            },
            genders: [] as string[],
            interests: [] as string[],
          },
          // —————————————————————————————————————————
          // 4. Creatives (array)
          // —————————————————————————————————————————
          creatives: [
            {
              contentSource: isFastCampaign ? 'auto' : 'upload',
              existingCreativeIds: [] as string[],
              uploadedFiles: [] as File[],
              imageHash: '',
              adHeadline: '',
              adPrimaryText: '',
              adDescription: '',
              adCallToAction: 'LEARN_MORE' as string,
            },
          ],
        },
      ],

    },

    validate: {
      // Campaign fields
      campaign: {
        campaignName: (v) => v.trim() ? null : 'Campaign name is required',
        destinationType: (v) => v ? null : 'Please select a destination type',
        objective: (v) => v ? null : 'Objective is required',
      },

      // Budget
      // 'budget.amount': (v) => (v >= 5 ? null : 'Minimum budget is $5'),

      // // Schedule
      // 'schedule.startDate': (v) =>
      //   v ? null : 'Start date is required',

      // // Ad Set array: validate first item as example
      // 'adSets.0.adSetName': (v) =>
      //   v.trim() ? null : 'Ad Set name is required',
      // 'adSets.0.page_id': (v) =>
      //   v ? null : 'Facebook Page is required',

      // // Creative array: first creative
      // 'creatives.0.adHeadline': (v) =>
      //   v.trim() ? null : 'Ad headline is required',
      // 'creatives.0.adPrimaryText': (v) =>
      //   v.trim() ? null : 'Ad primary text is required',
    },
  });
}