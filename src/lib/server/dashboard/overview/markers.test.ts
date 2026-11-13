import { describe, expect, it } from 'vitest';
import { chartMarkers, localDay } from './markers';

describe('chartMarkers', () => {
  it('marks launches and lifecycle events in advertiser-local days within the window', () => {
    const markers = chartMarkers(
      [
        { entity_level: 'ad', name: 'A', raw: { created_time: '2026-11-08T03:00:00Z' } }, // Nov 7 in New York
        { entity_level: 'adset', name: 'S', raw: { start_time: '2026-11-09T15:00:00-0500' } },
        { entity_level: 'campaign', name: 'C', raw: { start_time: '2026-10-01T00:00:00Z' } }, // outside window
        { entity_level: 'ad', name: 'B', raw: {} },
      ],
      [{ kind: 'paused', created_at: '2026-11-09T20:00:00Z' }, { kind: 'unavailable', created_at: '2026-11-10T20:00:00Z' }],
      '2026-11-06', '2026-11-12', 'America/New_York',
    );
    expect(markers).toEqual([
      { day: '2026-11-07', label: 'New ad' },
      { day: '2026-11-09', label: 'Ad set started, Ad paused' },
    ]);
  });
  it('ignores invalid timestamps and zones', () => {
    expect(localDay('not a date', 'UTC')).toBeNull();
    expect(localDay('2026-11-09T00:00:00Z', 'Not/AZone')).toBeNull();
  });
});
