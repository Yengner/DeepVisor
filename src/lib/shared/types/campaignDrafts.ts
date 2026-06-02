import type { SyncCoverage } from './integrations';

export type ReviveDraftSource = 'historic_clone' | 'fresh_relaunch' | 'manual_defaults';

export type ReviveStaleSeverity = 'watch' | 'stale' | 'critical';

export type CampaignDraftMode = 'manual' | 'smart';

export type LeadCampaignLeadMethod = 'instant_form' | 'messages' | 'calls';

export type LeadCampaignOfferTemplate =
  | 'new_client_intro'
  | 'high_ticket_transformation'
  | 'same_day_openings';

export type CampaignDraftTargetMode =
  | 'new_campaign'
  | 'existing_campaign'
  | 'existing_adset';

export interface CampaignDraftTarget {
  mode: CampaignDraftTargetMode;
  existingCampaignId?: string | null;
  existingCampaignName?: string | null;
  existingAdSetId?: string | null;
  existingAdSetName?: string | null;
}

export interface LeadCampaignCreativeDraft {
  id: string;
  role: 'primary' | 'challenger';
  contentSource: string;
  existingCreativeIds: string[];
  selectedCreativeName?: string;
  uploadedFileNames?: string[];
  imageHash: string;
  adHeadline: string;
  adPrimaryText: string;
  adDescription: string;
  adCallToAction: string;
}

export interface LeadCampaignAdSetDraft {
  id: string;
  role: 'primary' | 'challenger';
  existingCampaignId?: string | null;
  existingAdSetId?: string | null;
  adSetName: string;
  pageId: string;
  optimizationGoal: string;
  useAdvantageAudience: boolean;
  useAdvantagePlacements: boolean;
  billingEvent: string;
  targeting: ManualCampaignDraftForm['targeting'] & {
    locationLabel?: string;
  };
  creatives: LeadCampaignCreativeDraft[];
}

export interface LeadCampaignMethodSettings {
  instantForm: {
    formStyle: 'higher_intent' | 'more_volume';
    privacyPolicyUrl: string;
    qualifyingQuestions: string[];
  };
  messages: {
    channel: 'whatsapp' | 'messenger' | 'instagram';
    whatsappPhoneNumberId?: string;
    whatsappPhoneNumber?: string;
    whatsappBusinessAccountId?: string;
    whatsappBusinessAccountName?: string;
    whatsappBusinessReady?: boolean;
    responseReady: boolean;
  };
  calls: {
    phoneNumber: string;
    staffedHoursAcknowledged: boolean;
    callWindow: string;
  };
}

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
  draftTarget?: CampaignDraftTarget;
  leadMethod?: LeadCampaignLeadMethod;
  offerTemplate?: LeadCampaignOfferTemplate;
  methodSettings?: LeadCampaignMethodSettings;
  adSets?: LeadCampaignAdSetDraft[];
  adSetName: string;
  pageId: string;
  optimizationGoal: string;
  useAdvantageAudience: boolean;
  useAdvantagePlacements: boolean;
  billingEvent: string;
  targeting: {
    markerPosition: { lat: number; lng: number } | null;
    locationLabel?: string;
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
