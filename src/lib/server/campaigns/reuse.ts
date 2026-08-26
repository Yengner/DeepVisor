import 'server-only';

import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { asRecord, asString, ErrorCode } from '@/lib/shared';
import {
  SALON_MOST_VALUABLE_SERVICE_OPTIONS,
  SALON_SERVICE_OPTIONS,
} from '@/lib/shared/onboarding/businessProfileOptions';
import type {
  CampaignDraftPayload,
  CampaignReuseCreativeMode,
  CreateCampaignReuseDraftRequest,
  CreateCampaignReuseDraftResult,
  LeadCampaignCreativeDraft,
  LeadCampaignLeadMethod,
  LeadCampaignMethodSettings,
  ManualCampaignDraftForm,
} from '@/lib/shared/types/campaignDrafts';
import type { Database, Json } from '@/lib/shared/types/supabase';
import {
  CampaignReuseSourceLookupError,
  getCampaignReuseSource,
  type CampaignReuseCreativeRow,
  type CampaignReuseSourceRecords,
} from '@/lib/server/repositories/campaigns/getCampaignReuseSource';
import {
  getMonthlyBudgetUpperBound,
  MAX_DAILY_CAMPAIGN_BUDGET,
  MAX_LIFETIME_CAMPAIGN_BUDGET,
} from './budgetGuardrails';
import { createCampaignDraft } from './drafts';

type CampaignsClient = SupabaseClient<Database>;
type BusinessProfileRow = Pick<
  Database['public']['Tables']['business_profiles']['Row'],
  | 'business_name'
  | 'booking_link'
  | 'website'
  | 'business_location'
  | 'customer_radius'
  | 'monthly_budget'
  | 'meta_page_id'
  | 'meta_page_name'
  | 'meta_page_instagram_account_id'
  | 'meta_page_instagram_account_name'
  | 'meta_page_instagram_account_username'
  | 'meta_page_instagram_account_picture_url'
  | 'preferred_contact_method'
  | 'lead_type'
  | 'most_valuable_service'
  | 'promoted_services'
  | 'page_phone'
  | 'whatsapp_number'
  | 'whatsapp_setup_completed'
>;

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_PAST_TOLERANCE_MS = DAY_MS;
const MAX_START_AHEAD_MS = 365 * DAY_MS;
const MAX_DURATION_MS = 366 * DAY_MS;
const ISO_WITH_TIMEZONE_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?(Z|([+-])(\d{2}):(\d{2}))$/i;
const DELETED_SOURCE_STATUSES = new Set(['deleted', 'permanently_deleted']);
const UNUSABLE_REUSE_AD_STATUSES = new Set([
  'deleted',
  'permanently_deleted',
  'disapproved',
  'with_issues',
]);
const SUPPORTED_DESTINATIONS = new Set(['ON_AD', 'MESSENGER', 'WHATSAPP', 'PHONE_CALL']);
const SUPPORTED_REUSE_OBJECTIVES = new Set([
  'OUTCOME_LEADS',
  'OUTCOME_ENGAGEMENT',
  'LEAD_GENERATION',
  'MESSAGES',
]);
const SUPPORTED_REUSE_SOURCE_DESTINATIONS = new Set([
  ...SUPPORTED_DESTINATIONS,
  'INSTAGRAM_DIRECT',
]);

export class CampaignReuseDraftError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409,
    readonly code: ErrorCode,
    readonly fieldErrors?: Record<string, string>
  ) {
    super(message);
    this.name = 'CampaignReuseDraftError';
  }
}

type ParsedSchedule = {
  startAt: Date;
  endAt: Date;
  durationDays: number;
};

type DestinationDefaults = {
  destinationType: string;
  leadMethod?: LeadCampaignLeadMethod;
  messageChannel: 'whatsapp' | 'messenger' | 'instagram';
};

function validateSourceRequest(request: CreateCampaignReuseDraftRequest): void {
  const fieldErrors: Record<string, string> = {};
  if (!request.sourceCampaignId.trim()) {
    fieldErrors.sourceCampaignId = 'The source campaign ID is required.';
  }
  if ((request.sourceType === 'adset' || request.sourceType === 'ad') && !request.sourceAdSetId) {
    fieldErrors.sourceAdSetId = 'The source ad-set ID is required for this source type.';
  }
  if (request.sourceType === 'ad' && !request.sourceAdId) {
    fieldErrors.sourceAdId = 'The source ad ID is required for an ad source.';
  }
  if (request.sourceAdId && !request.sourceAdSetId) {
    fieldErrors.sourceAdSetId = 'The parent ad-set ID is required when an ad ID is provided.';
  }
  if (request.creativeMode === 'reuse' && !request.sourceAdId) {
    fieldErrors.creativeMode = 'Exact creative reuse requires a selected source ad.';
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new CampaignReuseDraftError(
      'Invalid Run again source hierarchy.',
      400,
      ErrorCode.VALIDATION_ERROR,
      fieldErrors
    );
  }
}

function nonEmptyString(value: unknown): string | null {
  const normalized = asString(value).trim();
  return normalized || null;
}

