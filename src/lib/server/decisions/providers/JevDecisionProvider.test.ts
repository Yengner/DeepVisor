import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/shared/types/supabase';
import { buildFeatureSnapshot } from '@/lib/server/features';
import { DecisionEngine } from '../DecisionEngine';
import { saveFeatureSnapshot, insertDecisionRun, updateDecisionRun } from '../repository';
import { JevDecisionProvider } from './JevDecisionProvider';

vi.mock('server-only', () => ({}));
vi.mock('../repository', () => ({ saveFeatureSnapshot: vi.fn(), insertDecisionRun: vi.fn(), updateDecisionRun: vi.fn() }));

const state = buildFeatureSnapshot({
  deliveryUnit: { platform: 'meta', entityType: 'adset', businessId: 'private-business', adAccountId: 'private-account', adsetId: 'private-adset', currency: 'USD' },
  asOfDay: '2026-10-06', rows: [],
});
const questions = ['What should be reviewed?'];
const answer = {
  type: 'choice', choice: 'HOLD', confidence: 0.7,
  probabilities: { HOLD: 0.8, INSUFFICIENT_DATA: 0.1, REDUCE_BUDGET: 0, PAUSE_DELIVERY_UNIT: 0, REVIEW_CREATIVE: 0.1 },
};
const valid = { model: 'jev-1.13.0', answers: { delivery_decision_v1: answer }, usage: { input_tokens: 100, output_tokens: 10 } };
const transport = vi.fn<typeof fetch>();
const jsonResponse = (body: unknown = valid) => new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json', 'x-request-id': 'req-123' } });

