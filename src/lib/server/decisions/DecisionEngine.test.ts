import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Database } from '@/lib/shared/types/supabase';
import { buildFeatureSnapshot } from '@/lib/server/features';
import { DecisionEngine } from './DecisionEngine';
import { DeterministicDecisionProvider } from './providers/DeterministicDecisionProvider';
import { insertDecisionRun, saveFeatureSnapshot, updateDecisionRun } from './repository';
import type { DecisionProvider, DecisionResult } from './types';
import { DECISIONS } from './types';
import { validateDecisionResult } from './validation';

vi.mock('./repository', () => ({
  saveFeatureSnapshot: vi.fn(), insertDecisionRun: vi.fn(), updateDecisionRun: vi.fn(),
}));

const client = {} as SupabaseClient<Database>;
const mockProvider = new DeterministicDecisionProvider();
const snapshot = buildFeatureSnapshot({
  deliveryUnit: { platform: 'meta', entityType: 'adset', businessId: 'business', adAccountId: 'account', adsetId: 'adset', currency: 'USD' },
  asOfDay: '2026-10-06',
  rows: Array.from({ length: 7 }, (_, index) => ({
    adset_id: 'adset', day: `2026-${index === 6 ? '09-30' : `10-0${6 - index}`}`,
    spend: 20, impressions: 1000, clicks: 50, inline_link_clicks: 40,
    reach: 500, leads: 2, messages: 1, calls: 0,
  })),
});
const input = { businessId: 'business', platformIntegrationId: 'integration', snapshot, questions: ['Should this ad set change?'] };
const valid: DecisionResult = { ...mockProvider.identity, decision: 'HOLD', confidence: 0.8 };

function providerReturning(response: unknown): DecisionProvider {
  return { identity: mockProvider.identity, evaluate: vi.fn(async () => response as DecisionResult) };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(saveFeatureSnapshot).mockResolvedValue({ id: 'snapshot-id' } as Awaited<ReturnType<typeof saveFeatureSnapshot>>);
  vi.mocked(insertDecisionRun).mockResolvedValue({ id: 'run-id' } as Awaited<ReturnType<typeof insertDecisionRun>>);
  vi.mocked(updateDecisionRun).mockResolvedValue({ id: 'run-id' } as Awaited<ReturnType<typeof updateDecisionRun>>);
});