function safeHttpUrl(value: unknown): string {
  const normalized = nonEmptyString(value);
  if (!normalized) return '';

  try {
    const url = new URL(normalized);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : '';
  } catch {
    return '';
  }
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => nonEmptyString(item))
    .filter((item): item is string => Boolean(item));
}

function jsonObjectOrNull(value: unknown): Json | null {
  const record = asRecord(value);
  return Object.keys(record).length > 0 ? (record as Json) : null;
}

function isValidIsoWithTimezone(value: string): boolean {
  const match = ISO_WITH_TIMEZONE_PATTERN.exec(value);
  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6] ?? 0);
  const offsetHour = match[9] ? Number(match[9]) : 0;
  const offsetMinute = match[10] ? Number(match[10]) : 0;
  const calendarCheck = new Date(Date.UTC(year, month - 1, day));

  return (
    calendarCheck.getUTCFullYear() === year &&
    calendarCheck.getUTCMonth() + 1 === month &&
    calendarCheck.getUTCDate() === day &&
    hour >= 0 &&
    hour <= 23 &&
    minute >= 0 &&
    minute <= 59 &&
    second >= 0 &&
    second <= 59 &&
    offsetHour >= 0 &&
    offsetHour <= 14 &&
    offsetMinute >= 0 &&
    offsetMinute <= 59 &&
    (offsetHour < 14 || offsetMinute === 0)
  );
}

function parseSchedule(input: Pick<CreateCampaignReuseDraftRequest, 'startAt' | 'endAt'>): ParsedSchedule {
  const fieldErrors: Record<string, string> = {};

  if (!isValidIsoWithTimezone(input.startAt)) {
    fieldErrors.startAt = 'Use a full ISO date-time with Z or an explicit UTC offset.';
  }
  if (!isValidIsoWithTimezone(input.endAt)) {
    fieldErrors.endAt = 'Use a full ISO date-time with Z or an explicit UTC offset.';
  }

  const startAt = new Date(input.startAt);
  const endAt = new Date(input.endAt);
  if (!Number.isFinite(startAt.getTime())) {
    fieldErrors.startAt = 'Start date is invalid.';
  }
  if (!Number.isFinite(endAt.getTime())) {
    fieldErrors.endAt = 'End date is invalid.';
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new CampaignReuseDraftError(
      'Invalid campaign schedule.',
      400,
      ErrorCode.VALIDATION_ERROR,
      fieldErrors
    );
  }

  if (endAt.getTime() <= startAt.getTime()) {
    fieldErrors.endAt = 'End date must be after the start date.';
  } else if (endAt.getTime() - startAt.getTime() > MAX_DURATION_MS) {
    fieldErrors.endAt = 'Campaign duration cannot exceed 366 days.';
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new CampaignReuseDraftError(
      'Invalid campaign schedule.',
      400,
      ErrorCode.VALIDATION_ERROR,
      fieldErrors
    );
  }

  return {
    startAt,
    endAt,
    durationDays: (endAt.getTime() - startAt.getTime()) / DAY_MS,
  };
}

function validateScheduleWindow(schedule: ParsedSchedule): void {
  const now = Date.now();
  const fieldErrors: Record<string, string> = {};
  if (schedule.startAt.getTime() < now - DATE_PAST_TOLERANCE_MS) {
    fieldErrors.startAt = 'Start date cannot be more than one day in the past.';
  }
  if (schedule.startAt.getTime() > now + MAX_START_AHEAD_MS) {
    fieldErrors.startAt = 'Start date cannot be more than one year away.';
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new CampaignReuseDraftError(
      'Invalid campaign schedule.',
      400,
      ErrorCode.VALIDATION_ERROR,
      fieldErrors
    );
  }
}

function validateBudget(input: {
  budgetType: 'daily' | 'lifetime';
  budgetAmount: number;
  durationDays: number;
  monthlyBudget: string | null;
  currencyCode: string | null;
}): void {
  const minimum = input.budgetType === 'daily' ? 1 : 50;
  const absoluteMaximum =
    input.budgetType === 'daily'
      ? MAX_DAILY_CAMPAIGN_BUDGET
      : MAX_LIFETIME_CAMPAIGN_BUDGET;
  const currencyLabel = input.currencyCode?.trim().toUpperCase() || 'account currency';

  if (!Number.isFinite(input.budgetAmount) || input.budgetAmount < minimum) {
    throw new CampaignReuseDraftError(
      `Budget must be at least ${minimum} ${currencyLabel}.`,
      400,
      ErrorCode.VALIDATION_ERROR,
      { budgetAmount: `Enter at least ${minimum} ${currencyLabel}.` }
    );
  }

  if (input.budgetAmount > absoluteMaximum) {
    throw new CampaignReuseDraftError(
      `Budget exceeds the ${absoluteMaximum} ${currencyLabel} safety limit.`,
      400,
      ErrorCode.VALIDATION_ERROR,
      { budgetAmount: `Enter no more than ${absoluteMaximum} ${currencyLabel}.` }
    );
  }

  const monthlyCap = getMonthlyBudgetUpperBound(input.monthlyBudget);
  if (monthlyCap == null) {
    return;
  }

  const projectedSpend =
    input.budgetType === 'daily'
      ? input.budgetAmount * input.durationDays
      : input.budgetAmount;
  const coveredMonths = Math.max(1, input.durationDays / 30);
  const profileGuardrail = monthlyCap * coveredMonths * 1.25;

  if (projectedSpend > profileGuardrail) {
    throw new CampaignReuseDraftError(
      'Budget is materially above the saved monthly budget range.',
      400,
      ErrorCode.VALIDATION_ERROR,
      {
        budgetAmount: `Keep projected spend at or below ${Math.round(
          profileGuardrail
        )} ${currencyLabel}, or update the saved monthly budget first.`,
      }
    );
  }
}

