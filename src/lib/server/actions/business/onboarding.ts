"use server";

import { createServerClient } from '@/lib/server/supabase/server';
import { ok, fail, type ApiResponse, ErrorCode } from '@/lib/shared';
import { getErrorMessage } from '@/lib/shared/utils/guards';
import { requireUserId } from '@/lib/server/actions/user/session';
import { getOrCreateOrganizationBusinessContext } from '@/lib/server/actions/business/context';
import type { Database } from '@/lib/shared/types/supabase';
import {
  AVERAGE_CUSTOMER_VALUE_OPTIONS,
  CONTACT_METHOD_OPTIONS,
  CUSTOMER_RADIUS_OPTIONS,
  DEFAULT_INTELLIGENCE_GOALS,
  DEFAULT_WATCH_SIGNALS,
  INTELLIGENCE_GOAL_OPTIONS,
  LEAD_QUALITY_SIGNAL_OPTIONS,
  LEAD_TYPE_OPTIONS,
  META_ADS_STATUS_OPTIONS,
  MONTHLY_AD_BUDGET_OPTIONS,
  RECOMMENDATION_STYLE_OPTIONS,
  SAFETY_PREFERENCE_OPTIONS,
  SALON_INDUSTRY_OPTIONS,
  SALON_MOST_VALUABLE_SERVICE_OPTIONS,
  SALON_SERVICE_OPTIONS,
  TARGET_COST_PER_LEAD_OPTIONS,
  WATCH_SIGNAL_OPTIONS,
  isAllowedOption,
  optionValues,
  type OnboardingOption,
} from '@/lib/shared/onboarding/salonProfile';

type OrganizationType = Database['public']['Enums']['organization_type'];

type ActiveBusinessContext = {
  userId: string;
  organizationId: string;
  organizationName: string;
  organizationType: OrganizationType;
  businessId: string;
};

async function requireActiveBusinessContextOrFail(): Promise<ApiResponse<ActiveBusinessContext>> {
  try {
    const userId = await requireUserId();
    const context = await getOrCreateOrganizationBusinessContext(userId);
    return ok({
      userId,
      organizationId: context.organizationId,
      organizationName: context.organizationName,
      organizationType: context.organizationType,
      businessId: context.businessId,
    });
  } catch (error) {
    const message = getErrorMessage(error);
    return fail(message, ErrorCode.UNAUTHORIZED, {
      userMessage: message.includes('Partner organizations do not get an automatic business profile')
        ? 'Partner workspaces are not supported in this onboarding flow yet.'
        : 'Please sign in again.',
    });
  }
}

function coerceStringArray(value: string[] | string | undefined): string[] | undefined {
  if (value === undefined) return undefined;
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string') return value.split(',').map((item) => item.trim()).filter(Boolean);
  return undefined;
}

function cleanUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) (out as Record<string, unknown>)[k] = v;
  }
  return out;
}

const BUSINESS_NAME_PLACEHOLDERS = new Set([
  'my business',
  'business setup',
  'new business',
  'untitled business',
]);

