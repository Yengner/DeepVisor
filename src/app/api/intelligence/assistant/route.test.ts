import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({ unstable_rethrow: vi.fn() }));
const mocks = vi.hoisted(() => ({ authorize: vi.fn(), claim: vi.fn(), finish: vi.fn(), release: vi.fn(), load: vi.fn(), usage: vi.fn(), run: vi.fn(), save: vi.fn(), cards: vi.fn() }));
vi.mock('@/lib/server/intelligence/assistant/access', () => ({ authorizeAssistant: mocks.authorize, AssistantError: class extends Error {
        constructor(message: string, readonly status = 400) { super(message); }
    } }));
vi.mock('@/lib/server/intelligence/assistant/persistence', () => ({ claimTurn: mocks.claim, finishTurn: mocks.finish, releaseTurn: mocks.release, loadConversation: mocks.load, recordUsage: mocks.usage }));
vi.mock('@/lib/server/intelligence/assistant/draft', () => ({ saveAssistantDraft: mocks.save }));
vi.mock('@/lib/server/intelligence/assistant/tools', () => ({ assistantTools: [], readAssistantTool: vi.fn(), creativeCards: mocks.cards }));
vi.mock('@/lib/server/openai/conversation', () => ({ runConversation: mocks.run, conversationReservation: () => 100 }));
import { POST, GET } from './route';
import { emptyAssistantState } from '@/lib/shared/assistant/contracts';
const account = '11111111-1111-4111-8111-111111111111';
const request = (body: unknown) => new NextRequest('http://localhost/api/intelligence/assistant', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    vi.stubEnv('OPENAI_MODEL', 'gpt-6-luna');
    mocks.authorize.mockResolvedValue({ businessId: 'business', userId: 'user', account: { id: account }, integration: { id: 'integration' } });
    mocks.claim.mockResolvedValue({ id: 'thread', lock: 'lock', revision: 0, state: emptyAssistantState() });
    mocks.finish.mockImplementation((_scope, turn, state) => ({ ...state, revision: turn.revision + 1 }));
    mocks.cards.mockResolvedValue([]);
    mocks.load.mockResolvedValue(emptyAssistantState());
    mocks.run.mockResolvedValue({ message: 'What would you like to advertise?', visuals: [], insights: [], metadata: [], suggestedFollowUps: [], plan: null, creativeIds: [], questions: [] });
});
it('loads only the authenticated account conversation without inference', async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect((await response.json()).accountId).toBe(account);
    expect(mocks.run).not.toHaveBeenCalled();
});
it('persists conversation history and supplies prior messages on follow-up', async () => {
    const response = await POST(request({ action: 'message', question: 'Create an ad', revision: 0, adAccountId: account }));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.state.messages).toHaveLength(2);
    mocks.claim.mockResolvedValue({ id: 'thread', lock: 'lock2', revision: 1, state: body.state });
    await POST(request({ action: 'message', question: 'Actually make it $100', revision: 1, adAccountId: account }));
    expect(mocks.run.mock.calls[1][0].messages).toEqual(body.state.messages);
    expect(mocks.usage).toHaveBeenLastCalledWith(expect.anything(), expect.anything(), expect.anything(), true);
    expect(mocks.save).not.toHaveBeenCalled();
});
it('fails closed and releases locks on provider errors without writing success history', async () => {
    mocks.run.mockRejectedValue(new Error('provider secret must not be exposed'));
    const response = await POST(request({ action: 'message', question: 'Hi', revision: 0, adAccountId: account }));
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain('provider secret');
    expect(mocks.finish).not.toHaveBeenCalled();
    expect(mocks.release).toHaveBeenCalledOnce();
    expect(mocks.save).not.toHaveBeenCalled();
});
it('rejects model-triggered save without explicit confirmation and rejects cross-origin requests', async () => {
    const response = await POST(request({ action: 'save', plan: {}, revision: 0, adAccountId: account }));
    expect(response.status).toBe(400);
    expect(mocks.save).not.toHaveBeenCalled();
    const cross = new NextRequest('http://localhost/api/intelligence/assistant', { method: 'POST', headers: { origin: 'https://other.invalid' }, body: '{}' });
    expect((await POST(cross)).status).toBe(403);
});
it('reports missing provider configuration before reserving quota', async () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    const response = await POST(request({ action: 'message', question: 'Hi', revision: 0, adAccountId: account }));
    expect(response.status).toBe(503);
    expect(mocks.claim).not.toHaveBeenCalled();
});
