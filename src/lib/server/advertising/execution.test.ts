import { describe, expect, it, vi } from 'vitest';
import { buildFeatureSnapshot } from '../features';
import type { Json } from '@/lib/shared/types/supabase';
import { approvalFingerprint } from '../decisions/approval';
import { executeReview, executeLimitedAuto, executionEnabled, type ExecutionContext, type ExecutionStore } from './ReviewExecutor';
import { PolicyEngine } from '../decisions/policy/PolicyEngine';
import { MetaActionAdapter } from './MetaActionAdapter';
import { AdvertisingError, resolveBudget, type AdvertisingState } from './types';

vi.mock('server-only', () => ({}));
const now = '2026-10-06T12:00:00.000Z';
const state: AdvertisingState = {
  adset: { id: '123', account_id: '456', campaign_id: '789', status: 'ACTIVE', effective_status: 'ACTIVE', daily_budget: '10000', lifetime_budget: '0', updated_time: now, is_budget_schedule_enabled: false },
  campaign: { id: '789', account_id: '456', status: 'ACTIVE', effective_status: 'ACTIVE', daily_budget: '0', lifetime_budget: '0', updated_time: now },
  account: { id: 'act_456', account_id: '456', account_status: 1, currency: 'USD', timezone_name: 'UTC' },
};
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
function setup() {
  let live = structuredClone(state);
  const transport = vi.fn<typeof fetch>(async (url, init) => {
    if (init?.method === 'POST') {
      const values = new URLSearchParams(String(init.body));
      if (values.has('daily_budget')) live.adset.daily_budget = values.get('daily_budget')!;
      if (values.has('lifetime_budget')) live.adset.lifetime_budget = values.get('lifetime_budget')!;
      if (values.has('status')) live.adset.status = live.adset.effective_status = values.get('status')!;
      return response({ success: true });
    }
    const path = new URL(String(url)).pathname.split('/').pop();
    if (path === 'campaigns') return response({data:[live.campaign]});
    if (path === 'adsets') return response({data:[live.adset,{...live.adset,id:'124',daily_budget:'190000',status:'ACTIVE',effective_status:'ACTIVE'}]});
    return response(path === '123' ? live.adset : path === '789' ? live.campaign : live.account);
  });
  const adapter = new MetaActionAdapter({ accessToken: 'secret-token', accountId: '456', adsetId: '123', liveEnabled: true }, transport);
  const features = buildFeatureSnapshot({ deliveryUnit: { businessId: 'business', adAccountId: 'account', adsetId: '123', currency: 'USD', platform: 'meta', entityType: 'adset' }, asOfDay: '2026-10-06', rows: Array.from({ length: 60 }, (_, i) => ({
    adset_id: '123', day: new Date(Date.parse(now) - i * 86400000).toISOString().slice(0, 10), spend: 20, impressions: 1000, reach: 500, clicks: 50, inline_link_clicks: 40, leads: 2, messages: 1, calls: 0,
  })) });
  const base = { id: 'id', business_id: 'business', created_at: now, updated_at: now };
  const context: ExecutionContext = {
    run: { ...base, id: 'run', status: 'completed', feature_snapshot_id: 'snapshot', provider: 'mock', provider_model: 'rules', provider_version: '1', model_version: '1', confidence: 0.9, provider_response_json: null,
      decision_json: { result: { decision: 'REDUCE_BUDGET', confidence: 0.9, providerId: 'mock', modelId: 'rules', providerVersion: '1', modelVersion: '1' } } },
    snapshot: { ...base, id: 'snapshot', platform_integration_id: 'integration', ad_account_id: 'account', entity_type: 'adset', entity_id: '123', feature_schema_version: 1, feature_json: features as unknown as Json },
    policy: { ...base, mode: 'approval_required', allowed_action_classes: ['REDUCE_BUDGET', 'PAUSE_DELIVERY_UNIT'], max_budget_change_percent: 20,
      budget_boundaries_json: { executionEnabled: true, exclusiveWriterConfirmed: true, lockedEntityIds: [], currency: 'USD', timeZone: 'UTC', budgetPeriod: 'daily', minBudgetMinor: 1000, maxBudgetMinor: 20000 },
      cooldown_config_json: { cooldownHours: 24, maxDailyChanges: 3 },
      minimum_evidence_json: { spend: 100, impressions: 600, results: 2, activeDays: 4, decisionConfidence: 0.8, trackingConfidence: 'medium', maxSnapshotAgeDays: 1, maxEntityAgeMinutes: 15 } },
    proposal: { ...base, id: 'proposal', decision_run_id: 'run', action_type: 'REDUCE_BUDGET', target_entity_type: 'adset', target_entity_id: '123', current_state_json: { budgetMinor: 10000, metaState: structuredClone(state) }, proposed_state_json: { targetBudgetMinor: 9000 }, status: 'approved', risk_level: 'medium', requires_approval: true, policy_result_json: {} },
    history: [],
  };
  const sign = () => { context.proposal.policy_result_json = { outcome: 'REQUIRE_APPROVAL', reason: 'REVIEW_MODE', review: { userId: 'owner', choice: 'approve', reviewedAt: now, fingerprint: approvalFingerprint(context.proposal, context.run, context.snapshot, context.policy) } }; };
  sign();
  const store: ExecutionStore = { claim: vi.fn(async () => context), checkpoint: vi.fn(async () => {}), finish: vi.fn(async () => {}) };
  const execute = () => executeReview({ businessId: 'business', proposalId: 'proposal', enabled: true, store, adapter: async () => adapter, now: () => new Date(now) });
  return { context, store, adapter, transport, execute, sign, live: () => live, setLive: (s: AdvertisingState) => { live = s; } };
}

