'use server';
import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import { fail, ok, ErrorCode, type ApiResponse } from '@/lib/shared';
import { requireManagerContext } from '@/lib/server/actions/business/manager';
import { resolveCurrentSelection } from '@/lib/server/actions/app/selection';
import { createAdminClient } from '@/lib/server/supabase/admin';
import { CheckinError, saveCheckin } from '@/lib/server/bookings/checkins';
import { dayIn } from '@/lib/shared/time/zone';

/**
 * Owner/admin-only: record how many appointments a completed week's ads produced, or `null`
 * for "not sure". The account is the session's validated selection, never a browser value.
 */
export async function saveBookingCheckinAction(weekStart: unknown, bookings: unknown): Promise<ApiResponse<null>> {
  const t = await getTranslations('checkin.error');
  if (typeof weekStart !== 'string' || (bookings !== null && typeof bookings !== 'number')) {
    return fail('Invalid check-in', ErrorCode.VALIDATION_ERROR, { userMessage: t('invalid') });
  }
  const context = await requireManagerContext(t('forbidden'));
  if (!context.success) return context;
  try {
    const selection = await resolveCurrentSelection(context.data.businessId);
    if (!selection.selectedAdAccountId) {
      return fail('No ad account selected', ErrorCode.VALIDATION_ERROR, { userMessage: t('noAccount') });
    }
    const db = createAdminClient();
    const { data: account, error } = await db.from('ad_accounts').select('id, timezone')
      .eq('id', selection.selectedAdAccountId).eq('business_id', context.data.businessId).maybeSingle();
    if (error) throw error;
    if (!account?.timezone) {
      return fail('Account unavailable', ErrorCode.VALIDATION_ERROR, { userMessage: t('accountUnavailable') });
    }
    await saveCheckin(db, {
      businessId: context.data.businessId, adAccountId: account.id, userId: context.data.userId,
      weekStart, bookings, today: dayIn(account.timezone),
    });
    revalidatePath('/dashboard');
    return ok(null);
  } catch (error) {
    if (error instanceof CheckinError) {
      return fail('Invalid check-in', ErrorCode.VALIDATION_ERROR, { userMessage: error.code === 'INVALID_WEEK' ? t('oldWeek') : t('count') });
    }
    console.error('Saving booking check-in failed', { code: (error as { code?: string })?.code });
    return fail('Saving check-in failed', ErrorCode.DATABASE_ERROR, { userMessage: t('failed') });
  }
}
