'use server';
import { getTranslations } from 'next-intl/server';
import { fail, ok, ErrorCode, type ApiResponse } from '@/lib/shared';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import { AssistantError, authorizeSelectedMetaAccount } from '@/lib/server/intelligence/assistant/access';
import { MAX_DAILY_CAMPAIGN_BUDGET } from '@/lib/server/campaigns/budgetGuardrails';
import { findRestartSource } from '@/lib/server/suggestions/rerun';
import { deletePlan, PlanConflictError, savePlan, type SavedPlan } from '@/lib/server/suggestions/plans';
import { dayIn } from '@/lib/shared/time/zone';
import { planDates, RERUN_MIN_DAILY, validDays } from '@/lib/shared/suggestions/rerun';

/**
 * Save or discard the "run this ad again" plan for one ad set. Owners/admins only; the ad set must
 * belong to the selected Meta account. Saved in DeepVisor only: nothing is sent to Meta.
 */
export async function savePlanAction(adSetId: unknown, input: unknown): Promise<ApiResponse<SavedPlan>> {
  const t = await getTranslations('rerun.error');
  const plan = parseInput(input);
  if (!plan) return fail('Invalid plan', ErrorCode.VALIDATION_ERROR, { userMessage: t('failed') });
  const { role } = await getRequiredAppContext();
  if (role !== 'owner' && role !== 'admin') return fail('Forbidden', ErrorCode.FORBIDDEN, { userMessage: t('forbidden') });
  try {
    const scope = await authorizeSelectedMetaAccount();
    const zone = scope.account.timezone, currency = scope.account.currency_code;
    if (!zone || !currency) return fail('No timezone or currency', ErrorCode.VALIDATION_ERROR, { userMessage: t('failed') });
    const source = await findRestartSource(scope, adSetId);
    if (!source) return fail('Ad set unavailable', ErrorCode.NOT_FOUND, { userMessage: t('gone') });
    // Same date rule the page shows: starts tomorrow in the account timezone, last day inclusive.
    const { startDay, lastDay } = planDates(dayIn(zone), plan.days);
    const saved = await savePlan(scope, { source, currency, dailyBudget: plan.dailyBudget, days: plan.days, startDay, endDay: lastDay, expectedVersion: plan.version });
    return ok(saved);
  } catch (error) {
    if (error instanceof PlanConflictError) return fail(error.message, ErrorCode.CONFLICT, { userMessage: t('conflict') });
    if (error instanceof AssistantError) return fail(error.message, ErrorCode.FORBIDDEN, { userMessage: error.status === 409 || error.status === 403 ? t('account') : t('failed') });
    const failure = error as { code?: string; message?: string };
    console.error('Saving ad plan failed', { code: failure?.code, message: failure?.message });
    return fail('Saving ad plan failed', ErrorCode.DATABASE_ERROR, { userMessage: t('failed') });
  }
}

export async function discardPlanAction(adSetId: unknown): Promise<ApiResponse<{ discarded: boolean }>> {
  const t = await getTranslations('rerun.error');
  if (typeof adSetId !== 'string' || !/^\d{1,30}$/.test(adSetId)) return fail('Invalid ad set', ErrorCode.VALIDATION_ERROR, { userMessage: t('failed') });
  const { role } = await getRequiredAppContext();
  if (role !== 'owner' && role !== 'admin') return fail('Forbidden', ErrorCode.FORBIDDEN, { userMessage: t('forbidden') });
  try {
    const scope = await authorizeSelectedMetaAccount();
    return ok({ discarded: await deletePlan(scope, adSetId) });
  } catch (error) {
    if (error instanceof AssistantError) return fail(error.message, ErrorCode.FORBIDDEN, { userMessage: error.status === 409 || error.status === 403 ? t('account') : t('failed') });
    const failure = error as { code?: string; message?: string };
    console.error('Discarding ad plan failed', { code: failure?.code, message: failure?.message });
    return fail('Discarding ad plan failed', ErrorCode.DATABASE_ERROR, { userMessage: t('failed') });
  }
}

/** Whole days 1–90, a budget in range (rounded to cents), and the version being edited (or null). */
function parseInput(input: unknown): { dailyBudget: number; days: number; version: number | null } | null {
  if (!input || typeof input !== 'object') return null;
  const { dailyBudget, days, version } = input as Record<string, unknown>;
  if (typeof dailyBudget !== 'number' || typeof days !== 'number') return null;
  const cents = Math.round(dailyBudget * 100) / 100;
  if (!Number.isFinite(cents) || cents < RERUN_MIN_DAILY || cents > MAX_DAILY_CAMPAIGN_BUDGET || !validDays(days)) return null;
  if (version !== null && version !== undefined && !(typeof version === 'number' && Number.isInteger(version) && version >= 1)) return null;
  return { dailyBudget: cents, days, version: typeof version === 'number' ? version : null };
}
