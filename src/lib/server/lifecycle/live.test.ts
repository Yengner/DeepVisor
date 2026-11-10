import {readFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
import {it,expect,vi} from 'vitest';
import type {Database} from '@/lib/shared/types/supabase';
vi.mock('server-only',()=>({}));
vi.mock('@/lib/server/supabase/admin',()=>({createAdminClient:vi.fn()}));
import {createAdminClient} from '@/lib/server/supabase/admin';
import {lifecycleBrief} from './brief';
it.skipIf(process.env.DEEPVISOR_LIFECYCLE_TEST!=='gkdyyjqepzayjdpvqnja')('verifies the actual reconstructed interruption and denies unrelated authenticated users',async()=>{
 expect(process.env.NEXT_PUBLIC_SUPABASE_URL).toBe('https://gkdyyjqepzayjdpvqnja.supabase.co');
 const db=createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false}});vi.mocked(createAdminClient).mockReturnValue(db);
 const b=await lifecycleBrief('9db69ec3-44b0-45f6-a826-8802b1af29d2','90d2e451-a8b8-46fe-9b53-3777261021a9','5701cef6-3a1e-4abb-8593-5bb6a01b703d');
 expect(b?.provenance).toBe('reconstructed');expect(b?.affected.map(a=>a.id)).toEqual(['120229570219550408']);expect(b?.affected[0].end).toBe('2026-11-10T16:00:00-0500');expect(b?.spend).toBeCloseTo(166.09,2);expect(b?.results).toBe(48);expect(b?.days.length).toBeGreaterThan(0);
 expect(await lifecycleBrief('wrong-business','90d2e451-a8b8-46fe-9b53-3777261021a9','5701cef6-3a1e-4abb-8593-5bb6a01b703d').catch(()=>null)).toBeNull();
 const users=JSON.parse(readFileSync('.env.beta-phase5.json','utf8')).users;
 for(const user of users.slice(0,2)){
  const normal=createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{auth:{persistSession:false}});
  const auth=await normal.auth.signInWithPassword({email:user.email,password:user.password});if(auth.error)throw auth.error;
  const result=await normal.from('ad_lifecycle_events').select('id').eq('id',b!.id);expect(result.error).toBeNull();expect(result.data).toEqual([]);
  expect((await normal.from('ad_lifecycle_acknowledgements').insert({event_id:b!.id,user_id:auth.data.user!.id})).error).not.toBeNull();await normal.auth.signOut({scope:'local'});
 }
},30000);