describe('DecisionEngine', () => {
  it('evaluates and persists HOLD with model identity, questions and raw response', async () => {
    const result = await new DecisionEngine(client, mockProvider).evaluate(input);
    expect(result).toMatchObject({ featureSnapshotId: 'snapshot-id', decisionRunId: 'run-id', result: { decision: 'HOLD' } });
    expect(insertDecisionRun).toHaveBeenCalledWith(client, 'business', expect.objectContaining({
      feature_snapshot_id: 'snapshot-id', provider: 'deepvisor-mock', provider_model: 'deterministic-fixture',
      model_version: '1', status: 'pending', decision_json: { questions: input.questions },
    }));
    expect(updateDecisionRun).toHaveBeenCalledWith(client, 'business', 'run-id', expect.objectContaining({
      status: 'completed', confidence: 1, provider_response_json: { mock: true, rule: 'HOLD' },
      decision_json: expect.objectContaining({ result: expect.objectContaining({ probabilities: { HOLD: 1 } }) }),
    }));
  });

  it('returns insufficient data for empty windows', async () => {
    const empty = buildFeatureSnapshot({ deliveryUnit: snapshot.deliveryUnit, asOfDay: snapshot.asOfDay, rows: [] });
    const result = await new DecisionEngine(client, mockProvider).evaluate({ ...input, snapshot: empty });
    expect(result.result.decision).toBe('INSUFFICIENT_DATA');
    expect(updateDecisionRun).toHaveBeenCalledWith(client, 'business', 'run-id', expect.objectContaining({ status: 'completed' }));
  });

  it('supports creative review through deterministic evidence', async () => {
    const state = structuredClone(snapshot);
    state.creativeFatigue.elevatedFrequency = true;
    expect((await new DecisionEngine(client, mockProvider).evaluate({ ...input, snapshot: state })).result.decision).toBe('REVIEW_CREATIVE');
  });

  it.each(DECISIONS)('accepts the supported %s vocabulary as a decision record only', async (decision) => {
    expect((await new DecisionEngine(client, providerReturning({ ...valid, decision })).evaluate(input)).result.decision).toBe(decision);
  });

  it.each([
    null, {}, { ...valid, decision: 'INCREASE_BUDGET' },
    { ...valid, confidence: NaN }, { ...valid, confidence: Infinity },
    { ...valid, confidence: -0.1 }, { ...valid, confidence: 1.1 },
    { ...valid, confidence: '0.9' }, { ...valid, providerId: 'different-provider' },
    { ...valid, modelVersion: 'different-version' },
    { ...valid, probabilities: { HOLD: 0.2 } },
    { ...valid, probabilities: { PAUSE_DELIVERY_UNIT: 1 } },
    { ...valid, probabilities: { HOLD: 0.5, UNKNOWN: 0.5 } },
    { ...valid, rawResponse: { value: Infinity } },
    { ...valid, evidence: new Date() }, { ...valid, rawResponse: { fn: () => null } },
  ])('fails closed for malformed provider output %#', async (response) => {
    await expect(new DecisionEngine(client, providerReturning(response)).evaluate(input)).rejects.toMatchObject({ code: 'INVALID_RESPONSE', decisionRunId: 'run-id' });
    expect(updateDecisionRun).toHaveBeenCalledExactlyOnceWith(client, 'business', 'run-id', {
      status: 'failed', confidence: null, decision_json: { questions: input.questions, error: { code: 'INVALID_RESPONSE' } },
      provider_response_json: null,
    });
  });

  it('rejects cyclic raw responses without crashing validation', async () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    await expect(new DecisionEngine(client, providerReturning({ ...valid, rawResponse: circular })).evaluate(input)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });

  it('records provider failures without persisting exception text or returning a fallback', async () => {
    const provider: DecisionProvider = {
      identity: mockProvider.identity,
      evaluate: vi.fn().mockRejectedValue(new Error('private provider credentials')),
    };
    await expect(new DecisionEngine(client, provider).evaluate(input)).rejects.toMatchObject({ code: 'PROVIDER_FAILED' });
    expect(updateDecisionRun).toHaveBeenCalledWith(client, 'business', 'run-id', expect.objectContaining({
      status: 'failed', decision_json: { questions: input.questions, error: { code: 'PROVIDER_FAILED' } },
    }));
  });

  it('rejects mismatched tenant context before persistence or evaluation', async () => {
    const provider = providerReturning(valid);
    await expect(new DecisionEngine(client, provider).evaluate({ ...input, businessId: 'other' })).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    expect(provider.evaluate).not.toHaveBeenCalled();
    expect(saveFeatureSnapshot).not.toHaveBeenCalled();
  });

  it('does not evaluate when pending-run persistence fails', async () => {
    const provider = providerReturning(valid);
    vi.mocked(insertDecisionRun).mockRejectedValue(new Error('database unavailable'));
    await expect(new DecisionEngine(client, provider).evaluate(input)).rejects.toMatchObject({ code: 'PERSISTENCE_FAILED' });
    expect(provider.evaluate).not.toHaveBeenCalled();
  });

  it('does not return a decision when completion persistence fails', async () => {
    vi.mocked(updateDecisionRun).mockResolvedValue(null);
    await expect(new DecisionEngine(client, mockProvider).evaluate(input)).rejects.toMatchObject({ code: 'PERSISTENCE_FAILED', decisionRunId: 'run-id' });
  });

  it('surfaces audit-write failures after provider failures', async () => {
    vi.mocked(updateDecisionRun).mockRejectedValue(new Error('database unavailable'));
    await expect(new DecisionEngine(client, providerReturning(null)).evaluate(input)).rejects.toMatchObject({ code: 'PERSISTENCE_FAILED' });
  });

  it('isolates caller state and persisted questions from provider mutation', async () => {
    const before = structuredClone(input);
    const provider: DecisionProvider = {
      identity: mockProvider.identity,
      evaluate: async (state, questions) => {
        state.deliveryUnit.businessId = 'mutated';
        (questions as string[]).push('mutated');
        return valid;
      },
    };
    await new DecisionEngine(client, provider).evaluate(input);
    expect(input).toEqual(before);
    expect(updateDecisionRun).toHaveBeenCalledWith(client, 'business', 'run-id', expect.objectContaining({ decision_json: { questions: input.questions, result: valid } }));
  });

  it('allows absent probability information and preserves supplied distributions', () => {
    expect(validateDecisionResult({ ...valid, confidence: null }).confidence).toBeNull();
    expect(validateDecisionResult({ ...valid, probabilities: { HOLD: 0.8, REVIEW_CREATIVE: 0.2 } }).probabilities).toEqual({ HOLD: 0.8, REVIEW_CREATIVE: 0.2 });
  });

  it('keeps the development provider deterministic', async () => {
    expect(await mockProvider.evaluate(snapshot, input.questions)).toEqual(await mockProvider.evaluate(snapshot, input.questions));
  });
});