function normalizeSourceStatus(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? '';
}

function validateSourceStatuses(
  source: CampaignReuseSourceRecords,
  creativeMode: CampaignReuseCreativeMode
): void {
  const sourceRows = [source.campaign, source.adSet].filter(Boolean) as Array<{
    status: string | null;
  }>;

  if (sourceRows.some((row) => DELETED_SOURCE_STATUSES.has(normalizeSourceStatus(row.status)))) {
    throw new CampaignReuseDraftError(
      'The selected source has been deleted and cannot be run again.',
      409,
      ErrorCode.CONFLICT
    );
  }

  if (
    creativeMode === 'reuse' &&
    source.ad &&
    UNUSABLE_REUSE_AD_STATUSES.has(normalizeSourceStatus(source.ad.status))
  ) {
    throw new CampaignReuseDraftError(
      'The selected ad is no longer eligible for exact creative reuse.',
      409,
      ErrorCode.CONFLICT
    );
  }
}

function validateSourceCompatibility(source: CampaignReuseSourceRecords): void {
  const campaignRaw = asRecord(source.campaign.raw);
  const objective = (
    source.campaign.objective || nonEmptyString(campaignRaw.objective) || ''
  ).trim().toUpperCase();
  const adSetRaw = asRecord(source.adSet?.raw);
  const destination = nonEmptyString(adSetRaw.destination_type)?.toUpperCase() || '';
  const fieldErrors: Record<string, string> = {};

  if (!objective || !SUPPORTED_REUSE_OBJECTIVES.has(objective)) {
    fieldErrors.sourceCampaignId = objective
      ? `Objective ${objective} is not supported by the current review builder.`
      : 'The source campaign objective is unavailable.';
  }

  if (destination && !SUPPORTED_REUSE_SOURCE_DESTINATIONS.has(destination)) {
    fieldErrors.sourceAdSetId =
      `Destination ${destination} is not supported by the current review builder.`;
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new CampaignReuseDraftError(
      'This source needs a campaign workflow that Run again does not support yet.',
      409,
      ErrorCode.CONFLICT,
      fieldErrors
    );
  }
}

function defaultsFromDestination(value: string): DestinationDefaults | null {
  const normalized = value.trim().toUpperCase();
  if (!SUPPORTED_DESTINATIONS.has(normalized)) {
    if (normalized === 'INSTAGRAM_DIRECT') {
      return {
        destinationType: 'MESSENGER',
        leadMethod: 'messages',
        messageChannel: 'instagram',
      };
    }
    return null;
  }

  if (normalized === 'ON_AD') {
    return {
      destinationType: normalized,
      leadMethod: 'instant_form',
      messageChannel: 'whatsapp',
    };
  }
  if (normalized === 'PHONE_CALL') {
    return {
      destinationType: normalized,
      leadMethod: 'calls',
      messageChannel: 'whatsapp',
    };
  }

  return {
    destinationType: normalized,
    leadMethod: 'messages',
    messageChannel: normalized === 'WHATSAPP' ? 'whatsapp' : 'messenger',
  };
}

function destinationFromCta(ctaType: string | null | undefined): DestinationDefaults | null {
  const normalized = ctaType?.trim().toUpperCase() ?? '';
  if (normalized === 'CALL_NOW') {
    return defaultsFromDestination('PHONE_CALL');
  }
  if (normalized.includes('WHATSAPP')) {
    return defaultsFromDestination('WHATSAPP');
  }
  if (normalized === 'MESSAGE_PAGE' || normalized === 'SEND_MESSAGE') {
    return defaultsFromDestination('MESSENGER');
  }
  return null;
}

function destinationFromProfile(profile: BusinessProfileRow | null): DestinationDefaults | null {
  const preference = profile?.preferred_contact_method || profile?.lead_type || '';
  switch (preference) {
    case 'whatsapp_messages':
      return defaultsFromDestination('WHATSAPP');
    case 'instagram_dms':
      return {
        destinationType: 'MESSENGER',
        leadMethod: 'messages',
        messageChannel: 'instagram',
      };
    case 'facebook_messenger':
    case 'messages':
      return defaultsFromDestination('MESSENGER');
    case 'phone_calls':
      return defaultsFromDestination('PHONE_CALL');
    case 'lead_form':
    case 'instant_forms':
    case 'consultation_requests':
      return defaultsFromDestination('ON_AD');
    default:
      return null;
  }
}

function usesUnsupportedWebsiteBookingPreference(profile: BusinessProfileRow | null): boolean {
  return [profile?.preferred_contact_method, profile?.lead_type].some((value) =>
    value === 'website_booking_link' || value === 'booking_link_clicks'
  );
}

