import { it, expect, vi, afterEach } from 'vitest';
import OpenAI from 'openai';
vi.mock('server-only', () => ({}));
import { runConversation, conversationReservation, type Usage } from './conversation';
import { assistantConfig, estimatedCost } from '../intelligence/assistant/config';
const answer = { message: 'What budget would you like?', visuals: [], insights: [], metadata: [], suggestedFollowUps: [], plan: null, creativeIds: [], questions: [] };
const final = () => ({ status: 'completed', output: [], output_text: JSON.stringify(answer), usage: { input_tokens: 100, output_tokens: 30, input_tokens_details: { cached_tokens: 20 } } });
function setup(outputs: unknown[]) {
    const create = vi.fn();
    outputs.forEach(o => create.mockResolvedValueOnce(o));
    const client = { responses: { create } } as unknown as OpenAI;
    const usage: Usage = { input: 0, output: 0, cached: 0, model: 'gpt-6-luna', estimatedUsd: null };
    const readTool = vi.fn().mockResolvedValue({ budget: null });
    return { create, usage, readTool, input: { messages: [], plan: null, question: 'My usual budget?', tools: [], readTool, usage, client } };
}
afterEach(() => vi.unstubAllEnvs());
it('uses Responses strict schema, low effort, bounded tokens and no provider retention', async () => {
    vi.stubEnv('OPENAI_MODEL', '');
    vi.stubEnv('OPENAI_REASONING_EFFORT', '');
    const s = setup([final()]);
    expect(await runConversation(s.input)).toEqual(answer);
    expect(s.create.mock.calls[0][0]).toMatchObject({ model: 'gpt-6-luna', reasoning: { effort: 'low' }, store: false, max_output_tokens: 1800, text: { format: { type: 'json_schema', strict: true } } });
    expect(s.usage).toMatchObject({ input: 100, output: 30, cached: 20 });
});
it('replays tool calls and encrypted reasoning with matching call IDs', async () => {
    const output = [{ type: 'reasoning', id: 'r', summary: [], encrypted_content: 'ciphertext' }, { type: 'function_call', name: 'getAdvertisingDefaults', arguments: '{"objective":null,"campaignId":null}', call_id: 'c' }];
    const s = setup([{ ...final(), output }, final()]);
    await runConversation(s.input);
    expect(s.readTool).toHaveBeenCalledWith('getAdvertisingDefaults', { objective: null, campaignId: null });
    expect(s.create.mock.calls[1][0].input).toEqual(expect.arrayContaining([...output, { type: 'function_call_output', call_id: 'c', output: '{"budget":null}' }]));
});
it('stops repeated tool calls instead of repeating database work', async () => {
    const response = { ...final(), output: [{ type: 'function_call', name: 'getBusinessProfile', arguments: '{}', call_id: 'c' }] };
    const s = setup([response, response]);
    await expect(runConversation(s.input)).rejects.toThrow('repeated');
    expect(s.readTool).toHaveBeenCalledTimes(1);
});
it('rejects malformed structured outputs and incomplete responses', async () => {
    await expect(runConversation(setup([{ ...final(), output_text: '{"text":"done","html":"<script>"}' }]).input)).rejects.toThrow();
    await expect(runConversation(setup([{ ...final(), status: 'incomplete' }]).input)).rejects.toThrow('complete');
});
it('limits context before a paid request and accounts for schemas in reservation', async () => {
    const s = setup([final()]);
    s.input.question = 'x'.repeat(45000);
    await expect(runConversation(s.input)).rejects.toThrow('context limit');
    expect(s.create).not.toHaveBeenCalled();
    expect(conversationReservation(assistantConfig())).toBe(4 * (40000 + 1800));
});
it('supports explicit Terra evaluation, accurate cached-price estimates and no silent model fallback', () => {
    vi.stubEnv('OPENAI_MODEL', 'gpt-6.1-terra');
    expect(assistantConfig().model).toBe('gpt-6.1-terra');
    expect(estimatedCost('gpt-6.1-terra', 1000000, 1000000, 0)).toBe(.05);
    vi.stubEnv('OPENAI_MODEL', 'other-model');
    expect(() => assistantConfig()).toThrow('unsupported');
});
it('supports analytics follow-ups with scoped UI defaults and returned evidence', async () => {
    const response = { ...final(), output: [{ type: 'function_call', name: 'getAccountPerformance', arguments: '{"period":"7d","platform":"facebook"}', call_id: 'analytics' }] };
    const s = setup([response, final()]);
    s.readTool.mockResolvedValue({ unavailable: 'No publisher daily history', platform: 'facebook' });
    await runConversation({ ...s.input, question: 'And Instagram?', context: { period: '7d', platform: 'combined' }, messages: [{ role: 'user', text: 'How did Facebook do over 7 days?' }, { role: 'assistant', text: 'Daily publisher history is unavailable.' }] });
    expect(s.create.mock.calls[0][0].input).toEqual(expect.arrayContaining([{ role: 'user', content: 'And Instagram?' }]));
    expect(s.create.mock.calls[1][0].input).toEqual(expect.arrayContaining([{ type: 'function_call_output', call_id: 'analytics', output: '{"unavailable":"No publisher daily history","platform":"facebook"}' }]));
});
