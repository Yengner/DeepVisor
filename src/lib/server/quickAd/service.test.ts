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
  // The fake "file" says what it really is in its first byte: 1 = PNG, 2 = MP4.
  verifiedMediaType: (bytes: Uint8Array) => (bytes[0] === 1 ? 'image/png' : bytes[0] === 2 ? 'video/mp4' : null),
}));
import { createQuickAd, prepareQuickAdUpload, QUICK_AD_DAILY_LIMIT } from './service';

const MB = 1024 * 1024;
const MEDIA_ID = '00000000-0000-4000-8000-0000000000aa';
const PNG = { kind: 1, size: 2 * MB };

const NOW = new Date().toISOString();
const WELCOME = JSON.stringify({ text_format: { customer_action_type: 'ice_breakers', message: { ice_breakers: [{ title: 'Quiero una cita', response: 'Gracias' }] } } });

function knownFacts(stored: StoredFact[]) {
  return { accountCurrency: 'USD', facts: resolveFacts({ stored, history: { daily_budget: { value: { amountMinor: 2000, currency: 'USD' }, basis: { code: 'latest_ad_set' } }, run_days: { value: { days: 7 }, basis: { code: 'one_scheduled' } } }, accountCurrency: 'USD', now: NOW }), toAsk: [] };
}

/** Fake Supabase: canned rows per table, records storage calls. */
function fakeScope(opts: { used?: number; stored?: { kind: number; size: number } | null } = {}) {
  const storage = { links: [] as string[], downloads: [] as string[], removed: [] as string[] };
  const stored = opts.stored === undefined ? PNG : opts.stored;
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
      createSignedUploadUrl: async (path: string) => { storage.links.push(path); return { data: { path, token: 'tok' }, error: null }; },
      download: async (path: string) => {
        storage.downloads.push(path);
        if (!stored) return { data: null, error: { message: 'Object not found' } };
        const blob = { size: stored.size, slice: () => ({ arrayBuffer: async () => Uint8Array.from([stored.kind]).buffer }) };
        return { data: blob, error: null };
      },
      remove: async (paths: string[]) => { storage.removed.push(...paths); return { error: null }; },
    }) },
  };
  return { storage, scope: { db, businessId: 'biz', userId: 'user', account: { id: 'acct', timezone: 'America/New_York', currency_code: 'USD' }, integration: { id: 'int' } } as never };
}
const input = (over = {}) => ({ media: { id: MEDIA_ID, type: 'image/png', name: 'fall.png' }, note: 'Fall color', request: {}, idempotencyKey: '00000000-0000-4000-8000-000000000001', ...over });
const PATH = `biz/acct/user/quick/${MEDIA_ID}`;

beforeEach(() => {
  m.facts = knownFacts([{ key: 'client_languages', value: { languages: ['es', 'en'] }, confirmedAt: NOW }]);
  m.runAi.mockReset();
  m.createDraft.mockReset();
  m.createDraft.mockResolvedValue({ draftId: 'd1', href: '/campaigns/create?draft=d1', replayed: false });
});

