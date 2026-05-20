"use server";

import { unstable_cache } from 'next/cache';
import { redirect, unstable_rethrow } from 'next/navigation';
import { createAdminClient } from '@/lib/server/supabase/admin';
import { createServerClient } from '@/lib/server/supabase/server';
import { createServerTimer } from '@/lib/server/timing';
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

type ExistingBusinessContextResult =
  | {
      kind: 'found';
      context: OrganizationBusinessContext;
    }
  | {
      kind: 'missing_membership';
    }
  | {
      kind: 'missing_business_profile';
      organization: OrganizationRow;
      role: BusinessRole;
    };

type JoinedBusinessProfileRow = BusinessOnboarding | BusinessOnboarding[] | null;

type JoinedOrganizationRow = {
  id: string;
  name: string;
  type: OrganizationType;
  business_profiles?: JoinedBusinessProfileRow;
} | null;

type JoinedMembershipRow = {
  organization_id: string | null;
  role: OrganizationRole | null;
  organizations?: JoinedOrganizationRow | JoinedOrganizationRow[];
};

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
  const timer = createServerTimer('context', { enabledEnvVar: 'CONTEXT_TIMING' });
  const supabase = await timer.measure('create server client: default business context', () =>
    createServerClient()
  );
  const defaultBusinessName = 'Business setup';

  // Organization creation and owner assignment live in one RPC so the database
  // owns the invariant that every new workspace has an owner membership.
  const { data: organizationId, error: organizationError } = await timer.measure(
    'create default organization rpc',
    () =>
      supabase.rpc('create_organization_with_owner', {
        org_name: defaultBusinessName,
        org_type: 'business',
        org_primary_language: 'en',
      })
  );

  if (organizationError || !organizationId) {
    throw new Error(organizationError?.message || 'Failed to create organization');
  }

  const organization = await timer.measure('load default organization', () =>
    getOrganizationById(organizationId)
  );

  const { data: business, error: businessError } = await timer.measure(
    'create default business profile',
    () =>
      supabase
        .from('business_profiles')
        .insert({
          organization_id: organization.id,
          business_name: organization.name,
          onboarding_step: 0,
          onboarding_completed: false,
        })
        .select('id, onboarding_completed, onboarding_step')
        .single()
  );

  if (businessError || !business) {
    throw new Error(businessError?.message || 'Failed to create business profile');
  }

  const result = {
    organizationId: organization.id,
    organizationName: defaultBusinessName,
    organizationType: 'business' as OrganizationType,
    role: 'owner' as const,
    business,
  };
  timer.finish('create default business context total');
  return result;
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
  const timer = createServerTimer('context', { enabledEnvVar: 'CONTEXT_TIMING' });
  const existingBusiness = await timer.measure('ensure business profile: lookup existing', () =>
    getPrimaryBusinessProfileForOrganization(organization.id)
  );

  if (existingBusiness) {
    timer.finish('ensure business profile total');
    return existingBusiness;
  }

  if (organization.type !== 'business') {
    throw new Error(
      'Partner organizations do not get an automatic business profile. A business must be selected explicitly.'
    );
  }

  const supabase = await timer.measure('create server client: ensure business profile', () =>
    createServerClient()
  );

  // Business organizations have a single primary business profile. We create it on demand
  // so new owners can complete onboarding before any deeper account setup begins.
  const { data: createdBusiness, error: createError } = await timer.measure(
    'ensure business profile: create missing',
    () =>
      supabase
        .from('business_profiles')
        .insert({
          organization_id: organization.id,
          business_name: organization.name,
          onboarding_step: 0,
          onboarding_completed: false,
        })
        .select('id, onboarding_completed, onboarding_step')
        .single()
  );

  if (createError || !createdBusiness) {
    throw new Error(createError?.message || 'Failed to create missing business profile');
  }

  timer.finish('ensure business profile total');
  return createdBusiness;
}