function resolveDestination(
  adSetRaw: Record<string, unknown>,
  creative: CampaignReuseCreativeRow | null,
  profile: BusinessProfileRow | null
): DestinationDefaults {
  const sourceDestination = nonEmptyString(adSetRaw.destination_type);
  if (sourceDestination) {
    return (
      defaultsFromDestination(sourceDestination) ?? {
        destinationType: '',
        messageChannel: 'whatsapp',
      }
    );
  }

  return (
    destinationFromCta(creative?.cta_type) ??
    destinationFromProfile(profile) ?? {
      destinationType: '',
      messageChannel: 'whatsapp',
    }
  );
}

function requireResolvedDestination(
  source: CampaignReuseSourceRecords,
  profile: BusinessProfileRow | null
): DestinationDefaults {
  const destination = resolveDestination(
    asRecord(source.adSet?.raw),
    source.creative,
    profile
  );

  if (destination.destinationType && SUPPORTED_DESTINATIONS.has(destination.destinationType)) {
    return destination;
  }

  const websiteBooking = usesUnsupportedWebsiteBookingPreference(profile);
  throw new CampaignReuseDraftError(
    websiteBooking
      ? 'Run again does not support website booking destinations yet. Choose a supported lead destination in campaign defaults first.'
      : 'The lead destination is unavailable. Sync the source again or choose a supported lead destination in campaign defaults.',
    409,
    ErrorCode.CONFLICT,
    {
      [source.adSet ? 'sourceAdSetId' : 'sourceCampaignId']: websiteBooking
        ? 'Website booking links cannot be converted safely by the current review builder.'
        : 'A supported source or saved lead destination is required.',
    }
  );
}

function pageIdFromObjectStoryId(value: unknown): string | null {
  const objectStoryId = nonEmptyString(value);
  if (!objectStoryId) return null;

  const [pageId, postId] = objectStoryId.split('_');
  return pageId && postId && /^\d+$/.test(pageId) && /^\d+$/.test(postId)
    ? pageId
    : null;
}

function exactSourcePageId(
  source: CampaignReuseSourceRecords,
  promotedObject: Record<string, unknown>
): string | null {
  const story = asRecord(source.creative?.object_story_spec);
  return (
    nonEmptyString(source.creative?.page_id) ||
    nonEmptyString(story.page_id) ||
    pageIdFromObjectStoryId(source.creative?.object_story_id) ||
    nonEmptyString(promotedObject.page_id)
  );
}

function missingSourceConfiguration(
  source: CampaignReuseSourceRecords,
  adSetRaw: Record<string, unknown>,
  sourcePageId: string | null
): string[] {
  const missing: string[] = [];
  if (!source.adSet || Object.keys(asRecord(adSetRaw.targeting)).length === 0) {
    missing.push('audience and location');
  }
  if (!nonEmptyString(adSetRaw.destination_type)) {
    missing.push('lead destination');
  }
  if (!sourcePageId) {
    missing.push('Facebook Page');
  }
  return missing;
}

function extractLeadFormId(creative: CampaignReuseCreativeRow | null): string {
  const story = asRecord(creative?.object_story_spec);
  const storyData = [story.link_data, story.video_data, story.template_data]
    .map((value) => asRecord(value));

  for (const data of storyData) {
    const ctaValue = asRecord(asRecord(data.call_to_action).value);
    const formId = nonEmptyString(ctaValue.lead_gen_form_id);
    if (formId) return formId;
  }

  return '';
}

function defaultMethodSettings(input: {
  destination: DestinationDefaults;
  profile: BusinessProfileRow | null;
  creative: CampaignReuseCreativeRow | null;
}): LeadCampaignMethodSettings {
  const whatsappNumber =
    input.profile?.whatsapp_setup_completed
      ? input.profile.whatsapp_number || input.profile.page_phone || ''
      : '';

  return {
    instantForm: {
      formStyle: 'higher_intent',
      formId: extractLeadFormId(input.creative),
      privacyPolicyUrl: '',
      qualifyingQuestions: [],
    },
    messages: {
      channel: input.destination.messageChannel,
      whatsappPhoneNumberId: '',
      whatsappPhoneNumber: whatsappNumber,
      whatsappBusinessAccountId: '',
      whatsappBusinessAccountName: '',
      whatsappBusinessReady: Boolean(whatsappNumber),
      responseReady: false,
    },
    calls: {
      phoneNumber: input.profile?.page_phone || '',
      staffedHoursAcknowledged: false,
      callWindow: '',
    },
  };
}

function customerRadiusInMiles(value: string | null | undefined): number | null {
  switch (value) {
    case 'within_3_miles':
      return 3;
    case 'within_5_miles':
      return 5;
    case 'within_10_miles':
      return 10;
    case 'within_15_miles':
      return 15;
    case 'within_25_miles':
      return 25;
    default:
      return null;
  }
}

