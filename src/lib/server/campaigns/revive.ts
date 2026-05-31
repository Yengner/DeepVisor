import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { asNumber, asRecord, asString } from '@/lib/shared';
import type {
  CampaignDraftPayload,
  ManualCampaignDraftForm,
  ReviveCampaignDraftRecommendation,
  ReviveCampaignOpportunity,
  ReviveDraftSource,
  LeadCampaignAdSetDraft,
  LeadCampaignCreativeDraft,
  LeadCampaignMethodSettings,
  LeadCampaignLeadMethod,
  LeadCampaignOfferTemplate,
  SmartCampaignDraftForm,
} from '@/lib/shared/types/campaignDrafts';
import type { Database } from '@/lib/shared/types/supabase';
import { getLatestAdAccountAssessment } from '@/lib/server/intelligence/repositories/assessments';
import { getAdAccountSyncCoverage } from '@/lib/server/repositories/ad_accounts/syncState';
import { createCampaignDraft } from './drafts';

type CampaignsClient = SupabaseClient<Database>;

const META_LEADS_OBJECTIVE = 'OUTCOME_LEADS';
const META_FORM_DESTINATION = 'ON_AD';
const META_PHONE_DESTINATION = 'PHONE_CALL';
const META_MESSENGER_DESTINATION = 'MESSENGER';
const META_WHATSAPP_DESTINATION = 'WHATSAPP';
const META_DEFAULT_OPTIMIZATION_GOAL = 'LEAD_GENERATION';
const META_CALL_OPTIMIZATION_GOAL = 'QUALITY_CALL';
const META_DEFAULT_BID_STRATEGY = 'LOWEST_COST_WITHOUT_CAP';
const META_DEFAULT_BUYING_TYPE = 'AUCTION';
const META_DEFAULT_BILLING_EVENT = 'IMPRESSIONS';
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type BusinessProfileSeed = Pick<
  Database['public']['Tables']['business_profiles']['Row'],
  'business_name' | 'website' | 'description' | 'monthly_budget' | 'ad_goals'
>;

type CampaignSeedRow = Pick<
  Database['public']['Views']['campaign_dims']['Row'],
  'id' | 'name' | 'objective' | 'raw'
>;

type AdsetSeedRow = Pick<
  Database['public']['Views']['adset_dims']['Row'],
  'id' | 'name' | 'optimization_goal' | 'raw'
>;

type CreativeSeedRow = Pick<
  Database['public']['Tables']['ad_creatives']['Row'],
  | 'platform_creative_id'
  | 'page_id'
  | 'image_hash'
  | 'headline'
  | 'primary_text'
  | 'description'
  | 'cta_type'
  | 'link_url'
>;

function startOfTodayIso(): string {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return today.toISOString();
}