describe('prepareQuickAdUpload', () => {
  it('gives a one-time upload link inside the signed-in scope for photos up to 30 MB and videos up to 50 MB', async () => {
    const { scope, storage } = fakeScope();
    const photo = await prepareQuickAdUpload(scope, { type: 'image/jpeg', size: 30 * MB, request: {} });
    expect(photo).toMatchObject({ bucket: 'assistant-draft-media', token: 'tok' });
    expect(photo.path).toBe(`biz/acct/user/quick/${photo.mediaId}`);
    await prepareQuickAdUpload(scope, { type: 'video/mp4', size: 50 * MB, request: {} });
    expect(storage.links).toHaveLength(2);
  });

  it('refuses files over the limit or of other types before making a link', async () => {
    const { scope, storage } = fakeScope();
    await expect(prepareQuickAdUpload(scope, { type: 'image/png', size: 30 * MB + 1, request: {} })).rejects.toMatchObject({ code: 'TOO_LARGE', status: 413 });
    await expect(prepareQuickAdUpload(scope, { type: 'video/mp4', size: 50 * MB + 1, request: {} })).rejects.toMatchObject({ code: 'TOO_LARGE' });
    await expect(prepareQuickAdUpload(scope, { type: 'text/html', size: 10, request: {} })).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    expect(storage.links).toEqual([]);
  });

  it('asks for missing answers or stops at the daily limit before any upload', async () => {
    m.facts = knownFacts([]);
    const missing = fakeScope();
    await expect(prepareQuickAdUpload(missing.scope, { type: 'image/png', size: MB, request: {} })).rejects.toMatchObject({ code: 'MISSING_FACTS', missing: ['client_languages'] });
    expect(missing.storage.links).toEqual([]);
    m.facts = knownFacts([{ key: 'client_languages', value: { languages: ['es', 'en'] }, confirmedAt: NOW }]);
    const limited = fakeScope({ used: QUICK_AD_DAILY_LIMIT });
    await expect(prepareQuickAdUpload(limited.scope, { type: 'image/png', size: MB, request: {} })).rejects.toMatchObject({ code: 'DAILY_LIMIT', status: 429 });
    expect(limited.storage.links).toEqual([]);
  });
});

describe('createQuickAd', () => {
  it('asks for missing answers and removes the upload without calling the model', async () => {
    m.facts = knownFacts([]);
    const { scope, storage } = fakeScope();
    await expect(createQuickAd(scope, input())).rejects.toMatchObject({ code: 'MISSING_FACTS', missing: ['client_languages'] });
    expect(storage.removed).toEqual([PATH]);
    expect(m.runAi).not.toHaveBeenCalled();
  });

  it('stops at the daily limit and removes the upload without calling the model', async () => {
    const { scope, storage } = fakeScope({ used: QUICK_AD_DAILY_LIMIT });
    await expect(createQuickAd(scope, input())).rejects.toMatchObject({ code: 'DAILY_LIMIT', status: 429 });
    expect(storage.removed).toEqual([PATH]);
    expect(m.runAi).not.toHaveBeenCalled();
  });

  it('checks the stored file itself: real type, size for its type, and that it exists', async () => {
    const disguised = fakeScope({ stored: { kind: 2, size: MB } }); // an MP4 sent as image/png
    await expect(createQuickAd(disguised.scope, input())).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    expect(disguised.storage.removed).toEqual([PATH]);

    const bigPhoto = fakeScope({ stored: { kind: 1, size: 30 * MB + 1 } });
    await expect(createQuickAd(bigPhoto.scope, input())).rejects.toMatchObject({ code: 'TOO_LARGE' });
    expect(bigPhoto.storage.removed).toEqual([PATH]);

    const missingFile = fakeScope({ stored: null });
    await expect(createQuickAd(missingFile.scope, input())).rejects.toMatchObject({ code: 'UPLOAD_MISSING' });
    expect(m.runAi).not.toHaveBeenCalled();
    expect(m.createDraft).not.toHaveBeenCalled();
  });

  it('accepts a 45 MB video', async () => {
    m.runAi.mockImplementation(async (args: { fallback: unknown }) => ({ output: args.fallback }));
    const { scope, storage } = fakeScope({ stored: { kind: 2, size: 45 * MB } });
    await createQuickAd(scope, input({ media: { id: MEDIA_ID, type: 'video/mp4', name: 'promo.mp4' } }));
    expect(m.createDraft.mock.calls[0][1].content.media).toEqual([{ id: MEDIA_ID, name: 'promo.mp4', mime: 'video/mp4', path: PATH }]);
    expect(storage.removed).toEqual([]);
  });

  it('rejects long notes and removes the upload', async () => {
    const { scope, storage } = fakeScope();
    await expect(createQuickAd(scope, input({ note: 'x'.repeat(301) }))).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    expect(storage.removed).toEqual([PATH]);
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
    expect(storage.downloads).toEqual([PATH]);
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
    expect(storage.removed).toEqual([PATH]);
  });
});
