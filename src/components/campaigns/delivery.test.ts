import { describe, expect, it } from 'vitest';
import { activeDeliveryFirst, campaignTableSelection } from './delivery';
const rows = [
  { id: 'old-inactive', delivery: false },
  { id: 'live', delivery: true },
  { id: 'also-live', delivery: true },
];
describe('campaign table auto-selection', () => {
  it('selects the first displayed row, not the first source row', () => {
    expect(campaignTableSelection(rows)).toBe(activeDeliveryFirst(rows)[0].id);
    expect(campaignTableSelection(rows)).toBe('live');
  });
  it('preserves a valid manual selection or explicit deeper drilldown', () => {
    expect(campaignTableSelection(rows, 'old-inactive')).toBe('old-inactive');
  });
  it('selects the first remaining visible row when a selection is filtered out or removed', () => {
    expect(campaignTableSelection(rows.slice(1), 'old-inactive')).toBe('live');
    expect(campaignTableSelection(rows, 'removed')).toBe('live');
  });
  it('handles no active campaigns and no visible rows', () => {
    expect(campaignTableSelection(rows.slice(0, 1))).toBe('old-inactive');
    expect(campaignTableSelection([], 'live')).toBeNull();
  });
});