function isoDaysFromToday(days: number): string {
  const date = new Date(startOfTodayIso());
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function formatGoalLabel(value: string): string {
  return value
    .replace(/^OUTCOME_/, '')
    .replace(/_/g, ' ')
    .toLowerCase();
}

function looksLikeUuid(value: string | null): boolean {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

function mapMonthlyBudgetCap(value: string | null): number | null {
  switch (value) {
    case 'under_1000':
      return 1000;
    case '1000_5000':
      return 5000;
    case '5000_10000':
      return 10000;
    case '10000_50000':
      return 50000;
    case 'over_50000':
      return 50000;
    default:
      return null;
  }
}

function clampBudget(input: {
  suggestedDailyBudget: number;
  monthlyBudget: string | null;
}): number {
  const cap = mapMonthlyBudgetCap(input.monthlyBudget);
  const maxDaily = cap ? Math.max(20, Math.round(cap / 30)) : 250;
  return Math.max(20, Math.min(Math.round(input.suggestedDailyBudget), maxDaily));
}

function resolveSuggestedDailyBudget(input: {
  monthlyBudget: string | null;
  last30dSpend: number;
  topCampaignSpend: number;
  daysSinceLastActivity: number | null;
}): number {
  const historicalBase =
    input.last30dSpend > 0
      ? input.last30dSpend / 30
      : input.topCampaignSpend > 0
        ? input.topCampaignSpend / 14
        : 35;
  const staleGuardrail =
    input.daysSinceLastActivity != null && input.daysSinceLastActivity > 120 ? historicalBase * 0.7 : historicalBase * 0.85;

  return clampBudget({
    suggestedDailyBudget: staleGuardrail,
    monthlyBudget: input.monthlyBudget,
  });
}

function inferDestinationType(input: {
  leads: number;
  messages: number;
  calls?: number;
}): string {
  if (
    typeof input.calls === 'number' &&
    input.calls > 0 &&
    input.calls >= input.leads &&
    input.calls >= input.messages
  ) {
    return META_PHONE_DESTINATION;
  }

  if (input.messages > 0 && input.messages > input.leads) {
    return META_WHATSAPP_DESTINATION;
  }

  return META_FORM_DESTINATION;
}

function normalizeLeadDestinationType(destinationType: string): string {
  if (
    destinationType === META_MESSENGER_DESTINATION ||
    destinationType === META_WHATSAPP_DESTINATION ||
    destinationType === META_PHONE_DESTINATION
  ) {
    return destinationType;
  }

  return META_FORM_DESTINATION;
}

function leadMethodForDestination(destinationType: string): LeadCampaignLeadMethod {
  if (destinationType === META_MESSENGER_DESTINATION || destinationType === META_WHATSAPP_DESTINATION) {
    return 'messages';
  }

  if (destinationType === META_PHONE_DESTINATION) {
    return 'calls';
  }

  return 'instant_form';
}

function offerTemplateForLeadMethod(leadMethod: LeadCampaignLeadMethod): LeadCampaignOfferTemplate {
  if (leadMethod === 'calls') {
    return 'same_day_openings';
  }

  if (leadMethod === 'messages') {
    return 'high_ticket_transformation';
  }

  return 'new_client_intro';
}

function optimizationGoalForDestination(destinationType: string): string {
  return destinationType === META_PHONE_DESTINATION
    ? META_CALL_OPTIMIZATION_GOAL
    : META_DEFAULT_OPTIMIZATION_GOAL;
}

function defaultMethodSettings(): LeadCampaignMethodSettings {
  return {
    instantForm: {
      formStyle: 'higher_intent',
      privacyPolicyUrl: '',
      qualifyingQuestions: ['Preferred service', 'Preferred appointment day', 'Phone number'],
    },
    messages: {
      channel: 'whatsapp',
      whatsappPhoneNumber: '',
      whatsappBusinessReady: false,
      responseReady: false,
    },
    calls: {
      phoneNumber: '',
      staffedHoursAcknowledged: false,
      callWindow: 'Business hours only',
    },
  };
}

function parseTargeting(
  raw: unknown
): ManualCampaignDraftForm['targeting'] {
  const targeting = asRecord(asRecord(raw).targeting);
  const geoLocations = asRecord(targeting.geo_locations);
  const customLocations = Array.isArray(geoLocations.custom_locations)
    ? geoLocations.custom_locations.map((item) => asRecord(item))
    : [];
  const customLocation = customLocations[0] ?? {};
  const markerPosition =
    typeof customLocation.latitude === 'number' && typeof customLocation.longitude === 'number'
      ? {
          lat: customLocation.latitude,
          lng: customLocation.longitude,
        }
      : null;
  const flexibleSpec = Array.isArray(targeting.flexible_spec)
    ? targeting.flexible_spec.map((item) => asRecord(item))
    : [];
  const flexibleInterests = flexibleSpec.flatMap((item) =>
    Array.isArray(item.interests) ? item.interests.map((interest) => asRecord(interest)) : []
  );
  const directInterests = Array.isArray(targeting.interests)
    ? targeting.interests.map((interest) => asRecord(interest))
    : [];
  const interests = [...flexibleInterests, ...directInterests]
    .map((interest) => asString(interest.name))
    .filter(Boolean)
    .slice(0, 5);

  return {
    markerPosition,
    locationLabel: '',
    radius: asNumber(customLocation.radius) || 10,
    ageMin: asNumber(targeting.age_min) || 18,
    ageMax: asNumber(targeting.age_max) || 65,
    genders: Array.isArray(targeting.genders)
      ? targeting.genders.map((gender) => String(gender)).filter(Boolean)
      : [],
    interests,
  };
}

function buildCreativeDraft(
  input: {
    creative: CreativeSeedRow | null;
    role: 'primary' | 'challenger';
    offerTemplate: LeadCampaignOfferTemplate;
  }
): LeadCampaignCreativeDraft {
  const roleSuffix = input.role === 'challenger' ? ' angle 2' : '';
  const fallbackByTemplate: Record<LeadCampaignOfferTemplate, { headline: string; primaryText: string; description: string; cta: string }> = {
    new_client_intro: {
      headline: `New client lead offer${roleSuffix}`,
      primaryText: 'Book a first-time consult and see the right service plan before you commit.',
      description: 'Consult',
      cta: 'GET_OFFER',
    },
    high_ticket_transformation: {
      headline: `Transformation consult${roleSuffix}`,
      primaryText: 'Thinking about a bigger service? Message the business for a quick consult.',
      description: 'Consult request',
      cta: 'BOOK_NOW',
    },
    same_day_openings: {
      headline: `Today openings available${roleSuffix}`,
      primaryText: 'Call now to ask about same-day openings and available appointment times.',
      description: 'Same-day openings',
      cta: 'CALL_NOW',
    },
  };
  const fallback = fallbackByTemplate[input.offerTemplate];
  const hasExistingCreative = Boolean(input.creative?.platform_creative_id);

  return {
    id: input.role,
    role: input.role,
    contentSource: hasExistingCreative ? 'existing' : 'upload',
    existingCreativeIds: hasExistingCreative && input.creative?.platform_creative_id
      ? [input.creative.platform_creative_id]
      : [],
    selectedCreativeName: hasExistingCreative ? `Creative ${input.creative?.platform_creative_id}` : '',
    uploadedFileNames: [],
    imageHash: input.creative?.image_hash ?? '',
    adHeadline: input.role === 'primary' ? input.creative?.headline ?? fallback.headline : fallback.headline,
    adPrimaryText: input.role === 'primary' ? input.creative?.primary_text ?? fallback.primaryText : fallback.primaryText,
    adDescription: input.role === 'primary' ? input.creative?.description ?? fallback.description : fallback.description,
    adCallToAction: input.role === 'primary' ? input.creative?.cta_type ?? fallback.cta : fallback.cta,
  };
}

function buildManualDraftPayload(input: {
  campaignName: string;
  destinationType: string;
  dailyBudget: number;
  adSetName: string;
  pageId: string;
  targeting: ManualCampaignDraftForm['targeting'];
  creative: CreativeSeedRow | null;
}): CampaignDraftPayload {
  const destinationType = normalizeLeadDestinationType(input.destinationType);
  const leadMethod = leadMethodForDestination(destinationType);
  const offerTemplate = offerTemplateForLeadMethod(leadMethod);
  const optimizationGoal = optimizationGoalForDestination(destinationType);
  const lifetimeBudget = Math.max(150, Math.round(input.dailyBudget * 30));
  const primaryCreative = buildCreativeDraft({
    creative: input.creative,
    role: 'primary',
    offerTemplate,
  });
  const challengerCreative = buildCreativeDraft({
    creative: null,
    role: 'challenger',
    offerTemplate,
  });
  const primaryAdSet: LeadCampaignAdSetDraft = {
    id: 'primary',
    role: 'primary',
    existingCampaignId: null,
    existingAdSetId: null,
    adSetName: input.adSetName,
    pageId: input.pageId,
    optimizationGoal,
    useAdvantageAudience: true,
    useAdvantagePlacements: true,
    billingEvent: META_DEFAULT_BILLING_EVENT,
    targeting: input.targeting,
    creatives: [primaryCreative, challengerCreative],
  };

  return {
    mode: 'manual',
    form: {
      campaignName: input.campaignName,
      objective: META_LEADS_OBJECTIVE,
      destinationType,
      specialAdCategories: ['NONE'],
      bidStrategy: META_DEFAULT_BID_STRATEGY,
      buyingType: META_DEFAULT_BUYING_TYPE,
      budgetAmount: lifetimeBudget,
      budgetType: 'lifetime',
      budgetOptimization: false,
      startDate: startOfTodayIso(),
      endDate: isoDaysFromToday(30),
      draftTarget: {
        mode: 'new_campaign',
        existingCampaignId: null,
        existingCampaignName: null,
        existingAdSetId: null,
        existingAdSetName: null,
      },
      leadMethod,
      offerTemplate,
      methodSettings: defaultMethodSettings(),
      adSets: [primaryAdSet],
      adSetName: input.adSetName,
      pageId: input.pageId,
      optimizationGoal,
      useAdvantageAudience: true,
      useAdvantagePlacements: true,
      billingEvent: META_DEFAULT_BILLING_EVENT,
      targeting: input.targeting,
      creative: {
        contentSource: primaryCreative.contentSource,
        existingCreativeIds: primaryCreative.existingCreativeIds,
        imageHash: primaryCreative.imageHash,
        adHeadline: primaryCreative.adHeadline,
        adPrimaryText: primaryCreative.adPrimaryText,
        adDescription: primaryCreative.adDescription,
        adCallToAction: primaryCreative.adCallToAction,
      },
    },
  };
}

function buildSmartDraftPayload(input: {
  objective: string;
  destinationType: string;
  dailyBudget: number;
  businessWebsite: string | null;
  creative: CreativeSeedRow | null;
}): CampaignDraftPayload {
  const destinationType =
    input.destinationType === META_PHONE_DESTINATION ||
    input.destinationType === META_MESSENGER_DESTINATION ||
    input.destinationType === META_WHATSAPP_DESTINATION
      ? input.destinationType
      : META_FORM_DESTINATION;

  return {
    mode: 'smart',
    form: {
      budgetType: 'daily',
      budget: input.dailyBudget,
      objective: input.objective,
      destinationType,
      timeframe: '30',
      creatives: input.creative?.image_hash ?? '',
      link: input.creative?.link_url ?? input.businessWebsite ?? 'https://fb.me/',
      message: input.creative?.primary_text ?? '',
      imageHash: input.creative?.image_hash ?? '',
      formId: '',
    },
  };
}

async function loadBusinessProfile(
  supabase: CampaignsClient,
  businessId: string
): Promise<BusinessProfileSeed | null> {
  const { data, error } = await supabase
    .from('business_profiles')
    .select('business_name, website, description, monthly_budget, ad_goals')
    .eq('id', businessId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as BusinessProfileSeed | null) ?? null;
}

async function loadCampaignSeed(
  supabase: CampaignsClient,
  adAccountId: string,
  campaignId: string | null
): Promise<CampaignSeedRow | null> {
  if (!campaignId) {
    return null;
  }

  let query = supabase
    .from('campaign_dims')
    .select('id, name, objective, raw')
    .eq('ad_account_id', adAccountId);

  query = looksLikeUuid(campaignId)
    ? query.eq('id', campaignId)
    : query.eq('external_id', campaignId);

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw error;
  }

  return (data as CampaignSeedRow | null) ?? null;
}

async function loadAdsetSeed(
  supabase: CampaignsClient,
  adAccountId: string,
  adsetId: string | null
): Promise<AdsetSeedRow | null> {
  if (!adsetId) {
    return null;
  }

  let query = supabase
    .from('adset_dims')
    .select('id, name, optimization_goal, raw')
    .eq('ad_account_id', adAccountId);

  query = looksLikeUuid(adsetId)
    ? query.eq('id', adsetId)
    : query.eq('external_id', adsetId);

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw error;
  }

  return (data as AdsetSeedRow | null) ?? null;
}

