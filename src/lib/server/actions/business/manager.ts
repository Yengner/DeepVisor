import 'server-only';
import { unstable_rethrow } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { fail, ok, ErrorCode, type ApiResponse } from '@/lib/shared';
import { canManageBusiness } from '@/lib/shared/business/access';
import { requireUserId } from '@/lib/server/actions/user/session';
import { getOrCreateOrganizationBusinessContext } from '@/lib/server/actions/business/context';

/**
 * The signed-in user's business, only when they are an owner or admin. The business always
 * comes from the session's membership, never from the browser. A signed-out user is redirected.
 */
export async function requireManagerContext(userMessage: string): Promise<ApiResponse<{ userId: string; businessId: string }>> {
  try {
    const userId = await requireUserId();
    const context = await getOrCreateOrganizationBusinessContext(userId);
    if (!canManageBusiness(context.role)) {
      return fail('Requires an owner or admin', ErrorCode.FORBIDDEN, { userMessage });
    }
    return ok({ userId, businessId: context.businessId });
  } catch (error) {
    unstable_rethrow(error);
    return fail('Not signed in', ErrorCode.UNAUTHORIZED, { userMessage: (await getTranslations('auth'))('signInAgain') });
  }
}
