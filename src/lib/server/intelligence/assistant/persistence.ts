import 'server-only';
import { randomUUID } from 'node:crypto';
import type { Json } from '@/lib/shared/types/supabase';
import { emptyAssistantState, type AssistantState } from '@/lib/shared/assistant/contracts';
import { AssistantError, type AssistantAccess } from './access';
import { assistantConfig } from './config';
import type { Usage } from '@/lib/server/openai/conversation';
function scoped(scope: AssistantAccess) { return scope.db.from('assistant_conversations').select('*').eq('business_id', scope.businessId).eq('ad_account_id', scope.account.id).eq('user_id', scope.userId); }
export async function loadConversation(scope: AssistantAccess): Promise<AssistantState> {
    const { data, error } = await scoped(scope).maybeSingle();
    if (error)
        throw new AssistantError('Conversation storage is unavailable. Apply the assistant migration before using chat.', 503);
    return data ? { ...data.state as unknown as AssistantState, revision: data.revision } : emptyAssistantState();
}
export async function claimTurn(scope: AssistantAccess, revision: number, tokens: number) {
    const config = assistantConfig(), lock = randomUUID();
    const { data, error } = await scope.db.rpc('claim_assistant_turn', {
        p_business: scope.businessId, p_account: scope.account.id, p_user: scope.userId, p_revision: revision, p_lock: lock, p_tokens: tokens,
        p_conversation_requests: config.conversationRequests, p_conversation_tokens: config.conversationTokens,
        p_business_requests: config.businessRequests, p_business_tokens: config.businessTokens, p_minute: config.perMinute,
    });
    if (error) {
        if (error.message.includes('ASSISTANT_REVISION'))
            throw new AssistantError('Conversation changed in another tab. Reload before continuing.', 409);
        if (error.message.includes('ASSISTANT_BUSY'))
            throw new AssistantError('A reply is already in progress. Please wait.', 409);
        if (error.message.includes('LIMIT'))
            throw new AssistantError('Assistant usage limit reached. Try later, or clear a full conversation.', 429);
        throw new AssistantError('Conversation storage is unavailable.', 503);
    }
    const row = data as unknown as {
        id: string;
        state: AssistantState;
        revision: number;
    };
    return { ...row, lock };
}
export type Turn = Awaited<ReturnType<typeof claimTurn>>;
export async function finishTurn(scope: AssistantAccess, turn: Turn, state: AssistantState, clear = false) {
    const next = { ...state, revision: turn.revision + 1 };
    const { data, error } = await scope.db.from('assistant_conversations').update({ state: next as unknown as Json, revision: next.revision, lock_id: null, locked_until: null, updated_at: new Date().toISOString(), ...(clear ? { generation: randomUUID() } : {}) }).eq('id', turn.id).eq('business_id', scope.businessId).eq('ad_account_id', scope.account.id).eq('user_id', scope.userId).eq('lock_id', turn.lock).select('id').maybeSingle();
    if (error || !data)
        throw new AssistantError('Conversation changed. Reload before continuing.', 409);
    return next;
}
export async function releaseTurn(scope: AssistantAccess, turn: Turn) {
    await scope.db.from('assistant_conversations').update({ lock_id: null, locked_until: null }).eq('id', turn.id).eq('business_id', scope.businessId).eq('user_id', scope.userId).eq('lock_id', turn.lock);
}
export async function recordUsage(scope: AssistantAccess, turn: Turn, usage: Usage, succeeded: boolean) {
    const { error } = await scope.db.from('assistant_usage').update({ input_tokens: usage.input, output_tokens: usage.output, cached_tokens: usage.cached, estimated_usd: usage.estimatedUsd, model: usage.model, status: succeeded ? 'succeeded' : 'failed', ...(succeeded && usage.input + usage.output > 0 ? { reserved_tokens: usage.input + usage.output } : {}) }).eq('id', turn.lock).eq('business_id', scope.businessId);
    // Reservations remain charged even on uncertain failures, so lost usage writes cannot bypass budgets.
    if (error)
        console.error('Assistant usage record failed', { code: error.code });
}
