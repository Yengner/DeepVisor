"use server";

import { createServerClient } from '@/lib/server/supabase/server';
import { ok, fail, type ApiResponse, ErrorCode } from '@/lib/shared';
import { getErrorMessage } from '@/lib/shared/utils/guards';
import { requireUserId } from '@/lib/server/actions/user/session';
import { getOrCreateOrganizationBusinessContext } from '@/lib/server/actions/business/context';
import type { Database } from '@/lib/shared/types/supabase';

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
    description: string | null;
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
          description,
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
      businessName: bp.business_name ?? '',
      industry: bp.industry ?? null,
      monthlyBudget: bp.monthly_budget ?? null,
      website: bp.website ?? null,
      description: bp.description ?? null,
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
  description?: string | null;
  adGoals?: string[] | string;
  preferredPlatforms?: string[] | string;
}): Promise<ApiResponse<null>> {
  try {
    const supabase = await createServerClient();

    const contextRes = await requireActiveBusinessContextOrFail();
    if (!contextRes.success) return contextRes;

    const { businessId, organizationId, organizationType } = contextRes.data;

    const updateData = cleanUndefined({
      business_name: input.businessName,
      industry: input.industry ?? undefined,
      monthly_budget: input.monthlyBudget ?? undefined,
      website: input.website ?? undefined,
      description: input.description ?? undefined,
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

    if (input.businessName && organizationType === 'business') {
      const { error: organizationError } = await supabase
        .from('organizations')
        .update({
          name: input.businessName,
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
