import { z } from 'zod';
import { FEATURE_SCHEMA_VERSION } from '@/lib/server/features';
import { validateDecisionResult } from '../validation';
import type { PolicyInput, PolicyReason, PolicyResult } from './types';

const id = z.string().trim().min(1);
const timestamp = z.string().datetime({ offset: true });
const number = z.number().finite().nonnegative();
const money = number.int().max(Number.MAX_SAFE_INTEGER);
const timeZone = id.refine((value) => {
  try { new Intl.DateTimeFormat('en', { timeZone: value }); return true; } catch { return false; }
});
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
});
const actionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('REDUCE_BUDGET'), targetBudgetMinor: money }).strict(),
  z.object({ type: z.literal('PAUSE_DELIVERY_UNIT') }).strict(),
]);
const inputSchema = z.object({
  now: timestamp,
  policy: z.object({
    businessId: id, mode: z.enum(['SHADOW', 'REVIEW', 'LIMITED_AUTO', 'OFF']), timeZone,
    currency: z.string().regex(/^[A-Z]{3}$/), budgetPeriod: z.enum(['daily', 'lifetime']),
    allowedActionClasses: z.array(z.enum(['REDUCE_BUDGET', 'PAUSE_DELIVERY_UNIT'])),
    minimumEvidence: z.object({
      spend: number, impressions: number.int(), results: number.int(), activeDays: number.int().min(4).max(7),
      decisionConfidence: z.number().finite().positive().max(1), trackingConfidence: z.enum(['medium', 'high']),
      maxSnapshotAgeDays: number.int().max(30), maxEntityAgeMinutes: number.positive().max(1440),
    }),
    maxBudgetChangePercent: number.max(100).multipleOf(0.01), minBudgetMinor: money, maxBudgetMinor: money,
    cooldownHours: number.max(8760), maxDailyChanges: number.int(),
    limitedAuto: z.object({
      adAccountId: id,
      enabled: z.boolean(), killSwitch: z.boolean(), allowedEntityIds: z.array(id).min(1),
      minAccountBudgetMinor: money, maxAccountBudgetMinor: money,
      maxPauseBudgetMinor: money, maxPauseAccountPercent: number.max(5).multipleOf(0.01),
    }).refine((limits) => limits.minAccountBudgetMinor <= limits.maxAccountBudgetMinor).optional(),
  }).refine((policy) => policy.minBudgetMinor <= policy.maxBudgetMinor),
  entity: z.object({
    businessId: id, adAccountId: id, entityId: id, platform: z.literal('meta'), entityType: z.literal('adset'),
    status: z.enum(['active', 'paused']), locked: z.boolean(), budgetOwner: z.enum(['adset', 'campaign']),
    budgetMinor: money, currency: z.string().regex(/^[A-Z]{3}$/), budgetPeriod: z.enum(['daily', 'lifetime']),
    timeZone, observedAt: timestamp,
    accountBudgetMinor: money.optional(),
  }),
  snapshot: z.object({
    schemaVersion: z.literal(FEATURE_SCHEMA_VERSION), asOfDay: day,
    deliveryUnit: z.object({ businessId: id, adAccountId: id, adsetId: id, currency: id, platform: z.literal('meta'), entityType: z.literal('adset') }),
    windows: z.object({ recent7d: z.object({
      sinceDay: day, untilDay: day, expectedDays: z.literal(7), observedDays: number.int().max(7),
      missingDays: number.int().max(7), activeDays: number.int().max(7),
      metrics: z.object({ spend: number.nullable(), impressions: number.nullable(), results: number.nullable() }),
      dataSufficiency: z.object({ status: z.enum(['sufficient', 'insufficient']), reasons: z.array(z.string()) }),
    }) }),
    trackingConfidence: z.object({ level: z.enum(['unknown', 'low', 'medium', 'high']) }),
  }),
  history: z.object({
    businessId: id, complete: z.boolean(), since: timestamp, until: timestamp,
    actions: z.array(z.object({
      id, businessId: id, adAccountId: id, entityId: id,
      status: z.enum(['pending', 'running', 'succeeded', 'failed', 'unknown']), attemptedAt: timestamp,
    })),
  }),
  proposedAction: actionSchema.optional(),
});

