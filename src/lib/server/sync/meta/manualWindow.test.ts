import { expect, it } from 'vitest';
import { manualMetaWindow } from './manualWindow';
it('includes thirty account-local calendar days including today, across DST', () => {
  expect(manualMetaWindow('America/New_York', new Date('2026-11-02T01:00:00Z'))).toEqual({ since: '2026-10-03', until: '2026-11-01', backfillDays: 30 });
  expect(manualMetaWindow('Asia/Tokyo', new Date('2026-10-08T23:00:00Z')).until).toBe('2026-10-09');
});
it('does not turn invalid timezone metadata into an unbounded backfill', () => {
  expect(() => manualMetaWindow('invalid-zone')).toThrow();
});
