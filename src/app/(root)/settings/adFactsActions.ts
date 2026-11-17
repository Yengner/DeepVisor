'use server';
import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import { fail, ok, ErrorCode, type ApiResponse } from '@/lib/shared';
import { requireManagerContext } from '@/lib/server/actions/business/manager';
import { createAdminClient } from '@/lib/server/supabase/admin';
import { AdFactError, clearFact, saveFact } from '@/lib/server/agent/facts';
import { isFactKey } from '@/lib/shared/agent/facts';

/**
 * Owner/admin-only writes for business advertising facts. The business comes from the signed-in
 * user's membership, never from the browser; values are validated against the shared schema.
 */
const managerContext = async () => requireManagerContext((await getTranslations('facts.error'))('forbidden'));

export async function saveAdFactAction(key: unknown, value: unknown): Promise<ApiResponse<null>> {
  const t = await getTranslations('facts.error');
  if (!isFactKey(key)) return fail('Unknown fact', ErrorCode.VALIDATION_ERROR, { userMessage: t('failed') });
  const context = await managerContext();
  if (!context.success) return context;
  try {
    await saveFact(createAdminClient(), { ...context.data, key, value });
    revalidatePath('/settings');
    return ok(null);
  } catch (error) {
    if (error instanceof AdFactError) {
      return fail('Invalid fact value', ErrorCode.VALIDATION_ERROR, { userMessage: t('invalid') });
    }
    console.error('Saving ad fact failed', { key, code: (error as { code?: string })?.code });
    return fail('Saving ad fact failed', ErrorCode.DATABASE_ERROR, { userMessage: t('failed') });
  }
}

export async function clearAdFactAction(key: unknown): Promise<ApiResponse<null>> {
  const t = await getTranslations('facts.error');
  if (!isFactKey(key)) return fail('Unknown fact', ErrorCode.VALIDATION_ERROR, { userMessage: t('removeInvalid') });
  const context = await managerContext();
  if (!context.success) return context;
  try {
    await clearFact(createAdminClient(), { businessId: context.data.businessId, key });
    revalidatePath('/settings');
    return ok(null);
  } catch (error) {
    console.error('Clearing ad fact failed', { key, code: (error as { code?: string })?.code });
    return fail('Clearing ad fact failed', ErrorCode.DATABASE_ERROR, { userMessage: t('removeFailed') });
  }
}
