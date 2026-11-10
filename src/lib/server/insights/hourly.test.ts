import {beforeEach,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({from:vi.fn(),pages:vi.fn()}));
vi.mock('server-only',()=>({}));
vi.mock('@/lib/server/supabase/admin',()=>({createAdminClient:()=>({from:mocks.from})}));
vi.mock('@/lib/server/repositories/pagination',()=>({readAllPages:mocks.pages}));
import {loadHourlyRecap} from './hourly';
let query:Record<string,ReturnType<typeof vi.fn>>;
beforeEach(()=>{vi.clearAllMocks();query={};for(const key of ['select','eq','order','range'])query[key]=vi.fn(()=>query);query.maybeSingle=vi.fn(async()=>({data:{id:'account'},error:null}));mocks.from.mockReturnValue(query);mocks.pages.mockImplementation(async cb=>{cb(0,999);return [];});});
it('validates business ownership then restricts hourly reads to the account, level, day and local time',async()=>{
 await loadHourlyRecap('business','account','2026-11-07','USD');
 for(const pair of [['business_id','business'],['id','account'],['ad_account_id','account'],['entity_level','adset'],['time_basis','advertiser'],['day','2026-11-07']])expect(query.eq).toHaveBeenCalledWith(...pair);
});
it('rejects an account outside the business before reading performance',async()=>{
 query.maybeSingle.mockResolvedValue({data:null,error:null});await expect(loadHourlyRecap('business','other','2026-11-07','USD')).rejects.toThrow('scope');expect(mocks.pages).not.toHaveBeenCalled();
});
it('preserves unavailable/error state instead of inventing hourly zeros',async()=>{
 mocks.pages.mockRejectedValue(new Error('offline'));expect(await loadHourlyRecap('business','account','2026-11-07','USD')).toMatchObject({status:'error',observedHours:0});
});