async function loadCreativeSeed(
  supabase: CampaignsClient,
  adAccountId: string
): Promise<CreativeSeedRow | null> {
  const { data, error } = await supabase
    .from('ad_creatives')
    .select(
      'platform_creative_id, page_id, image_hash, headline, primary_text, description, cta_type, link_url'
    )
    .eq('ad_account_id', adAccountId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as CreativeSeedRow | null) ?? null;
}

function buildRecommendationSet(input: {
  opportunity: Omit<ReviveCampaignOpportunity, 'recommendations'>;
  businessProfile: BusinessProfileSeed | null;
  campaignSeed: CampaignSeedRow | null;
  adsetSeed: AdsetSeedRow | null;
  creativeSeed: CreativeSeedRow | null;
  last30dSpend: number;
  topCampaignSpend: number;
  last30dLeads: number;
  last30dMessages: number;
}): ReviveCampaignDraftRecommendation[] {
  const businessName = input.businessProfile?.business_name || 'Your business';
  const topCampaignName = input.campaignSeed?.name || 'Best historic winner';
  const outcomeDirection = inferDestinationType({
    leads: input.last30dLeads,
    messages: input.last30dMessages,
  });
  const dailyBudget = resolveSuggestedDailyBudget({
    monthlyBudget: input.businessProfile?.monthly_budget ?? null,
    last30dSpend: input.last30dSpend,
    topCampaignSpend: input.topCampaignSpend,
    daysSinceLastActivity: input.opportunity.daysSinceLastActivity,
  });
  const targeting = parseTargeting(input.adsetSeed?.raw);
  const pageId = input.creativeSeed?.page_id ?? '';
  const historicClonePayload = buildManualDraftPayload({
    campaignName: `Revive ${topCampaignName}`,
    destinationType: outcomeDirection,
    dailyBudget,
    adSetName: input.adsetSeed?.name || `${topCampaignName} - Relaunch`,
    pageId,
    targeting,
    creative: input.creativeSeed,
  });
  const freshRelaunchPayload = buildSmartDraftPayload({
    objective: META_LEADS_OBJECTIVE,
    destinationType: outcomeDirection,
    dailyBudget,
    businessWebsite: input.businessProfile?.website ?? null,
    creative: input.creativeSeed,
  });
  const manualDefaultsPayload = buildManualDraftPayload({
    campaignName: `${businessName} Lead Relaunch`,
    destinationType: outcomeDirection,
    dailyBudget: Math.max(20, Math.round(dailyBudget * 0.85)),
    adSetName: `${businessName} - Core audience`,
    pageId,
    targeting: {
      markerPosition: targeting.markerPosition,
      radius: targeting.radius || 10,
      ageMin: 18,
      ageMax: 65,
      genders: [],
      interests: [],
    },
    creative: input.creativeSeed,
  });

  return [
    {
      source: 'historic_clone',
      title: 'Revive best historic winner',
      reason: `Start from ${topCampaignName} and carry forward the strongest surviving structure into a fresh reviewable draft.`,
      destination: 'manual',
      payloadJson: historicClonePayload,
      sourceAssessmentDigestHash: input.opportunity.sourceAssessmentDigestHash,
    },
    {
      source: 'fresh_relaunch',
      title: 'Build fresh lead-gen relaunch',
      reason: `Launch a cleaner ${formatGoalLabel(
        META_LEADS_OBJECTIVE
      )} draft based on the business profile and the account's historic outcome pattern.`,
      destination: 'smart',
      payloadJson: freshRelaunchPayload,
      sourceAssessmentDigestHash: input.opportunity.sourceAssessmentDigestHash,
    },
    {
      source: 'manual_defaults',
      title: 'Open manual builder with defaults',
      reason: 'Start from a conservative manual draft with prefilled budget, targeting guardrails, and the latest available creative context.',
      destination: 'manual',
      payloadJson: manualDefaultsPayload,
      sourceAssessmentDigestHash: input.opportunity.sourceAssessmentDigestHash,
    },
  ];
}