describe('Meta action adapter', () => {
  it('resolves ad-set and campaign ownership without redirecting a reduction', async () => {
    const f = setup();
    expect(resolveBudget(state)).toMatchObject({ owner: 'adset', ownerId: '123', period: 'daily', amountMinor: 10000 });
    const shared = structuredClone(state); shared.adset.daily_budget = '0'; shared.campaign.daily_budget = '10000';
    expect(resolveBudget(shared)).toMatchObject({ owner: 'campaign', ownerId: '789' });
    await expect(f.adapter.apply({ type: 'REDUCE_BUDGET', targetBudgetMinor: 9000 }, shared)).rejects.toThrow('SHARED_BUDGET');
    expect(f.transport).not.toHaveBeenCalled();
  });
  it('fails on ambiguous or scheduled budgets', () => {
    expect(() => resolveBudget({ ...state, campaign: { ...state.campaign, daily_budget: '1000' } })).toThrow('AMBIGUOUS');
    expect(() => resolveBudget({ ...state, adset: { ...state.adset, is_budget_schedule_enabled: true } })).toThrow('SCHEDULED');
  });
  it.each([0, -1, 10000, 11000, NaN, 9000.1])('never writes an invalid reduction %s', async (targetBudgetMinor) => {
    const f = setup(); await expect(f.adapter.apply({ type: 'REDUCE_BUDGET', targetBudgetMinor }, state)).rejects.toThrow();
    expect(f.transport).not.toHaveBeenCalled();
  });
  it('uses only the requested field and keeps tokens out of URLs', async () => {
    const f = setup(); await f.adapter.apply({ type: 'REDUCE_BUDGET', targetBudgetMinor: 9000 }, state);
    const [url, init] = f.transport.mock.calls[0];
    expect(String(url)).toBe('https://graph.facebook.com/v24.0/123');
    expect(init?.body).toBe('daily_budget=9000');
    expect(init?.redirect).toBe('error');
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer secret-token');
  });
  it('writes lifetime budget without touching daily budget', async () => {
    const f = setup(); const lifetime = structuredClone(state); lifetime.adset.daily_budget = '0'; lifetime.adset.lifetime_budget = '10000';
    await f.adapter.apply({ type: 'REDUCE_BUDGET', targetBudgetMinor: 9000 }, lifetime);
    expect(f.transport.mock.calls[0][1]?.body).toBe('lifetime_budget=9000');
  });
  it('validates Meta account scope and malformed states', async () => {
    const f = setup(); f.live().adset.account_id = '999'; await expect(f.adapter.read()).rejects.toThrow('SCOPE');
    f.transport.mockResolvedValue(response({ id: '123' })); await expect(f.adapter.read()).rejects.toThrow('MALFORMED');
  });
  it('does not retry timeouts and sanitizes API diagnostics', async () => {
    const f = setup(); f.transport.mockRejectedValueOnce(new Error('secret-token'));
    await expect(f.adapter.apply({ type: 'PAUSE_DELIVERY_UNIT' }, state)).rejects.toThrow('META_TRANSPORT');
    expect(f.transport).toHaveBeenCalledTimes(1);
    f.transport.mockResolvedValueOnce(response({ error: { code: 190, message: 'secret-token', fbtrace_id: 'trace-1' } }, 400));
    await expect(f.adapter.apply({ type: 'PAUSE_DELIVERY_UNIT' }, state)).rejects.toMatchObject({ code: 'META_API_ERROR', metadata: { httpStatus: 400, code: 190, fbtrace_id: 'trace-1' } });
  });
});

