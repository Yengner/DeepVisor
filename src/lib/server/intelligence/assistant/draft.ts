import 'server-only';
import { createHash } from 'node:crypto';
import { assistantPlanSchema, type AssistantPlan, type AssistantMedia } from '@/lib/shared/assistant/contracts';
import type { CampaignDraftPayload } from '@/lib/shared/types/campaignDrafts';
import { defaults, renderName } from '@/lib/shared/organizer/model';
import { createCampaignDraft, getCampaignDraftById } from '@/lib/server/campaigns/drafts';
import { validateBudget } from '@/lib/server/campaigns/reuse';
import { getCampaignReuseSource } from '@/lib/server/repositories/campaigns/getCampaignReuseSource';
import { AssistantError, authorizeAssistant, type AssistantAccess } from './access';
import { loadCreatives } from './tools';
export function validatePlan(value: unknown) {
    const plan = assistantPlanSchema.parse(value);
    const required = ['concept', 'objective', 'destination', 'budgetType', 'budgetAmount', 'durationDays', 'startAt', 'location', 'radius', 'ageMin', 'ageMax'] as const;
    const missing = required.filter(k => plan[k] === null || plan[k] === '');
    if (missing.length)
        throw new AssistantError(`Complete these draft fields: ${missing.join(', ')}.`);
    if (plan.objective !== 'OUTCOME_LEADS')
        throw new AssistantError('The existing draft builder currently supports lead campaigns only.');
    if (plan.ageMin! > plan.ageMax!)
        throw new AssistantError('Minimum age must not exceed maximum age.');
    if ((plan.latitude === null) !== (plan.longitude === null))
        throw new AssistantError('Supply both coordinates or leave both unset.');
    if (plan.targetMode !== 'new_campaign' && !plan.campaignId)
        throw new AssistantError('Choose an existing campaign.');
    if (plan.targetMode === 'existing_adset' && !plan.adSetId)
        throw new AssistantError('Choose an existing ad set.');
    const start = Date.parse(plan.startAt!);
    if (start < Date.now() - 86400000 || start > Date.now() + 365 * 86400000)
        throw new AssistantError('Choose a current or future start date within one year.');
    return plan;
}
export async function saveAssistantDraft(expected: AssistantAccess, value: unknown, conversationId: string, revision: number, attachments: AssistantMedia[] = []) {
    const scope = await authorizeAssistant(expected.account.id);
    if (scope.businessId !== expected.businessId || scope.userId !== expected.userId)
        throw new AssistantError('Account access changed.', 403);
    const plan = validatePlan(value);
    if (!scope.account.currency_code || !scope.account.timezone)
        throw new AssistantError('Account currency and timezone are required.');
    const { data: profile, error } = await scope.db.from('business_profiles').select('monthly_budget,meta_page_id').eq('id', scope.businessId).maybeSingle();
    if (error || !profile)
        throw new AssistantError('Business preferences could not be verified.', 503);
    validateBudget({ budgetType: plan.budgetType!, budgetAmount: plan.budgetAmount!, durationDays: plan.durationDays!, monthlyBudget: profile.monthly_budget, currencyCode: scope.account.currency_code });
    let campaignName: string | null = null, adSetName: string | null = null;
    if (plan.targetMode !== 'new_campaign') {
        const source = await getCampaignReuseSource(scope.db, { businessId: scope.businessId, adAccountId: scope.account.id, sourceType: plan.targetMode === 'existing_adset' ? 'adset' : 'campaign', sourceCampaignId: plan.campaignId!, sourceAdSetId: plan.targetMode === 'existing_adset' ? plan.adSetId! : undefined, requireCreative: false });
        if (source.campaign.objective !== plan.objective || [source.campaign.status, source.adSet?.status].some(s => s?.toLowerCase().includes('deleted')))
            throw new AssistantError('The selected source is incompatible with this draft.');
        campaignName = source.campaign.name;
        adSetName = source.adSet?.name ?? null;
    }
    const creative = plan.creativeId ? (await loadCreatives(scope)).find(c => c.platform_creative_id === plan.creativeId) : null;
    if (plan.creativeId && !creative)
        throw new AssistantError('That creative is no longer in the available account history.');
    const payload = buildAssistantDraft(plan, { pageId: profile.meta_page_id ?? '', campaignName, adSetName, imageHash: creative?.image_hash ?? '', currency: scope.account.currency_code, timezone: scope.account.timezone });
    payload.form.assistantMedia = attachments;
    const hash = createHash('sha256').update(`${scope.businessId}:${scope.userId}:${conversationId}:${revision}`).digest('hex');
    const id = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
    const fingerprint = createHash('sha256').update(JSON.stringify(plan)).digest('hex');
    const sourceActionId = `assistant:${conversationId}:${revision}:${fingerprint}`;
    const existing = await getCampaignDraftById(scope.db, { businessId: scope.businessId, draftId: id });
    if (existing) {
        if (existing.source_action_id !== sourceActionId || existing.created_by_user_id !== scope.userId || existing.ad_account_id !== scope.account.id)
            throw new AssistantError('This saved draft differs from the current request. Reload first.', 409);
        return existing.id;
    }
    const draft = await createCampaignDraft(scope.db, { draftId: id, businessId: scope.businessId, platformIntegrationId: scope.integration.id, adAccountId: scope.account.id, userId: scope.userId, title: payload.form.campaignName, payloadJson: payload, sourceActionId, reviewNotes: `Customer confirmed assistant draft. Review targeting, placements, destination setup and creative before any future execution. Currency: ${scope.account.currency_code}; timezone: ${scope.account.timezone}. No Meta writes performed. ${plan.latitude === null ? 'Location coordinates remain unresolved. ' : ''}${creative ? '' : 'Creative media still required.'}` });
    return draft.id;
}
export function buildAssistantDraft(plan: AssistantPlan, context: {
    pageId: string;
    campaignName: string | null;
    adSetName: string | null;
    imageHash: string;
    currency: string;
    timezone: string;
}): Extract<CampaignDraftPayload, {
    mode: 'manual';
}> {
    const date = new Intl.DateTimeFormat('en-CA', { timeZone: context.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(plan.startAt!));
    const campaignName = context.campaignName ?? renderName(defaults.campaign, { Objective: plan.objective!, Initiative: plan.concept!, StartDate: date }, defaults);
    const adSetName = context.adSetName ?? renderName(defaults.adset, { Geography: plan.location!, StartDate: date }, defaults);
    const creative = { contentSource: plan.creativeId ? 'existing' : 'upload', existingCreativeIds: plan.creativeId ? [plan.creativeId] : [], imageHash: context.imageHash, adHeadline: plan.headline ?? '', adPrimaryText: plan.primaryText ?? '', adDescription: '', adCallToAction: '' };
    const targeting = { markerPosition: plan.latitude !== null && plan.longitude !== null ? { lat: plan.latitude, lng: plan.longitude } : null, locationLabel: plan.location!, radius: plan.radius!, ageMin: plan.ageMin!, ageMax: plan.ageMax!, genders: plan.genders.map(gender => gender === 'male' ? '1' : '2'), interests: [] };
    const optimizationGoal = plan.destination === 'PHONE_CALL' ? 'QUALITY_CALL' : 'LEAD_GENERATION';
    return { mode: 'manual', form: { initialStatus: 'PAUSED', reviewRequired: true, campaignName, objective: plan.objective!, destinationType: plan.destination!, specialAdCategories: [], bidStrategy: 'LOWEST_COST_WITHOUT_CAP', buyingType: 'AUCTION', budgetAmount: plan.budgetAmount!, budgetType: plan.budgetType!, budgetOptimization: false, startDate: plan.startAt!, endDate: new Date(Date.parse(plan.startAt!) + plan.durationDays! * 86400000).toISOString(), draftTarget: { mode: plan.targetMode, existingCampaignId: plan.targetMode === 'new_campaign' ? null : plan.campaignId, existingAdSetId: plan.targetMode === 'existing_adset' ? plan.adSetId : null }, leadMethod: plan.destination === 'ON_AD' ? 'instant_form' : plan.destination === 'PHONE_CALL' ? 'calls' : 'messages', methodSettings: { instantForm: { formStyle: 'higher_intent', privacyPolicyUrl: '', qualifyingQuestions: [] }, messages: { channel: plan.destination === 'WHATSAPP' ? 'whatsapp' : 'messenger', responseReady: false }, calls: { phoneNumber: '', staffedHoursAcknowledged: false, callWindow: '' } }, adSetName, pageId: context.pageId, optimizationGoal, useAdvantageAudience: false, useAdvantagePlacements: false, billingEvent: 'IMPRESSIONS', targeting, creative } };
}