function normalizeBusinessName(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isPlaceholderBusinessName(value: string | null | undefined): boolean {
  return BUSINESS_NAME_PLACEHOLDERS.has(normalizeBusinessName(value).toLowerCase());
}

function businessNameForOnboardingInput(value: string | null | undefined): string {
  const normalized = normalizeBusinessName(value);
  return normalized && !isPlaceholderBusinessName(normalized) ? normalized : '';
}

function cleanString(value: string | null | undefined): string | null {
  if (value === undefined) return null;
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed || null;
}

function cleanStringForUpdate(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  return cleanString(value);
}

function cleanStringArray(value: string[] | string | undefined): string[] | undefined {
  return coerceStringArray(value);
}

function allowedOrNull(value: string | null | undefined, options: OnboardingOption[]): string | null {
  return value && isAllowedOption(value, options) ? value : null;
}

function allowedArrayOrEmpty(value: string[] | null | undefined, options: OnboardingOption[]): string[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set(optionValues(options));
  return value.filter((item) => allowed.has(item));
}

function validateAllowedString(
  fieldLabel: string,
  value: string | null | undefined,
  options: OnboardingOption[],
  required = false
): string | null {
  if (value === undefined) return null;
  const normalized = cleanString(value);

  if (!normalized) {
    return required ? `${fieldLabel} is required` : null;
  }

  return isAllowedOption(normalized, options) ? null : `${fieldLabel} is invalid`;
}

function validateAllowedArray(
  fieldLabel: string,
  value: string[] | string | undefined,
  options: OnboardingOption[],
  required = false
): string | null {
  if (value === undefined) return null;
  const normalized = cleanStringArray(value) ?? [];

  if (normalized.length === 0) {
    return required ? `${fieldLabel} is required` : null;
  }

  const allowed = new Set(optionValues(options));
  return normalized.every((item) => allowed.has(item)) ? null : `${fieldLabel} includes an invalid option`;
}

export type OnboardingInitial = {
  step: number;
  completed: boolean;
  businessId: string;
  organizationId: string;
  organizationName: string;
  organizationType: OrganizationType;
  connectedPlatformKeys: string[];
  businessData: {
    businessName: string;
    industry: string | null;
    monthlyBudget: string | null;
    website: string | null;
    bookingLink: string | null;
    businessLocation: string | null;
    customerRadius: string | null;
    description: string | null;
    promotedServices: string[];
    mostValuableService: string | null;
    metaAdsStatus: string | null;
    primaryGoal: string | null;
    leadType: string | null;
    preferredContactMethod: string | null;
    leadQualitySignal: string | null;
    averageCustomerValue: string | null;
    targetCostPerLead: string | null;
    watchSignals: string[];
    recommendationStyle: string | null;
    safetyPreference: string | null;
    adGoals: string[];
    preferredPlatforms: string[];
  };
};

export async function getOnboardingInitial(): Promise<ApiResponse<OnboardingInitial>> {
  const supabase = await createServerClient();

  const contextRes = await requireActiveBusinessContextOrFail();
  if (!contextRes.success) return contextRes;

  const { businessId, organizationId, organizationName, organizationType } = contextRes.data;

  const [{ data: bp, error: profileError }, { data: integrations, error: integrationsError }] = await Promise.all([
    supabase
      .from('business_profiles')
      .select(
        `
          id,
          business_name,
          industry,
          monthly_budget,
          website,
          booking_link,
          business_location,
          customer_radius,
          description,
          promoted_services,
          most_valuable_service,
          meta_ads_status,
          primary_goal,
          lead_type,
          preferred_contact_method,
          lead_quality_signal,
          average_customer_value,
          target_cost_per_lead,
          watch_signals,
          recommendation_style,
          safety_preference,
          ad_goals,
          preferred_platforms,
          onboarding_step,
          onboarding_completed
        `
      )
      .eq('id', businessId)
      .single(),
    supabase
      .from('platform_integrations')
      .select('status, platforms ( key )')
      .eq('business_id', businessId)
      .eq('status', 'connected'),
  ]);

  if (profileError || !bp) {
    return fail(getErrorMessage(profileError), ErrorCode.DATABASE_ERROR);
  }

  if (integrationsError) {
    return fail(getErrorMessage(integrationsError), ErrorCode.DATABASE_ERROR);
  }

  const connectedPlatformKeys = (integrations ?? [])
    .map((row) => {
      const platform = Array.isArray(row.platforms) ? row.platforms[0] : row.platforms;
      return typeof platform?.key === 'string' ? platform.key : null;
    })
    .filter((key): key is string => key !== null);

  return ok({
    step: bp.onboarding_step ?? 0,
    completed: bp.onboarding_completed ?? false,
    businessId: bp.id,
    organizationId,
    organizationName,
    organizationType,
    connectedPlatformKeys,
    businessData: {
      businessName: businessNameForOnboardingInput(bp.business_name),
      industry: allowedOrNull(bp.industry, SALON_INDUSTRY_OPTIONS),
      monthlyBudget: allowedOrNull(bp.monthly_budget, MONTHLY_AD_BUDGET_OPTIONS),
      website: cleanString(bp.website),
      bookingLink: cleanString(bp.booking_link),
      businessLocation: cleanString(bp.business_location),
      customerRadius: allowedOrNull(bp.customer_radius, CUSTOMER_RADIUS_OPTIONS),
      description: bp.description ?? null,
      promotedServices: allowedArrayOrEmpty(bp.promoted_services, SALON_SERVICE_OPTIONS),
      mostValuableService: allowedOrNull(bp.most_valuable_service, [
        ...SALON_SERVICE_OPTIONS,
        ...SALON_MOST_VALUABLE_SERVICE_OPTIONS,
      ]),
      metaAdsStatus: allowedOrNull(bp.meta_ads_status, META_ADS_STATUS_OPTIONS),
      primaryGoal: allowedOrNull(bp.primary_goal, INTELLIGENCE_GOAL_OPTIONS),
      leadType: allowedOrNull(bp.lead_type, LEAD_TYPE_OPTIONS),
      preferredContactMethod: allowedOrNull(bp.preferred_contact_method, CONTACT_METHOD_OPTIONS),
      leadQualitySignal: allowedOrNull(bp.lead_quality_signal, LEAD_QUALITY_SIGNAL_OPTIONS),
      averageCustomerValue: allowedOrNull(bp.average_customer_value, AVERAGE_CUSTOMER_VALUE_OPTIONS),
      targetCostPerLead: allowedOrNull(bp.target_cost_per_lead, TARGET_COST_PER_LEAD_OPTIONS),
      watchSignals: allowedArrayOrEmpty(bp.watch_signals, WATCH_SIGNAL_OPTIONS),
      recommendationStyle: allowedOrNull(bp.recommendation_style, RECOMMENDATION_STYLE_OPTIONS),
      safetyPreference: allowedOrNull(bp.safety_preference, SAFETY_PREFERENCE_OPTIONS),
      adGoals: Array.isArray(bp.ad_goals) ? bp.ad_goals : [],
      preferredPlatforms: Array.isArray(bp.preferred_platforms) ? bp.preferred_platforms : [],
    },
  });
}

export async function updateBusinessProfileData(input: {
  businessName?: string;
  industry?: string | null;
  monthlyBudget?: string | null;
  website?: string | null;
  bookingLink?: string | null;
  businessLocation?: string | null;
  customerRadius?: string | null;
  description?: string | null;
  promotedServices?: string[] | string;
  mostValuableService?: string | null;
  metaAdsStatus?: string | null;
  primaryGoal?: string | null;
  leadType?: string | null;
  preferredContactMethod?: string | null;
  leadQualitySignal?: string | null;
  averageCustomerValue?: string | null;
  targetCostPerLead?: string | null;
  watchSignals?: string[] | string;
  recommendationStyle?: string | null;
  safetyPreference?: string | null;
  adGoals?: string[] | string;
  preferredPlatforms?: string[] | string;
}): Promise<ApiResponse<null>> {
  try {
    const supabase = await createServerClient();

    const contextRes = await requireActiveBusinessContextOrFail();
    if (!contextRes.success) return contextRes;

    const { businessId, organizationId, organizationType } = contextRes.data;
    const businessName = input.businessName === undefined
      ? undefined
      : normalizeBusinessName(input.businessName);

    if (input.businessName !== undefined) {
      if (!businessName) {
        return fail('Business name is required', ErrorCode.VALIDATION_ERROR, {
          userMessage: 'Please enter your business name.',
        });
      }

      if (isPlaceholderBusinessName(businessName)) {
        return fail('Placeholder business name is not allowed', ErrorCode.VALIDATION_ERROR, {
          userMessage: 'Please replace the default name with your real business name.',
        });
      }
    }

    const validationError =
      validateAllowedString('Industry', input.industry, SALON_INDUSTRY_OPTIONS, input.industry !== undefined) ??
      validateAllowedString('Monthly ad budget', input.monthlyBudget, MONTHLY_AD_BUDGET_OPTIONS, input.monthlyBudget !== undefined) ??
      validateAllowedString('Customer radius', input.customerRadius, CUSTOMER_RADIUS_OPTIONS) ??
      validateAllowedArray('Main services', input.promotedServices, SALON_SERVICE_OPTIONS, input.promotedServices !== undefined) ??
      validateAllowedString('Most valuable service', input.mostValuableService, [
        ...SALON_SERVICE_OPTIONS,
        ...SALON_MOST_VALUABLE_SERVICE_OPTIONS,
      ], input.mostValuableService !== undefined) ??
      validateAllowedString('Meta ads status', input.metaAdsStatus, META_ADS_STATUS_OPTIONS, input.metaAdsStatus !== undefined) ??
      validateAllowedString('Primary goal', input.primaryGoal, INTELLIGENCE_GOAL_OPTIONS, input.primaryGoal !== undefined) ??
      validateAllowedString('Lead type', input.leadType, LEAD_TYPE_OPTIONS, input.leadType !== undefined) ??
      validateAllowedString('Preferred contact method', input.preferredContactMethod, CONTACT_METHOD_OPTIONS, input.preferredContactMethod !== undefined) ??
      validateAllowedString('Lead quality signal', input.leadQualitySignal, LEAD_QUALITY_SIGNAL_OPTIONS, input.leadQualitySignal !== undefined) ??
      validateAllowedString('Average customer value', input.averageCustomerValue, AVERAGE_CUSTOMER_VALUE_OPTIONS) ??
      validateAllowedString('Target cost per lead', input.targetCostPerLead, TARGET_COST_PER_LEAD_OPTIONS) ??
      validateAllowedArray('Watch signals', input.watchSignals, WATCH_SIGNAL_OPTIONS, input.watchSignals !== undefined) ??
      validateAllowedString('Recommendation style', input.recommendationStyle, RECOMMENDATION_STYLE_OPTIONS, input.recommendationStyle !== undefined) ??
      validateAllowedString('Safety preference', input.safetyPreference, SAFETY_PREFERENCE_OPTIONS, input.safetyPreference !== undefined);

    if (validationError) {
      return fail(validationError, ErrorCode.VALIDATION_ERROR, {
        userMessage: validationError,
      });
    }

    if (input.businessLocation !== undefined && !cleanString(input.businessLocation)) {
      return fail('Business address is required', ErrorCode.VALIDATION_ERROR, {
        userMessage: 'Please enter your business address.',
      });
    }

    if (input.description !== undefined && !cleanString(input.description)) {
      return fail('Business description is required', ErrorCode.VALIDATION_ERROR, {
        userMessage: 'Please describe what you sell and who you are trying to reach.',
      });
    }

    const updateData = cleanUndefined({
      business_name: businessName,
      industry: input.industry ?? undefined,
      monthly_budget: input.monthlyBudget ?? undefined,
      website: cleanStringForUpdate(input.website),
      booking_link: cleanStringForUpdate(input.bookingLink),
      business_location: cleanStringForUpdate(input.businessLocation),
      customer_radius: input.customerRadius ?? undefined,
      description: cleanStringForUpdate(input.description),
      promoted_services: cleanStringArray(input.promotedServices),
      most_valuable_service: cleanStringForUpdate(input.mostValuableService),
      meta_ads_status: cleanStringForUpdate(input.metaAdsStatus),
      primary_goal: cleanStringForUpdate(input.primaryGoal),
      lead_type: cleanStringForUpdate(input.leadType),
      preferred_contact_method: cleanStringForUpdate(input.preferredContactMethod),
      lead_quality_signal: cleanStringForUpdate(input.leadQualitySignal),
      average_customer_value: cleanStringForUpdate(input.averageCustomerValue),
      target_cost_per_lead: cleanStringForUpdate(input.targetCostPerLead),
      watch_signals: cleanStringArray(input.watchSignals),
      recommendation_style: cleanStringForUpdate(input.recommendationStyle),
      safety_preference: cleanStringForUpdate(input.safetyPreference),
      ad_goals: coerceStringArray(input.adGoals),
      preferred_platforms: coerceStringArray(input.preferredPlatforms),
      updated_at: new Date().toISOString(),
    });

    const { error } = await supabase
      .from('business_profiles')
      .update(updateData)
      .eq('id', businessId);

    if (error) {
      return fail(getErrorMessage(error), ErrorCode.DATABASE_ERROR);
    }

    if (businessName && organizationType === 'business') {
      const { error: organizationError } = await supabase
        .from('organizations')
        .update({
          name: businessName,
          updated_at: new Date().toISOString(),
        })
        .eq('id', organizationId);

      if (organizationError) {
        return fail(getErrorMessage(organizationError), ErrorCode.DATABASE_ERROR);
      }
    }

    return ok(null);
  } catch (error) {
    return fail(getErrorMessage(error), ErrorCode.UNKNOWN_ERROR);
  }
}

export async function updateOnboardingProgress(input: {
  step: number;
  completed?: boolean;
}): Promise<ApiResponse<null>> {
  try {
    const supabase = await createServerClient();

    const contextRes = await requireActiveBusinessContextOrFail();
    if (!contextRes.success) return contextRes;

    const { businessId } = contextRes.data;

    const updateData = cleanUndefined({
      onboarding_step: input.step,
      onboarding_completed: input.completed,
      updated_at: new Date().toISOString(),
    });

    const { error } = await supabase
      .from('business_profiles')
      .update(updateData)
      .eq('id', businessId);

    if (error) {
      return fail(getErrorMessage(error), ErrorCode.DATABASE_ERROR);
    }

    return ok(null);
  } catch (error) {
    return fail(getErrorMessage(error), ErrorCode.UNKNOWN_ERROR);
  }
}
