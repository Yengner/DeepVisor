import {readFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
import {expect,it,vi} from 'vitest';
vi.mock('server-only',()=>({}));
const fixture=vi.hoisted(()=>({context:{} as Record<string,unknown>,auth:{} as Record<string,unknown>}));
vi.mock('../actions/app/context',()=>({getRequiredAppContext:async()=>fixture.auth}));
vi.mock('../dashboard/overview/load',async original=>({...await original<typeof import('../dashboard/overview/load')>(),loadOverviewContext:async()=>fixture.context}));
import {inspect,save,history} from './service';
import {previewRename,approveRename,executeRename,restoreRename,renameHistory} from './renaming';
import {validateDraft} from '@/lib/shared/organizer/model';
const project='gkdyyjqepzayjdpvqnja';
it.skipIf(process.env.DEEPVISOR_ORGANIZER_TEST!==project)('runs approved synthetic renaming and conflict-aware restoration with real persistence',async()=>{
 expect(process.env.DEEPVISOR_ORGANIZER_SIMULATION).toBe(project);expect(process.env.DEEPVISOR_META_EXECUTION_ENABLED).not.toBe('true');
 const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false}});
 const id='eeee4445-0000-4000-8000-000000000001';const account=await db.from('ad_accounts').select('*').eq('id',id).single();if(account.error)throw account.error;expect(account.data.name).toContain('SYNTHETIC');
 const users=JSON.parse(readFileSync('.env.beta-fixtures.json','utf8')).users;
 const normal=()=>createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{auth:{persistSession:false}});const a=normal(),b=normal();
 try{
 const auth=await a.auth.signInWithPassword(users.a);if(auth.error)throw auth.error;const other=await b.auth.signInWithPassword(users.b);if(other.error)throw other.error;
 fixture.auth={businessId:account.data.business_id,user:{id:auth.data.user!.id},role:'owner'};
 fixture.context={businessId:account.data.business_id,account:account.data,platform:{vendor:'meta',id:'unused-in-simulation'},zone:'UTC'};
 const original=await db.from('ad_entities').select('id,name,parent_id').eq('ad_account_id',id).order('id');
 const inspected=await inspect(id,'organizer-v1');const draft=validateDraft(inspected!.snapshot,inspected!.viewVersion!.proposal);draft.edits.forEach((e,i)=>{e.selected=i===0;e.name=i===0?'Approved organizer fixture':inspected!.snapshot.nodes.find(n=>n.id===e.id)!.name;});
 const saved=await save(id,inspected!.baselineId,inspected!.versions[0].version,draft,inspected!.viewVersion!.id);
 const preview=await previewRename(id,saved!.viewVersion!.id);expect(preview.simulated).toBe(true);expect(preview.changes).toHaveLength(1);
 fixture.auth.role='member';await expect(approveRename(id,preview.id,preview.fingerprint,true)).rejects.toThrow('Owner/admin');fixture.auth.role='owner';
 await expect(approveRename(id,preview.id,preview.fingerprint,false)).rejects.toThrow('confirmation');
 const approvals=await Promise.allSettled([approveRename(id,preview.id,preview.fingerprint,true),approveRename(id,preview.id,preview.fingerprint,true)]);expect(approvals.filter(r=>r.status==='fulfilled')).toHaveLength(1);const approval=(approvals.find(r=>r.status==='fulfilled') as PromiseFulfilledResult<string>).value;
 const runs=await Promise.all([executeRename(id,approval),executeRename(id,approval)]);expect(runs[0]).toBe(runs[1]);
 const ledger=await renameHistory(id);expect(ledger.events.filter(e=>e.run_id===runs[0]).map(e=>(e.event as {kind:string}).kind)).toEqual(['intent','verified']);
 const c=preview.changes[0];const state=await db.from('organization_rename_simulation').select('state').eq('entity_id',c.entityId).single();if(state.error)throw state.error;
 const altered=await db.from('organization_rename_simulation').update({state:{...state.data.state,name:'External edit'}}).eq('entity_id',c.entityId);if(altered.error)throw altered.error;
 try{await expect(restoreRename(id,runs[0])).rejects.toThrow('conflicts');}finally{const reset=await db.from('organization_rename_simulation').update({state:state.data.state}).eq('entity_id',c.entityId);if(reset.error)throw reset.error;}
 const restoreId=await restoreRename(id,runs[0]);const restored=await history(id,restoreId);const restoration=validateDraft(restored!.snapshot,restored!.viewVersion!.proposal);expect(restoration.edits.every(e=>!e.selected)).toBe(true);restoration.edits.forEach(e=>{e.selected=true;});
 const version=await save(id,restored!.baselineId,restored!.versions[0].version,restoration,restoreId);
 const restorePreview=await previewRename(id,version!.viewVersion!.id);expect(restorePreview.changes[0].afterName).toBe(c.before.name);
 const restoreApproval=await approveRename(id,restorePreview.id,restorePreview.fingerprint,true);const restoreRun=await executeRename(id,restoreApproval);
 const final=await renameHistory(id);expect(final.events.filter(e=>e.run_id===restoreRun).map(e=>(e.event as {kind:string}).kind)).toEqual(['intent','verified']);
 const own=await a.from('organization_rename_events').select('id').eq('run_id',runs[0]);expect(own.error).toBeNull();expect(own.data).toHaveLength(2);
 const foreign=await b.from('organization_rename_events').select('id').eq('run_id',runs[0]);expect(foreign.error).toBeNull();expect(foreign.data).toHaveLength(0);
 expect((await a.rpc('organizer_claim',{p_business:account.data.business_id,p_actor:auth.data.user!.id,p_approval:approval})).error).not.toBeNull();
 const after=await db.from('ad_entities').select('id,name,parent_id').eq('ad_account_id',id).order('id');expect(after.data).toEqual(original.data);
 }finally{await a.auth.signOut({scope:'local'});await b.auth.signOut({scope:'local'});}
},120000);
