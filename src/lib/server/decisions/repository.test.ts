import { createClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Database } from '@/lib/shared/types/supabase';
import { buildFeatureSnapshot } from '@/lib/server/features';
import * as repository from './repository';

const transport = vi.fn<typeof fetch>();
const client = createClient<Database>('https://unit-test.supabase.co', 'test-key', {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: transport },
});

beforeEach(() => {
  transport.mockReset();
  transport.mockImplementation(async () => new Response(JSON.stringify({ id: 'record', business_id: 'business' }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  }));
});

function request() {
  const [url, init] = transport.mock.calls[0];
  return {
    url: new URL(String(url)),
    headers: new Headers(init?.headers),
    body: init?.body ? JSON.parse(String(init.body)) : null,
    method: init?.method,
  };
}

describe('V2 persistence repositories', () => {
  it('saves feature schema version, identity and the complete typed snapshot', async () => {
    const snapshot = buildFeatureSnapshot({
      deliveryUnit: { businessId: 'business', adAccountId: 'account', adsetId: 'adset', currency: 'USD', platform: 'meta', entityType: 'adset' },
      asOfDay: '2026-10-06', rows: [],
    });
    await repository.saveFeatureSnapshot(client, { platformIntegrationId: 'integration', snapshot });
    expect(request()).toMatchObject({ method: 'POST', body: {
      business_id: 'business', ad_account_id: 'account', platform_integration_id: 'integration',
      entity_type: 'adset', entity_id: 'adset', feature_schema_version: 1, feature_json: snapshot,
    } });
    expect(request().headers.get('content-profile')).toBe('ai');
  });

  it.each([
    repository.getFeatureSnapshot, repository.getDecisionRun, repository.getActionProposal,
    repository.getExecutedAction, repository.getActionOutcome,
  ])('scopes single-record reads to the business', async (get) => {
    await get(client, 'business', 'record');
    expect(request().url.searchParams.get('business_id')).toBe('eq.business');
    expect(request().url.searchParams.get('id')).toBe('eq.record');
    expect(request().headers.get('accept-profile')).toBe('ai');
  });

  it.each([
    repository.listFeatureSnapshots, repository.listDecisionRuns, repository.listActionProposals,
    repository.listExecutedActions, repository.listActionOutcomes,
  ])('bounds and scopes list reads', async (list) => {
    await list(client, 'business', 10);
    expect(request().url.searchParams.get('business_id')).toBe('eq.business');
    expect(request().url.searchParams.get('limit')).toBe('10');
    expect(request().url.searchParams.get('order')).toBe('created_at.desc,id.desc');
  });

  it('records the provider response without dropping metadata', async () => {
    const providerResponse = { reasoning: { signals: ['delivery'] }, score: 0.8 };
    await repository.insertDecisionRun(client, 'business', {
      feature_snapshot_id: 'snapshot', provider: 'deterministic', provider_model: 'rules',
      model_version: '1', provider_version: '2', confidence: 0.8,
      decision_json: { action: 'hold' }, provider_response_json: providerResponse,
    });
    expect(request().body).toMatchObject({ business_id: 'business', provider_response_json: providerResponse, model_version: '1' });
  });

  it('persists proposals, execution records and outcomes without platform calls', async () => {
    await repository.insertActionProposal(client, 'business', {
      decision_run_id: 'run', action_type: 'hold', target_entity_type: 'adset', target_entity_id: 'adset',
    });
    expect(request().url.pathname).toBe('/rest/v1/action_proposals');
    transport.mockClear();
    await repository.insertExecutedAction(client, 'business', { action_proposal_id: 'proposal', status: 'failed', error_json: { message: 'test' } });
    expect(request().body).toMatchObject({ business_id: 'business', status: 'failed' });
    transport.mockClear();
    await repository.insertActionOutcome(client, 'business', {
      executed_action_id: 'execution', measurement_horizon_hours: 24,
      metrics_before_json: { spend: 1 }, metrics_after_json: { spend: 2 }, calculated_change_json: { spend: 1 },
    });
    expect(request().url.pathname).toBe('/rest/v1/action_outcomes');
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it.each([repository.updateDecisionRun, repository.updateActionProposal, repository.updateExecutedAction])('scopes updates by both business and ID', async (update) => {
    await update(client, 'business', 'record', { status: 'pending' });
    expect(request().method).toBe('PATCH');
    expect(request().url.searchParams.get('business_id')).toBe('eq.business');
    expect(request().url.searchParams.get('id')).toBe('eq.record');
  });

  it('upserts one policy per business and scopes policy reads', async () => {
    await repository.upsertAutonomyPolicy(client, 'business', { mode: 'off', allowed_action_classes: [] });
    expect(request().url.searchParams.get('on_conflict')).toBe('business_id');
    expect(request().body).toMatchObject({ business_id: 'business', mode: 'off' });
    transport.mockClear();
    await repository.getAutonomyPolicy(client, 'business');
    expect(request().url.searchParams.get('business_id')).toBe('eq.business');
  });

  it('returns null for a missing record', async () => {
    transport.mockResolvedValue(new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } }));
    expect(await repository.getDecisionRun(client, 'business', 'missing')).toBeNull();
  });

  it('propagates database failures', async () => {
    transport.mockResolvedValue(new Response(JSON.stringify({ code: '23503', message: 'Invalid parent' }), {
      status: 409, headers: { 'Content-Type': 'application/json' },
    }));
    await expect(repository.insertDecisionRun(client, 'business', { feature_snapshot_id: 'missing', provider: 'test' })).rejects.toMatchObject({ code: '23503' });
  });

  it('rejects missing business scope and unbounded lists before transport', async () => {
    await expect(repository.getDecisionRun(client, ' ', 'id')).rejects.toThrow('business ID');
    await expect(repository.listDecisionRuns(client, 'business', 101)).rejects.toThrow('Limit');
    expect(transport).not.toHaveBeenCalled();
  });
});