function dayInZone(time: number, zone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(time);
  return ['year', 'month', 'day'].map((type) => parts.find((part) => part.type === type)!.value).join('-');
}

/** Pure authorization check. It neither persists proposals nor executes them. */
export class PolicyEngine {
  evaluate(input: PolicyInput): PolicyResult {
    const result = (outcome: PolicyResult['outcome'], reason: PolicyReason, risk: PolicyResult['risk'] = null,
      action: PolicyResult['action'] = null): PolicyResult => ({ policySchemaVersion: 1, outcome, reason, risk, action });
    const block = (reason: PolicyReason) => result('BLOCK', reason);
    const parsed = inputSchema.safeParse(input);
    if (!parsed.success) return block('INVALID_INPUT');
    let decision;
    try { decision = validateDecisionResult(input.decision); } catch { return block('INVALID_INPUT'); }
    const { policy, entity, snapshot, history, proposedAction } = parsed.data;
    const now = Date.parse(parsed.data.now);
    const unit = snapshot.deliveryUnit;
    if (policy.businessId !== entity.businessId || unit.businessId !== entity.businessId ||
      history.businessId !== entity.businessId || unit.adAccountId !== entity.adAccountId || unit.adsetId !== entity.entityId ||
      policy.currency !== entity.currency || unit.currency !== entity.currency || policy.budgetPeriod !== entity.budgetPeriod ||
      history.actions.some((action) => action.businessId !== entity.businessId)) return block('SCOPE_MISMATCH');
    if (policy.mode === 'OFF') return block('OFF');
    if (decision.decision === 'HOLD') return result('HOLD', 'NO_ACTION');
    if (decision.decision === 'REVIEW_CREATIVE') return result('HOLD', 'RECOMMENDATION_ONLY', 'low');
    if (decision.decision === 'INSUFFICIENT_DATA') return block('INSUFFICIENT_DATA');
    if (entity.locked) return block('LOCKED');
    if (entity.status !== 'active') return block('NOT_ACTIVE');
    if (!policy.allowedActionClasses.includes(decision.decision)) return block('ACTION_NOT_ALLOWED');
    if (!proposedAction || proposedAction.type !== decision.decision) return block('PROPOSAL_MISMATCH');
    if (policy.mode === 'LIMITED_AUTO') {
      const auto = policy.limitedAuto;
      if (!auto?.enabled || auto.killSwitch || auto.adAccountId !== entity.adAccountId || !auto.allowedEntityIds.includes(entity.entityId)) return block('AUTO_DISABLED');
      if (entity.budgetOwner !== 'adset' || entity.budgetPeriod !== 'daily') return block('SHARED_BUDGET');
      if (entity.budgetMinor <= 0 || entity.budgetMinor < policy.minBudgetMinor || entity.budgetMinor > policy.maxBudgetMinor) return block('BUDGET_BOUNDS');
      const total = entity.accountBudgetMinor;
      const reduction = proposedAction.type === 'REDUCE_BUDGET' ? entity.budgetMinor - proposedAction.targetBudgetMinor : entity.budgetMinor;
      if (total === undefined || total < entity.budgetMinor || total < auto.minAccountBudgetMinor || total > auto.maxAccountBudgetMinor ||
        total - reduction < auto.minAccountBudgetMinor || total - reduction > auto.maxAccountBudgetMinor) return block('ACCOUNT_BUDGET_BOUNDS');
    }

    const minimum = policy.minimumEvidence;
    const window = snapshot.windows.recent7d;
    const windowDays = (Date.parse(window.untilDay) - Date.parse(window.sinceDay)) / 86400000 + 1;
    if (window.dataSufficiency.status !== 'sufficient' || window.dataSufficiency.reasons.length || window.missingDays !== 0 ||
      window.observedDays !== 7 || windowDays !== 7 || window.untilDay !== snapshot.asOfDay ||
      window.activeDays < minimum.activeDays || window.metrics.spend === null || window.metrics.impressions === null || window.metrics.results === null ||
      window.metrics.spend < minimum.spend || window.metrics.impressions < minimum.impressions || window.metrics.results < minimum.results) return block('INSUFFICIENT_DATA');
    if (decision.confidence === null || decision.confidence < minimum.decisionConfidence) return block('LOW_CONFIDENCE');
    const tracking = snapshot.trackingConfidence.level;
    if (tracking === 'low' || tracking === 'unknown' || (minimum.trackingConfidence === 'high' && tracking !== 'high')) return block('TRACKING_INADEQUATE');
    const snapshotAge = (Date.parse(dayInZone(now, entity.timeZone)) - Date.parse(snapshot.asOfDay)) / 86400000;
    const entityAge = now - Date.parse(entity.observedAt);
    if (snapshotAge < 0 || snapshotAge > minimum.maxSnapshotAgeDays || entityAge < 0 || entityAge > minimum.maxEntityAgeMinutes * 60000) return block('STALE_DATA');

    const cooldownMs = policy.cooldownHours * 3600000;
    // 26 hours covers the current business-local day, including DST transitions.
    const coverageStart = now - Math.max(cooldownMs, 26 * 3600000);
    if (!history.complete || Date.parse(history.since) > coverageStart || Date.parse(history.until) !== now ||
      new Set(history.actions.map((action) => action.id)).size !== history.actions.length ||
      history.actions.some((action) => Date.parse(action.attemptedAt) > now ||
        (['succeeded', 'failed'].includes(action.status) && Date.parse(action.attemptedAt) < Date.parse(history.since)))) return block('INCOMPLETE_HISTORY');
    const entityActions = history.actions.filter((action) => action.entityId === entity.entityId && action.adAccountId === entity.adAccountId);
    if (entityActions.some((action) => ['pending', 'running', 'unknown'].includes(action.status))) return block('ACTION_IN_FLIGHT');
    if (entityActions.some((action) => now - Date.parse(action.attemptedAt) < cooldownMs)) return block('COOLDOWN');
    const businessDay = dayInZone(now, policy.timeZone);
    if (history.actions.filter((action) => dayInZone(Date.parse(action.attemptedAt), policy.timeZone) === businessDay).length >= policy.maxDailyChanges) return block('DAILY_LIMIT');

    let risk: 'low' | 'medium' | 'high' = 'high';
    if (proposedAction.type === 'REDUCE_BUDGET') {
      if (entity.budgetOwner !== 'adset') return block('SHARED_BUDGET');
      const current = entity.budgetMinor;
      const target = proposedAction.targetBudgetMinor;
      if (current <= 0 || target <= 0 || target >= current || current < policy.minBudgetMinor || current > policy.maxBudgetMinor ||
        target < policy.minBudgetMinor || target > policy.maxBudgetMinor) return block('BUDGET_BOUNDS');
      // Compare integer basis points to avoid floating-point errors at budget boundaries.
      const change = BigInt(current - target) * BigInt(10000);
      const budget = BigInt(current);
      if (change > budget * BigInt(Math.round(policy.maxBudgetChangePercent * 100))) return block('BUDGET_CHANGE_LIMIT');
      risk = change <= budget * BigInt(500) ? 'low' : change <= budget * BigInt(2000) ? 'medium' : 'high';
    }
    if (policy.mode === 'SHADOW') return result('SHADOW_ONLY', 'SHADOW_MODE', risk, proposedAction);
    if (policy.mode === 'REVIEW') return result('REQUIRE_APPROVAL', 'REVIEW_MODE', risk, proposedAction);
    if (proposedAction.type === 'PAUSE_DELIVERY_UNIT') {
      const auto = policy.limitedAuto!;
      if (entity.budgetMinor <= auto.maxPauseBudgetMinor &&
        BigInt(entity.budgetMinor) * BigInt(10000) <= BigInt(entity.accountBudgetMinor!) * BigInt(Math.round(auto.maxPauseAccountPercent * 100))) risk = 'low';
    }
    if (risk !== 'low') return result('REQUIRE_APPROVAL', risk === 'high' ? 'HIGH_RISK' : 'NOT_LOW_RISK', risk, proposedAction);
    return result('ALLOW_EXECUTION', 'POLICY_PASSED', risk, proposedAction);
  }
}
