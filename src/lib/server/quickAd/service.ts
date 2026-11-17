import 'server-only';
import { randomUUID } from 'node:crypto';
import { loadAdFacts, type AdFactsView } from '@/lib/server/agent/facts';
import { createCampaignReuseDraft, CampaignReuseDraftError } from '@/lib/server/campaigns/reuse';
import type { AssistantAccess } from '@/lib/server/intelligence/assistant/access';
import { MEDIA_BUCKET, validateMedia } from '@/lib/server/intelligence/assistant/media';
import { runStructuredAI } from '@/lib/server/openai/structured';
import { allPages } from '@/lib/server/repositories/pagination';
import type { FactKey } from '@/lib/shared/agent/facts';
import { resultChannel } from '@/lib/shared/performance/resultChannel';
import { COPY_JSON_SCHEMA, COPY_SYSTEM_PROMPT, fallbackCopy, validateCopy, type CopyResult } from '@/lib/shared/quickAd/copy';
import { budgetMajor, chooseSourceAdSet, dayIn, localMidnightUtc, planQuickAd, quickAdSchedule, type QuickAdPlan, type QuickAdRequest, type SourceChoice } from '@/lib/shared/quickAd/plan';
import { parseWelcomeMessage, welcomeSpecFromStory, type WelcomeMessage } from '@/lib/shared/quickAd/welcome';

/**
 * Quick ad: a paused, review-required draft from an uploaded creative, reusing the business's
 * best messaging ad set. One cheap structured model call writes the ad text; everything else
 * is deterministic. Never publishes or changes anything in Meta.
 */
export const QUICK_AD_DAILY_LIMIT = 10;
export const QUICK_AD_SOURCE_TYPE = 'quick_ad_copy';
const PROMPT_VERSION = 'quick-ad-copy-v1';
const MAX_NOTE = 300;
/** Review notes are stored in the draft for the draft builder, which is English for now. */
const REASON_NOTE: Record<SourceChoice['reason'], string> = {
  cheapest: 'lowest cost per conversation in the last 90 days',
  recent: 'your most recent messaging ad set',
};

export class QuickAdError extends Error {
  constructor(message: string, readonly status: number, readonly code: 'NO_SOURCE' | 'MISSING_FACTS' | 'DAILY_LIMIT' | 'INVALID_INPUT' | 'UNAVAILABLE', readonly missing: FactKey[] = []) {
    super(message);
  }
}

type Scope = Pick<AssistantAccess, 'db' | 'businessId' | 'userId' | 'account' | 'integration'>;

export type QuickAdContext = {
  facts: AdFactsView;
  source: SourceChoice | null;
  welcome: WelcomeMessage | null;
  previousAd: { primaryText: string | null; headline: string | null } | null;
  plan: QuickAdPlan;
  remainingToday: number;
  timezone: string;
};

function accountZone(scope: Scope) {
  const zone = scope.account.timezone;
  if (!zone) throw new QuickAdError('Account timezone is required.', 409, 'UNAVAILABLE');
  return zone;
}

/** Messaging ad sets from the same table the reuse flow reads, with 90-day saved totals. */
async function sourceCandidates(scope: Scope, today: string) {
  const adSets = await allPages((from, to) => scope.db.from('adset_dims')
    .select('id, external_id, campaign_external_id, name, status, created_time, raw')
    .eq('ad_account_id', scope.account.id).order('id').range(from, to));
  const entities = await allPages((from, to) => scope.db.from('ad_entities')
    .select('id, external_id').eq('business_id', scope.businessId).eq('ad_account_id', scope.account.id)
    .eq('entity_level', 'adset').order('id').range(from, to));
  const since = new Date(Date.parse(`${today}T12:00:00Z`) - 89 * 86_400_000).toISOString().slice(0, 10);
  const rows = await allPages((from, to) => scope.db.from('ad_entity_performance_daily')
    .select('entity_id, spend, leads, messages, calls').eq('ad_account_id', scope.account.id)
    .eq('entity_level', 'adset').gte('day', since).order('entity_id').order('day').range(from, to));
  const external = new Map(entities.map(e => [e.id, e.external_id]));
  const totals = new Map<string, { spend: number | null; results: number | null }>();
  for (const row of rows) {
    const id = external.get(row.entity_id);
    if (!id) continue;
    const t = totals.get(id) ?? { spend: 0, results: 0 };
    const add = (a: number | null, b: number | null) => (a === null || b === null ? null : a + b);
    const results = [row.leads, row.messages, row.calls].every(v => typeof v === 'number') ? row.leads! + row.messages! + row.calls! : null;
    totals.set(id, { spend: add(t.spend, row.spend), results: add(t.results, results) });
  }
  return adSets.flatMap(a => {
    if (!a.external_id || !a.campaign_external_id) return [];
    const raw = a.raw && typeof a.raw === 'object' ? a.raw as Record<string, unknown> : {};
    const t = totals.get(a.external_id);
    return [{
      adSetId: a.external_id, campaignId: a.campaign_external_id, name: a.name ?? 'Ad set',
      destinationType: typeof raw.destination_type === 'string' ? raw.destination_type : null,
      status: a.status, createdTime: a.created_time, spend: t?.spend ?? null, results: t?.results ?? null,
    }];
  });
}

