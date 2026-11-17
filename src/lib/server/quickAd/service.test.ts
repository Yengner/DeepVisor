import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveFacts, type StoredFact } from '@/lib/shared/agent/facts';

vi.mock('server-only', () => ({}));
const m = vi.hoisted(() => ({
  facts: null as unknown,
  runAi: vi.fn(),
  createDraft: vi.fn(),
}));
vi.mock('@/lib/server/agent/facts', () => ({ loadAdFacts: vi.fn(async () => m.facts) }));
vi.mock('@/lib/server/openai/structured', () => ({ runStructuredAI: m.runAi }));
vi.mock('@/lib/server/campaigns/reuse', () => ({
  createCampaignReuseDraft: m.createDraft,
  CampaignReuseDraftError: class CampaignReuseDraftError extends Error { status = 409; },
}));
vi.mock('@/lib/server/intelligence/assistant/media', () => ({
  MEDIA_BUCKET: 'assistant-draft-media',
  validateMedia: (bytes: Uint8Array, type: string) => { if (type !== 'image/png') throw new Error('Choose a valid file.'); return type; },
}));
import { createQuickAd, QUICK_AD_DAILY_LIMIT, QuickAdError } from './service';

const NOW = new Date().toISOString();
const WELCOME = JSON.stringify({ text_format: { customer_action_type: 'ice_breakers', message: { ice_breakers: [{ title: 'Quiero una cita', response: 'Gracias' }] } } });

function knownFacts(stored: StoredFact[]) {
  return { accountCurrency: 'USD', facts: resolveFacts({ stored, history: { daily_budget: { value: { amountMinor: 2000, currency: 'USD' }, basis: { code: 'latest_ad_set' } }, run_days: { value: { days: 7 }, basis: { code: 'one_scheduled' } } }, accountCurrency: 'USD', now: NOW }), toAsk: [] };
}

/** Fake Supabase: canned rows per table, records storage calls. */
function fakeScope(opts: { used?: number } = {}) {
  const storage = { uploads: [] as string[], removed: [] as string[] };
  const rows: Record<string, unknown> = {
    adset_dims: [
      { id: '1', external_id: 'wa-set', campaign_external_id: 'camp', name: 'WhatsApp set', status: 'paused', created_time: '2026-10-28T00:00:00Z', raw: { destination_type: 'WHATSAPP' } },
      { id: '2', external_id: 'web-set', campaign_external_id: 'camp', name: 'Website set', status: 'active', created_time: '2026-11-01T00:00:00Z', raw: { destination_type: 'WEBSITE' } },
    ],
    ad_entities: [], ad_entity_performance_daily: [],
    ad_dims: { creative_id: 'cr1', created_time: '2026-10-28T00:00:00Z' },
    ad_creatives: { primary_text: 'Texto anterior', headline: 'Citas', object_story_spec: { link_data: { page_welcome_message: WELCOME } } },
    business_profiles: { business_name: 'Salon', location_city: 'Tampa', promoted_services: ['color'], most_valuable_service: 'color' },
  };
  const query = (table: string) => {
    const b: Record<string, unknown> = {};
    for (const op of ['select', 'eq', 'gte', 'in', 'not', 'order', 'limit', 'range']) b[op] = () => b;
    const result = () => ({ data: rows[table] ?? null, error: null, count: table === 'ai_generation_runs' ? opts.used ?? 0 : null });
    b.maybeSingle = () => Promise.resolve(result());
    b.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result()).then(resolve);
    return b;
  };
  const db = {
    from: query,
    schema: () => ({ from: query }),
    storage: { from: () => ({
      upload: async (path: string) => { storage.uploads.push(path); return { error: null }; },
      remove: async (paths: string[]) => { storage.removed.push(...paths); return { error: null }; },
    }) },
  };
  return { storage, scope: { db, businessId: 'biz', userId: 'user', account: { id: 'acct', timezone: 'America/New_York', currency_code: 'USD' }, integration: { id: 'int' } } as never };
}
const input = (over = {}) => ({ file: { bytes: new Uint8Array(20), type: 'image/png', name: 'fall.png' }, note: 'Fall color', request: {}, idempotencyKey: '00000000-0000-4000-8000-000000000001', ...over });

