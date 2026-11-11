import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only',()=>({}));
vi.mock('react',()=>({cache:(fn:unknown)=>fn}));
const saved=vi.hoisted(()=>vi.fn());
vi.mock('../../sync/resources/insights',()=>({readSavedInsights:saved}));
const state=vi.hoisted(()=>({cache:new Map<string,Promise<unknown>>(),reads:vi.fn(),token:vi.fn(),account:vi.fn(),integration:vi.fn()}));
vi.mock('next/cache',()=>({unstable_cache:(fn:()=>Promise<unknown>,key:string[])=>()=>{const k=JSON.stringify(key); if(!state.cache.has(k))state.cache.set(k,fn());return state.cache.get(k);}}));
vi.mock('../../sync/meta/client',()=>({fetchMetaCollection:state.reads}));
vi.mock('../../integrations/service',()=>({getBusinessIntegrationById:state.integration,resolveIntegrationAccessToken:state.token}));
vi.mock('../../supabase/admin',()=>({createAdminClient:()=>({from:()=>{const query={select:()=>query,eq:(key:string,value:string)=>{state.account(key,value);return query;},maybeSingle:async()=>({data:{last_success_at:'2026-11-01T12:00:00Z'},error:null}),single:async()=>({data:{external_account_id:'123'},error:null})};return query;}})}));
import { loadInsights } from './load';
import type { OverviewContext } from '../overview/load';
const context=(business='business')=>({businessId:business,account:{id:'account',external_account_id:'123',currency_code:'USD'},platform:{id:'integration',status:'connected'},zone:'America/New_York',timezoneUnavailable:false,today:'2026-11-01'}) as unknown as OverviewContext;
afterEach(()=>vi.unstubAllEnvs());
beforeEach(()=>{vi.stubEnv('DEEPVISOR_RESOURCE_REFRESH','false');vi.clearAllMocks();state.cache.clear();state.integration.mockResolvedValue({status:'connected'});state.token.mockResolvedValue('private-test-token');state.reads.mockResolvedValue([]);});
it('shares window across equivalent reads, isolates businesses and keeps credentials outside cache keys',async()=>{
 await Promise.all([loadInsights(context()),loadInsights(context())]); expect(state.reads).toHaveBeenCalledTimes(4);
 await loadInsights(context('other'));expect(state.reads).toHaveBeenCalledTimes(8);
 expect([...state.cache.keys()].join()).not.toContain('private-test-token');expect(state.account).toHaveBeenCalledWith('business_id','other');
});
it('fails closed on unauthorized account or disconnected integration before provider access',async()=>{
 state.integration.mockResolvedValue(null);expect((await loadInsights(context())).source).toBe('unavailable');expect(state.reads).not.toHaveBeenCalled();
});
it('keeps provider failures unavailable and does not fabricate successful zero metrics',async()=>{
 state.reads.mockRejectedValue(new Error('provider unavailable'));const result=await loadInsights(context());expect(result.daily).toBeNull();expect(result.audience).toBeNull();expect(result.hourly).toBeNull();expect(result.source).toBe('unavailable');
});
it('keeps combined-only fallbacks separate and requests hourly actions and retains combined-only scope',async()=>{
 state.reads.mockImplementation(async (request:{path:string;params:{breakdowns?:string;fields:string;time_increment?:number}})=>{
   if(request.params.breakdowns?.includes('publisher_platform,')) throw new Error('unsupported combination');
   if(request.params.breakdowns==='age,gender') return [{date_start:'2026-11-01',date_stop:'2026-11-01',age:'25-34',gender:'female',spend:'10',impressions:'100',clicks:'5'}];
   if(request.params.breakdowns==='hourly_stats_aggregated_by_advertiser_time_zone') {
     expect(request.params.fields).toContain('actions'); expect(request.params.time_increment).toBe(1);
     return [{date_start:'2026-11-01',date_stop:'2026-11-01',hourly_stats_aggregated_by_advertiser_time_zone:'09:00:00 - 09:59:59',spend:'10',impressions:'100',clicks:'5',actions:[{action_type:'lead',value:'2'}]}];
   }
   return [];
 });
 const result=await loadInsights(context());
 expect(result.audience).toHaveLength(1);expect(result.audience?.[0].publisher).toBe('combined-only');
 expect(result.hourly).toHaveLength(1);expect(result.hourly?.[0]).toMatchObject({publisher:'combined-only',day:'2026-11-01',leads:2});
});

it('retains hourly delivery if Meta explicitly rejects the actions field', async () => {
 state.reads.mockImplementation(async ({params}) => {
   if (!params.breakdowns?.includes('hourly_stats')) return [];
   if (params.fields.includes('actions')) throw new Error('Actions are not supported for this breakdown');
   return [{date_start:'2026-11-01',publisher_platform:'facebook',hourly_stats_aggregated_by_advertiser_time_zone:'09:00:00 - 09:59:59',spend:'10',impressions:'100',clicks:'5'}];
 });
 const result = await loadInsights(context());
 expect(result.hourly).toEqual([expect.objectContaining({publisher:'facebook',spend:10,leads:null,messages:null,calls:null})]);
});

it('reads saved scoped observations without Meta or token access in resource mode',async()=>{
 vi.stubEnv('DEEPVISOR_RESOURCE_REFRESH','true');
 saved.mockResolvedValue({daily:[],audience:null,hourly:[],learning:{},fetchedAt:'2026-11-01T10:00:00Z',source:'stored'});
 const result=await loadInsights(context());
 expect(saved).toHaveBeenCalledWith('business','account');expect(result.source).toBe('stored');
 expect(result.canonicalFetchedAt).toBe('2026-11-01T12:00:00Z');
 expect(state.reads).not.toHaveBeenCalled();expect(state.token).not.toHaveBeenCalled();
});
