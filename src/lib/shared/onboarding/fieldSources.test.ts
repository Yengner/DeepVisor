import { describe, expect, it } from 'vitest';
import { parseFieldSources, recordFieldSources } from './fieldSources';

const now = new Date('2026-11-14T12:00:00.000Z');

describe('recordFieldSources', () => {
  it('stamps only the written columns and keeps earlier entries', () => {
    const existing = { industry: { source: 'user', updated_at: '2026-11-01T00:00:00.000Z' } };
    expect(recordFieldSources(existing, ['business_name', 'location_city'], 'user', now)).toEqual({
      industry: { source: 'user', updated_at: '2026-11-01T00:00:00.000Z' },
      business_name: { source: 'user', updated_at: '2026-11-14T12:00:00.000Z' },
      location_city: { source: 'user', updated_at: '2026-11-14T12:00:00.000Z' },
    });
  });

  it('does not mutate the stored value', () => {
    const existing = { industry: { source: 'user', updated_at: 'x' } };
    recordFieldSources(existing, ['industry'], 'user', now);
    expect(existing.industry.updated_at).toBe('x');
  });
});

describe('parseFieldSources', () => {
  it('drops malformed or unknown entries', () => {
    expect(parseFieldSources({
      ok: { source: 'meta_page', updated_at: 't' },
      badSource: { source: 'guess', updated_at: 't' },
      missingTime: { source: 'user' },
      notObject: 'user',
    })).toEqual({ ok: { source: 'meta_page', updated_at: 't' } });
    expect(parseFieldSources(null)).toEqual({});
    expect(parseFieldSources([])).toEqual({});
  });
});