function firstJoinedOrganization(value: JoinedMembershipRow['organizations']): JoinedOrganizationRow {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function firstJoinedBusinessProfile(value: JoinedBusinessProfileRow | undefined): BusinessOnboarding | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

export async function getExistingOrganizationBusinessContext(
  userId: string
): Promise<ExistingBusinessContextResult> {
  const timer = createServerTimer('context', { enabledEnvVar: 'CONTEXT_TIMING' });
  const supabase = timer.measureSync('create admin client: business context', createAdminClient);

  const { data: membership, error: membershipError } = await timer.measure(
    'membership org business query',
    () =>
      supabase
        .from('organization_memberships')
        .select(
          `
          organization_id,
          role,
          organizations!organization_memberships_org_fkey (
            id,
            name,
            type,
            business_profiles (
              id,
              onboarding_completed,
              onboarding_step
            )
          )
        `
        )
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()
  );

  if (membershipError) {
    throw new Error(membershipError.message);
  }

  if (!membership?.organization_id) {
    timer.finish('existing business context total');
    return { kind: 'missing_membership' };
  }

  const joinedMembership = membership as unknown as JoinedMembershipRow;
  const organization = firstJoinedOrganization(joinedMembership.organizations);

  if (!organization) {
    throw new Error('Failed to load organization for membership');
  }

  const business = firstJoinedBusinessProfile(organization.business_profiles);
  const role = normalizeOrganizationRole(joinedMembership.role);

  if (!business) {
    timer.finish('existing business context total');
    return {
      kind: 'missing_business_profile',
      organization: {
        id: organization.id,
        name: organization.name,
        type: organization.type,
      },
      role,
    };
  }

  const context = {
    organizationId: organization.id,
    organizationName: organization.name,
    organizationType: organization.type,
    businessId: business.id,
    role,
    onboarding: business,
  };

  timer.finish('existing business context total');
  return {
    kind: 'found',
    context,
  };
}

function isBusinessContextCacheMiss(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.startsWith('organization-business-context-cache-miss:')
  );
}

function getCachedFoundOrganizationBusinessContext(userId: string) {
  return unstable_cache(
    async () => {
      const existing = await getExistingOrganizationBusinessContext(userId);

      if (existing.kind === 'found') {
        return existing.context;
      }

      throw new Error(`organization-business-context-cache-miss:${existing.kind}`);
    },
    ['organization-business-context', userId],
    {
      revalidate: 30,
    }
  )();
}

export async function getCachedOrganizationBusinessContext(
  userId: string
): Promise<OrganizationBusinessContext> {
  try {
    return await getCachedFoundOrganizationBusinessContext(userId);
  } catch (error) {
    if (!isBusinessContextCacheMiss(error)) {
      throw error;
    }
  }

  return getOrCreateOrganizationBusinessContext(userId);
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
  const timer = createServerTimer('context', { enabledEnvVar: 'CONTEXT_TIMING' });
  const existing = await timer.measure('existing organization business context', () =>
    getExistingOrganizationBusinessContext(userId)
  );

  if (existing.kind === 'found') {
    timer.finish('get or create business context total');
    return existing.context;
  }

  if (existing.kind === 'missing_membership') {
    const created = await createDefaultBusinessContext();

    const context = {
      organizationId: created.organizationId,
      organizationName: created.organizationName,
      organizationType: created.organizationType,
      businessId: created.business.id,
      role: created.role,
      onboarding: created.business,
    };
    timer.finish('get or create business context total');
    return context;
  }

  const business = await timer.measure('ensure business profile', () =>
    ensureBusinessProfileForOrganization(existing.organization)
  );

  const context = {
    organizationId: existing.organization.id,
    organizationName: existing.organization.name,
    organizationType: existing.organization.type,
    businessId: business.id,
    role: existing.role,
    onboarding: business,
  };
  timer.finish('get or create business context total');
  return context;
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
    if (error instanceof Error && error.message.includes('Partner organizations do not get an automatic business profile')) {
      redirect('/onboarding');
    }
    redirect('/login');
  }
}
