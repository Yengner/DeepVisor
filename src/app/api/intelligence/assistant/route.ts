import { requestAssistantFreshness } from '@/lib/server/intelligence/assistant/freshness';
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { unstable_rethrow } from 'next/navigation';
import { assistantRequestSchema, emptyAssistantState } from '@/lib/shared/assistant/contracts';
import { AssistantError, authorizeAssistant } from '@/lib/server/intelligence/assistant/access';
import { assistantConfig } from '@/lib/server/intelligence/assistant/config';
import { assistantTools, readAssistantTool, creativeCards } from '@/lib/server/intelligence/assistant/tools';
import { makeEvidence, resolveEvidence, type EvidenceSource } from '@/lib/server/intelligence/assistant/evidence';
import { asRecord } from '@/lib/shared/utils/format';
import { claimTurn, finishTurn, loadConversation, recordUsage, releaseTurn } from '@/lib/server/intelligence/assistant/persistence';
import { saveAssistantDraft } from '@/lib/server/intelligence/assistant/draft';
import { CampaignReuseDraftError } from '@/lib/server/campaigns/reuse';
import { MEDIA_BUCKET } from '@/lib/server/intelligence/assistant/media';
import { conversationReservation, runConversation, type Usage } from '@/lib/server/openai/conversation';
export const runtime = 'nodejs';
export const maxDuration = 300;
function failure(error: unknown) {
    unstable_rethrow(error);
    if (error instanceof AssistantError || error instanceof CampaignReuseDraftError)
        return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    if (error instanceof OpenAI.RateLimitError)
        return NextResponse.json({ success: false, error: 'The provider is busy or its usage limit was reached. Try again shortly.' }, { status: 429, headers: { 'Retry-After': '60' } });
    // Do not log provider errors, prompts, DB rows, credentials or signed media URLs.
    console.error('Assistant request failed', { kind: error instanceof Error ? error.name : 'unknown' });
    return NextResponse.json({ success: false, error: 'The assistant could not complete this request. Your saved conversation is unchanged. Try again shortly.' }, { status: 503 });
}
export async function GET() {
    try {
        const scope = await authorizeAssistant();
        return NextResponse.json({ success: true, state: await loadConversation(scope), accountId: scope.account.id, currency: scope.account.currency_code, timezone: scope.account.timezone, configured: Boolean(process.env.OPENAI_API_KEY) }, { headers: { 'Cache-Control': 'no-store' } });
    }
    catch (error) {
        return failure(error);
    }
}
export async function POST(request: NextRequest) {
    try {
        if (request.headers.get('origin') && request.headers.get('origin') !== request.nextUrl.origin)
            throw new AssistantError('Invalid request origin.', 403);
        const raw = await request.text();
        if (Buffer.byteLength(raw) > 24000)
            throw new AssistantError('Request is too large.', 413);
        let json: unknown;
        try {
            json = JSON.parse(raw);
        }
        catch {
            throw new AssistantError('Invalid JSON request.');
        }
        const parsed = assistantRequestSchema.safeParse(json);
        if (!parsed.success)
            throw new AssistantError('Check the message or draft fields.');
        const body = parsed.data;
        const scope = await authorizeAssistant(body.adAccountId);
        if (body.action === 'message' && !process.env.OPENAI_API_KEY)
            throw new AssistantError('OpenAI is not configured. Add the server-side OPENAI_API_KEY to enable chat.', 503);
        const config = assistantConfig();
        const turn = await claimTurn(scope, body.revision, body.action === 'message' ? conversationReservation(config) : 0);
        const usage: Usage = { input: 0, output: 0, cached: 0, estimatedUsd: null, model: config.model };
        let succeeded = false;
        try {
            let state = turn.state;
            if (body.action === 'clear')
                state = emptyAssistantState();
            else if (body.action === 'modify')
                state = { ...state, plan: body.plan, savedDraftId: null };
            else if (body.action === 'save') {
                const id = await saveAssistantDraft(scope, body.plan, turn.id, turn.revision, state.attachments ?? []);
                state = { ...state, plan: body.plan, savedDraftId: id, attachments: state.attachments?.map(a => ({ ...a, saved: true })), messages: [...state.messages, { role: 'assistant', text: 'Your review draft was saved. Nothing was published or changed in Meta.' }] };
            }
            else {
                const evidence: EvidenceSource[] = [];
                const reads = new Map<string, Promise<unknown>>();
                const reply = await runConversation({ messages: state.messages, plan: state.plan, question: body.question, context: body.context, attachmentCount: state.attachments?.length ?? 0, tools: assistantTools, readTool: async (name, args) => { const result = await readAssistantTool(name, args, scope, reads);
                    const backgroundRefresh = await requestAssistantFreshness(name, args, scope);
                    if (!['getAccountPerformance', 'getPerformanceRankings', 'getPerformanceBreakdown', 'getStoredFindings'].includes(name)) return result;
                    const data = asRecord(result), { contextPeriods, ...primary } = data;
                    const sources = [makeEvidence(`source${evidence.length + 1}`, primary, String(asRecord(args).period))];
                    if (Array.isArray(contextPeriods)) for (const item of contextPeriods) { const context = asRecord(item); sources.push(makeEvidence(`source${evidence.length + sources.length + 1}`, context.data, String(context.period))); }
                    evidence.push(...sources);
                    const compact = primary.metrics ? { source: primary.source, observedAt: primary.observedAt, daily: Array.isArray(primary.daily) ? primary.daily.map(row => { const point = asRecord(row); return { day: point.day, spend: point.spend, results: point.conversion }; }) : [] } : primary;
                    return { ...compact, backgroundRefresh, evidenceSources: sources.map(({ id, title, facts, observations }) => ({ id, title, facts, observations })) }; }, usage });
                // Provider IDs are never rendered as URLs. Resolve recommendations from this account.
                const presentation = resolveEvidence(reply, evidence, !reply.plan && !/detail|in.depth|comprehensive|explain.*why|why.*drop/i.test(body.question));
                const visualCreativeIds = reply.visuals.filter(v => v.kind === 'creative').flatMap(v => evidence.find(s => s.id === v.sourceId)?.creativeIds ?? []);
                const creatives = await creativeCards(scope, [...new Set([...reply.creativeIds, ...visualCreativeIds])].slice(0, 4));
                state = { ...state, plan: reply.plan ?? state.plan, creatives: reply.plan && creatives.length ? creatives : state.creatives, savedDraftId: reply.plan ? null : state.savedDraftId, messages: [...state.messages, { role: 'user', text: body.question }, { role: 'assistant', text: [reply.message, ...reply.questions].join('\n\n'), presentation, creatives }] };
            }
            state.messages = state.messages.slice(-80);
            const next = await finishTurn(scope, turn, state, body.action === 'clear');
            succeeded = true;
            if (body.action === 'clear') {
                const prefix = `${scope.businessId}/${scope.account.id}/${scope.userId}/`;
                const paths: string[] = [];
                for (const media of turn.state.attachments ?? []) {
                    if (!media.path.startsWith(prefix) || media.path.includes('..'))
                        continue;
                    const { data: references, error } = await scope.db.from('campaign_drafts').select('id').eq('business_id', scope.businessId).eq('ad_account_id', scope.account.id).contains('payload_json', { form: { assistantMedia: [{ id: media.id }] } }).limit(1);
                    if (!error && !references?.length)
                        paths.push(media.path);
                }
                if (paths.length)
                    await scope.db.storage.from(MEDIA_BUCKET).remove(paths);
            }
            return NextResponse.json({ success: true, state: next }, { headers: { 'Cache-Control': 'no-store' } });
        }
        finally {
            if (body.action === 'message')
                await recordUsage(scope, turn, usage, succeeded);
            if (!succeeded)
                await releaseTurn(scope, turn);
        }
    }
    catch (error) {
        return failure(error);
    }
}