export async function getReviveCampaignOpportunity(
  supabase: CampaignsClient,
  input: {
    businessId: string;
    platformIntegrationId: string;
    adAccountId: string;
  }
): Promise<ReviveCampaignOpportunity | null> {
  const [syncCoverage, assessment] = await Promise.all([
    getAdAccountSyncCoverage(supabase, input.adAccountId),
    getLatestAdAccountAssessment(supabase, {
      businessId: input.businessId,
      platformIntegrationId: input.platformIntegrationId,
      adAccountId: input.adAccountId,
    }),
  ]);

  if (!assessment || assessment.assessment.primaryFlow !== 'revive') {
    return null;
  }

  if (syncCoverage?.historicalAnalysisPending) {
    return null;
  }

  const baseOpportunity = {
    adAccountId: input.adAccountId,
    platformIntegrationId: input.platformIntegrationId,
    adAccountName: assessment.digest.adAccountName,
    summary: assessment.assessment.summary,
    primaryFlow: 'revive' as const,
    daysSinceLastActivity: assessment.digest.daysSinceLastActivity,
    staleSeverity: assessment.digest.staleSeverity ?? 'watch',
    sourceAssessmentDigestHash: assessment.digest.digestHash,
    syncCoverage,
  };

  const [businessProfile, campaignSeed, adsetSeed, creativeSeed] = await Promise.all([
    loadBusinessProfile(supabase, input.businessId),
    loadCampaignSeed(supabase, input.adAccountId, assessment.digest.topCampaigns[0]?.id ?? null),
    loadAdsetSeed(supabase, input.adAccountId, assessment.digest.topAdSets[0]?.id ?? null),
    loadCreativeSeed(supabase, input.adAccountId),
  ]);

  return {
    ...baseOpportunity,
    recommendations: buildRecommendationSet({
      opportunity: baseOpportunity,
      businessProfile,
      campaignSeed,
      adsetSeed,
      creativeSeed,
      last30dSpend: assessment.digest.weightedAverages.last30d.spend,
      topCampaignSpend: assessment.digest.topCampaigns[0]?.spend ?? 0,
      last30dLeads: assessment.digest.weightedAverages.last30d.leads,
      last30dMessages: assessment.digest.weightedAverages.last30d.messages,
    }),
  };
}

