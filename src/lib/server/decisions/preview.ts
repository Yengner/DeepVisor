import type { DecisionCard } from './surface';
import type { AttentionItem, DecisionsView, UnitState } from '../dashboard/overview/types';
import { dayInZone, shiftDay } from '../dashboard/overview/model';

/** URL opt-in is deliberately ignored outside local development. No persistence or providers. */
export function isDecisionPreview(value: unknown, environment = process.env.NODE_ENV) {
  return environment === 'development' && value === 'decisions';
}

export function buildDecisionPreview(now: string, zone = 'UTC') {
  const today = dayInZone(now, zone);
  const period = `${shiftDay(today, -6)} to ${today}`;
  const scenarios = [
    ['approval', 'Balayage appointments', 'Review a lower budget', 'Needs approval', 'Cost per result increased across the recent completed-day window. Review a small budget reduction.', 'Your approval is required.'],
    ['creative', 'New client consultations', 'Refresh your ad creative', null, 'The sample review recommends testing a new creative angle before changing delivery.', null],
    ['hold', 'Weekend colour', 'Keep things as they are', null, 'No delivery change was recommended by this sample evaluation.', null],
    ['shadow', 'Your next skin reset', 'Review a lower budget', 'Observation only', 'A lower budget is being considered in Shadow mode. This is an observation, not an advertising change.', 'This recommendation is being observed only.'],
    ['blocked', 'Massage appointments', 'Review pausing this ad set', 'Blocked', 'The sample recommendation cannot proceed because there is not enough recent evidence.', 'There is not enough recent performance data to support a change.'],
    ['approved', 'Fresh-start appointments', 'Review a lower budget', 'Approved - not executed', 'An owner has approved this sample proposal. No execution has been recorded.', 'Your approval was recorded.'],
    ['executed', 'Returning clients', 'Review a lower budget', 'Executed', 'This fictional historical example shows how a verified budget change appears.', 'Approved in Review mode.'],
    ['insufficient', 'New treatment launch', 'More data needed', null, 'This sample ad set has too little delivery history to support a recommendation.', null],
  ] as const;
  const cards: DecisionCard[] = scenarios.map(([id, entity, title, status, explanation, reason]) => ({
    id: `sample-${id}`, entity, title, account: 'Sample salon · Demo Meta account', createdAt: now,
    explanation, provider: 'Sample evaluation', confidence: null, probability: null,
    evaluated: ['Recent delivery and results', 'Cost per result compared with the preceding completed window'],
    evidence: id === 'insufficient' ? [{ label: 'Spend', value: '$4.00' }, { label: 'Results', value: '0' }] : [{ label: 'Spend', value: '$245.00' }, { label: 'Results', value: '28' }, { label: 'Cost per result', value: '$8.75' }],
    period,
    proposals: status ? [{
      id: `sample-proposal-${id}`, title, status, reason, detail: id === 'blocked' ? 'Pause delivery for this ad set.' : '$35.00 to $33.25 daily',
      currentValue: id === 'blocked' ? 'Active' : '$35.00 daily', proposedValue: id === 'blocked' ? 'Paused' : '$33.25 daily',
      // No valid review fingerprint is ever generated for presentation samples.
      canReview: id === 'approval', reviewFingerprint: null,
      executionHistory: id === 'executed' ? [{ status: 'Executed', startedAt: now, completedAt: now, before: '$35.00 daily (ad set)', after: '$33.25 daily (ad set)' }] : [],
    }] : [],
  }));
  const attention: AttentionItem[] = [
    { entity: cards[0].entity, title: 'Reduce daily budget 5%', detail: '$35.00 → $33.25 / day', reason: cards[0].explanation, evidence: 'Cost per result: $8.75', period, confidence: null, mode: 'REVIEW', state: 'Approval required' },
    { entity: cards[1].entity, title: cards[1].title, detail: null, reason: cards[1].explanation, evidence: 'Results: 28', period, confidence: null, mode: 'SHADOW', state: 'Shadow recommendation' },
  ];
  const activity: DecisionsView['activity'] = [
    { title: 'Advertising change completed', entity: cards[6].entity, at: now, state: 'Executed', mode: 'REVIEW' },
    { title: 'Change approved', entity: cards[5].entity, at: now, state: 'Approved', mode: 'REVIEW' },
    { title: 'Creative review recommended', entity: cards[1].entity, at: now, state: 'Shadow', mode: 'SHADOW' },
  ];
  const view: DecisionsView = {
    counts: { evaluations: 8, checked: 8, holds: 1, recommendations: 1, blocked: 1, approvals: 1, shadow: 2, executed: 1 },
    attention, activity, lastCheck: now, provenanceUnavailable: false, outcomesUnavailable: false,
  };
  return { cards, overview: { view, allAttention: attention, allActivity: activity, states: new Map<string, UnitState>(), policyUnavailable: false } };
}
