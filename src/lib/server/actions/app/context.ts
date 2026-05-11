import { cache } from 'react';
import { redirect, unstable_rethrow } from 'next/navigation';
import { getLoggedInUserOrRedirect } from '@/lib/server/actions/user/account';
import { getCachedOrganizationBusinessContext } from '@/lib/server/actions/business/context';
import { createServerTimer } from '@/lib/server/timing';
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
    const timer = createServerTimer('context', { enabledEnvVar: 'CONTEXT_TIMING' });
    try {
      const user = await timer.measure('get logged in user', () => getLoggedInUserOrRedirect());
      const businessContext = await timer.measure('cached organization business context', () =>
        getCachedOrganizationBusinessContext(user.id)
      );

      if (requireOnboardingCompleted && !businessContext.onboarding.onboarding_completed) {
        redirect('/onboarding');
      }

      const context = {
        user,
        ...businessContext,
      };

      timer.finish('required app context total');
      return context;
    } catch (error) {
      unstable_rethrow(error);
      console.error('Failed to resolve required app context:', error);
      if (
        error instanceof Error &&
        error.message.includes('Partner organizations do not get an automatic business profile')
      ) {
        redirect('/onboarding');
      }
      redirect('/login');
    }
  }
);
