import { describe, expect, it } from 'vitest';
import { buildDecisionPreview, isDecisionPreview } from './preview';
import { meaningfulConfidence } from '@/components/product/presentation';

describe('isolated decision presentation preview', () => {
  it('requires explicit opt-in and never activates in production or tests', () => {
    expect(isDecisionPreview('decisions', 'development')).toBe(true);
    for (const environment of ['production', 'test'] as const) expect(isDecisionPreview('decisions', environment)).toBe(false);
    for (const value of [undefined, '', 'true', ['decisions']]) expect(isDecisionPreview(value, 'development')).toBe(false);
  });
  it('provides approval, shadow, blocked, approved, executed, HOLD and insufficient-data examples', () => {
    const { cards } = buildDecisionPreview('2026-10-07T16:00:00Z');
    expect(cards).toHaveLength(8);
    expect(cards.flatMap(c => c.proposals.map(p => p.status))).toEqual(['Needs approval', 'Observation only', 'Blocked', 'Approved - not executed', 'Executed']);
    expect(cards.some(c => c.title === 'Keep things as they are')).toBe(true);
    expect(cards.some(c => c.title === 'More data needed')).toBe(true);
  });
  it('never creates executable identifiers, valid review fingerprints or fabricated confidence', () => {
    const { cards } = buildDecisionPreview('2026-10-07T16:00:00Z');
    for (const card of cards) {
      expect(card.id).toMatch(/^sample-/);
      expect(meaningfulConfidence(card.provider, card.probability, card.confidence)).toBeNull();
      for (const proposal of card.proposals) {
        expect(proposal.id).toMatch(/^sample-proposal-/);
        expect(proposal.reviewFingerprint).toBeNull();
      }
    }
  });
  it('uses the same sample entities and changes on Overview and Decisions', () => {
    const sample = buildDecisionPreview('2026-10-07T16:00:00Z');
    expect(sample.overview.view.attention[0].entity).toBe(sample.cards[0].entity);
    expect(sample.overview.allAttention).toHaveLength(2);
    expect(sample.overview.view.counts.executed).toBe(1);
    const executed = sample.cards.find(c => c.id === 'sample-executed')!.proposals[0];
    expect(executed.executionHistory?.[0]).toMatchObject({ before: '$35.00 daily (ad set)', after: '$33.25 daily (ad set)' });
    expect(sample.cards.find(c => c.id === 'sample-approved')!.proposals[0].executionHistory).toEqual([]);
  });
  it('is deterministic and dates evidence in the supplied account timezone', () => {
    const a = buildDecisionPreview('2026-10-07T01:00:00Z', 'America/New_York');
    expect(a).toEqual(buildDecisionPreview('2026-10-07T01:00:00Z', 'America/New_York'));
    expect(a.cards[0].period).toBe('2026-09-30 to 2026-10-06');
  });
});