async function setupAuto() {
  const f = setup();
  f.context.policy.mode='autonomous';
  Object.assign(f.context.policy.budget_boundaries_json!,{limitedAuto:{adAccountId:'account',enabled:true,killSwitch:false,allowedEntityIds:['123'],minAccountBudgetMinor:1000,maxAccountBudgetMinor:300000,maxPauseBudgetMinor:10000,maxPauseAccountPercent:5}});
  f.context.proposal.proposed_state_json={targetBudgetMinor:9500};
  f.context.proposal.status='pending'; f.context.proposal.requires_approval=false; f.context.proposal.risk_level='low';
  Object.assign(f.context.proposal.current_state_json!,{accountBudget:await f.adapter.readAccountBudget()});
  f.transport.mockClear();
  const sign = () => { f.context.proposal.policy_result_json={outcome:'ALLOW_EXECUTION',reason:'POLICY_PASSED',automaticAuthorization:{fingerprint:approvalFingerprint(f.context.proposal,f.context.run,f.context.snapshot,f.context.policy)}}; };
  sign(); f.store.authorize=vi.fn(async()=>{});
  const execute = () => executeLimitedAuto({businessId:'business',proposalId:'proposal',enabled:true,store:f.store,adapter:async()=>f.adapter,now:()=>new Date(now)});
  const writes = () => f.transport.mock.calls.filter(([,init])=>init?.method==='POST');
  return {...f,sign,execute,writes};
}