export async function createReviveCampaignDraft(
  supabase: CampaignsClient,
  input: {
    businessId: string;
    platformIntegrationId: string;
    adAccountId: string;
    userId: string;
    source: ReviveDraftSource;
  }
): Promise<{
  draftId: string;
  destination: 'manual' | 'smart';
  href: string;
  recommendation: ReviveCampaignDraftRecommendation;
}> {
  const opportunity = await getReviveCampaignOpportunity(supabase, {
    businessId: input.businessId,
    platformIntegrationId: input.platformIntegrationId,
    adAccountId: input.adAccountId,
  });

  if (!opportunity) {
    throw new Error('No revive opportunity is available for this ad account');
  }

  const recommendation =
    opportunity.recommendations.find((item) => item.source === input.source) ?? null;

  if (!recommendation) {
    throw new Error('Requested revive recommendation could not be found');
  }

  const draft = await createCampaignDraft(supabase, {
    businessId: input.businessId,
    platformIntegrationId: input.platformIntegrationId,
    adAccountId: input.adAccountId,
    userId: input.userId,
    title: recommendation.title,
    payloadJson: recommendation.payloadJson,
    reviewNotes: recommendation.reason,
    sourceActionId: `revive:${recommendation.source}`,
  });

  const href =
    recommendation.destination === 'smart'
      ? `/campaigns/intelligence/create?draft=${draft.id}`
      : `/campaigns/create?draft=${draft.id}`;

  return {
    draftId: draft.id,
    destination: recommendation.destination,
    href,
    recommendation,
  };
}
