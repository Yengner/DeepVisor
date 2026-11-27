'use server';
import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import { fail, ok, ErrorCode, type ApiResponse } from '@/lib/shared';
import { requireManagerContext } from '@/lib/server/actions/business/manager';
import { createAdminClient } from '@/lib/server/supabase/admin';
import { connectWhatsApp, isMetaId, WhatsAppConnectError } from '@/lib/server/leads/connect';

/**
 * Owner/admin-only: finish "Connect WhatsApp" (Embedded Signup) for the signed-in business.
 * The business comes from the session; the browser supplies only Meta's code and ids, which the
 * server re-checks with Meta before saving anything.
 */
export async function connectWhatsAppAction(input: unknown): Promise<ApiResponse<{ displayPhone: string | null; synced: boolean }>> {
  const t = await getTranslations('leads.connect.error');
  const { code, phoneNumberId, wabaId } = (input ?? {}) as Record<string, unknown>;
  if (typeof code !== 'string' || (phoneNumberId !== null && !isMetaId(phoneNumberId)) || !isMetaId(wabaId)) {
    return fail('Invalid signup result', ErrorCode.VALIDATION_ERROR, { userMessage: t('access') });
  }
  const context = await requireManagerContext(t('forbidden'));
  if (!context.success) return context;
  try {
    const result = await connectWhatsApp(createAdminClient(), { businessId: context.data.businessId, code, phoneNumberId, wabaId });
    revalidatePath('/leads');
    return ok({ displayPhone: result.displayPhone, synced: result.synced });
  } catch (error) {
    if (error instanceof WhatsAppConnectError) {
      console.error('WhatsApp connect failed', { reason: error.reason, metaCode: error.metaCode });
      return fail('WhatsApp connect failed', ErrorCode.VALIDATION_ERROR, { userMessage: t(error.reason) });
    }
    console.error('WhatsApp connect failed', { code: (error as { code?: string })?.code });
    return fail('WhatsApp connect failed', ErrorCode.DATABASE_ERROR, { userMessage: t('failed') });
  }
}