function mainSalonService(
  profile: BusinessProfileRow | null
): { value: string; label: string } | null {
  const value =
    nonEmptyString(profile?.most_valuable_service) ||
    stringArray(profile?.promoted_services)[0] ||
    null;
  if (!value || value === 'other') {
    return null;
  }

  const option = [...SALON_SERVICE_OPTIONS, ...SALON_MOST_VALUABLE_SERVICE_OPTIONS].find(
    (candidate) => candidate.value === value
  );

  return {
    value,
    label: option?.label || value.replace(/_/g, ' '),
  };
}

function firstRecord(value: unknown): Record<string, unknown> {
  return Array.isArray(value) ? asRecord(value[0]) : {};
}

function genderArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((gender) => {
      if (typeof gender === 'number' && Number.isFinite(gender)) {
        return String(gender);
      }
      return nonEmptyString(gender);
    })
    .filter((gender): gender is string => Boolean(gender));
}

function sourceLocationLabel(geoLocations: Record<string, unknown>): string | null {
  const custom = firstRecord(geoLocations.custom_locations);
  const city = firstRecord(geoLocations.cities);
  const region = firstRecord(geoLocations.regions);
  const countries = stringArray(geoLocations.countries);

  return (
    nonEmptyString(custom.name) ||
    nonEmptyString(custom.address_string) ||
    nonEmptyString(city.name) ||
    nonEmptyString(region.name) ||
    (countries.length > 0 ? countries.join(', ') : null)
  );
}

function buildTargeting(
  adSetRaw: Record<string, unknown>,
  profile: BusinessProfileRow | null
): ManualCampaignDraftForm['targeting'] {
  const targeting = asRecord(adSetRaw.targeting);
  const geoLocations = asRecord(targeting.geo_locations);
  const customLocation = firstRecord(geoLocations.custom_locations);
  const latitude = finiteNumber(customLocation.latitude);
  const longitude = finiteNumber(customLocation.longitude);
  const sourceRadius = finiteNumber(customLocation.radius);
  const sourceDistanceUnit = nonEmptyString(customLocation.distance_unit)?.toLowerCase();
  const normalizedSourceRadius =
    sourceRadius != null && sourceRadius > 0
      ? sourceDistanceUnit === 'kilometer'
        ? sourceRadius / 1.609344
        : sourceRadius
      : null;
  const flexibleSpec = Array.isArray(targeting.flexible_spec)
    ? targeting.flexible_spec.map((value) => asRecord(value))
    : [];
  const interestRecords = [
    ...(Array.isArray(targeting.interests) ? targeting.interests.map((value) => asRecord(value)) : []),
    ...flexibleSpec.flatMap((spec) =>
      Array.isArray(spec.interests) ? spec.interests.map((value) => asRecord(value)) : []
    ),
  ];

  return {
    markerPosition:
      latitude != null && longitude != null
        ? { lat: latitude, lng: longitude }
        : null,
    locationLabel: sourceLocationLabel(geoLocations) || profile?.business_location || '',
    radius: Math.max(
      1,
      Math.round((normalizedSourceRadius ?? customerRadiusInMiles(profile?.customer_radius) ?? 5) * 10) / 10
    ),
    ageMin: finiteNumber(targeting.age_min) ?? 18,
    ageMax: finiteNumber(targeting.age_max) ?? 65,
    genders: genderArray(targeting.genders),
    interests: interestRecords
      .map((interest) => nonEmptyString(interest.name))
      .filter((interest): interest is string => Boolean(interest))
      .slice(0, 8),
  };
}

function usesAdvantageAudience(adSetRaw: Record<string, unknown>): boolean {
  const targeting = asRecord(adSetRaw.targeting);
  const nestedAutomation = asRecord(targeting.targeting_automation);
  const automationValue =
    nestedAutomation.advantage_audience ??
    asRecord(adSetRaw.targeting_automation).advantage_audience;
  if (typeof automationValue === 'boolean') return automationValue;
  if (automationValue === 1 || automationValue === '1') return true;
  if (automationValue === 0 || automationValue === '0') return false;

  const explicitAudienceKeys = [
    'age_min',
    'age_max',
    'genders',
    'interests',
    'flexible_spec',
    'custom_audiences',
    'excluded_custom_audiences',
  ];
  return !explicitAudienceKeys.some((key) => targeting[key] != null);
}

function usesAdvantagePlacements(adSetRaw: Record<string, unknown>): boolean {
  const targeting = asRecord(adSetRaw.targeting);
  const placementKeys = [
    'publisher_platforms',
    'facebook_positions',
    'instagram_positions',
    'messenger_positions',
    'audience_network_positions',
    'device_platforms',
  ];
  return !placementKeys.some((key) => Array.isArray(targeting[key]) && targeting[key].length > 0);
}

function freshCreative(linkUrl: string): LeadCampaignCreativeDraft {
  return {
    id: 'primary',
    role: 'primary',
    contentSource: 'upload',
    existingCreativeIds: [],
    selectedCreativeName: '',
    uploadedFileNames: [],
    imageHash: '',
    linkUrl,
    adHeadline: '',
    adPrimaryText: '',
    adDescription: '',
    adCallToAction: '',
  };
}

