import { describe, expect, it } from 'vitest';
import { computeTrackingConfidence, computeTrendSnapshot } from './metrics';

describe('legacy assessment metrics', () => {
  it('preserves legacy zero-baseline percentages', () => {
    expect(computeTrendSnapshot({ currentValue: 5, previousValue: 0 })).toEqual({
      direction: 'up', deltaAbsolute: 5, deltaPercent: 100, currentValue: 5, previousValue: 0,
    });
    expect(computeTrendSnapshot({ currentValue: 0, previousValue: 0 })).toMatchObject({ direction: 'flat', deltaPercent: null });
  });

  it('preserves rounding and decrease direction', () => {
    expect(computeTrendSnapshot({ currentValue: 5, previousValue: 15 })).toMatchObject({
      direction: 'down', deltaAbsolute: -10, deltaPercent: -66.67,
    });
  });

  it.each([
    [10, 0, 0, 'high'], [2, 25, 30, 'medium'], [0, 20, 50, 'low'],
    [0, 1, 1, 'medium'], [0, 0, 0, 'low'],
  ] as const)('preserves tracking heuristic for %s results/%s link clicks/%s clicks', (conversion, linkClicks, clicks, expected) => {
    expect(computeTrackingConfidence({ conversion, linkClicks, clicks })).toBe(expected);
  });
});
