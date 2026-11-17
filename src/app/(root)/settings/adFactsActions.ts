'use server';
import { revalidatePath } from 'next/cache';
import { unstable_rethrow } from 'next/navigation';
import { fail, ok, ErrorCode, type ApiResponse } from '@/lib/shared';
import { requireUserId } from '@/lib/server/actions/user/session';
import { getOrCreateOrganizationBusinessContext } from '@/lib/server/actions/business/context';
import { createAdminClient } from '@/lib/server/supabase/admin';
import { AdFactError, clearFact, saveFact } from '@/lib/server/agent/facts';
import { isFactKey } from '@/lib/shared/agent/facts';

/**
 * Owner/admin-only writes for business advertising facts. The business comes from the signed-in
 * user's membership, never from the browser; values are validated against the shared schema.
 */
async function managerContext(): Promise<ApiResponse<{ userId: string; businessId: string }>> {
  try {
    const userId = await requireUserId();
    const context = await getOrCreateOrganizationBusinessContext(userId);
    if (context.role !== 'owner' && context.role !== 'admin') {
      return fail('Ad facts require an owner or admin', ErrorCode.FORBIDDEN, {
        userMessage: 'Only workspace owners and admins can change these answers.',
      });
    }
    return ok({ userId, businessId: context.businessId });
  } catch (error) {
    unstable_rethrow(error); // a signed-out user is redirected to /login
    return fail('Not signed in', ErrorCode.UNAUTHORIZED, { userMessage: 'Please sign in again.' });
  }
}

export async function saveAdFactAction(key: unknown, value: unknown): Promise<ApiResponse<null>> {
  if (!isFactKey(key)) return fail('Unknown fact', ErrorCode.VALIDATION_ERROR, { userMessage: 'That answer could not be saved.' });
  const context = await managerContext();
  if (!context.success) return context;
  try {
    await saveFact(createAdminClient(), { ...context.data, key, value });
    revalidatePath('/settings');
    return ok(null);
  } catch (error) {
    if (error instanceof AdFactError) {
      return fail('Invalid fact value', ErrorCode.VALIDATION_ERROR, { userMessage: 'Check the answer and try again.' });
    }
    console.error('Saving ad fact failed', { key, code: (error as { code?: string })?.code });
    return fail('Saving ad fact failed', ErrorCode.DATABASE_ERROR, { userMessage: 'The answer could not be saved. Please try again.' });
  }
}

export async function clearAdFactAction(key: unknown): Promise<ApiResponse<null>> {
  if (!isFactKey(key)) return fail('Unknown fact', ErrorCode.VALIDATION_ERROR, { userMessage: 'That answer could not be removed.' });
  const context = await managerContext();
  if (!context.success) return context;
  try {
    await clearFact(createAdminClient(), { businessId: context.data.businessId, key });
    revalidatePath('/settings');
    return ok(null);
  } catch (error) {
    console.error('Clearing ad fact failed', { key, code: (error as { code?: string })?.code });
    return fail('Clearing ad fact failed', ErrorCode.DATABASE_ERROR, { userMessage: 'The answer could not be removed. Please try again.' });
  }
}
