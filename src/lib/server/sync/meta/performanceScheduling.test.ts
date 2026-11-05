import {expect,it,vi,afterEach,beforeEach} from 'vitest';
vi.mock('server-only',()=>({}));
vi.mock('./fetch',async importOriginal=>{
 const original=await importOriginal<typeof import('./fetch')>();
 return Object.fromEntries(Object.entries(original).map(([key,value])=>[key,typeof value==='function'?vi.fn(async()=>[]):value]));
});
import * as fetches from './fetch';
import {syncMetaPerformance} from './syncMetaPerformance';
// Hourly retention is relative to the current account-local day, not syncedAt.
beforeEach(()=>{
 vi.useFakeTimers({toFake:['Date']});
 vi.setSystemTime(new Date('2026-10-29T12:00:00Z'));
});
afterEach(()=>{vi.useRealTimers();vi.clearAllMocks();});
const input={supabase:{} as Parameters<typeof syncMetaPerformance>[0]['supabase'],adAccounts:[{id:'account',external_account_id:'act_1',timezone:'UTC',currency_code:'USD'}] as Parameters<typeof syncMetaPerformance>[0]['adAccounts'],campaignsByExternalId:new Map(),adsetsByExternalId:new Map(),adsByExternalId:new Map(),accessToken:'mock-only',syncedAt:'2026-10-29T12:00:00Z',dateRange:{since:'2026-10-23',until:'2026-10-29'}};
it('skips broad snapshots on recent subsequent windows while fetching daily/hourly measurements',async()=>{
 await syncMetaPerformance({...input,refreshAudience:false,refreshSummaries:false});
 expect(fetches.fetchMetaAdsetAudienceBreakdownSeeds).not.toHaveBeenCalled();expect(fetches.fetchMetaAdPerformanceSummarySeeds).not.toHaveBeenCalled();
 expect(fetches.fetchMetaAdsetPerformanceSeeds).toHaveBeenCalledOnce();expect(fetches.fetchMetaAdsetHourlyPerformanceSeeds).toHaveBeenCalledOnce();
});
it('refreshes snapshots once when explicitly requested and reports no invented account daily writes',async()=>{
 const result=await syncMetaPerformance(input);
 expect(fetches.fetchMetaAdsetAudienceBreakdownSeeds).toHaveBeenCalledOnce();expect(fetches.fetchMetaAdAudienceBreakdownSeeds).toHaveBeenCalledOnce();
 expect(fetches.fetchMetaAdPerformanceSummarySeeds).toHaveBeenCalledOnce();expect(result.adAccountPerformanceRows).toBe(0);
});

it('skips expired hourly windows while continuing daily measurements',async()=>{
 vi.setSystemTime(new Date('2026-11-10T12:00:00Z'));
 await syncMetaPerformance({...input,refreshAudience:false,refreshSummaries:false});
 expect(fetches.fetchMetaAdsetPerformanceSeeds).toHaveBeenCalledOnce();
 expect(fetches.fetchMetaAdsetHourlyPerformanceSeeds).not.toHaveBeenCalled();
 expect(fetches.fetchMetaAdHourlyPerformanceSeeds).not.toHaveBeenCalled();
});
it.each([
 ['UTC','2026-10-24'],
 ['America/New_York','2026-10-23'],
])('clips hourly retention using the current local day in %s',async(timezone,since)=>{
 vi.setSystemTime(new Date('2026-10-30T01:00:00Z'));
 await syncMetaPerformance({...input,adAccounts:input.adAccounts.map(account=>({...account,timezone})),refreshAudience:false,refreshSummaries:false});
 expect(fetches.fetchMetaAdsetHourlyPerformanceSeeds).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({dateRange:{since,until:'2026-10-29'}}));
 expect(fetches.fetchMetaAdHourlyPerformanceSeeds).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({dateRange:{since,until:'2026-10-29'}}));
 expect(fetches.fetchMetaAdsetPerformanceSeeds).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({dateRange:input.dateRange}));
});
