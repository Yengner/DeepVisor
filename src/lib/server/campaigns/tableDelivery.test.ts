import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('@/lib/server/supabase/admin', () => ({ createAdminClient: vi.fn() }));
import { createAdminClient } from '@/lib/server/supabase/admin';
import { loadTableDelivery } from './tableDelivery';
import { activeDeliveryKeys } from './exploration/delivery';
import { activeDeliveryFirst } from '@/components/campaigns/delivery';

const chain = () => [
  { external_id: 'c', parent_external_id: null, entity_level: 'campaign', status: 'ACTIVE' },
  { external_id: 's', parent_external_id: 'c', entity_level: 'adset', status: 'ACTIVE' },
  { external_id: 'a', parent_external_id: 's', entity_level: 'ad', status: 'ACTIVE' },
];

describe('table delivery emphasis', () => {
  it('requires a complete active chain and leaves empty campaigns/ad sets unhighlighted', () => {
    expect(activeDeliveryKeys(chain()).sort()).toEqual(['ad:a','adset:s','campaign:c']);
    expect(activeDeliveryKeys(chain().slice(0,2))).toEqual([]);
    expect(activeDeliveryKeys(chain().slice(1))).toEqual([]);
    for (const index of [0,1,2]) {
      for (const status of ['PAUSED','CAMPAIGN_PAUSED','ADSET_PAUSED','PENDING_REVIEW','DISAPPROVED','UNKNOWN','']) {
        const rows=chain(); rows[index].status=status;
        expect(activeDeliveryKeys(rows)).toEqual([]);
      }
    }
  });
  it('highlights only the working branch, without requiring all siblings to be active', () => {
    const rows=[...chain(),{...chain()[1],external_id:'empty'},{...chain()[2],external_id:'paused',status:'PAUSED'}];
    expect(activeDeliveryKeys(rows).sort()).toEqual(['ad:a','adset:s','campaign:c']);
  });
  it.each([0,1,2])('excludes future, expired and malformed schedules at level %i', index => {
    for (const raw of [{start_time:'2026-10-17T00:00:00Z'}, {end_time:'2026-10-16T12:00:00Z'}, {start_time:'invalid'}]) {
      const rows=chain().map((row,i)=>({...row,raw:i===index?raw:{}}));
      expect(activeDeliveryKeys(rows,'2026-10-16T12:00:00Z')).toEqual([]);
    }
  });
  it('groups active rows first without mutating or ranking by historical spend', () => {
    const rows=[{id:'old',spend:9999,delivery:false},{id:'live',spend:0,delivery:true},{id:'other',spend:1,delivery:true},{id:'unknown'}];
    expect(activeDeliveryFirst(rows).map(row=>row.id)).toEqual(['live','other','old','unknown']);
    expect(rows[0].id).toBe('old');
  });
});

describe('scoped paginated hierarchy read', () => {
  const query={select:vi.fn(),eq:vi.fn(),order:vi.fn(),range:vi.fn()};
  beforeEach(()=>{
    vi.clearAllMocks();
    query.select.mockReturnValue(query); query.eq.mockReturnValue(query); query.order.mockReturnValue(query);
    vi.mocked(createAdminClient).mockReturnValue({from:vi.fn(()=>query)} as unknown as ReturnType<typeof createAdminClient>);
  });
  it('reads every page within business, account and integration boundaries',async()=>{
    const padding=Array.from({length:498},(_,i)=>({...chain()[0],external_id:`empty-${i}`}));
    query.range.mockResolvedValueOnce({data:[...chain().slice(0,2),...padding],error:null})
      .mockResolvedValueOnce({data:[chain()[2]],error:null});
    expect(await loadTableDelivery('business','account','integration')).toEqual({available:true,activeKeys:['ad:a','adset:s','campaign:c']});
    expect(query.eq.mock.calls).toContainEqual(['business_id','business']);
    expect(query.eq.mock.calls).toContainEqual(['ad_account_id','account']);
    expect(query.eq.mock.calls).toContainEqual(['platform_integration_id','integration']);
    expect(query.range.mock.calls).toEqual([[0,499],[500,999]]);
  });
  it('fails closed if any page fails instead of using a partial hierarchy',async()=>{
    query.range.mockResolvedValueOnce({data:Array.from({length:500},(_,i)=>({...chain()[0],external_id:String(i)})),error:null})
      .mockResolvedValueOnce({data:null,error:new Error('unavailable')});
    expect(await loadTableDelivery('business','account','integration')).toEqual({available:false,activeKeys:[]});
  });
});