function creativeDraft(
  creativeMode: CampaignReuseCreativeMode,
  creative: CampaignReuseCreativeRow | null,
  linkUrl: string
): LeadCampaignCreativeDraft {
  if (creativeMode !== 'reuse' || !creative) {
    return freshCreative(linkUrl);
  }

  return {
    id: 'primary',
    role: 'primary',
    contentSource: 'existing',
    existingCreativeIds: [creative.platform_creative_id],
    selectedCreativeName: creative.name || `Creative ${creative.platform_creative_id}`,
    uploadedFileNames: [],
    imageHash: creative.image_hash || '',
    linkUrl,
    adHeadline: creative.headline || '',
    adPrimaryText: creative.primary_text || '',
    adDescription: creative.description || '',
    adCallToAction: creative.cta_type || '',
  };
}

function normalizeSpecialAdCategories(campaignRaw: Record<string, unknown>): string[] {
  const categories = stringArray(campaignRaw.special_ad_categories);
  return categories.length > 0 ? categories : ['NONE'];
}

function buildDraftPayload(input: {
  request: CreateCampaignReuseDraftRequest;
  source: CampaignReuseSourceRecords;
  profile: BusinessProfileRow | null;
  currencyCode: string | null;
  timezone: string | null;
  schedule: ParsedSchedule;
}): CampaignDraftPayload {
  const campaignRaw = asRecord(input.source.campaign.raw);
  const adSetRaw = asRecord(input.source.adSet?.raw);
  const promotedObject = asRecord(adSetRaw.promoted_object);
  const destination = requireResolvedDestination(input.source, input.profile);
  const targeting = buildTargeting(adSetRaw, input.profile);
  const mainService = mainSalonService(input.profile);
  const linkUrl =
    safeHttpUrl(input.source.creative?.link_url) ||
    safeHttpUrl(input.profile?.booking_link) ||
    safeHttpUrl(input.profile?.website);
  const creative = creativeDraft(
    input.request.creativeMode,
    input.source.creative,
    linkUrl
  );
  const sourcePageId = exactSourcePageId(input.source, promotedObject);
  const pageId = sourcePageId || input.profile?.meta_page_id || '';
  const sourceInstagramAccountId = nonEmptyString(
    input.source.creative?.instagram_actor_id
  );
  const profileInstagramMatchesSource = Boolean(
    input.profile?.meta_page_id &&
      pageId === input.profile.meta_page_id &&
      (!sourceInstagramAccountId ||
        sourceInstagramAccountId === input.profile.meta_page_instagram_account_id)
  );
  const instagramAccountId =
    (sourcePageId ? sourceInstagramAccountId : null) ||
    (profileInstagramMatchesSource ? input.profile?.meta_page_instagram_account_id : null) ||
    null;
  const missingConfiguration = missingSourceConfiguration(
    input.source,
    adSetRaw,
    sourcePageId
  );
  const optimizationGoal =
    input.source.adSet?.optimization_goal ||
    nonEmptyString(adSetRaw.optimization_goal) ||
    (destination.leadMethod === 'calls' ? 'QUALITY_CALL' : destination.leadMethod ? 'LEAD_GENERATION' : '');
  const billingEvent = nonEmptyString(adSetRaw.billing_event) || 'IMPRESSIONS';
  const bidStrategy =
    nonEmptyString(adSetRaw.bid_strategy) ||
    nonEmptyString(campaignRaw.bid_strategy) ||
    'LOWEST_COST_WITHOUT_CAP';
  const adSetName =
    input.source.adSet?.name ||
    (mainService
      ? `${mainService.label} - new ad set`
      : `${input.source.campaign.name || 'Campaign'} - new ad set`);
  const campaignName = `${input.source.campaign.name || 'Campaign'} - Run again`;
  const methodSettings = defaultMethodSettings({
    destination,
    profile: input.profile,
    creative: input.source.creative,
  });
  const primaryAdSet = {
    id: 'primary',
    role: 'primary' as const,
    existingCampaignId: null,
    existingAdSetId: null,
    adSetName,
    pageId,
    instagramAccountId,
    instagramAccountName: profileInstagramMatchesSource
      ? input.profile?.meta_page_instagram_account_name ?? null
      : null,
    instagramAccountUsername: profileInstagramMatchesSource
      ? input.profile?.meta_page_instagram_account_username ?? null
      : null,
    instagramAccountPictureUrl: profileInstagramMatchesSource
      ? input.profile?.meta_page_instagram_account_picture_url ?? null
      : null,
    optimizationGoal,
    useAdvantageAudience: usesAdvantageAudience(adSetRaw),
    useAdvantagePlacements: usesAdvantagePlacements(adSetRaw),
    billingEvent,
    sourceConfiguration: {
      destinationType: nonEmptyString(adSetRaw.destination_type),
      bidStrategy: nonEmptyString(adSetRaw.bid_strategy),
      billingEvent: nonEmptyString(adSetRaw.billing_event),
      optimizationGoal: nonEmptyString(adSetRaw.optimization_goal),
      promotedObject: jsonObjectOrNull(adSetRaw.promoted_object),
      targeting: jsonObjectOrNull(adSetRaw.targeting),
      attributionSpec: Array.isArray(adSetRaw.attribution_spec)
        ? (adSetRaw.attribution_spec as Json)
        : jsonObjectOrNull(adSetRaw.attribution_spec),
    },
    targeting,
    creatives: [creative],
  };
  const leadMethodFields = destination.leadMethod
    ? {
        leadMethod: destination.leadMethod,
        offerTemplate:
          destination.leadMethod === 'calls'
            ? ('same_day_openings' as const)
            : destination.leadMethod === 'messages'
              ? ('high_ticket_transformation' as const)
              : ('new_client_intro' as const),
      }
    : {};

  return {
    mode: 'manual',
    form: {
      initialStatus: 'PAUSED',
      reviewRequired: true,
      reuseSource: {
        sourceType: input.request.sourceType,
        creativeMode: input.request.creativeMode,
        configurationCoverage: missingConfiguration.length > 0 ? 'partial' : 'exact',
        missingConfiguration,
        campaignId: input.request.sourceCampaignId,
        campaignName: input.source.campaign.name || 'Unnamed campaign',
        campaignStatus: input.source.campaign.status,
        adSetId: input.request.sourceAdSetId ?? null,
        adSetName: input.source.adSet?.name ?? null,
        adSetStatus: input.source.adSet?.status ?? null,
        adId: input.request.sourceAdId ?? null,
        adName: input.source.ad?.name ?? null,
        adStatus: input.source.ad?.status ?? null,
        creativeId:
          input.source.ad?.creative_id ?? input.source.creative?.platform_creative_id ?? null,
        serviceName: mainService?.label ?? null,
        serviceValue: mainService?.value ?? null,
        currencyCode: input.currencyCode,
        timezone: input.timezone,
      },
      campaignName,
      objective:
        input.source.campaign.objective || nonEmptyString(campaignRaw.objective) || '',
      destinationType: destination.destinationType,
      specialAdCategories: normalizeSpecialAdCategories(campaignRaw),
      bidStrategy,
      buyingType: nonEmptyString(campaignRaw.buying_type) || 'AUCTION',
      budgetAmount: input.request.budgetAmount,
      budgetType: input.request.budgetType,
      budgetOptimization: Boolean(campaignRaw.daily_budget || campaignRaw.lifetime_budget),
      startDate: input.schedule.startAt.toISOString(),
      endDate: input.schedule.endAt.toISOString(),
      draftTarget: {
        mode: 'new_campaign',
        existingCampaignId: null,
        existingCampaignName: null,
        existingAdSetId: null,
        existingAdSetName: null,
      },
      ...leadMethodFields,
      methodSettings,
      adSets: [primaryAdSet],
      adSetName,
      pageId,
      instagramAccountId,
      instagramAccountName: primaryAdSet.instagramAccountName,
      instagramAccountUsername: primaryAdSet.instagramAccountUsername,
      instagramAccountPictureUrl: primaryAdSet.instagramAccountPictureUrl,
      optimizationGoal,
      useAdvantageAudience: primaryAdSet.useAdvantageAudience,
      useAdvantagePlacements: primaryAdSet.useAdvantagePlacements,
      billingEvent,
      targeting,
      creative: {
        contentSource: creative.contentSource,
        existingCreativeIds: creative.existingCreativeIds,
        imageHash: creative.imageHash,
        linkUrl: creative.linkUrl,
        adHeadline: creative.adHeadline,
        adPrimaryText: creative.adPrimaryText,
        adDescription: creative.adDescription,
        adCallToAction: creative.adCallToAction,
      },
    },
  };
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function deterministicDraftId(value: string): string {
  const bytes = createHash('sha256').update(value).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x80;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(
    16,
    20
  )}-${hex.slice(20)}`;
}

function buildRequestFingerprint(request: CreateCampaignReuseDraftRequest): string {
  return sha256(
    JSON.stringify({
      sourceType: request.sourceType,
      sourceCampaignId: request.sourceCampaignId,
      sourceAdSetId: request.sourceAdSetId ?? null,
      sourceAdId: request.sourceAdId ?? null,
      budgetType: request.budgetType,
      budgetAmount: request.budgetAmount,
      startAt: new Date(request.startAt).toISOString(),
      endAt: new Date(request.endAt).toISOString(),
      creativeMode: request.creativeMode,
    })
  );
}

async function findIdempotentDraft(
  supabase: CampaignsClient,
  input: {
    draftId: string;
    businessId: string;
    platformIntegrationId: string;
    adAccountId: string;
    userId: string;
    sourceActionId: string;
  }
): Promise<string | null> {
  const { data, error } = await supabase
    .from('campaign_drafts')
    .select(
      'id, business_id, platform_integration_id, ad_account_id, created_by_user_id, source_action_id'
    )
    .eq('id', input.draftId)
    .maybeSingle();

  if (error) {
    throw error;
  }
  if (!data) {
    return null;
  }

  const sameScope =
    data.business_id === input.businessId &&
    data.platform_integration_id === input.platformIntegrationId &&
    data.ad_account_id === input.adAccountId &&
    data.created_by_user_id === input.userId;
  if (!sameScope || data.source_action_id !== input.sourceActionId) {
    throw new CampaignReuseDraftError(
      'That idempotency key was already used for a different Run again request.',
      409,
      ErrorCode.CONFLICT,
      { idempotencyKey: 'Generate a new idempotency key for a changed request.' }
    );
  }

  return data.id;
}

function isUniqueViolation(error: unknown): boolean {
  return asString(asRecord(error).code) === '23505';
}

async function loadBusinessProfile(
  supabase: CampaignsClient,
  businessId: string
): Promise<BusinessProfileRow | null> {
  const { data, error } = await supabase
    .from('business_profiles')
    .select(
      'business_name, booking_link, website, business_location, customer_radius, monthly_budget, meta_page_id, meta_page_name, meta_page_instagram_account_id, meta_page_instagram_account_name, meta_page_instagram_account_username, meta_page_instagram_account_picture_url, preferred_contact_method, lead_type, most_valuable_service, promoted_services, page_phone, whatsapp_number, whatsapp_setup_completed'
    )
    .eq('id', businessId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as BusinessProfileRow | null) ?? null;
}

export async function createCampaignReuseDraft(
  supabase: CampaignsClient,
  input: {
    businessId: string;
    platformIntegrationId: string;
    adAccountId: string;
    userId: string;
    currencyCode: string | null;
    timezone: string | null;
    request: CreateCampaignReuseDraftRequest;
  }
): Promise<CreateCampaignReuseDraftResult> {
  validateSourceRequest(input.request);
  const schedule = parseSchedule(input.request);
  const requestFingerprint = buildRequestFingerprint(input.request);
  const idempotencyScope = `${input.businessId}:${input.platformIntegrationId}:${input.adAccountId}:${input.userId}:${input.request.idempotencyKey}`;
  const draftId = deterministicDraftId(idempotencyScope);
  const sourceActionId = `reuse:${input.request.idempotencyKey}:${requestFingerprint}`;
  const existingDraftId = await findIdempotentDraft(supabase, {
    draftId,
    businessId: input.businessId,
    platformIntegrationId: input.platformIntegrationId,
    adAccountId: input.adAccountId,
    userId: input.userId,
    sourceActionId,
  });

  if (existingDraftId) {
    return {
      draftId: existingDraftId,
      href: `/campaigns/create?draft=${existingDraftId}`,
      replayed: true,
    };
  }

  validateScheduleWindow(schedule);

  let source: CampaignReuseSourceRecords;
  try {
    source = await getCampaignReuseSource(supabase, {
      businessId: input.businessId,
      adAccountId: input.adAccountId,
      sourceType: input.request.sourceType,
      sourceCampaignId: input.request.sourceCampaignId,
      sourceAdSetId: input.request.sourceAdSetId,
      sourceAdId: input.request.sourceAdId,
      requireCreative: input.request.creativeMode === 'reuse',
    });
  } catch (error) {
    if (error instanceof CampaignReuseSourceLookupError) {
      throw new CampaignReuseDraftError(
        error.message,
        error.reason === 'source_not_found' ? 404 : 409,
        error.reason === 'source_not_found' ? ErrorCode.NOT_FOUND : ErrorCode.CONFLICT
      );
    }
    throw error;
  }

  validateSourceStatuses(source, input.request.creativeMode);
  validateSourceCompatibility(source);
  const profile = await loadBusinessProfile(supabase, input.businessId);
  requireResolvedDestination(source, profile);
  validateBudget({
    budgetType: input.request.budgetType,
    budgetAmount: input.request.budgetAmount,
    durationDays: schedule.durationDays,
    monthlyBudget: profile?.monthly_budget ?? null,
    currencyCode: input.currencyCode,
  });

  const payloadJson = buildDraftPayload({
    request: input.request,
    source,
    profile,
    currencyCode: input.currencyCode,
    timezone: input.timezone,
    schedule,
  });
  const sourceLabel =
    input.request.sourceType === 'ad'
      ? source.ad?.name || input.request.sourceAdId
      : input.request.sourceType === 'adset'
        ? source.adSet?.name || input.request.sourceAdSetId
        : source.campaign.name || input.request.sourceCampaignId;

  try {
    const draft = await createCampaignDraft(supabase, {
      draftId,
      businessId: input.businessId,
      platformIntegrationId: input.platformIntegrationId,
      adAccountId: input.adAccountId,
      userId: input.userId,
      title: `Run again: ${sourceLabel}`,
      payloadJson,
      reviewNotes:
        'Created from an exact account-scoped source. Initial Meta status must remain PAUSED until final review.',
      sourceActionId,
    });

    return {
      draftId: draft.id,
      href: `/campaigns/create?draft=${draft.id}`,
      replayed: false,
    };
  } catch (error) {
    if (!isUniqueViolation(error)) {
      throw error;
    }

    const replayedDraftId = await findIdempotentDraft(supabase, {
      draftId,
      businessId: input.businessId,
      platformIntegrationId: input.platformIntegrationId,
      adAccountId: input.adAccountId,
      userId: input.userId,
      sourceActionId,
    });
    if (!replayedDraftId) {
      throw error;
    }

    return {
      draftId: replayedDraftId,
      href: `/campaigns/create?draft=${replayedDraftId}`,
      replayed: true,
    };
  }
}
