import { cache } from 'react';
import { getLoggedInUserOrRedirect } from '@/lib/server/actions/user/account';
import { requireBusinessContextOrRedirect } from '@/lib/server/actions/business/context';
import type { Database } from '@/lib/shared/types/supabase';

type OrganizationType = Database['public']['Enums']['organization_type'];

type RequiredAppContext = {
  user: Awaited<ReturnType<typeof getLoggedInUserOrRedirect>>;
  organizationId: string;
  organizationName: string;
  organizationType: OrganizationType;
  businessId: string;
  role: 'owner' | 'admin' | 'member';
  onboarding: {
    id: string;
    onboarding_completed: boolean;
    onboarding_step: number;
  };
};
/**
 * Fetches the required context for the app, including user and business information.
 * Redirects to login if the user is not authenticated, or to onboarding if the business context is not set up.
 * @param requireOnboardingCompleted - If true, will also check if the business onboarding is completed and redirect if not.
 * @returns An object containing the user and business context information.
 */
export const getRequiredAppContext = cache(
  async (requireOnboardingCompleted: boolean = true): Promise<RequiredAppContext> => {
    const user = await getLoggedInUserOrRedirect();
    const businessContext = await requireBusinessContextOrRedirect(user.id, {
      requireOnboardingCompleted,
    });

    return {
      user,
      ...businessContext,
    };
  }
);
