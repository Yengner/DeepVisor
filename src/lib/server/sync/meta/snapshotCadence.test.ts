import {createClient} from '@supabase/supabase-js';
import {expect,it,vi} from 'vitest';
import type {Database} from '@/lib/shared/types/supabase';
import {snapshotsDue} from './snapshotCadence';
it('checks only successfully completed account-scoped snapshots within 24 hours',async()=>{
 let request:URL|undefined;
 const fetcher=vi.fn<typeof fetch>().mockImplementation(async url=>{request=new URL(String(url));return new Response(JSON.stringify({finished_at:'2026-10-29T00:00:00Z'}),{headers:{'Content-Type':'application/json'}});});
 const client=createClient<Database>('https://test.supabase.co','test',{auth:{persistSession:false},global:{fetch:fetcher}});
 expect(await snapshotsDue(client,'business','account','v2','2026-10-29T12:00:00Z')).toBe(false);
 expect(request!.searchParams.get('business_id')).toBe('eq.business');expect(request!.searchParams.get('ad_account_id')).toBe('eq.account');
 expect(request!.searchParams.get('status')).toBe('eq.completed');expect(request!.searchParams.get('finished_at')).toBe('gte.2026-10-28T12:00:00.000Z');
 fetcher.mockResolvedValue(new Response('null',{headers:{'Content-Type':'application/json'}}));
 expect(await snapshotsDue(client,'business','account','v2','2026-10-29T12:00:00Z')).toBe(true);
});
