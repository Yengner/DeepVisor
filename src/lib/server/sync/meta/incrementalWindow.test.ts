import { expect, it } from 'vitest';
import { incrementalWindow } from './incrementalWindow';
it('re-reads recent attribution instead of fetching only the already-covered current day',()=>{
 expect(incrementalWindow('2026-10-20','2026-10-20',7)).toEqual({since:'2026-10-14',until:'2026-10-20',backfillDays:7});
});
it('retains catch-up coverage after interruption longer than the attribution window',()=>{
 expect(incrementalWindow('2026-09-20','2026-10-20',7)).toEqual({since:'2026-09-20',until:'2026-10-20',backfillDays:31});
});
