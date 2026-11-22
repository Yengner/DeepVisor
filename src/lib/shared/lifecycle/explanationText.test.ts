import { describe, expect, it } from 'vitest';
import en from '../../../../messages/en.json';
import es from '../../../../messages/es.json';
import { changes, type Observation } from './model';
import { lifecycleExplanation, recognizeExplanation, type LifecycleTranslate } from './explanationText';

const PREVIOUS = '2026-11-20T00:00:00Z';
const NOW = '2026-11-21T00:00:00Z';
const obs = (id: string, level: string, over: Partial<Observation> = {}): Observation => ({
  id, level, parent: null, campaign: null, name: `${id} name`, configured: 'ACTIVE', effective: 'ACTIVE',
  end: null, start: null, dailyBudget: null, lifetimeBudget: null, targeting: null, ...over,
});

/** Every situation `changes()` writes an explanation for, ad level and campaign level. */
const scenarios: Array<[string, Observation[], Observation[]]> = [
  ['ad goes live', [obs('ad', 'ad', { effective: 'PENDING_REVIEW' })], [obs('ad', 'ad')]],
  ['ad paused', [obs('ad', 'ad')], [obs('ad', 'ad', { configured: 'PAUSED', effective: 'PAUSED' })]],
  ['ad paused by its campaign', [obs('c1', 'campaign'), obs('ad', 'ad', { campaign: 'c1' })],
    [obs('c1', 'campaign', { configured: 'PAUSED', effective: 'PAUSED' }), obs('ad', 'ad', { campaign: 'c1', effective: 'CAMPAIGN_PAUSED' })]],
  ['ad archived', [obs('ad', 'ad')], [obs('ad', 'ad', { effective: 'ARCHIVED' })]],
  ['ad cannot deliver', [obs('ad', 'ad')], [obs('ad', 'ad', { effective: 'DISAPPROVED' })]],
  ['ad reaches its end', [obs('ad', 'ad', { end: '2026-11-20T12:00:00Z' })], [obs('ad', 'ad', { end: '2026-11-20T12:00:00Z' })]],
  ['campaign paused', [obs('c1', 'campaign')], [obs('c1', 'campaign', { configured: 'PAUSED', effective: 'PAUSED' })]],
  ['campaign archived', [obs('c1', 'campaign')], [obs('c1', 'campaign', { effective: 'ARCHIVED' })]],
  ['campaign resumed', [obs('c1', 'campaign', { configured: 'PAUSED', effective: 'PAUSED' })], [obs('c1', 'campaign')]],
  ['campaign reaches its end', [obs('c1', 'campaign', { end: '2026-11-20T12:00:00Z' })], [obs('c1', 'campaign', { end: '2026-11-20T12:00:00Z' })]],
];

function translatorFor(messages: typeof en): LifecycleTranslate {
  return (key, values = {}) => {
    const found = (messages.lifecycleText as Record<string, unknown>)[key];
    if (typeof found !== 'string') throw new Error(`Missing lifecycleText.${key}`);
    return found.replace(/\{(\w+)\}/g, (_, name) => {
      if (!(name in values)) throw new Error(`lifecycleText.${key} needs {${name}}`);
      return values[name];
    });
  };
}

describe('lifecycle explanations', () => {
  for (const [label, before, after] of scenarios) {
    it(`recognises the sentence for: ${label}`, () => {
      const [change] = changes(before, after, PREVIOUS, NOW);
      expect(change, 'changes() should report this').toBeDefined();
      expect(recognizeExplanation(change.explanation), change.explanation).not.toBeNull();
    });

    for (const [locale, messages] of [['en', en], ['es', es]] as const) {
      it(`words it in ${locale}: ${label}`, () => {
        const [change] = changes(before, after, PREVIOUS, NOW);
        const words = lifecycleExplanation(change.explanation, translatorFor(messages));
        if (locale === 'en') expect(words).toBe(change.explanation.replace('the exact time delivery', 'when delivery'));
        else expect(words).not.toBe(change.explanation);
      });
    }
  }

  it('puts the entity name into the Spanish sentence', () => {
    const [change] = changes(
      [obs('c1', 'campaign', { name: 'Spring promo' })],
      [obs('c1', 'campaign', { name: 'Spring promo', configured: 'PAUSED', effective: 'PAUSED' })],
      PREVIOUS, NOW);
    expect(lifecycleExplanation(change.explanation, translatorFor(es))).toBe('Meta ahora reporta que Spring promo está en pausa.');
  });

  it('keeps the saved text for a sentence it does not know', () => {
    expect(lifecycleExplanation('Something older.', translatorFor(es))).toBe('Something older.');
  });
});
