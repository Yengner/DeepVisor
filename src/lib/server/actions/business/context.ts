import 'server-only';

import { cache } from 'react';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/server/supabase/admin';
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

/** The cookie only chooses among the user's own memberships; it never grants access. */
export const ACTIVE_BUSINESS_COOKIE = 'active_business_id';

/** Every business the user is a member of, oldest membership first. */
async function listMemberships(userId: string): Promise<JoinedMembershipRow[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
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
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as unknown as JoinedMembershipRow[];
}

function toContext(membership: JoinedMembershipRow): OrganizationBusinessContext | null {
  const organization = firstJoinedOrganization(membership.organizations);
  const business = firstJoinedBusinessProfile(organization?.business_profiles);

  return organization && business
    ? {
        organizationId: organization.id,
        organizationName: organization.name,
        organizationType: organization.type,
        businessId: business.id,
        role: normalizeOrganizationRole(membership.role),
        onboarding: business,
      }
    : null;
}

/** The businesses the user can switch between. */
export async function listUserBusinesses(userId: string): Promise<OrganizationBusinessContext[]> {
  return (await listMemberships(userId)).map(toContext).filter((context) => context !== null);
}

export async function getExistingOrganizationBusinessContext(
  userId: string
): Promise<ExistingBusinessContextResult> {
  const memberships = (await listMemberships(userId)).filter((membership) => membership.organization_id);

  if (memberships.length === 0) {
    return { kind: 'missing_membership' };
  }

  const chosen = (await cookies()).get(ACTIVE_BUSINESS_COOKIE)?.value;
  const selected = chosen
    ? memberships.map(toContext).find((context) => context?.businessId === chosen)
    : null;

  if (selected) {
    return { kind: 'found', context: selected };
  }

  const first = memberships[0];
  const organization = firstJoinedOrganization(first.organizations);

  if (!organization) {
    throw new Error('Failed to load organization for membership');
  }

  const context = toContext(first);

  return context
    ? { kind: 'found', context }
    : {
        kind: 'missing_business_profile',
        organization: { id: organization.id, name: organization.name, type: organization.type },
        role: normalizeOrganizationRole(first.role),
      };
}

/**
 * Read once per request. Nothing is cached between requests, so switching business and removed
 * access both apply on the next request.
 */
export const getCachedOrganizationBusinessContext = cache(
  async (userId: string): Promise<OrganizationBusinessContext> => getOrCreateOrganizationBusinessContext(userId)
);

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
  const existing = await getExistingOrganizationBusinessContext(userId);

  if (existing.kind === 'found') {
    return existing.context;
  }

  const supabase = await createServerClient();
  const { error } = await supabase.rpc('ensure_onboarding_workspace');
  if (error) throw new Error(error.message);
  const resolved = await getExistingOrganizationBusinessContext(userId);
  if (resolved.kind !== 'found') throw new Error('Workspace creation did not return a business');
  return resolved.context;
}
