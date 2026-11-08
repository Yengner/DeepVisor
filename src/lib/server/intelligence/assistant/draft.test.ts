import { it, expect, vi, afterEach } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('./access', () => ({ AssistantError: class extends Error {
    }, authorizeAssistant: vi.fn() }));
vi.mock('./tools', () => ({ loadCreatives: vi.fn() }));
vi.mock('@/lib/server/campaigns/drafts', () => ({ createCampaignDraft: vi.fn(), getCampaignDraftById: vi.fn() }));
import { validatePlan, buildAssistantDraft, saveAssistantDraft } from './draft';
import { authorizeAssistant } from './access';
import { createCampaignDraft, getCampaignDraftById } from '@/lib/server/campaigns/drafts';
import type { AssistantPlan } from '@/lib/shared/assistant/contracts';
const plan: AssistantPlan = { concept: 'Hair consultation', objective: 'OUTCOME_LEADS', destination: 'MESSENGER', budgetType: 'lifetime', budgetAmount: 150, durationDays: 7, startAt: '2026-11-05T20:00:00-05:00', location: 'New York', latitude: null, longitude: null, radius: 5, ageMin: 25, ageMax: 65, genders: [], creativeId: null, headline: 'Book a consultation', primaryText: null, targetMode: 'new_campaign', campaignId: null, adSetId: null };
afterEach(() => vi.useRealTimers());
it('requires explicit fields, a valid age range and source hierarchy', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-04T00:00:00Z'));
    expect(validatePlan(plan)).toEqual(plan);
    expect(() => validatePlan({ ...plan, budgetAmount: null })).toThrow('budgetAmount');
    expect(() => validatePlan({ ...plan, ageMin: 65, ageMax: 25 })).toThrow('age');
    expect(() => validatePlan({ ...plan, targetMode: 'existing_adset' })).toThrow('campaign');
    expect(() => validatePlan({ ...plan, objective: 'OUTCOME_ENGAGEMENT' })).toThrow('lead campaigns');
});
it('reuses deterministic naming, preserves lifetime budgets, and always creates a paused review draft', () => {
    const draft = buildAssistantDraft(plan, { pageId: 'page', campaignName: null, adSetName: null, imageHash: '', currency: 'USD', timezone: 'America/New_York' });
    expect(draft.form).toMatchObject({ initialStatus: 'PAUSED', reviewRequired: true, budgetAmount: 150, budgetType: 'lifetime', campaignName: 'OUTCOME_LEADS | Hair consultation | 2026-11-05' });
    expect(draft.form.targeting.markerPosition).toBeNull();
    expect(draft.form.creative.existingCreativeIds).toEqual([]);
    expect(draft.form.endDate).toBe('2026-11-13T01:00:00.000Z');
});
it('preserves WhatsApp destination and does not assert contact readiness', () => {
    const draft = buildAssistantDraft({ ...plan, destination: 'WHATSAPP', genders: ['female'] }, { pageId: 'page', campaignName: null, adSetName: null, imageHash: '', currency: 'USD', timezone: 'America/New_York' });
    expect(draft.form.methodSettings?.messages).toEqual({ channel: 'whatsapp', responseReady: false });
    expect(draft.form.targeting.genders).toEqual(['2']);
});
it('saves through the existing repository and replays a lost response without creating a second draft', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-04T00:00:00Z'));
    const query = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data: { monthly_budget: '500_1000', meta_page_id: 'page' }, error: null }) };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    const scope = { businessId: 'business', userId: 'user', account: { id: 'account', currency_code: 'USD', timezone: 'America/New_York' }, integration: { id: 'integration' }, db: { from: vi.fn(() => query) } };
    vi.mocked(authorizeAssistant).mockResolvedValue(scope as never);
    vi.mocked(getCampaignDraftById).mockResolvedValue(null);
    vi.mocked(createCampaignDraft).mockResolvedValue({ id: 'saved' } as never);
    expect(await saveAssistantDraft(scope as never, plan, 'conversation', 1)).toBe('saved');
    const input = vi.mocked(createCampaignDraft).mock.calls.at(-1)![1];
    expect(input).toMatchObject({ businessId: 'business', adAccountId: 'account', userId: 'user', payloadJson: { mode: 'manual', form: { initialStatus: 'PAUSED', reviewRequired: true } } });
    vi.mocked(getCampaignDraftById).mockResolvedValue({ id: 'saved', source_action_id: input.sourceActionId, created_by_user_id: 'user', ad_account_id: 'account' } as never);
    expect(await saveAssistantDraft(scope as never, plan, 'conversation', 1)).toBe('saved');
    expect(createCampaignDraft).toHaveBeenCalledTimes(1);
    await expect(saveAssistantDraft(scope as never, { ...plan, budgetAmount: 100 }, 'conversation', 1)).rejects.toThrow('differs');
});
