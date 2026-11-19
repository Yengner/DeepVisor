'use server';
import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import { fail, ok, ErrorCode, type ApiResponse } from '@/lib/shared';
import { requireManagerContext } from '@/lib/server/actions/business/manager';
import { resolveCurrentSelection } from '@/lib/server/actions/app/selection';
import { createAdminClient } from '@/lib/server/supabase/admin';
import { addCallLead, LeadError, setLeadOutcome } from '@/lib/server/leads/service';
import type { LeadOutcome } from '@/lib/shared/leads/summary';

const OUTCOMES: readonly LeadOutcome[] = ['booked', 'not_booked', 'spam'];
const isOutcome = (value: unknown): value is LeadOutcome => OUTCOMES.includes(value as LeadOutcome);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Owner/admin-only: mark one lead booked, not booked or spam, or clear the mark (`null`). */
export async function setLeadOutcomeAction(leadId: unknown, outcome: unknown): Promise<ApiResponse<null>> {
  const t = await getTranslations('leads.error');
  if (typeof leadId !== 'string' || !UUID.test(leadId) || (outcome !== null && !isOutcome(outcome))) {
    return fail('Invalid lead', ErrorCode.VALIDATION_ERROR, { userMessage: t('invalid') });
  }
  const context = await requireManagerContext(t('forbidden'));
  if (!context.success) return context;
  try {
    await setLeadOutcome(createAdminClient(), { businessId: context.data.businessId, leadId, outcome, userId: context.data.userId });
    revalidatePath('/leads');
    return ok(null);
  } catch (error) {
    if (error instanceof LeadError) return fail('Lead not found', ErrorCode.NOT_FOUND, { userMessage: t('notFound') });
    console.error('Saving lead outcome failed', { code: (error as { code?: string })?.code });
    return fail('Saving lead failed', ErrorCode.DATABASE_ERROR, { userMessage: t('failed') });
  }
}

/** Owner/admin-only: log a phone call, optionally from one of the selected account's ads. */
export async function addCallLeadAction(adExternalId: unknown, outcome: unknown): Promise<ApiResponse<null>> {
  const t = await getTranslations('leads.error');
  if ((adExternalId !== null && typeof adExternalId !== 'string') || (outcome !== null && !isOutcome(outcome))) {
    return fail('Invalid call', ErrorCode.VALIDATION_ERROR, { userMessage: t('invalid') });
  }
  const context = await requireManagerContext(t('forbidden'));
  if (!context.success) return context;
  try {
    const selection = await resolveCurrentSelection(context.data.businessId);
    if (!selection.selectedAdAccountId) return fail('No ad account selected', ErrorCode.VALIDATION_ERROR, { userMessage: t('noAccount') });
    await addCallLead(createAdminClient(), {
      businessId: context.data.businessId, adAccountId: selection.selectedAdAccountId,
      adExternalId: adExternalId || null, outcome, userId: context.data.userId,
    });
    revalidatePath('/leads');
    return ok(null);
  } catch (error) {
    if (error instanceof LeadError) return fail('Invalid call', ErrorCode.VALIDATION_ERROR, { userMessage: t('invalid') });
    console.error('Adding call lead failed', { code: (error as { code?: string })?.code });
    return fail('Adding call failed', ErrorCode.DATABASE_ERROR, { userMessage: t('failed') });
  }
}
