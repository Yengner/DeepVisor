import { describe, expect, it } from 'vitest';
import { normalizeSavedViewName, normalizeSavedViewQuery, savedViewRangeLabel } from './savedViews';

describe('saved report views', () => {
  it('keeps only report parameters and drops unknown or malformed values', () => {
    expect(normalizeSavedViewQuery('?ad_account_id=abc-1&demo=1&group_by=week&compare=yes&campaign_id=x%3Cscript%3E'))
      .toBe('ad_account_id=abc-1&group_by=week');
  });
  it('stores a rolling preset instead of the dates it resolved to', () => {
    expect(normalizeSavedViewQuery('date_from=2026-10-14&date_to=2026-11-12&compare=previous_period', 30))
      .toBe('compare=previous_period&preset=30');
  });
  it('keeps fixed dates for a custom range and clears dates for all history', () => {
    expect(normalizeSavedViewQuery('date_from=2026-10-01&date_to=2026-10-31')).toBe('date_from=2026-10-01&date_to=2026-10-31');
    expect(normalizeSavedViewQuery('range=max&date_from=2026-10-01&date_to=2026-10-31&compare=previous_period')).toBe('range=max');
  });
  it('validates names and describes ranges', () => {
    expect(normalizeSavedViewName('  Monthly   client  ')).toBe('Monthly client');
    expect(normalizeSavedViewName('')).toBeNull();
    expect(normalizeSavedViewName('x'.repeat(81))).toBeNull();
    expect(savedViewRangeLabel('preset=7')).toBe('Rolling 7 days');
    expect(savedViewRangeLabel('range=max')).toBe('All saved history');
    expect(savedViewRangeLabel('date_from=2026-10-01&date_to=2026-10-31')).toBe('Oct 1 – Oct 31, 2026');
  });
});
