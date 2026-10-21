import 'server-only';

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
      tags: [`business-context:${userId}`],
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

  const supabase = await createServerClient();
  const { error } = await supabase.rpc('ensure_onboarding_workspace');
  if (error) throw new Error(error.message);
  const resolved = await getExistingOrganizationBusinessContext(userId);
  if (resolved.kind !== 'found') throw new Error('Workspace creation did not return a business');
  timer.finish('get or create business context total');
  return resolved.context;
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