describe('limited automatic execution',()=>{
  it.each(['REDUCE_BUDGET','PAUSE_DELIVERY_UNIT'])('executes low-risk %s with full entity/account audits',async action=>{
    const f = await setupAuto();
    if (action==='PAUSE_DELIVERY_UNIT') {
      f.context.proposal.action_type=action; f.context.proposal.proposed_state_json={};
      Object.assign((f.context.run.decision_json as {result:object}).result,{decision:action}); f.sign();
    }
    await f.execute(); expect(f.writes()).toHaveLength(1);
    expect(f.store.checkpoint).toHaveBeenCalledWith(expect.objectContaining({accountBudget:expect.objectContaining({totalDailyBudgetMinor:200000})}),expect.objectContaining({executionMode:'LIMITED_AUTO'}));
    expect(f.store.finish).toHaveBeenCalledWith(true,expect.objectContaining({accountBudget:expect.objectContaining({totalDailyBudgetMinor:action==='PAUSE_DELIVERY_UNIT'?190000:199500})}),null);
    expect(f.store.authorize).toHaveBeenCalledOnce();
    expect(vi.mocked(f.store.authorize!).mock.invocationCallOrder[0]).toBeLessThan(f.transport.mock.invocationCallOrder[f.transport.mock.calls.findIndex(([,init])=>init?.method==='POST')]);
  });
  it.each(['off','observe','approval_required'])('blocks mode %s',async mode=>{
    const f=await setupAuto(); f.context.policy.mode=mode; f.sign();
    await expect(f.execute()).rejects.toThrow('INVALID_AUTO_AUTHORIZATION'); expect(f.writes()).toHaveLength(0);
  });
  it.each(['enabled','killSwitch','exclusiveWriterConfirmed','executionEnabled'])('blocks disabled opt-in/switch %s',async field=>{
    const f=await setupAuto(); const bounds=f.context.policy.budget_boundaries_json as Record<string,unknown>;
    Object.assign(['enabled','killSwitch'].includes(field)?bounds.limitedAuto as object:bounds,{[field]:field==='killSwitch'}); f.sign();
    await expect(f.execute()).rejects.toThrow(); expect(f.writes()).toHaveLength(0);
  });
  it('blocks changed evidence/amount even if automatic authorization remains',async()=>{
    const f=await setupAuto(); f.context.proposal.proposed_state_json={targetBudgetMinor:9000};
    await expect(f.execute()).rejects.toThrow('INVALID_AUTO_AUTHORIZATION'); expect(f.writes()).toHaveLength(0);
  });
  it.each([-1,120001])('rejects a future or expired decision age %s',async age=>{
    const f=await setupAuto(); f.context.run.updated_at=new Date(Date.parse(now)-age).toISOString(); f.sign();
    await expect(f.execute()).rejects.toThrow('INVALID_AUTO_AUTHORIZATION'); expect(f.writes()).toHaveLength(0);
  });
  it('accepts the exact freshness boundary',async()=>{
    const f=await setupAuto(); f.context.run.updated_at=new Date(Date.parse(now)-120000).toISOString(); f.sign();
    await expect(f.execute()).resolves.toBeUndefined();
  });
  it.each(['INCREASE_BUDGET','CHANGE_CREATIVE','CHANGE_AUDIENCE','CREATE_CAMPAIGN','DELETE_DELIVERY_UNIT'])('blocks unsupported %s',async action=>{
    const f=await setupAuto(); f.context.proposal.action_type=action; f.sign();
    await expect(f.execute()).rejects.toThrow('UNSUPPORTED_ACTION'); expect(f.writes()).toHaveLength(0);
  });
  it.each([9000,10000,11000])('rejects medium-risk/non-reducing amount %s',async targetBudgetMinor=>{
    const f=await setupAuto(); f.context.proposal.proposed_state_json={targetBudgetMinor}; f.sign();
    await expect(f.execute()).rejects.toThrow('POLICY_BLOCKED'); expect(f.writes()).toHaveLength(0);
  });
  it('blocks manual state changes since evaluation',async()=>{
    const f=await setupAuto(); f.live().adset.updated_time='2026-10-06T12:00:01Z';
    await expect(f.execute()).rejects.toThrow('STALE_PROPOSAL'); expect(f.writes()).toHaveLength(0);
  });
  it('blocks account changes between pre-write reads',async()=>{
    const f=await setupAuto(); const read=f.adapter.readAccountBudget.bind(f.adapter); let calls=0;
    vi.spyOn(f.adapter,'readAccountBudget').mockImplementation(async()=>{const account=await read(); if(++calls===2) account.totalDailyBudgetMinor++; return account;});
    await expect(f.execute()).rejects.toThrow('ACCOUNT_STATE_CHANGED'); expect(f.writes()).toHaveLength(0);
  });
  it.each(['authorize','checkpoint'])('does not write when %s fails or a switch is revoked',async method=>{
    const f=await setupAuto(); vi.mocked(f.store[method as 'authorize'|'checkpoint']!).mockRejectedValueOnce(new Error('revoked'));
    await expect(f.execute()).rejects.toThrow(); expect(f.writes()).toHaveLength(0);
  });
  it('blocks a missing pre-write gate',async()=>{
    const f=await setupAuto(); delete f.store.authorize;
    await expect(f.execute()).rejects.toThrow('MISSING_AUTO_AUTHORIZATION_GATE'); expect(f.writes()).toHaveLength(0);
  });
  it('blocks PolicyEngine exceptions',async()=>{
    const f=await setupAuto(); const spy=vi.spyOn(PolicyEngine.prototype,'evaluate').mockImplementation(()=>{throw new Error('broken');});
    try { await expect(f.execute()).rejects.toThrow(); expect(f.writes()).toHaveLength(0); } finally {spy.mockRestore();}
  });
  it('requires account readback and marks uncertain failure without write retry',async()=>{
    const f=await setupAuto(); const read=f.adapter.readAccountBudget.bind(f.adapter); let calls=0;
    vi.spyOn(f.adapter,'readAccountBudget').mockImplementation(async()=>{if(++calls===3) throw new Error('offline'); return read();});
    await expect(f.execute()).rejects.toThrow(); expect(f.writes()).toHaveLength(1);
    expect(f.store.finish).toHaveBeenCalledWith(false,expect.any(Object),expect.objectContaining({reconciliationRequired:true}));
  });
  it('blocks stale prewrite data after a slow durable gate',async()=>{
    const f=await setupAuto(); let clock=Date.parse(now);
    vi.mocked(f.store.authorize!).mockImplementation(async()=>{clock+=15001;});
    await expect(executeLimitedAuto({businessId:'business',proposalId:'proposal',enabled:true,store:f.store,adapter:async()=>f.adapter,now:()=>new Date(clock)})).rejects.toThrow('PREWRITE_STATE_EXPIRED');
    expect(f.writes()).toHaveLength(0);
  });
});

