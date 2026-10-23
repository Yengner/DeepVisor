import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { Database } from '@/lib/shared/types/supabase';
import { businesses } from '../../../scripts/beta-fixtures/fixture';
vi.mock('server-only', () => ({}));
vi.mock('./supabase/server', () => ({ createSupabaseClient: vi.fn() }));
import { createSupabaseClient } from './supabase/server';
import { getCampaignLifetimeIncludingZeros } from './repositories/campaigns/getCampaignsMetrics';
import { getAdSetsLifetimeIncludingZeros } from './repositories/adsets/getAdSetsMetrics';
import { getAdsLifetimeIncludingZeros } from './repositories/ads/getAdsMetrics';
import { readAllPages } from './repositories/utils';
const enabled=process.env.DEEPVISOR_FIXTURES==='gkdyyjqepzayjdpvqnja';
describe.skipIf(!enabled)('Phase 3 authenticated persisted campaign table metrics',()=>{
 beforeAll(()=>{expect(process.env.NODE_ENV).toBe('test');expect(process.env.NEXT_PUBLIC_SUPABASE_URL).toBe('https://gkdyyjqepzayjdpvqnja.supabase.co');});
 it.each(businesses)('$key campaign/ad-set/ad tables match their own saved summary measurements',async b=>{
  const state=JSON.parse(readFileSync('.env.beta-fixtures.json','utf8'));
  const client=createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
  const auth=await client.auth.signInWithPassword(state.users[b.key]);if(auth.error)throw auth.error;
  vi.mocked(createSupabaseClient).mockResolvedValue(client);
  const facts=await readAllPages((from,to)=>client.from('ad_entity_performance_summary').select('*').eq('ad_account_id',b.accountId).order('entity_id').range(from,to));
  const dims=await client.from('ad_entities').select('id,external_id,entity_level').eq('ad_account_id',b.accountId);if(dims.error)throw dims.error;
  for(const [level,rows] of [['campaign',await getCampaignLifetimeIncludingZeros(b.accountId)],['adset',await getAdSetsLifetimeIncludingZeros(b.accountId)],['ad',await getAdsLifetimeIncludingZeros(b.accountId)]] as const){
   expect(rows.length).toBe(dims.data.filter(d=>d.entity_level===level).length);
   for(const row of rows){const entity=dims.data.find(d=>d.external_id===row.id)!;const totals=facts.filter(f=>f.entity_id===entity.id);const sum=(key:'spend'|'leads'|'messages'|'calls')=>totals.reduce((s,r)=>s+Number(r[key]),0);
    expect(Number(row.spend)).toBe(sum('spend'));expect(row.leads+row.messages+(row.calls??0)).toBe(sum('leads')+sum('messages')+sum('calls'));expect(row.reach).toBeNull();expect(row.frequency).toBeNull();
   }
  }
  const ads=await getAdsLifetimeIncludingZeros(b.accountId);expect(ads.some(ad=>ad.creativePreview?.image?.includes('/beta-fixtures/'))).toBe(true);
  const foreign=businesses.find(x=>x.key!==b.key)!;
  expect(await getCampaignLifetimeIncludingZeros(foreign.accountId)).toEqual([]);
  expect(await getAdSetsLifetimeIncludingZeros(foreign.accountId)).toEqual([]);
  expect(await getAdsLifetimeIncludingZeros(foreign.accountId)).toEqual([]);
  await client.auth.signOut();
 },60000);
});
