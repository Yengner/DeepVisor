import { afterEach, expect, it, vi } from 'vitest';
vi.mock('server-only',()=>({}));
import { resolveMetaBackfillWindow } from './client';
import { accountToday } from '@/lib/shared/reports/dates';
afterEach(()=>vi.useRealTimers());
it('initial history contains 30 completed advertiser days plus the partial day at UTC midnight',()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-23T01:00:00Z'));
  const accountDay=accountToday('America/New_York')!;
  expect(resolveMetaBackfillWindow(30,{accountDay,includePartialDayBuffer:true})).toEqual({since:'2026-09-22',until:'2026-10-22',backfillDays:31});
  expect(resolveMetaBackfillWindow(30)).toEqual({since:'2026-09-24',until:'2026-10-23',backfillDays:30});
});
