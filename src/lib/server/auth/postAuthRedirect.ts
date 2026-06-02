import 'server-only';

import { getOrCreateOrganizationBusinessContext } from '@/lib/server/actions/business/context';

export async function resolvePostAuthRedirectPath(userId: string): Promise<'/dashboard' | '/onboarding'> {
  const context = await getOrCreateOrganizationBusinessContext(userId);

  return context.onboarding.onboarding_completed ? '/dashboard' : '/onboarding';
}
