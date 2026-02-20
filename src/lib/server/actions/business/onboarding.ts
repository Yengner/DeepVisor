"use server";

import { createSupabaseClient } from "@/lib/server/supabase/server";
import { ok, fail, type ApiResponse, ErrorCode } from "@/lib/shared";
import { getErrorMessage } from "@/lib/shared/utils/guards";

async function requireActiveBusinessIdOrFail(): Promise<ApiResponse<{ businessId: string }>> {
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data?.user) {
    return fail("User not authenticated", ErrorCode.UNAUTHORIZED, {
      userMessage: "Please sign in again.",
    });
  }

  const { data: membership, error: mErr } = await supabase
    .from("business_memberships")
    .select("business_id, role")
    .eq("user_id", data.user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (mErr) {
    return fail(getErrorMessage(mErr), ErrorCode.DATABASE_ERROR);
  }

  if (!membership?.business_id) {
    return fail("No business membership found", ErrorCode.NOT_FOUND, {
      userMessage: "Let's create your business to continue onboarding.",
    });
  }

  return ok({ businessId: membership.business_id });
}

function _coerceStringArray(value: string[] | string | undefined): string[] | undefined {
  if (value === undefined) return undefined;
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === "string") return value.split(",").map(s => s.trim()).filter(Boolean);
  return undefined;
}

function cleanUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) (out as any)[k] = v;
  }
  return out;
}

export type OnboardingInitial = {
  step: number;
  completed: boolean;
  businessId: string;
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
  const supabase = await createSupabaseClient();

  const businessRes = await requireActiveBusinessIdOrFail();
  if (!businessRes.success) return businessRes;

  const { businessId } = businessRes.data;

  const { data: bp, error } = await supabase
    .from("business_profiles")
    .select(`
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
    `)
    .eq("id", businessId)
    .single();

  if (error) {
    return fail(getErrorMessage(error), ErrorCode.DATABASE_ERROR);
  }

  return ok({
    step: bp.onboarding_step ?? 0,
    completed: bp.onboarding_completed ?? false,
    businessId: bp.id,
    businessData: {
      businessName: bp.business_name ?? "",
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
    const supabase = await createSupabaseClient();

    const businessRes = await requireActiveBusinessIdOrFail();
    if (!businessRes.success) return businessRes;

    const { businessId } = businessRes.data;

    const updateData = cleanUndefined({
      business_name: input.businessName,
      industry: input.industry ?? undefined,
      monthly_budget: input.monthlyBudget ?? undefined,
      website: input.website ?? undefined,
      description: input.description ?? undefined,
      ad_goals: _coerceStringArray(input.adGoals),
      preferred_platforms: _coerceStringArray(input.preferredPlatforms),
      updated_at: new Date().toISOString(),
    });

    const { error } = await supabase
      .from("business_profiles")
      .update(updateData)
      .eq("id", businessId);

    if (error) {
      return fail(getErrorMessage(error), ErrorCode.DATABASE_ERROR);
    }

    return ok(null);
  } catch (e) {
    return fail(getErrorMessage(e), ErrorCode.UNKNOWN_ERROR);
  }
}

export async function updateOnboardingProgress(input: {
    step: number;
    completed?: boolean;
}): Promise<ApiResponse<null>> {
    try {
        const supabase = await createSupabaseClient();

        const businessRes = await requireActiveBusinessIdOrFail();
        if (!businessRes.success) return businessRes;

        const { businessId } = businessRes.data;

        const updateData = cleanUndefined({
            onboarding_step: input.step,
            onboarding_completed: input.completed,
            updated_at: new Date().toISOString(),
        });

        const { error } = await supabase
            .from("business_profiles")
            .update(updateData)
            .eq("id", businessId);

        if (error) {
            return fail(getErrorMessage(error), ErrorCode.DATABASE_ERROR);
        }

        return ok(null);
    } catch (e) {
        return fail(getErrorMessage(e), ErrorCode.UNKNOWN_ERROR);
    }
}