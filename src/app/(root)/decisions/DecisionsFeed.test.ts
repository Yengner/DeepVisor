import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MantineProvider } from '@mantine/core';
vi.mock('./actions', () => ({ reviewDecisionAction: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import DecisionsFeed from './DecisionsFeed';
import { buildDecisionPreview } from '@/lib/server/decisions/preview';
import { reviewDecisionAction } from './actions';

describe('preview decision reviews', () => {
  it('renders disabled review controls even with owner access and a fingerprint', () => {
    const cards = buildDecisionPreview('2026-10-07T16:00:00Z').cards;
    cards[0].proposals[0].reviewFingerprint = 'must-not-be-used';
    const html = renderToStaticMarkup(createElement(MantineProvider, null,
      createElement(DecisionsFeed, { cards, canReview: true, preview: true })));
    const buttons = html.match(/<button\b[^>]*>/g) ?? [];
    expect(buttons).toHaveLength(2);
    expect(buttons.every(button => /\bdisabled(?:[ =]|>)/.test(button))).toBe(true);
    expect(html).toContain('Preview only. Reviews cannot be saved.');
    expect(html).toContain('No change recommended');
    expect(html).toContain('Observed before');
    expect(html).not.toContain('% confidence');
    expect(reviewDecisionAction).not.toHaveBeenCalled();
  });
});
