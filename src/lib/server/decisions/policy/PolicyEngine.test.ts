import { describe, expect, it } from 'vitest';
import { buildFeatureSnapshot } from '@/lib/server/features';
import { PolicyEngine } from './PolicyEngine';
import type { PolicyInput, RecentActionHistory } from './types';

const engine = new PolicyEngine();
function fixture(): PolicyInput {
  const now = '2026-10-06T12:00:00.000Z';
  const snapshot = buildFeatureSnapshot({
    deliveryUnit: { platform: 'meta', entityType: 'adset', businessId: 'business', adAccountId: 'account', adsetId: 'adset', currency: 'USD' },
    asOfDay: '2026-10-06',
    rows: Array.from({ length: 60 }, (_, index) => {
      const date = new Date(now);
      date.setUTCDate(date.getUTCDate() - index);
      return { adset_id: 'adset', day: date.toISOString().slice(0, 10), spend: 20, impressions: 1000, reach: 500, clicks: 50, inline_link_clicks: 40, leads: 2, messages: 1, calls: 0 };
    }),
  });
  return {
    now, snapshot,
    decision: { decision: 'REDUCE_BUDGET', confidence: 0.9, providerId: 'mock', providerVersion: '1', modelId: 'mock', modelVersion: '1' },
    policy: {
      businessId: 'business', mode: 'LIMITED_AUTO', timeZone: 'UTC', currency: 'USD', budgetPeriod: 'daily',
      allowedActionClasses: ['REDUCE_BUDGET', 'PAUSE_DELIVERY_UNIT'],
      minimumEvidence: { spend: 100, impressions: 600, results: 2, activeDays: 4, decisionConfidence: 0.8, trackingConfidence: 'medium', maxSnapshotAgeDays: 1, maxEntityAgeMinutes: 15 },
      maxBudgetChangePercent: 20, minBudgetMinor: 1000, maxBudgetMinor: 20000, cooldownHours: 24, maxDailyChanges: 3,
      limitedAuto: { adAccountId:'account',enabled:true,killSwitch:false,allowedEntityIds:['adset'],minAccountBudgetMinor:1000,maxAccountBudgetMinor:1000000,maxPauseBudgetMinor:0,maxPauseAccountPercent:0 },
    },
    entity: { businessId: 'business', adAccountId: 'account', entityId: 'adset', platform: 'meta', entityType: 'adset', status: 'active', locked: false, budgetOwner: 'adset', budgetMinor: 10000, currency: 'USD', budgetPeriod: 'daily', timeZone: 'UTC', observedAt: now, accountBudgetMinor:200000 },
    history: { businessId: 'business', complete: true, since: '2026-10-04T12:00:00.000Z', until: now, actions: [] },
    proposedAction: { type: 'REDUCE_BUDGET', targetBudgetMinor: 9500 },
  };
}
function historyAction(patch: Partial<RecentActionHistory['actions'][number]> = {}): RecentActionHistory['actions'][number] {
  return { id: 'action', businessId: 'business', adAccountId: 'account', entityId: 'adset', status: 'succeeded', attemptedAt: '2026-10-06T11:00:00.000Z', ...patch };
}

