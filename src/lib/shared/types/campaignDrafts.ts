import type { SyncCoverage } from './integrations';

export type ReviveDraftSource = 'historic_clone' | 'fresh_relaunch' | 'manual_defaults';

export type ReviveStaleSeverity = 'watch' | 'stale' | 'critical';

export type CampaignDraftMode = 'manual' | 'smart';

export interface ManualCampaignDraftForm {
  campaignName: string;
  objective: string;
  destinationType: string;
  specialAdCategories: string[];
  bidStrategy: string;
  buyingType: string;
  budgetAmount: number;
  budgetType: 'daily' | 'lifetime';
  budgetOptimization: boolean;
  startDate: string;
  endDate: string | null;
  adSetName: string;
  pageId: string;
  optimizationGoal: string;
  useAdvantageAudience: boolean;
  useAdvantagePlacements: boolean;
  billingEvent: string;
  targeting: {
    markerPosition: { lat: number; lng: number } | null;
    radius: number;
    ageMin: number;
    ageMax: number;
    genders: string[];
    interests: string[];
  };
  creative: {
    contentSource: string;
    existingCreativeIds: string[];
    imageHash: string;
    adHeadline: string;
    adPrimaryText: string;
    adDescription: string;
    adCallToAction: string;
  };
}

export interface SmartCampaignDraftForm {
  budgetType: 'daily' | 'lifetime';
  budget: number;
  objective: string;
  destinationType: string;
  timeframe: string;
  creatives: string;
  link: string;
  message: string;
  imageHash: string;
  formId: string;
}

export type CampaignDraftPayload =
  | {
      mode: 'manual';
      form: ManualCampaignDraftForm;
    }
  | {
      mode: 'smart';
      form: SmartCampaignDraftForm;
    };

export interface ReviveCampaignDraftRecommendation {
  source: ReviveDraftSource;
  title: string;
  reason: string;
  destination: CampaignDraftMode;
  payloadJson: CampaignDraftPayload;
  sourceAssessmentDigestHash: string;
}

export interface ReviveCampaignOpportunity {
  adAccountId: string;
  platformIntegrationId: string;
  adAccountName: string | null;
  summary: string;
  primaryFlow: 'revive';
  daysSinceLastActivity: number | null;
  staleSeverity: ReviveStaleSeverity;
  sourceAssessmentDigestHash: string;
  syncCoverage: SyncCoverage | null;
  recommendations: ReviveCampaignDraftRecommendation[];
}