beforeEach(() => {
  vi.useFakeTimers();
  vi.resetAllMocks();
  vi.stubEnv('JEV_API_KEY', 'test-private-key');
  vi.stubEnv('JEV_MODEL_ID', 'jev-1.13.0');
  vi.stubEnv('JEV_API_URL', 'https://api.typesafe.ai/v1/systemone');
  vi.stubEnv('JEV_TIMEOUT_MS', '100');
  vi.stubEnv('JEV_MAX_RETRIES', '1');
  transport.mockImplementation(async () => jsonResponse());
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

describe('Jev provider', () => {
  it('maps the documented response without confusing confidence with choice probability', async () => {
    const provider = new JevDecisionProvider(transport);
    const result = await provider.evaluate(state, questions);
    expect(result).toMatchObject({
      providerId: 'jev', providerVersion: '1', modelId: 'jev-1.13.0', modelVersion: '1.13.0',
      decision: 'HOLD', confidence: 0.7, probabilities: answer.probabilities,
      rawResponse: { ...valid, requestId: 'req-123', attempts: 1 },
      evidence: { questionSchemaVersion: 1, featureSchemaVersion: 1 },
    });
    expect(JSON.stringify(provider)).not.toContain('test-private-key');
    expect(JSON.stringify(result)).not.toContain('test-private-key');
  });

  it('sends canonical, versioned requests without internal IDs or credentials in the body', async () => {
    const provider = new JevDecisionProvider(transport);
    await provider.evaluate(state, questions);
    const [url, options] = transport.mock.calls[0];
    expect(url).toBe('https://api.typesafe.ai/v1/systemone');
    expect(options).toMatchObject({ method: 'POST', redirect: 'error', cache: 'no-store', headers: { Authorization: 'Bearer test-private-key' } });
    const body = JSON.parse(String(options?.body));
    expect(body.questions.delivery_decision_v1).toMatchObject({ type: 'choice', instructions: { considerations: questions } });
    expect(Object.keys(body.questions.delivery_decision_v1.criteria)).toHaveLength(5);
    expect(body.state.windows).toEqual(state.windows);
    expect(String(options?.body)).not.toMatch(/private-business|private-account|private-adset|test-private-key/);
    const reordered = Object.fromEntries(Object.entries(state).reverse()) as unknown as typeof state;
    await provider.evaluate(reordered, questions);
    expect(transport.mock.calls[1][1]?.body).toBe(options?.body);
  });

  it.each([
    {}, { ...valid, model: 'jev-2.0.0' },
    { ...valid, answers: {} },
    { ...valid, answers: { delivery_decision_v1: { ...answer, choice: 'INCREASE_BUDGET' } } },
    { ...valid, answers: { delivery_decision_v1: { ...answer, confidence: 1.2 } } },
    { ...valid, answers: { delivery_decision_v1: { ...answer, confidence: '0.7' } } },
    { ...valid, answers: { delivery_decision_v1: { ...answer, probabilities: { HOLD: 1 } } } },
    { ...valid, answers: { delivery_decision_v1: { ...answer, probabilities: { ...answer.probabilities, HOLD: 0.9 } } } },
    { ...valid, answers: { delivery_decision_v1: { ...answer, probabilities: { ...answer.probabilities, HOLD: -0.8 } } } },
    { ...valid, answers: { delivery_decision_v1: { ...answer, probabilities: { ...answer.probabilities, HOLD: null } } } },
    { ...valid, answers: { delivery_decision_v1: { ...answer, probabilities: { ...answer.probabilities, UNKNOWN: 0 } } } },
    { ...valid, answers: { delivery_decision_v1: { ...answer, choice: 'REDUCE_BUDGET' } } },
  ])('rejects malformed output without retrying %#', async (body) => {
    transport.mockImplementation(async () => jsonResponse(body));
    await expect(new JevDecisionProvider(transport).evaluate(state, questions)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid JSON', async () => {
    transport.mockResolvedValue(new Response('not json'));
    await expect(new JevDecisionProvider(transport).evaluate(state, questions)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it('drops undocumented response fields from audit metadata', async () => {
    transport.mockImplementation(async () => jsonResponse({ ...valid, secret: 'test-private-key', answers: { delivery_decision_v1: { ...answer, debug: 'test-private-key' } } }));
    expect(JSON.stringify(await new JevDecisionProvider(transport).evaluate(state, questions))).not.toContain('test-private-key');
  });

  it.each([401, 403, 422, 302])('fails without retry for HTTP %s', async (status) => {
    transport.mockResolvedValue(new Response('private upstream error', { status }));
    await expect(new JevDecisionProvider(transport).evaluate(state, questions)).rejects.toMatchObject({ code: 'HTTP_ERROR' });
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it.each([429, 503, 529])('retries HTTP %s after backoff with the same request', async (status) => {
    transport.mockResolvedValueOnce(new Response('', { status, headers: { 'Retry-After': '1' } }));
    const pending = new JevDecisionProvider(transport).evaluate(state, questions);
    await vi.advanceTimersByTimeAsync(999);
    expect(transport).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect((await pending).rawResponse).toMatchObject({ attempts: 2 });
    expect(transport.mock.calls[0][1]?.body).toBe(transport.mock.calls[1][1]?.body);
  });

  it('fails closed when Retry-After exceeds the bounded wait', async () => {
    transport.mockResolvedValue(new Response('', { status: 429, headers: { 'Retry-After': '60' } }));
    await expect(new JevDecisionProvider(transport).evaluate(state, questions)).rejects.toMatchObject({ code: 'UNAVAILABLE' });
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it('bounds retries for unavailable service', async () => {
    transport.mockRejectedValue(new Error('private transport error'));
    const rejected = expect(new JevDecisionProvider(transport).evaluate(state, questions)).rejects.toMatchObject({ code: 'UNAVAILABLE' });
    await vi.runAllTimersAsync();
    await rejected;
    expect(transport).toHaveBeenCalledTimes(2);
  });

  it('aborts hung requests and never returns a decision after timeout', async () => {
    transport.mockImplementation(() => new Promise(() => {}));
    const rejected = expect(new JevDecisionProvider(transport).evaluate(state, questions)).rejects.toMatchObject({ code: 'TIMEOUT' });
    await vi.runAllTimersAsync();
    await rejected;
    expect(transport).toHaveBeenCalledTimes(2);
    expect(transport.mock.calls.every(([, options]) => options?.signal?.aborted)).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('includes reading the response body in the timeout', async () => {
    vi.stubEnv('JEV_MAX_RETRIES', '0');
    transport.mockResolvedValue(new Response(new ReadableStream({ start() {} })));
    const rejected = expect(new JevDecisionProvider(transport).evaluate(state, questions)).rejects.toMatchObject({ code: 'TIMEOUT' });
    await vi.runAllTimersAsync();
    await rejected;
  });

  it.each([
    ['JEV_API_KEY', ''], ['JEV_API_URL', 'http://example.com'], ['JEV_API_URL', 'https://user:pass@example.com'],
    ['JEV_MODEL_ID', 'jev-latest'], ['JEV_TIMEOUT_MS', '0'], ['JEV_MAX_RETRIES', '10'],
  ])('rejects invalid configuration %s', (key, value) => {
    vi.stubEnv(key, value);
    expect(() => new JevDecisionProvider(transport)).toThrow('CONFIGURATION');
    expect(transport).not.toHaveBeenCalled();
  });

  it('works through the unchanged engine and persists provider metadata', async () => {
    vi.mocked(saveFeatureSnapshot).mockResolvedValue({ id: 'snapshot' } as Awaited<ReturnType<typeof saveFeatureSnapshot>>);
    vi.mocked(insertDecisionRun).mockResolvedValue({ id: 'run' } as Awaited<ReturnType<typeof insertDecisionRun>>);
    vi.mocked(updateDecisionRun).mockResolvedValue({ id: 'run' } as Awaited<ReturnType<typeof updateDecisionRun>>);
    const engine = new DecisionEngine({} as SupabaseClient<Database>, new JevDecisionProvider(transport));
    const input = { businessId: state.deliveryUnit.businessId, platformIntegrationId: 'integration', snapshot: state, questions };
    expect((await engine.evaluate(input)).result.providerId).toBe('jev');
    expect(insertDecisionRun).toHaveBeenCalledWith(expect.anything(), input.businessId, expect.objectContaining({ provider: 'jev', provider_model: 'jev-1.13.0', model_version: '1.13.0' }));
    expect(updateDecisionRun).toHaveBeenCalledWith(expect.anything(), input.businessId, 'run', expect.objectContaining({ status: 'completed', provider_response_json: expect.objectContaining({ model: 'jev-1.13.0' }) }));
    transport.mockResolvedValue(new Response('bad', { status: 401 }));
    await expect(engine.evaluate(input)).rejects.toMatchObject({ code: 'PROVIDER_FAILED' });
    expect(updateDecisionRun).toHaveBeenLastCalledWith(expect.anything(), input.businessId, 'run', expect.objectContaining({ status: 'failed' }));
  });
});
