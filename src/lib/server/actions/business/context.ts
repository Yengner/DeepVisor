"use server";

import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/server/supabase/server';
type BusinessRole = 'owner' | 'admin' | 'member';
type OrganizationRole = BusinessRole | 'viewer';

type BusinessOnboarding = {
  id: string;
  onboarding_completed: boolean;
  onboarding_step: number;
};

function normalizeOrganizationRole(role: string | null | undefined): BusinessRole {
  if (role === 'owner' || role === 'admin' || role === 'member') {
    return role;
  }
  return 'member';
}

async function createDefaultBusinessContext(userId: string): Promise<{
  organizationId: string;
  role: BusinessRole;
  business: BusinessOnboarding;
}> {
  const supabase = await createServerClient();

  const { data: organization, error: organizationError } = await supabase
    .from('organizations')
    .insert({
      name: 'My Business',
      type: 'business',
      primary_language: 'en',
      branding: {},
      is_active: true,
    })
    .select('id')
    .single();

  if (organizationError || !organization) {
    throw new Error(organizationError?.message || 'Failed to create organization');
  }

  const { error: membershipError } = await supabase
    .from('organization_memberships')
    .insert({
      organization_id: organization.id,
      user_id: userId,
      role: 'owner',
    });

  if (membershipError) {
    throw new Error(membershipError.message || 'Failed to create organization membership');
  }

  const { data: business, error: businessError } = await supabase
    .from('business_profiles')
    .insert({
      organization_id: organization.id,
      business_name: 'My Business',
      onboarding_step: 0,
      onboarding_completed: false,
    })
    .select('id, onboarding_completed, onboarding_step')
    .single();

  if (businessError || !business) {
    throw new Error(businessError?.message || 'Failed to create business profile');
  }

  return {
    organizationId: organization.id,
    role: 'owner',
    business,
  };
}

async function ensureBusinessProfileForOrganization(organizationId: string): Promise<BusinessOnboarding> {
  const supabase = await createServerClient();

  const { data: business, error: businessError } = await supabase
    .from('business_profiles')
    .select('id, onboarding_completed, onboarding_step')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (businessError) {
    throw new Error(businessError.message);
  }

  if (business) {
    return business;
  }

  const { data: createdBusiness, error: createError } = await supabase
    .from('business_profiles')
    .insert({
      organization_id: organizationId,
      business_name: 'My Business',
      onboarding_step: 0,
      onboarding_completed: false,
    })
    .select('id, onboarding_completed, onboarding_step')
    .single();

  if (createError || !createdBusiness) {
    throw new Error(createError?.message || 'Failed to create missing business profile');
  }

  return createdBusiness;
}

export async function getOrCreateOrganizationBusinessContext(userId: string) {
  const supabase = await createServerClient();

  const { data: membership, error: membershipError } = await supabase
    .from('organization_memberships')
    .select('organization_id, role')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .maybeSingle();

  if (membershipError) {
    throw new Error(membershipError.message);
  }

  if (!membership?.organization_id) {
    const created = await createDefaultBusinessContext(userId);

    return {
      organizationId: created.organizationId,
      businessId: created.business.id,
      role: created.role,
      onboarding: created.business,
    };
  }

  const business = await ensureBusinessProfileForOrganization(membership.organization_id);

  return {
    organizationId: membership.organization_id,
    businessId: business.id,
    role: normalizeOrganizationRole(membership.role as OrganizationRole),
    onboarding: business,
  };
}

export async function requireBusinessContextOrRedirect(
  userId: string,
  options?: { requireOnboardingCompleted?: boolean }
) {
  try {
    const context = await getOrCreateOrganizationBusinessContext(userId);
    const requireOnboardingCompleted = options?.requireOnboardingCompleted ?? true;

    if (requireOnboardingCompleted && !context.onboarding.onboarding_completed) {
      redirect(`/onboarding?step=${context.onboarding.onboarding_step ?? 0}`);
    }

    return context;
  } catch (error) {
    console.error('Failed to resolve business context:', error);
    redirect('/login');
  }
}
