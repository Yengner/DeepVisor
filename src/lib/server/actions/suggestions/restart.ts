'use server';
import { getTranslations } from 'next-intl/server';
import { fail, ok, ErrorCode, type ApiResponse } from '@/lib/shared';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import { AssistantError, authorizeSelectedMetaAccount } from '@/lib/server/intelligence/assistant/access';
import { CampaignReuseDraftError, createCampaignReuseDraft } from '@/lib/server/campaigns/reuse';
import { MAX_DAILY_CAMPAIGN_BUDGET } from '@/lib/server/campaigns/budgetGuardrails';
import { sourceDailyBudget } from '@/lib/server/suggestions/idle';
import { findRestartSource } from '@/lib/server/suggestions/rerun';
import { dayIn, quickAdSchedule } from '@/lib/shared/quickAd/plan';
import { RESTART_DAYS } from '@/lib/shared/suggestions/idle';
import { RERUN_MIN_DAILY, validDays } from '@/lib/shared/suggestions/rerun';

/** The owner's choice on the plan page; omitted, last time's daily budget for RESTART_DAYS days. */
export type RestartPlanInput = { dailyBudget: number; days: number };

/**
 * "Run this ad again": a paused, review-required draft that copies the ad set's latest ad exactly
 * (existing Run again flow, creative reused) at the chosen daily budget for the chosen days,
 * starting tomorrow. Owners/admins only; the ad set must belong to the session's selected account.
 * Budget and days are checked again here; the draft builder applies the monthly limit. Nothing is
 * published or sent to Meta.
 */
export async function prepareRestartDraftAction(adSetId: unknown, plan?: unknown): Promise<ApiResponse<{ href: string }>> {
  const t = await getTranslations('suggestion.error');
  const chosen = parsePlan(plan);
  if (chosen === 'invalid') return fail('Invalid plan', ErrorCode.VALIDATION_ERROR, { userMessage: t('failed') });
  const { role } = await getRequiredAppContext();
  if (role !== 'owner' && role !== 'admin') return fail('Forbidden', ErrorCode.FORBIDDEN, { userMessage: t('forbidden') });
  try {
    const scope = await authorizeSelectedMetaAccount();
    const zone = scope.account.timezone;
    if (!zone) return fail('No timezone', ErrorCode.VALIDATION_ERROR, { userMessage: t('failed') });
    const source = await findRestartSource(scope, adSetId);
    if (!source) return fail('Ad set unavailable', ErrorCode.NOT_FOUND, { userMessage: t('gone') });
    const budget = chosen?.dailyBudget ?? await sourceDailyBudget(scope.db, scope.account.id, source.adSetId, source.campaignId, scope.account.currency_code);
    if (budget === null) return fail('No daily budget', ErrorCode.VALIDATION_ERROR, { userMessage: t('noBudget') });
    const days = chosen?.days ?? RESTART_DAYS;
    const today = dayIn(zone);
    const schedule = quickAdSchedule({ today, zone, days });
    const result = await createCampaignReuseDraft(scope.db, {
      businessId: scope.businessId, platformIntegrationId: scope.integration.id, adAccountId: scope.account.id, userId: scope.userId,
      currencyCode: scope.account.currency_code, timezone: zone,
      request: {
        sourceType: 'ad', sourceCampaignId: source.campaignId, sourceAdSetId: source.adSetId, sourceAdId: source.sourceAdId,
        budgetType: 'daily', budgetAmount: budget, startAt: schedule.startAt, endAt: schedule.endAt,
        // The same plan on the same day opens the same draft; a different plan makes a new one.
        creativeMode: 'reuse', idempotencyKey: `idle-restart:${source.adSetId}:${today}:${budget}:${days}`,
      },
    });
    return ok({ href: result.href });
  } catch (error) {
    // "Select your ad account" only when that is the actual problem (none selected, or not a usable Meta account).
    if (error instanceof AssistantError) return fail(error.message, ErrorCode.FORBIDDEN, { userMessage: error.status === 409 || error.status === 403 ? t('account') : t('failed') });
    // Builder refusals (e.g. above the saved monthly budget) are English-only; the plan page shows
    // the limit before this point, so a refusal here gets the general message.
    if (error instanceof CampaignReuseDraftError) return fail(error.message, ErrorCode.VALIDATION_ERROR, { userMessage: t('failed') });
    console.error('Restart draft failed', { code: (error as { code?: string })?.code });
    return fail('Restart draft failed', ErrorCode.DATABASE_ERROR, { userMessage: t('failed') });
  }
}

/** Undefined: use last time's plan. Otherwise a whole number of days and a budget in range, in cents. */
function parsePlan(plan: unknown): RestartPlanInput | undefined | 'invalid' {
  if (plan === undefined || plan === null) return undefined;
  if (typeof plan !== 'object') return 'invalid';
  const { dailyBudget, days } = plan as Record<string, unknown>;
  if (typeof dailyBudget !== 'number' || typeof days !== 'number') return 'invalid';
  const cents = Math.round(dailyBudget * 100) / 100;
  if (!Number.isFinite(cents) || cents < RERUN_MIN_DAILY || cents > MAX_DAILY_CAMPAIGN_BUDGET || !validDays(days)) return 'invalid';
  return { dailyBudget: cents, days };
}