/** The source ad set's most recent ad: its text and WhatsApp welcome setup. */
async function sourceCreative(scope: Scope, adSetId: string) {
  const { data: ad, error } = await scope.db.from('ad_dims').select('creative_id, created_time')
    .eq('ad_account_id', scope.account.id).eq('adset_external_id', adSetId)
    .not('creative_id', 'is', null).order('created_time', { ascending: false, nullsFirst: false }).limit(1).maybeSingle();
  if (error) throw error;
  if (!ad?.creative_id) return { previousAd: null, welcome: null };
  const { data: creative, error: creativeError } = await scope.db.from('ad_creatives')
    .select('primary_text, headline, object_story_spec')
    .eq('business_id', scope.businessId).eq('ad_account_id', scope.account.id).eq('platform_creative_id', ad.creative_id).maybeSingle();
  if (creativeError) throw creativeError;
  if (!creative) return { previousAd: null, welcome: null };
  return {
    previousAd: { primaryText: creative.primary_text, headline: creative.headline },
    welcome: parseWelcomeMessage(welcomeSpecFromStory(creative.object_story_spec)),
  };
}

async function usedToday(scope: Scope, zone: string, today: string) {
  const { count, error } = await scope.db.schema('ai').from('ai_generation_runs')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', scope.businessId).eq('source_type', QUICK_AD_SOURCE_TYPE)
    .gte('created_at', localMidnightUtc(today, zone).toISOString());
  if (error) throw error;
  return count ?? 0;
}

export async function loadQuickAdContext(scope: Scope, request: QuickAdRequest = {}): Promise<QuickAdContext> {
  const zone = accountZone(scope);
  const today = dayIn(zone);
  const [facts, candidates, used] = await Promise.all([
    loadAdFacts(scope.db, { businessId: scope.businessId, adAccountId: scope.account.id }),
    sourceCandidates(scope, today),
    usedToday(scope, zone, today),
  ]);
  const source = chooseSourceAdSet(candidates);
  const { previousAd, welcome } = source ? await sourceCreative(scope, source.adSetId) : { previousAd: null, welcome: null };
  const needsGreeting = source !== null && resultChannel(source.destinationType) === 'whatsapp' && welcome === null;
  const plan = planQuickAd({ facts: facts.facts, request, accountCurrency: facts.accountCurrency, needsGreeting });
  return { facts, source, welcome, previousAd, plan, remainingToday: Math.max(0, QUICK_AD_DAILY_LIMIT - used), timezone: zone };
}

/** Review-safe view of the plan for the page: no raw Meta setup or internal ids. */
export function quickAdSummary(context: QuickAdContext) {
  const { plan, source, welcome } = context;
  return {
    source: source ? { name: source.name, reason: source.reason } : null,
    dailyBudget: plan.dailyBudget ? { amount: budgetMajor(plan.dailyBudget), currency: plan.dailyBudget.currency, source: plan.dailyBudget.source } : null,
    days: plan.days,
    languages: plan.languages,
    missing: plan.missing,
    overMonthlyLimit: plan.overMonthlyLimit,
    welcome: welcome
      ? { kind: welcome.kind, clientMessage: welcome.clientMessage, autoReply: welcome.autoReply, fromAd: true }
      : plan.greeting ? { kind: 'autofill' as const, clientMessage: plan.greeting, autoReply: null, fromAd: false } : null,
    remainingToday: context.remainingToday,
    limit: QUICK_AD_DAILY_LIMIT,
  };
}
export type QuickAdSummary = ReturnType<typeof quickAdSummary>;

export type QuickAdInput = {
  file: { bytes: Uint8Array; type: string; name: string };
  note: string;
  request: QuickAdRequest;
  idempotencyKey: string;
};