describe('account allocation reads',()=>{
  it('sums daily allocations without double-counting campaign budgets',async()=>{
    const f=setup(); expect((await f.adapter.readAccountBudget()).totalDailyBudgetMinor).toBe(200000);
    f.live().adset.daily_budget='0'; f.live().campaign.daily_budget='10000';
    // Fixture's sibling has its own budget: this ambiguity must block.
    await expect(f.adapter.readAccountBudget()).rejects.toThrow('AMBIGUOUS_BUDGET_OWNER');
  });
  it.each([{data:[] ,paging:{next:'https://untrusted.test'}},{data:[{}]},{data:[],paging:{next:'anything',cursors:{after:'same'}}}])('rejects incomplete or malformed pagination',async body=>{
    const f=setup(); f.transport.mockResolvedValue(response(body));
    await expect(f.adapter.readAccountBudget()).rejects.toThrow();
    expect(f.transport.mock.calls.every(([url])=>new URL(String(url)).hostname==='graph.facebook.com')).toBe(true);
  });
  it('rejects active lifetime/scheduled budgets',async()=>{
    const f=setup(); f.live().adset.lifetime_budget='10000';
    await expect(f.adapter.readAccountBudget()).rejects.toThrow('UNSUPPORTED_ACCOUNT_BUDGET');
    f.live().adset.lifetime_budget='0'; f.live().adset.is_budget_schedule_enabled=true;
    await expect(f.adapter.readAccountBudget()).rejects.toThrow('UNSUPPORTED_ACCOUNT_BUDGET');
  });
});

