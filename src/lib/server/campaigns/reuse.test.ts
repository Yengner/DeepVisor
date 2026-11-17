import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CampaignDraftPayload } from '@/lib/shared/types/campaignDrafts';

vi.mock('server-only', () => ({}));
const m = vi.hoisted(() => ({ saved: [] as Array<{ title: string; payloadJson: CampaignDraftPayload; reviewNotes: string }> }));
vi.mock('./drafts', () => ({
  createCampaignDraft: vi.fn(async (_db: unknown, input: { draftId: string; title: string; payloadJson: CampaignDraftPayload; reviewNotes: string }) => {
    m.saved.push(input);
    return { id: input.draftId };
  }),
}));
vi.mock('@/lib/server/repositories/campaigns/getCampaignReuseSource', () => ({
  CampaignReuseSourceLookupError: class extends Error {},
  getCampaignReuseSource: vi.fn(async () => ({
    campaign: { id: 'c-row', external_id: 'camp', name: 'Salon leads', objective: 'OUTCOME_LEADS', status: 'paused', raw: { objective: 'OUTCOME_LEADS' } },
    adSet: {
      id: 's-row', external_id: 'set', campaign_external_id: 'camp', name: 'WhatsApp set', optimization_goal: 'CONVERSATIONS', status: 'paused',
      raw: { destination_type: 'WHATSAPP', optimization_goal: 'CONVERSATIONS', billing_event: 'IMPRESSIONS', promoted_object: { page_id: 'page-1' },
        targeting: { geo_locations: { custom_locations: [{ latitude: 28, longitude: -82.4, radius: 15, distance_unit: 'mile' }] }, age_min: 25, age_max: 55 } },
    },
    ad: null,
    creative: null,
  })),
}));
import { createCampaignReuseDraft } from './reuse';

const db = {
  from: () => {
    const b: Record<string, unknown> = {};
    for (const op of ['select', 'eq']) b[op] = () => b;
    b.maybeSingle = async () => ({ data: null, error: null });
    return b;
  },
} as never;
const start = new Date(Date.now() + 86_400_000);
const request = {
  sourceType: 'adset' as const, sourceCampaignId: 'camp', sourceAdSetId: 'set', budgetType: 'daily' as const, budgetAmount: 20,
  startAt: start.toISOString(), endAt: new Date(start.getTime() + 7 * 86_400_000).toISOString(), creativeMode: 'fresh' as const,
  idempotencyKey: '00000000-0000-4000-8000-000000000009',
};
const base = { businessId: 'biz', platformIntegrationId: 'int', adAccountId: 'acct', userId: 'u', currencyCode: 'USD', timezone: 'America/New_York' };
const form = () => {
  const payload = m.saved[0].payloadJson;
  if (payload.mode !== 'manual') throw new Error('expected manual');
  return payload.form;
};

beforeEach(() => { m.saved = []; });

describe('createCampaignReuseDraft', () => {
  it('keeps the original run-again draft when no content is given', async () => {
    await createCampaignReuseDraft(db, { ...base, request });
    expect(m.saved[0].title).toBe('Run again: WhatsApp set');
    expect(form()).toMatchObject({ initialStatus: 'PAUSED', reviewRequired: true, destinationType: 'WHATSAPP', budgetAmount: 20, optimizationGoal: 'CONVERSATIONS' });
    expect(form().adSets?.[0].creatives).toHaveLength(1);
    expect(form().assistantMedia).toBeUndefined();
    expect(form().methodSettings?.messages.greetingText).toBeUndefined();
  });

  it('builds one creative per language with media and the exact welcome setup', async () => {
    const media = [{ id: 'm1', name: 'fall.png', mime: 'image/png', path: 'biz/acct/u/quick/m1' }];
    await createCampaignReuseDraft(db, {
      ...base, request,
      content: {
        title: 'Quick ad',
        copies: [
          { language: 'es', primaryText: 'Escríbenos para reservar.', headline: 'Reserva' },
          { language: 'en', primaryText: 'Message us to book.', headline: 'Book now' },
        ],
        media,
        welcome: { spec: '{"text_format":{}}', summary: 'Quiero una cita' },
        reviewNote: 'Quick ad from "WhatsApp set".',
      },
    });
    expect(m.saved[0].title).toBe('Quick ad: WhatsApp set');
    expect(m.saved[0].reviewNotes).toMatch(/^Quick ad from "WhatsApp set"\. .*PAUSED/);
    expect(form().campaignName).toBe('Salon leads - Quick ad');
    expect(form().assistantMedia).toEqual(media);
    expect(form().adSets?.[0].creatives.map(c => [c.role, c.language, c.adHeadline, c.uploadedFileNames])).toEqual([
      ['primary', 'es', 'Reserva', ['fall.png']],
      ['challenger', 'en', 'Book now', ['fall.png']],
    ]);
    expect(form().creative.adPrimaryText).toBe('Escríbenos para reservar.');
    expect(form().methodSettings?.messages).toMatchObject({ channel: 'whatsapp', greetingText: 'Quiero una cita', welcomeMessageSpec: '{"text_format":{}}' });
    expect(form().initialStatus).toBe('PAUSED');
  });

  it('uses an owner greeting without inventing a Meta setup', async () => {
    await createCampaignReuseDraft(db, { ...base, request, content: { title: 'Quick ad', copies: [], media: [], welcome: { spec: null, summary: 'Hola' }, reviewNote: 'x' } });
    expect(form().methodSettings?.messages.greetingText).toBe('Hola');
    expect(form().methodSettings?.messages.welcomeMessageSpec).toBeUndefined();
    expect(form().adSets?.[0].creatives).toHaveLength(1);
  });
});
