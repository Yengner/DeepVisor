import { useForm } from '@mantine/form';
import type { ManualCampaignDraftForm } from '@/lib/shared/types/campaignDrafts';
import { CAMPAIGN_OBJECTIVES, DESTINATION_TYPES, OPTIMIZATION_GOALS } from '../utils/objectiveMappings';

/**
 * Hook for managing campaign creation form state
 * 
 * @param isFastCampaign - Whether the form is for a Smart Campaign (simplified)
 * @returns Form object with values, validation, and methods
 */
function buildDefaultInitialValues(
  platformId: string,
  adAccountId: string,
  isFastCampaign: boolean
) {
  return {
    step: 'adset' as 'list' | 'adset' | 'creative',
    activeAdSetIdx: 0 as number | null,
    type: isFastCampaign ? 'Quick' : 'Manual',
    adSetSubStep: 'adset' as 'adset' | 'creative',

    mode: 'uncontrolled',
    platform: 'meta',
    platformIntegrationId: platformId,

    campaign: {
      adAccountId,
      campaignName: '',
      objective: CAMPAIGN_OBJECTIVES.LEADS,
      buying_type: 'AUCTION',
      special_ad_categories: ['NONE'],
      bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
      destinationType: DESTINATION_TYPES.FORM,
    },

    budget: {
      amount: 20,
      type: 'daily',
      optimization: true,
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
  };
}

function applyDraftToInitialValues(
  initialValues: ReturnType<typeof buildDefaultInitialValues>,
  draft: ManualCampaignDraftForm | null | undefined
) {
  if (!draft) {
    return initialValues;
  }

  return {
    ...initialValues,
    campaign: {
      ...initialValues.campaign,
      campaignName: draft.campaignName || initialValues.campaign.campaignName,
      objective: draft.objective || initialValues.campaign.objective,
      buying_type: draft.buyingType || initialValues.campaign.buying_type,
      special_ad_categories:
        draft.specialAdCategories.length > 0
          ? draft.specialAdCategories
          : initialValues.campaign.special_ad_categories,
      bid_strategy: draft.bidStrategy || initialValues.campaign.bid_strategy,
      destinationType: draft.destinationType || initialValues.campaign.destinationType,
    },
    budget: {
      ...initialValues.budget,
      amount: draft.budgetAmount || initialValues.budget.amount,
      type: draft.budgetType || initialValues.budget.type,
      optimization: draft.budgetOptimization,
      bidstrategy: draft.bidStrategy || initialValues.budget.bidstrategy,
      buying_type: draft.buyingType || initialValues.budget.buying_type,
    },
    schedule: {
      startDate: draft.startDate ? new Date(draft.startDate) : initialValues.schedule.startDate,
      endDate: draft.endDate ? new Date(draft.endDate) : null,
    },
    adSets: [
      {
        ...initialValues.adSets[0],
        adSetName: draft.adSetName || initialValues.adSets[0].adSetName,
        page_id: draft.pageId || initialValues.adSets[0].page_id,
        useAdvantageAudience: draft.useAdvantageAudience,
        useAdvantagePlacements: draft.useAdvantagePlacements,
        billingEvent: draft.billingEvent || initialValues.adSets[0].billingEvent,
        optimization_goal:
          draft.optimizationGoal || initialValues.adSets[0].optimization_goal,
        targeting: {
          location: {
            markerPosition:
              draft.targeting.markerPosition ?? initialValues.adSets[0].targeting.location.markerPosition,
            radius: draft.targeting.radius || initialValues.adSets[0].targeting.location.radius,
          },
          age: {
            min: draft.targeting.ageMin || initialValues.adSets[0].targeting.age.min,
            max: draft.targeting.ageMax || initialValues.adSets[0].targeting.age.max,
          },
          genders:
            draft.targeting.genders.length > 0
              ? draft.targeting.genders
              : initialValues.adSets[0].targeting.genders,
          interests:
            draft.targeting.interests.length > 0
              ? draft.targeting.interests
              : initialValues.adSets[0].targeting.interests,
        },
        creatives: [
          {
            ...initialValues.adSets[0].creatives[0],
            contentSource:
              draft.creative.contentSource || initialValues.adSets[0].creatives[0].contentSource,
            existingCreativeIds:
              draft.creative.existingCreativeIds.length > 0
                ? draft.creative.existingCreativeIds
                : initialValues.adSets[0].creatives[0].existingCreativeIds,
            imageHash:
              draft.creative.imageHash || initialValues.adSets[0].creatives[0].imageHash,
            adHeadline:
              draft.creative.adHeadline || initialValues.adSets[0].creatives[0].adHeadline,
            adPrimaryText:
              draft.creative.adPrimaryText ||
              initialValues.adSets[0].creatives[0].adPrimaryText,
            adDescription:
              draft.creative.adDescription ||
              initialValues.adSets[0].creatives[0].adDescription,
            adCallToAction:
              draft.creative.adCallToAction ||
              initialValues.adSets[0].creatives[0].adCallToAction,
          },
        ],
      },
    ],
  };
}

export function useMetaCampaignForm(
  platformId: string,
  adAccountId: string,
  isFastCampaign = false,
  draft: ManualCampaignDraftForm | null = null
) {
  const initialValues = applyDraftToInitialValues(
    buildDefaultInitialValues(platformId, adAccountId, isFastCampaign),
    draft
  );

  return useForm({
    initialValues,

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
