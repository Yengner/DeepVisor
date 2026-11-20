import { describe, expect, it, vi } from 'vitest';
vi.mock('@/components/brand/SpiderMascot', () => ({ default: () => null }));
import { flashTone } from './TickerNumber';

describe('flashTone', () => {
  it('shows more conversations as good news and fewer as bad', () => {
    expect(flashTone(10, 14, 'up-good')).toBe('good');
    expect(flashTone(14, 10, 'up-good')).toBe('bad');
  });
  it('shows a higher cost per conversation as bad news and a lower one as good', () => {
    expect(flashTone(2.5, 3.1, 'up-bad')).toBe('bad');
    expect(flashTone(3.1, 2.5, 'up-bad')).toBe('good');
  });
  it('keeps spend neutral either way', () => {
    expect(flashTone(20, 35, 'neutral')).toBe('neutral');
    expect(flashTone(35, 20, 'neutral')).toBe('neutral');
  });
  it('never colours a change it cannot judge (missing data or no real change)', () => {
    expect(flashTone(null, 12, 'up-good')).toBe('neutral');
    expect(flashTone(12, null, 'up-good')).toBe('neutral');
    expect(flashTone(12, 12, 'up-good')).toBe('neutral');
  });
});