export async function createQuickAd(scope: Scope, input: QuickAdInput) {
  const note = input.note.trim();
  if (note.length > MAX_NOTE) throw new QuickAdError(`Keep the note under ${MAX_NOTE} characters.`, 400, 'INVALID_INPUT');
  let mime: string;
  try { mime = validateMedia(input.file.bytes, input.file.type); }
  catch (error) { throw new QuickAdError((error as Error).message, 400, 'INVALID_INPUT'); }

  const context = await loadQuickAdContext(scope, input.request);
  const { source, plan } = context;
  if (!source) throw new QuickAdError('No messaging ad set to start from yet. Create your first ad in Campaigns.', 409, 'NO_SOURCE');
  if (plan.missing.length || !plan.dailyBudget || !plan.days || !plan.languages) {
    throw new QuickAdError('A few answers are needed first.', 409, 'MISSING_FACTS', plan.missing);
  }
  if (context.remainingToday <= 0) throw new QuickAdError(`You can make up to ${QUICK_AD_DAILY_LIMIT} quick ads a day. Try again tomorrow.`, 429, 'DAILY_LIMIT');

  const mediaId = randomUUID();
  const path = `${scope.businessId}/${scope.account.id}/${scope.userId}/quick/${mediaId}`;
  const { error: uploadError } = await scope.db.storage.from(MEDIA_BUCKET).upload(path, input.file.bytes, { contentType: mime, upsert: false });
  if (uploadError) throw new QuickAdError('Private media storage is unavailable.', 503, 'UNAVAILABLE');

  try {
    const { data: profile } = await scope.db.from('business_profiles')
      .select('business_name, location_city, promoted_services, most_valuable_service').eq('id', scope.businessId).maybeSingle();
    const languages = plan.languages;
    const copy = await runStructuredAI<CopyResult>({
      supabase: scope.db,
      businessId: scope.businessId,
      platformIntegrationId: scope.integration.id,
      adAccountId: scope.account.id,
      sourceType: QUICK_AD_SOURCE_TYPE,
      sourceId: input.idempotencyKey,
      promptVersion: PROMPT_VERSION,
      schemaName: 'quick_ad_copy',
      schema: COPY_JSON_SCHEMA as unknown as Record<string, unknown>,
      systemPrompt: COPY_SYSTEM_PROMPT,
      task: `Write ad text in these languages, in this order: ${languages.join(', ')}.`,
      input: {
        business: { name: profile?.business_name ?? null, city: profile?.location_city ?? null, services: profile?.promoted_services ?? [], mainService: profile?.most_valuable_service ?? null },
        ownerNote: note || null,
        previousAd: context.previousAd,
      },
      fallback: fallbackCopy(context.previousAd, languages),
      validate: value => {
        const variants = validateCopy(value, languages);
        return variants ? { variants, source: 'model' } : null;
      },
      timeoutMs: 8000,
    });

    const schedule = quickAdSchedule({ today: dayIn(context.timezone), zone: context.timezone, days: plan.days.value });
    const welcome = context.welcome
      ? { spec: context.welcome.spec, summary: context.welcome.clientMessage }
      : plan.greeting ? { spec: null, summary: plan.greeting } : null;
    const textNote = copy.output.source === 'model' ? 'Ad text written by DeepVisor; review it before publishing.'
      : copy.output.source === 'previous_ad' ? 'Ad text copied from your previous ad because new text could not be written.'
      : 'Ad text still needed.';
    const result = await createCampaignReuseDraft(scope.db, {
      businessId: scope.businessId,
      platformIntegrationId: scope.integration.id,
      adAccountId: scope.account.id,
      userId: scope.userId,
      currencyCode: scope.account.currency_code,
      timezone: context.timezone,
      request: {
        sourceType: 'adset', sourceCampaignId: source.campaignId, sourceAdSetId: source.adSetId,
        budgetType: 'daily', budgetAmount: budgetMajor(plan.dailyBudget), startAt: schedule.startAt, endAt: schedule.endAt,
        creativeMode: 'fresh', idempotencyKey: input.idempotencyKey,
      },
      content: {
        title: 'Quick ad',
        copies: copy.output.variants,
        media: [{ id: mediaId, name: input.file.name.replace(/[\x00-\x1f\x7f/\\]/g, '').slice(0, 120) || 'Quick ad media', mime, path }],
        welcome,
        reviewNote: `Quick ad from "${source.name}" (${REASON_NOTE[source.reason]}). ${textNote}${plan.overMonthlyLimit ? ' Planned spend is above your monthly limit.' : ''}`,
      },
    });
    if (result.replayed) await scope.db.storage.from(MEDIA_BUCKET).remove([path]);
    return { ...result, copySource: copy.output.source, overMonthlyLimit: plan.overMonthlyLimit };
  } catch (error) {
    await scope.db.storage.from(MEDIA_BUCKET).remove([path]);
    if (error instanceof CampaignReuseDraftError) throw new QuickAdError(error.message, error.status, 'INVALID_INPUT');
    throw error;
  }
}