describe('PolicyEngine', () => {
  it.each([
    ['OFF', 'BLOCK'], ['SHADOW', 'SHADOW_ONLY'], ['REVIEW', 'REQUIRE_APPROVAL'], ['LIMITED_AUTO', 'ALLOW_EXECUTION'],
  ] as const)('evaluates autonomy mode %s', (mode, outcome) => {
    const input = fixture(); input.policy!.mode = mode;
    expect(engine.evaluate(input).outcome).toBe(outcome);
  });

  it.each(['policy', 'entity', 'snapshot', 'decision', 'history'] as const)('fails closed without %s', (field) => {
    const input = fixture(); input[field] = null;
    expect(engine.evaluate(input)).toMatchObject({ outcome: 'BLOCK', reason: 'INVALID_INPUT', action: null });
  });

  it.each(['HOLD', 'REVIEW_CREATIVE', 'INSUFFICIENT_DATA'] as const)('never authorizes %s', (decision) => {
    const input = fixture(); input.decision!.decision = decision;
    expect(engine.evaluate(input)).toMatchObject({ outcome: decision === 'INSUFFICIENT_DATA' ? 'BLOCK' : 'HOLD', action: null });
  });

  it.each(['INCREASE_BUDGET', 'CHANGE_AUDIENCE', 'CHANGE_CREATIVE', 'DELETE_DELIVERY_UNIT'])('rejects unsupported/destructive action %s', (decision) => {
    const input = fixture(); Object.assign(input.decision!, { decision });
    expect(engine.evaluate(input).outcome).toBe('BLOCK');
  });

  it.each(['SHADOW', 'REVIEW', 'LIMITED_AUTO'] as const)('does not bypass hard gates in %s', (mode) => {
    const input = fixture(); input.policy!.mode = mode; input.entity!.locked = true;
    expect(engine.evaluate(input).reason).toBe('LOCKED');
  });

  it('requires approval for pausing, including limited autonomy', () => {
    const input = fixture(); input.decision!.decision = 'PAUSE_DELIVERY_UNIT'; input.proposedAction = { type: 'PAUSE_DELIVERY_UNIT' };
    expect(engine.evaluate(input)).toMatchObject({ outcome: 'REQUIRE_APPROVAL', risk: 'high', reason: 'HIGH_RISK' });
    input.entity!.status = 'paused';
    expect(engine.evaluate(input).reason).toBe('NOT_ACTIVE');
  });

  it('requires an allowed, matching explicit proposal', () => {
    const input = fixture(); input.policy!.allowedActionClasses = [];
    expect(engine.evaluate(input).reason).toBe('ACTION_NOT_ALLOWED');
    input.policy!.allowedActionClasses = ['REDUCE_BUDGET']; delete input.proposedAction;
    expect(engine.evaluate(input).reason).toBe('PROPOSAL_MISMATCH');
    input.proposedAction = { type: 'PAUSE_DELIVERY_UNIT' };
    expect(engine.evaluate(input).reason).toBe('PROPOSAL_MISMATCH');
  });

  it.each(['spend', 'impressions', 'results'] as const)('enforces inclusive minimum %s', (metric) => {
    const input = fixture(); const value = input.snapshot!.windows.recent7d.metrics[metric]!;
    input.policy!.minimumEvidence[metric] = value;
    expect(engine.evaluate(input).outcome).toBe('ALLOW_EXECUTION');
    input.policy!.minimumEvidence[metric] = value + 1;
    expect(engine.evaluate(input).reason).toBe('INSUFFICIENT_DATA');
    input.snapshot!.windows.recent7d.metrics[metric] = null;
    expect(engine.evaluate(input).reason).toBe('INSUFFICIENT_DATA');
  });

  it('requires sufficient, complete windows and enough active days', () => {
    const input = fixture(); const window = input.snapshot!.windows.recent7d;
    window.activeDays = 4;
    expect(engine.evaluate(input).outcome).toBe('ALLOW_EXECUTION');
    window.activeDays = 3;
    expect(engine.evaluate(input).reason).toBe('INSUFFICIENT_DATA');
    window.activeDays = 7; window.missingDays = 1;
    expect(engine.evaluate(input).reason).toBe('INSUFFICIENT_DATA');
    window.missingDays = 0; window.dataSufficiency.status = 'insufficient';
    expect(engine.evaluate(input).reason).toBe('INSUFFICIENT_DATA');
  });

  it.each(['low', 'unknown', 'medium'] as const)('blocks inadequate tracking %s', (level) => {
    const input = fixture(); input.policy!.minimumEvidence.trackingConfidence = 'high'; input.snapshot!.trackingConfidence.level = level;
    expect(engine.evaluate(input).reason).toBe('TRACKING_INADEQUATE');
  });

  it('requires confidence at the inclusive threshold', () => {
    const input = fixture(); input.decision!.confidence = 0.8;
    expect(engine.evaluate(input).outcome).toBe('ALLOW_EXECUTION');
    input.decision!.confidence = 0.799;
    expect(engine.evaluate(input).reason).toBe('LOW_CONFIDENCE');
    input.decision!.confidence = null;
    expect(engine.evaluate(input).reason).toBe('LOW_CONFIDENCE');
  });

  it.each([NaN, Infinity, -1])('blocks invalid budgets %s', (budget) => {
    const input = fixture(); input.entity!.budgetMinor = budget;
    expect(engine.evaluate(input).reason).toBe('INVALID_INPUT');
  });

  it.each([10000, 11000, 0, 999])('blocks unchanged, increasing or out-of-bounds target %s', (targetBudgetMinor) => {
    const input = fixture(); input.proposedAction = { type: 'REDUCE_BUDGET', targetBudgetMinor };
    expect(engine.evaluate(input).reason).toBe('BUDGET_BOUNDS');
  });

  it('honors min/max budgets and percentage boundaries exactly', () => {
    const input = fixture(); input.entity!.budgetMinor = 100; input.policy!.maxBudgetMinor = 100; input.policy!.minBudgetMinor = 95;
    input.policy!.maxBudgetChangePercent = 5; input.proposedAction = { type: 'REDUCE_BUDGET', targetBudgetMinor: 95 };
    expect(engine.evaluate(input).outcome).toBe('ALLOW_EXECUTION');
    input.policy!.maxBudgetChangePercent = 4.99;
    expect(engine.evaluate(input).reason).toBe('BUDGET_CHANGE_LIMIT');
    input.policy!.maxBudgetChangePercent = 7; input.policy!.maxBudgetMinor = 99;
    expect(engine.evaluate(input).reason).toBe('BUDGET_BOUNDS');
  });

  it.each([[9500, 'low'], [9499, 'medium'], [8000, 'medium'], [7999, 'high']] as const)('classifies target %s as %s risk', (targetBudgetMinor, risk) => {
    const input = fixture(); input.policy!.maxBudgetChangePercent = 30; input.proposedAction = { type: 'REDUCE_BUDGET', targetBudgetMinor };
    expect(engine.evaluate(input)).toMatchObject({ risk, outcome: risk === 'low' ? 'ALLOW_EXECUTION' : 'REQUIRE_APPROVAL' });
  });

  it('never treats a campaign-owned budget as an ad-set budget', () => {
    const input = fixture(); input.entity!.budgetOwner = 'campaign';
    expect(engine.evaluate(input).reason).toBe('SHARED_BUDGET');
  });

  it.each(['businessId', 'adAccountId', 'entityId', 'currency', 'budgetPeriod'] as const)('blocks mismatched scope %s', (field) => {
    const input = fixture(); Object.assign(input.entity!, { [field]: field === 'budgetPeriod' ? 'lifetime' : field === 'currency' ? 'EUR' : 'other' });
    expect(engine.evaluate(input).reason).toBe('SCOPE_MISMATCH');
  });

  it('enforces cooldown up to but not including the exact end', () => {
    const input = fixture(); input.history!.actions = [historyAction({ attemptedAt: '2026-10-05T12:00:00.001Z' })];
    expect(engine.evaluate(input).reason).toBe('COOLDOWN');
    input.history!.actions[0].attemptedAt = '2026-10-05T12:00:00.000Z';
    expect(engine.evaluate(input).outcome).toBe('ALLOW_EXECUTION');
  });

  it.each(['pending', 'running', 'unknown'] as const)('blocks unresolved %s even outside the cooldown history', (status) => {
    const input = fixture(); input.history!.actions = [historyAction({ status, attemptedAt: '2026-09-01T00:00:00.000Z' })];
    expect(engine.evaluate(input).reason).toBe('ACTION_IN_FLIGHT');
  });

  it('counts failed attempts conservatively', () => {
    const input = fixture(); input.history!.actions = [historyAction({ status: 'failed' })];
    expect(engine.evaluate(input).reason).toBe('COOLDOWN');
  });

  it('counts daily changes across accounts without applying other-entity cooldowns', () => {
    const input = fixture(); input.policy!.maxDailyChanges = 2;
    input.history!.actions = [historyAction({ adAccountId: 'other' })];
    expect(engine.evaluate(input).outcome).toBe('ALLOW_EXECUTION');
    input.history!.actions.push(historyAction({ id: 'second', adAccountId: 'other' }));
    expect(engine.evaluate(input).reason).toBe('DAILY_LIMIT');
  });

  it('uses business-local dates at midnight and DST boundaries', () => {
    const input = fixture(); input.policy!.timeZone = 'America/New_York'; input.policy!.maxDailyChanges = 1;
    input.now = '2026-11-01T06:30:00.000Z'; input.entity!.observedAt = input.now;
    input.history!.until = input.now; input.history!.since = '2026-10-30T06:30:00.000Z';
    input.snapshot!.asOfDay = '2026-11-01'; input.snapshot!.windows.recent7d.untilDay = '2026-11-01'; input.snapshot!.windows.recent7d.sinceDay = '2026-10-26';
    input.history!.actions = [historyAction({ entityId: 'other', attemptedAt: '2026-11-01T03:59:59.999Z' })];
    expect(engine.evaluate(input).outcome).toBe('ALLOW_EXECUTION');
    input.history!.actions[0].attemptedAt = '2026-11-01T04:00:00.000Z';
    expect(engine.evaluate(input).reason).toBe('DAILY_LIMIT');
  });

  it('fails closed on incomplete, stale, future or duplicate history', () => {
    const input = fixture(); input.history!.complete = false;
    expect(engine.evaluate(input).reason).toBe('INCOMPLETE_HISTORY');
    input.history!.complete = true; input.history!.until = '2026-10-06T11:59:59Z';
    expect(engine.evaluate(input).reason).toBe('INCOMPLETE_HISTORY');
    input.history!.until = input.now; input.history!.actions = [historyAction({ attemptedAt: '2026-10-07T00:00:00Z' })];
    expect(engine.evaluate(input).reason).toBe('INCOMPLETE_HISTORY');
    input.history!.actions = [historyAction(), historyAction()];
    expect(engine.evaluate(input).reason).toBe('INCOMPLETE_HISTORY');
    input.history!.actions = []; input.history!.since = '2026-10-06T00:00:00Z';
    expect(engine.evaluate(input).reason).toBe('INCOMPLETE_HISTORY');
  });

  it('enforces snapshot and entity freshness boundaries', () => {
    const input = fixture(); input.entity!.observedAt = '2026-10-06T11:45:00Z';
    expect(engine.evaluate(input).outcome).toBe('ALLOW_EXECUTION');
    input.entity!.observedAt = '2026-10-06T11:44:59Z';
    expect(engine.evaluate(input).reason).toBe('STALE_DATA');
    input.entity!.observedAt = input.now; input.now = '2026-10-08T12:00:00Z'; input.entity!.observedAt = input.now;
    expect(engine.evaluate(input).reason).toBe('STALE_DATA');
  });

  it('blocks zero daily limits and zero allowed budget changes', () => {
    const input = fixture(); input.policy!.maxDailyChanges = 0;
    expect(engine.evaluate(input).reason).toBe('DAILY_LIMIT');
    input.policy!.maxDailyChanges = 3; input.policy!.maxBudgetChangePercent = 0;
    expect(engine.evaluate(input).reason).toBe('BUDGET_CHANGE_LIMIT');
  });

  it('is deterministic and does not mutate inputs', () => {
    const input = fixture(); const original = structuredClone(input);
    const first = engine.evaluate(input);
    expect(engine.evaluate(input)).toEqual(first);
    expect(input).toEqual(original);
    expect(first.action).not.toBe(input.proposedAction);
  });

  it.each(['maxDailyChanges', 'cooldownHours', 'minimumEvidence', 'maxBudgetChangePercent'])('blocks missing policy field %s', (field) => {
    const input = fixture(); Reflect.deleteProperty(input.policy!, field);
    expect(engine.evaluate(input).reason).toBe('INVALID_INPUT');
  });

  it('rejects invalid timezones and inverted budget boundaries', () => {
    const input = fixture(); input.policy!.timeZone = 'not-a-zone';
    expect(engine.evaluate(input).reason).toBe('INVALID_INPUT');
    input.policy!.timeZone = 'UTC'; input.policy!.minBudgetMinor = input.policy!.maxBudgetMinor + 1;
    expect(engine.evaluate(input).reason).toBe('INVALID_INPUT');
  });

  it('rejects future entity data and future snapshots', () => {
    const input = fixture(); input.entity!.observedAt = '2026-10-06T12:00:00.001Z';
    expect(engine.evaluate(input).reason).toBe('STALE_DATA');
    input.entity!.observedAt = input.now;
    input.snapshot!.asOfDay = '2026-10-07';
    input.snapshot!.windows.recent7d.untilDay = '2026-10-07'; input.snapshot!.windows.recent7d.sinceDay = '2026-10-01';
    expect(engine.evaluate(input).reason).toBe('STALE_DATA');
  });

  it('accepts the exact snapshot age boundary', () => {
    const input = fixture(); input.now = '2026-10-07T12:00:00Z'; input.entity!.observedAt = input.now; input.history!.until = input.now;
    expect(engine.evaluate(input).outcome).toBe('ALLOW_EXECUTION');
  });

  it('requires history coverage through the entire cooldown', () => {
    const input = fixture(); input.policy!.cooldownHours = 48;
    expect(engine.evaluate(input).outcome).toBe('ALLOW_EXECUTION');
    input.history!.since = '2026-10-04T12:00:00.001Z';
    expect(engine.evaluate(input).reason).toBe('INCOMPLETE_HISTORY');
  });

  it('blocks a foreign-business action in otherwise matching history', () => {
    const input = fixture(); input.history!.actions = [historyAction({ businessId: 'other' })];
    expect(engine.evaluate(input).reason).toBe('SCOPE_MISMATCH');
  });
  it.each(['enabled','killSwitch','allowedEntityIds','adAccountId'] as const)('requires explicit auto opt-in %s', (field) => {
    const input = fixture(); Object.assign(input.policy!.limitedAuto!,{[field]:field==='enabled'?false:field==='killSwitch'?true:field==='adAccountId'?'other':[]});
    expect(engine.evaluate(input).outcome).toBe('BLOCK');
  });
  it('blocks legacy autonomy without the new opt-in', () => {
    const input = fixture(); delete input.policy!.limitedAuto;
    expect(engine.evaluate(input).reason).toBe('AUTO_DISABLED');
  });
  it('allows only explicitly bounded low-risk pauses', () => {
    const input = fixture(); input.decision!.decision='PAUSE_DELIVERY_UNIT'; input.proposedAction={type:'PAUSE_DELIVERY_UNIT'};
    Object.assign(input.policy!.limitedAuto!,{maxPauseBudgetMinor:10000,maxPauseAccountPercent:5});
    expect(engine.evaluate(input)).toMatchObject({outcome:'ALLOW_EXECUTION',risk:'low'});
    input.policy!.limitedAuto!.maxPauseBudgetMinor=9999;
    expect(engine.evaluate(input).outcome).toBe('REQUIRE_APPROVAL');
    input.policy!.limitedAuto!.maxPauseBudgetMinor=10000; input.entity!.accountBudgetMinor=199999;
    expect(engine.evaluate(input).outcome).toBe('REQUIRE_APPROVAL');
  });
  it('enforces account limits before and after reductions and pauses', () => {
    const input = fixture(); input.policy!.limitedAuto!.maxAccountBudgetMinor=199999;
    expect(engine.evaluate(input).reason).toBe('ACCOUNT_BUDGET_BOUNDS');
    input.policy!.limitedAuto!.maxAccountBudgetMinor=200000; input.policy!.limitedAuto!.minAccountBudgetMinor=199500;
    expect(engine.evaluate(input).outcome).toBe('ALLOW_EXECUTION');
    input.policy!.limitedAuto!.minAccountBudgetMinor=199501;
    expect(engine.evaluate(input).reason).toBe('ACCOUNT_BUDGET_BOUNDS');
    delete input.entity!.accountBudgetMinor;
    expect(engine.evaluate(input).reason).toBe('ACCOUNT_BUDGET_BOUNDS');
  });
});
