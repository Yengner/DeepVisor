'use server';
import { getTranslations } from 'next-intl/server';
import { fail, ok, ErrorCode, type ApiResponse } from '@/lib/shared';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import { AssistantError, authorizeSelectedMetaAccount } from '@/lib/server/intelligence/assistant/access';
import { CampaignReuseDraftError, createCampaignReuseDraft } from '@/lib/server/campaigns/reuse';
import { sourceDailyBudget } from '@/lib/server/suggestions/idle';
import { dayIn, quickAdSchedule } from '@/lib/shared/quickAd/plan';
import { RESTART_DAYS } from '@/lib/shared/suggestions/idle';

const META_ID = /^\d{1,30}$/;

/**
 * "Run your best ad again" from the ads-off suggestion: a paused, review-required draft that
 * copies the ad set's latest ad exactly (existing Run again flow, creative reused) at the same
 * daily budget for 7 days from tomorrow. Owners/admins only; the ad set must belong to the
 * session's selected account. Nothing is published or sent to Meta.
 */
export async function prepareRestartDraftAction(adSetId: unknown): Promise<ApiResponse<{ href: string }>> {
  const t = await getTranslations('suggestion.error');
  if (typeof adSetId !== 'string' || !META_ID.test(adSetId)) return fail('Invalid ad set', ErrorCode.VALIDATION_ERROR, { userMessage: t('failed') });
  const { role } = await getRequiredAppContext();
  if (role !== 'owner' && role !== 'admin') return fail('Forbidden', ErrorCode.FORBIDDEN, { userMessage: t('forbidden') });
  try {
    const scope = await authorizeSelectedMetaAccount();
    const zone = scope.account.timezone;
    if (!zone) return fail('No timezone', ErrorCode.VALIDATION_ERROR, { userMessage: t('failed') });
    const { data: adSet, error } = await scope.db.from('adset_dims').select('external_id, campaign_external_id, status')
      .eq('ad_account_id', scope.account.id).eq('external_id', adSetId).maybeSingle();
    if (error) throw error;
    if (!adSet?.campaign_external_id || /deleted|archived/i.test(adSet.status ?? '')) return fail('Ad set unavailable', ErrorCode.NOT_FOUND, { userMessage: t('gone') });
    const { data: ad, error: adError } = await scope.db.from('ad_dims').select('external_id, status')
      .eq('ad_account_id', scope.account.id).eq('adset_external_id', adSetId).not('external_id', 'is', null)
      .order('created_time', { ascending: false, nullsFirst: false }).limit(5);
    if (adError) throw adError;
    const source = ad?.find(a => !/deleted|archived/i.test(a.status ?? ''));
    if (!source?.external_id) return fail('No ad to copy', ErrorCode.NOT_FOUND, { userMessage: t('gone') });
    const budget = await sourceDailyBudget(scope.db, scope.account.id, adSetId, adSet.campaign_external_id, scope.account.currency_code);
    if (budget === null) return fail('No daily budget', ErrorCode.VALIDATION_ERROR, { userMessage: t('noBudget') });
    const today = dayIn(zone);
    const schedule = quickAdSchedule({ today, zone, days: RESTART_DAYS });
    const result = await createCampaignReuseDraft(scope.db, {
      businessId: scope.businessId, platformIntegrationId: scope.integration.id, adAccountId: scope.account.id, userId: scope.userId,
      currencyCode: scope.account.currency_code, timezone: zone,
      request: {
        sourceType: 'ad', sourceCampaignId: adSet.campaign_external_id, sourceAdSetId: adSetId, sourceAdId: source.external_id,
        budgetType: 'daily', budgetAmount: budget, startAt: schedule.startAt, endAt: schedule.endAt,
        creativeMode: 'reuse', idempotencyKey: `idle-restart:${adSetId}:${today}`,
      },
    });
    return ok({ href: result.href });
  } catch (error) {
    // "Select your ad account" only when that is the actual problem (none selected, or not a usable Meta account).
    if (error instanceof AssistantError) return fail(error.message, ErrorCode.FORBIDDEN, { userMessage: error.status === 409 || error.status === 403 ? t('account') : t('failed') });
    if (error instanceof CampaignReuseDraftError) return fail(error.message, ErrorCode.VALIDATION_ERROR, { userMessage: t('failed') });
    console.error('Restart draft failed', { code: (error as { code?: string })?.code });
    return fail('Restart draft failed', ErrorCode.DATABASE_ERROR, { userMessage: t('failed') });
  }
}