describe('review execution', () => {
  it('makes no storage or Meta calls when disabled', async () => {
    const f = setup();
    await expect(executeReview({ businessId: 'business', proposalId: 'proposal', enabled: false, store: f.store, adapter: async () => f.adapter })).rejects.toThrow('EXECUTION_DISABLED');
    expect(f.store.claim).not.toHaveBeenCalled(); expect(f.transport).not.toHaveBeenCalled();
  });
  it('defaults off and requires an explicit business allowlist', () => {
    expect(executionEnabled('business', {})).toBe(false);
    expect(executionEnabled('business', { DEEPVISOR_META_EXECUTION_ENABLED: 'true' })).toBe(false);
    expect(executionEnabled('business', { DEEPVISOR_META_EXECUTION_ENABLED: 'true', DEEPVISOR_META_EXECUTION_BUSINESSES: 'other,business' })).toBe(true);
  });
  it('persists before-state before one write and verifies the exact after-state', async () => {
    const f = setup(); await f.execute();
    expect(f.store.checkpoint).toHaveBeenCalledWith(state, expect.objectContaining({ action: { type: 'REDUCE_BUDGET', targetBudgetMinor: 9000 } }));
    expect(f.transport.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1);
    expect(f.store.finish).toHaveBeenCalledWith(true, f.live(), null);
    expect(f.live().adset.daily_budget).toBe('9000');
    const checkpointOrder = vi.mocked(f.store.checkpoint).mock.invocationCallOrder[0];
    const postIndex = f.transport.mock.calls.findIndex(([, init]) => init?.method === 'POST');
    expect(checkpointOrder).toBeLessThan(f.transport.mock.invocationCallOrder[postIndex]);
  });
  it('pauses only the ad set even when its campaign owns the budget', async () => {
    const f = setup(); f.live().adset.daily_budget = '0'; f.live().campaign.daily_budget = '10000';
    f.context.proposal.current_state_json = { metaState: structuredClone(f.live()) };
    f.context.proposal.action_type = 'PAUSE_DELIVERY_UNIT'; f.context.proposal.proposed_state_json = {};
    f.context.run.decision_json = { result: { decision: 'PAUSE_DELIVERY_UNIT', confidence: 0.9, providerId: 'mock', modelId: 'rules', providerVersion: '1', modelVersion: '1' } }; f.sign();
    await f.execute();
    expect(f.live().adset.status).toBe('PAUSED'); expect(f.live().campaign.status).toBe('ACTIVE');
    expect(f.transport.mock.calls.find(([, init]) => init?.method === 'POST')?.[1]?.body).toBe('status=PAUSED');
  });
  it.each(['pending', 'rejected', 'cancelled'])('refuses a %s proposal', async (status) => {
    const f = setup(); f.context.proposal.status = status;
    await expect(f.execute()).rejects.toThrow('INVALID_OR_STALE_APPROVAL'); expect(f.transport).not.toHaveBeenCalled();
  });
  it.each(['off', 'observe', 'autonomous'])('refuses policy mode %s', async (mode) => {
    const f = setup(); f.context.policy.mode = mode; f.sign();
    await expect(f.execute()).rejects.toThrow('INVALID_OR_STALE_APPROVAL'); expect(f.transport).not.toHaveBeenCalled();
  });
  it('rejects changed proposal content even if the status remains approved', async () => {
    const f = setup(); f.context.proposal.proposed_state_json = { targetBudgetMinor: 8000 };
    await expect(f.execute()).rejects.toThrow('INVALID_OR_STALE_APPROVAL'); expect(f.transport).not.toHaveBeenCalled();
  });
  it('requires single-writer confirmation and business-level enablement', async () => {
    for (const field of ['exclusiveWriterConfirmed', 'executionEnabled']) {
      const f = setup();
      Object.assign(f.context.policy.budget_boundaries_json!, { [field]: false }); f.sign();
      await expect(f.execute()).rejects.toThrow('INVALID_OR_STALE_APPROVAL');
      expect(f.transport).not.toHaveBeenCalled();
    }
  });
  it('rejects expired approvals and accepts the exact one-hour boundary', async () => {
    for (const [age, allowed] of [[3600000, true], [3600001, false], [-1, false]] as const) {
      const f = setup();
      const policyResult = f.context.proposal.policy_result_json as { review: { reviewedAt: string } };
      policyResult.review.reviewedAt = new Date(Date.parse(now) - age).toISOString();
      if (allowed) await expect(f.execute()).resolves.toBeUndefined();
      else await expect(f.execute()).rejects.toThrow('INVALID_OR_STALE_APPROVAL');
    }
  });
  it('rejects a foreign business before contacting Meta', async () => {
    const f = setup(); f.context.snapshot.business_id = 'other'; f.sign();
    await expect(f.execute()).rejects.toThrow('INVALID_OR_STALE_APPROVAL'); expect(f.transport).not.toHaveBeenCalled();
  });
  it('blocks a current entity lock even with a signed approval', async () => {
    const f = setup(); Object.assign(f.context.policy.budget_boundaries_json!, { lockedEntityIds: ['789'] }); f.sign();
    await expect(f.execute()).rejects.toThrow('POLICY_BLOCKED'); expect(f.store.checkpoint).not.toHaveBeenCalled();
  });
  it('honors business history when checking cooldown and daily limits', async () => {
    const f = setup(); f.context.history = [{ id: 'previous', businessId: 'business', adAccountId: 'account', entityId: '123', status: 'succeeded', attemptedAt: '2026-10-06T11:00:00Z' }];
    await expect(f.execute()).rejects.toMatchObject({ metadata: { reason: 'COOLDOWN' } });
    expect(f.store.checkpoint).not.toHaveBeenCalled();
  });
  it('blocks state changes between its two pre-write reads', async () => {
    const f = setup(); const read = f.adapter.read.bind(f.adapter); let reads = 0;
    vi.spyOn(f.adapter, 'read').mockImplementation(async () => {
      if (++reads === 2) f.live().adset.daily_budget = '8000';
      return read();
    });
    await expect(f.execute()).rejects.toThrow('META_STATE_CHANGED'); expect(f.store.checkpoint).not.toHaveBeenCalled();
  });
  it('blocks when a campaign has become the budget owner', async () => {
    const f = setup(); f.live().adset.daily_budget = '0'; f.live().campaign.daily_budget = '10000';
    await expect(f.execute()).rejects.toThrow('STALE_PROPOSAL'); expect(f.store.checkpoint).not.toHaveBeenCalled();
  });
  it('rejects missing approved state and stale Meta state', async () => {
    const f = setup(); f.live().adset.daily_budget = '8000';
    await expect(f.execute()).rejects.toThrow('STALE_PROPOSAL');
    expect(f.store.checkpoint).not.toHaveBeenCalled();
    const g = setup(); g.context.proposal.current_state_json = {}; g.sign();
    await expect(g.execute()).rejects.toThrow('MISSING_APPROVED_META_STATE');
  });
  it('rechecks evidence and current policy instead of trusting saved authorization', async () => {
    const f = setup(); f.context.policy.minimum_evidence_json = {}; f.sign();
    await expect(f.execute()).rejects.toThrow('POLICY_BLOCKED'); expect(f.store.checkpoint).not.toHaveBeenCalled();
  });
  it('does not write when the durable checkpoint fails', async () => {
    const f = setup(); vi.mocked(f.store.checkpoint).mockRejectedValueOnce(new Error('DB unavailable'));
    await expect(f.execute()).rejects.toThrow();
    expect(f.transport.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(0);
  });
  it('keeps ambiguous writes for reconciliation and records a readback without replay', async () => {
    const f = setup(); vi.spyOn(f.adapter, 'apply').mockImplementationOnce(async () => {
      f.live().adset.daily_budget = '9000'; throw new AdvertisingError('META_TRANSPORT_OR_RESPONSE_ERROR');
    });
    await expect(f.execute()).rejects.toThrow('META_TRANSPORT');
    expect(f.store.finish).toHaveBeenCalledWith(false, f.live(), expect.objectContaining({ reconciliationRequired: true }));
    expect(f.adapter.apply).toHaveBeenCalledTimes(1);
  });
  it('records mismatched readback rather than reporting success', async () => {
    const f = setup(); vi.spyOn(f.adapter, 'apply').mockResolvedValueOnce();
    await expect(f.execute()).rejects.toThrow('READBACK_MISMATCH');
    expect(f.store.finish).toHaveBeenCalledWith(false, state, expect.objectContaining({ code: 'READBACK_MISMATCH' }));
  });
  it('records an unavailable readback as uncertain, without replaying the write', async () => {
    const f = setup(); const read = f.adapter.read.bind(f.adapter); let reads = 0;
    vi.spyOn(f.adapter, 'read').mockImplementation(async () => {
      if (++reads > 2) throw new AdvertisingError('META_API_ERROR', { httpStatus: 503 });
      return read();
    });
    await expect(f.execute()).rejects.toThrow('META_API_ERROR');
    expect(f.store.finish).toHaveBeenCalledWith(false, null, expect.objectContaining({ reconciliationRequired: true }));
    expect(f.transport.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1);
  });
  it('does not report success when the final audit write fails', async () => {
    const f = setup(); vi.mocked(f.store.finish).mockRejectedValue(new Error('DB offline'));
    await expect(f.execute()).rejects.toThrow('DB offline');
    expect(f.transport.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1);
  });
  it('never reaches Meta when another worker has already claimed the proposal', async () => {
    const f = setup(); vi.mocked(f.store.claim).mockRejectedValueOnce(new Error('already claimed'));
    await expect(f.execute()).rejects.toThrow('already claimed'); expect(f.transport).not.toHaveBeenCalled();
  });
});
