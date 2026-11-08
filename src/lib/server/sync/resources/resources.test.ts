import { afterEach, expect, it, vi } from 'vitest';
vi.mock('server-only',()=>({}));
import { performanceRange } from './coordinator';
import { usagePercent, retrySeconds, withResourceBudget, budgetedRead } from './budget';
import { creativeNeedsRefresh } from './creativeFreshness';
import type { RepositoryClient } from '@/lib/server/repositories/utils';
import { fetchMetaCollection } from '../meta/client';
afterEach(()=>vi.unstubAllGlobals());
it('uses advertiser-local days across DST and midnight',()=>{
 expect(performanceRange('America/New_York','app_visit',new Date('2026-11-01T03:59:00Z'))).toEqual({since:'2026-10-30',until:'2026-10-31'});
 expect(performanceRange('America/New_York','app_visit',new Date('2026-11-01T06:01:00Z'))).toEqual({since:'2026-10-31',until:'2026-11-01'});
 expect(performanceRange('America/New_York','scheduled_refresh',new Date('2026-11-01T06:01:00Z'))).toEqual({since:'2026-10-26',until:'2026-11-01'});
 expect(()=>performanceRange(null,'app_visit')).toThrow('timezone');
});
it('parses only aggregate quota metrics and bounds Retry-After',()=>{
 expect(usagePercent('{"123":[{"call_count":42,"total_time":83,"type":"ads_insights"}]}')).toBe(83);
 expect(usagePercent('malformed')).toBeNull();expect(retrySeconds('999999999')).toBe(86400);
 expect(retrySeconds('Sat, 07 Nov 2026 12:01:00 GMT',Date.parse('2026-11-07T12:00:00Z'))).toBe(60);
});
it('never contacts Meta without a shared budget permit',async()=>{
 const rpc=vi.fn().mockResolvedValue({data:null,error:null}),fetch=vi.fn();
 await expect(withResourceBudget({rpc} as unknown as RepositoryClient,'account',()=>budgetedRead(fetch))).rejects.toThrow('provider_cooldown');
 expect(fetch).not.toHaveBeenCalled();
});
it('releases admission on HTTP failure and records provider cooldown',async()=>{
 const rpc=vi.fn().mockResolvedValueOnce({data:'lease',error:null}).mockResolvedValue({error:null});
 await withResourceBudget({rpc} as unknown as RepositoryClient,'account',()=>budgetedRead(async()=>new Response('',{status:429,headers:{'retry-after':'600','x-app-usage':'{"call_count":85}'}})));
 expect(rpc).toHaveBeenLastCalledWith('finish_meta_read',expect.objectContaining({p_lease:'lease',p_app_usage:85,p_retry_seconds:600}));
});
it('refreshes changed, missing, expired or old media while reusing recent media',()=>{
 const now=Date.parse('2026-11-07T12:00:00Z');
 const saved={updated_at:'2026-11-07T11:00:00Z',image_url:'https://example.test/ad.png',thumbnail_url:null};
 expect(creativeNeedsRefresh(saved,null,now)).toBe(false);
 expect(creativeNeedsRefresh(saved,'2026-11-07T11:30:00Z',now)).toBe(true);
 expect(creativeNeedsRefresh({...saved,updated_at:'2026-11-05T12:00:00Z'},null,now)).toBe(true);
 expect(creativeNeedsRefresh({...saved,image_url:'https://example.test/ad.png?oe=1'},null,now)).toBe(true);
 expect(creativeNeedsRefresh(undefined,null,now)).toBe(true);
});
it('rejects malformed successful Meta responses instead of publishing empty data',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('{"unexpected":true}')));
 await expect(fetchMetaCollection({path:'act_test/insights',accessToken:'test'})).rejects.toThrow('Invalid Meta collection');
});
