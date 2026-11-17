import { describe, expect, it } from 'vitest';
import { quickAdMaxBytes, quickAdMediaProblem } from './media';

const MB = 1024 * 1024;

describe('quick ad media limits', () => {
  it('allows photos up to 30 MB and videos up to 50 MB', () => {
    expect(quickAdMaxBytes('image/jpeg')).toBe(30 * MB);
    expect(quickAdMaxBytes('video/mp4')).toBe(50 * MB);
    expect(quickAdMediaProblem('image/png', 30 * MB)).toBeNull();
    expect(quickAdMediaProblem('image/png', 30 * MB + 1)).toBe('size');
    expect(quickAdMediaProblem('video/webm', 50 * MB)).toBeNull();
    expect(quickAdMediaProblem('video/webm', 50 * MB + 1)).toBe('size');
  });

  it('rejects other types and empty or invalid sizes', () => {
    expect(quickAdMaxBytes('image/gif')).toBeNull();
    expect(quickAdMediaProblem('text/html', 10)).toBe('type');
    expect(quickAdMediaProblem('image/png', 0)).toBe('size');
    expect(quickAdMediaProblem('image/png', Number.NaN)).toBe('size');
    expect(quickAdMediaProblem('image/png', 1.5)).toBe('size');
  });
});
