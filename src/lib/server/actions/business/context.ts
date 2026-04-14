"use server";

import { redirect, unstable_rethrow } from 'next/navigation';
import { createServerClient } from '@/lib/server/supabase/server';
import type { Database } from '@/lib/shared/types/supabase';

type BusinessRole = 'owner' | 'admin' | 'member';
type OrganizationRole = BusinessRole | 'viewer';
type OrganizationType = Database['public']['Enums']['organization_type'];

type BusinessOnboarding = {
  id: string;
  onboarding_completed: boolean;
  onboarding_step: number;
};

type OrganizationRow = Pick<
  Database['public']['Tables']['organizations']['Row'],
  'id' | 'name' | 'type'
>;

export type OrganizationBusinessContext = {
  organizationId: string;
  organizationName: string;
  organizationType: OrganizationType;
  businessId: string;
  role: BusinessRole;
  onboarding: BusinessOnboarding;
};

function normalizeOrganizationRole(role: string | null | undefined): BusinessRole {
  if (role === 'owner' || role === 'admin' || role === 'member') {
    return role;
  }
  return 'member';
}

async function createDefaultBusinessContext(): Promise<{
  organizationId: string;
  organizationName: string;
  organizationType: OrganizationType;
  role: BusinessRole;
  business: BusinessOnboarding;
}> {
  const supabase = await createServerClient();
  const defaultBusinessName = 'My Business';

  // Organization creation and owner assignment live in one RPC so the database
  // owns the invariant that every new workspace has an owner membership.
  const { data: organizationId, error: organizationError } = await supabase
    .rpc('create_organization_with_owner', {
      org_name: defaultBusinessName,
      org_type: 'business',
      org_primary_language: 'en',
    });

  if (organizationError || !organizationId) {
    throw new Error(organizationError?.message || 'Failed to create organization');
  }

  const organization = await getOrganizationById(organizationId);

  const { data: business, error: businessError } = await supabase
    .from('business_profiles')
    .insert({
      organization_id: organization.id,
      business_name: organization.name,
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
    organizationName: defaultBusinessName,
    organizationType: 'business',
    role: 'owner',
    business,
  };
}

async function getOrganizationById(organizationId: string): Promise<OrganizationRow> {
  const supabase = await createServerClient();

  const { data: organization, error } = await supabase
    .from('organizations')
    .select('id, name, type')
    .eq('id', organizationId)
    .single();

  if (error || !organization) {
    throw new Error(error?.message || 'Failed to load organization');
  }

  return organization;
}

async function getPrimaryBusinessProfileForOrganization(organizationId: string): Promise<BusinessOnboarding | null> {
  const supabase = await createServerClient();

  const { data: business, error } = await supabase
    .from('business_profiles')
    .select('id, onboarding_completed, onboarding_step')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return business;
}

async function ensureBusinessProfileForOrganization(
  organization: OrganizationRow
): Promise<BusinessOnboarding> {
  const existingBusiness = await getPrimaryBusinessProfileForOrganization(organization.id);

  if (existingBusiness) {
    return existingBusiness;
  }

  if (organization.type !== 'business') {
    throw new Error(
      'Agency organizations do not get an automatic business profile. A business must be selected explicitly.'
    );
  }

  const supabase = await createServerClient();

  // Business organizations have a single primary business profile. We create it on demand
  // so new owners can complete onboarding before any deeper account setup begins.
  const { data: createdBusiness, error: createError } = await supabase
    .from('business_profiles')
    .insert({
      organization_id: organization.id,
      business_name: organization.name,
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

/**
 * Loads the user's primary organization/business context, creating a default business
 * workspace when the user has not been assigned one yet.
 *
 * @param userId - The authenticated user whose workspace context should be resolved.
 * @returns The normalized organization + business context used throughout the app.
 */
export async function getOrCreateOrganizationBusinessContext(
  userId: string
): Promise<OrganizationBusinessContext> {
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
    const created = await createDefaultBusinessContext();

    return {
      organizationId: created.organizationId,
      organizationName: created.organizationName,
      organizationType: created.organizationType,
      businessId: created.business.id,
      role: created.role,
      onboarding: created.business,
    };
  }

  const organization = await getOrganizationById(membership.organization_id);
  const business = await ensureBusinessProfileForOrganization(organization);

  return {
    organizationId: organization.id,
    organizationName: organization.name,
    organizationType: organization.type,
    businessId: business.id,
    role: normalizeOrganizationRole(membership.role as OrganizationRole),
    onboarding: business,
  };
}

export async function requireBusinessContextOrRedirect(
  userId: string,
  options?: { requireOnboardingCompleted?: boolean }
) {
  const requireOnboardingCompleted = options?.requireOnboardingCompleted ?? true;

  try {
    const context = await getOrCreateOrganizationBusinessContext(userId);

    if (requireOnboardingCompleted && !context.onboarding.onboarding_completed) {
      redirect(`/onboarding`);
    }

    return context;
  } catch (error) {
    unstable_rethrow(error);
    console.error('Failed to resolve business context:', error);
    if (error instanceof Error && error.message.includes('Agency organizations do not get an automatic business profile')) {
      redirect('/onboarding');
    }
    redirect('/login');
  }
}