beforeEach(() => {
  m.facts = knownFacts([{ key: 'client_languages', value: { languages: ['es', 'en'] }, confirmedAt: NOW }]);
  m.runAi.mockReset();
  m.createDraft.mockReset();
  m.createDraft.mockResolvedValue({ draftId: 'd1', href: '/campaigns/create?draft=d1', replayed: false });
});

describe('createQuickAd', () => {
  it('asks for missing answers before uploading or calling the model', async () => {
    m.facts = knownFacts([]);
    const { scope, storage } = fakeScope();
    await expect(createQuickAd(scope, input())).rejects.toMatchObject({ code: 'MISSING_FACTS', missing: ['client_languages'] });
    expect(storage.uploads).toEqual([]);
    expect(m.runAi).not.toHaveBeenCalled();
  });

  it('stops at the daily limit before uploading or calling the model', async () => {
    const { scope, storage } = fakeScope({ used: QUICK_AD_DAILY_LIMIT });
    await expect(createQuickAd(scope, input())).rejects.toMatchObject({ code: 'DAILY_LIMIT', status: 429 });
    expect(storage.uploads).toEqual([]);
    expect(m.runAi).not.toHaveBeenCalled();
  });

  it('rejects invalid files and long notes without side effects', async () => {
    const { scope, storage } = fakeScope();
    await expect(createQuickAd(scope, input({ file: { bytes: new Uint8Array(20), type: 'text/html', name: 'x' } }))).rejects.toBeInstanceOf(QuickAdError);
    await expect(createQuickAd(scope, input({ note: 'x'.repeat(301) }))).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    expect(storage.uploads).toEqual([]);
  });

  it('drafts from the WhatsApp ad set with model text and the source welcome setup', async () => {
    m.runAi.mockImplementation(async (args: { validate: (v: unknown) => unknown }) => ({
      output: args.validate({ variants: [
        { language: 'en', primaryText: 'Fresh fall color. Message us to book.', headline: 'Book your color' },
        { language: 'es', primaryText: 'Color de otoño. Escríbenos para reservar.', headline: 'Reserva tu color' },
      ] }),
    }));
    const { scope, storage } = fakeScope();
    const result = await createQuickAd(scope, input());
    expect(result).toMatchObject({ draftId: 'd1', copySource: 'model' });
    expect(storage.uploads).toEqual([expect.stringMatching(/^biz\/acct\/user\/quick\//)]);
    expect(storage.removed).toEqual([]);
    expect(m.runAi).toHaveBeenCalledTimes(1);
    expect(m.runAi.mock.calls[0][0]).toMatchObject({ businessId: 'biz', sourceType: 'quick_ad_copy', input: { ownerNote: 'Fall color' } });
    const draft = m.createDraft.mock.calls[0][1];
    expect(draft.request).toMatchObject({ sourceType: 'adset', sourceCampaignId: 'camp', sourceAdSetId: 'wa-set', budgetType: 'daily', budgetAmount: 20, creativeMode: 'fresh' });
    expect(draft.content.copies.map((c: { language: string }) => c.language)).toEqual(['es', 'en']);
    expect(draft.content.welcome).toEqual({ spec: WELCOME, summary: 'Quiero una cita' });
    expect(Date.parse(draft.request.endAt) - Date.parse(draft.request.startAt)).toBeGreaterThanOrEqual(7 * 86_400_000 - 3_600_000);
  });

  it('falls back to the previous ad text and says so when the model fails', async () => {
    m.runAi.mockImplementation(async (args: { fallback: unknown }) => ({ output: args.fallback }));
    const { scope } = fakeScope();
    const result = await createQuickAd(scope, input());
    expect(result.copySource).toBe('previous_ad');
    const draft = m.createDraft.mock.calls[0][1];
    expect(draft.content.copies).toEqual([{ language: 'es', primaryText: 'Texto anterior', headline: 'Citas' }]);
    expect(draft.content.reviewNote).toContain('copied from your previous ad');
  });

  it('removes the uploaded file when the draft cannot be created', async () => {
    m.runAi.mockImplementation(async (args: { fallback: unknown }) => ({ output: args.fallback }));
    m.createDraft.mockRejectedValue(new Error('db down'));
    const { scope, storage } = fakeScope();
    await expect(createQuickAd(scope, input())).rejects.toThrow('db down');
    expect(storage.removed).toEqual(storage.uploads);
    expect(storage.removed).toHaveLength(1);
  });
});
