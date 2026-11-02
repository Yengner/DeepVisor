import {readFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
import {expect,it,vi} from 'vitest';
vi.mock('server-only',()=>({}));
const fixture=vi.hoisted(()=>({context:{} as Record<string,unknown>,auth:{} as Record<string,unknown>}));
vi.mock('../actions/app/context',()=>({getRequiredAppContext:async()=>fixture.auth}));
vi.mock('../dashboard/overview/load',async original=>({...await original<typeof import('../dashboard/overview/load')>(),loadOverviewContext:async()=>fixture.context}));
import {inspect,history,save} from './service';
import {validateDraft} from '@/lib/shared/organizer/model';
const project='gkdyyjqepzayjdpvqnja';
it.skipIf(process.env.DEEPVISOR_ORGANIZER_TEST!==project)('persists real fixture history, enforces normal-client isolation and never alters native entities',async()=>{
 expect(process.env.NEXT_PUBLIC_SUPABASE_URL).toBe(`https://${project}.supabase.co`);
 const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false}});
 const accountId='eeee4445-0000-4000-8000-000000000001';
 const account=await db.from('ad_accounts').select('*').eq('id',accountId).single();if(account.error)throw account.error;
 expect(account.data.name).toContain('SYNTHETIC');
 const users=JSON.parse(readFileSync('.env.beta-fixtures.json','utf8')).users;
 const normal=(key:'a'|'b')=>{const client=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{auth:{persistSession:false}});return {client,user:users[key]};};
 const a=normal('a'),b=normal('b');
 try{
 const auth=await a.client.auth.signInWithPassword(a.user);if(auth.error)throw auth.error;
 const authB=await b.client.auth.signInWithPassword(b.user);if(authB.error)throw authB.error;
 fixture.auth={businessId:account.data.business_id,user:{id:auth.data.user!.id},role:'owner'};
 fixture.context={businessId:account.data.business_id,account:account.data,platform:{vendor:'meta'},zone:'UTC'};
 const before=await db.from('ad_entities').select('id,name,parent_id,creative_external_id').eq('ad_account_id',accountId).order('id');
 const initial=await inspect(accountId,'organizer-v1');expect(initial).not.toBeNull();
 const original=JSON.stringify(initial!.original);const again=await inspect(accountId,'organizer-v1');expect(JSON.stringify(again!.original)).toBe(original);
 const latest=again!.versions[0];const draft=validateDraft(again!.snapshot,again!.viewVersion!.proposal);draft.edits[0].name='Fixture reviewed name';draft.edits[0].selected=true;
 const outcomes=await Promise.allSettled([save(accountId,again!.baselineId,latest.version,draft,latest.id),save(accountId,again!.baselineId,latest.version,draft,latest.id)]);
 expect(outcomes.filter(r=>r.status==='fulfilled')).toHaveLength(1);
 const saved=await history(accountId);expect(saved!.versions[0].version).toBe(latest.version+1);expect(JSON.stringify(saved!.original)).toBe(original);
 const own=await a.client.from('account_organization_baselines').select('id').eq('ad_account_id',accountId);expect(own.error).toBeNull();expect(own.data).toHaveLength(1);
 const other=await b.client.from('account_organization_baselines').select('id').eq('ad_account_id',accountId);expect(other.error).toBeNull();expect(other.data).toHaveLength(0);
 expect((await a.client.from('account_organization_baselines').update({snapshot:{}}).eq('id',saved!.baselineId)).error).not.toBeNull();
 expect((await db.from('account_organization_baselines').update({snapshot:{}}).eq('id',saved!.baselineId)).error).not.toBeNull();
 const target=before.data![0];
 const changed=await db.from('ad_entities').update({name:'Synthetic external rename conflict'}).eq('id',target.id).eq('ad_account_id',accountId);if(changed.error)throw changed.error;
 try {await expect(save(accountId,saved!.baselineId,saved!.versions[0].version,draft,saved!.versions[0].id)).rejects.toThrow('organization changed');}
 finally {const restored=await db.from('ad_entities').update({name:target.name}).eq('id',target.id).eq('ad_account_id',accountId);if(restored.error)throw restored.error;}
 const after=await db.from('ad_entities').select('id,name,parent_id,creative_external_id').eq('ad_account_id',accountId).order('id');expect(after.data).toEqual(before.data);
 }finally{await a.client.auth.signOut({scope:'local'});await b.client.auth.signOut({scope:'local'});}
},120000);
