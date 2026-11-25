import { describe, expect, it } from 'vitest';
import { defaultNaming, renderName } from './naming';

describe('deterministic names', () => {
  it('formats known values and omits missing parts', () => {
    expect(renderName(defaultNaming.ad, { Concept: 'Hair', Version: 'V02', LaunchDate: '2026-09-19' }, defaultNaming)).toBe('Hair | V02 | 2026-09-19');
    expect(renderName(defaultNaming.ad, { Concept: 'Hair', LaunchDate: '2026-09-19' }, { ...defaultNaming, dateFormat: 'DD/MM/YYYY', separator: ' / ' })).toBe('Hair / 19/09/2026');
    expect(renderName(defaultNaming.campaign, {}, defaultNaming)).toBe('');
  });

  it('rejects invented tokens and names longer than Meta allows', () => {
    expect(() => renderName('{Revenue}', {}, defaultNaming)).toThrow('Unknown naming token');
    expect(() => renderName(defaultNaming.campaign, { Initiative: 'x'.repeat(256) }, defaultNaming)).toThrow('255');
  });
});
