import 'server-only';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import type {SupabaseClient} from '@supabase/supabase-js';
import {createAdminClient} from '../supabase/admin';
import {canonical} from '../decisions/approval';
import {allPages} from '../repositories/pagination';
import {history,organizerScope} from './service';
import {selectedRenames,nativeParent,sameIdentity,sameState,type RenameChange} from '@/lib/shared/organizer/renamePlan';
import {propose,type Snapshot} from '@/lib/shared/organizer/model';
import {renameProvider,simulationAllowed} from '../advertising/organizer/provider';
import {renameEnabled} from '../advertising/organizer/adapter';
import {executeRenames,reconcileRenames,type RenameEvent,type RenameAudit} from '../advertising/organizer/execute';
const db=()=>createAdminClient() as SupabaseClient;
const uuid=(v:string)=>z.string().uuid().parse(v);
async function owner(account:string){const scope=await organizerScope(account);if(!['owner','admin'].includes(scope.auth.role))throw new Error('Owner/admin approval required');return scope;}
export async function previewRename(account:string,versionId:string){
 const {auth,context}=await owner(account);const saved=await history(account,uuid(versionId));if(!saved?.viewVersion)throw new Error('Plan unavailable');
 const source=saved.snapshot;const selected=selectedRenames(source,saved.viewVersion.proposal);
 const provider=await renameProvider(auth.businessId,context.platform!.id,source,[auth.user.id]);await provider.adapter.assertWritable();
 const changes:RenameChange[]=[];
 for(const {node,name} of selected){
  const parentId=nativeParent(node,source,saved.original);
  if(node.level!=='campaign'&&!parentId)throw new Error('Parent association unavailable');
  const change:RenameChange={entityId:node.id,before:{id:node.externalId,accountId:provider.accountId,level:node.level,parentId,name:node.name,updatedAt:'',creativeId:node.creativeId},afterName:name};
  const current=await provider.adapter.read(change);
  if(!sameIdentity(change.before,current)||current.name!==node.name)throw new Error('Current Meta name or hierarchy conflicts with the saved plan. Inspect or restore from verified history.');
  changes.push({...change,before:current});
 }
 const expiresAt=new Date(Date.now()+15*60000).toISOString();
 const fingerprint=createHash('sha256').update(canonical({versionId,business:auth.businessId,account,changes,expiresAt,simulated:provider.simulated,contract:'name-only-v1'})).digest('hex');
 const version=await db().from('account_organization_versions').select('restores_run_id').eq('id',versionId).eq('business_id',auth.businessId).single();if(version.error)throw new Error('Plan lineage unavailable');
 const r=await db().from('organization_rename_previews').insert({business_id:auth.businessId,ad_account_id:account,version_id:versionId,actor_id:auth.user.id,expires_at:expiresAt,fingerprint,simulated:provider.simulated,changes,restores_run_id:version.data.restores_run_id}).select('id,fingerprint,expires_at,simulated,changes').single();if(r.error)throw new Error('Could not preserve approval preview');return r.data as {id:string;fingerprint:string;expires_at:string;simulated:boolean;changes:RenameChange[]};
}
export async function approveRename(account:string,previewId:string,fingerprint:string,confirmed:boolean){
 if(confirmed!==true)throw new Error('Explicit confirmation required');const {auth}=await owner(account);
 const p=await db().from('organization_rename_previews').select('id').eq('id',uuid(previewId)).eq('business_id',auth.businessId).eq('ad_account_id',account).single();if(p.error)throw new Error('Preview unavailable');
 const r=await db().rpc('organizer_approve',{p_business:auth.businessId,p_actor:auth.user.id,p_preview:previewId,p_fingerprint:fingerprint});if(r.error)throw new Error('Preview expired, already approved, or authorization changed');return r.data as string;
}
async function runContext(account:string,runId:string){
 const scope=await owner(account);const d=db();const run=await d.from('organization_rename_runs').select('*').eq('business_id',scope.auth.businessId).eq('id',uuid(runId)).single();if(run.error)throw new Error('Run unavailable');
 const a=await d.from('organization_rename_approvals').select('*').eq('id',run.data.approval_id).eq('business_id',scope.auth.businessId).single();if(a.error)throw new Error('Approval unavailable');
 const p=await d.from('organization_rename_previews').select('*').eq('id',a.data.preview_id).eq('business_id',scope.auth.businessId).eq('ad_account_id',account).single();if(p.error)throw new Error('Run account mismatch');
 const saved=await history(account,p.data.version_id);if(!saved)throw new Error('Source unavailable');
 const events=await allPages((from,to)=>d.from('organization_rename_events').select('id,event,created_at,actor_id').eq('business_id',scope.auth.businessId).eq('run_id',runId).order('id').range(from,to));
 return {...scope,run:run.data,approval:a.data,preview:p.data,saved,events};
}
function audit(business:string,actor:string,runId:string):RenameAudit{return {
 async append(event){const r=await db().from('organization_rename_events').insert({business_id:business,run_id:runId,actor_id:actor,event});if(r.error)throw new Error('Audit persistence failed; reconcile the run before any further action.');},
 async finish(unresolved){const r=await db().from('organization_rename_runs').update({active:unresolved,finished_at:new Date().toISOString()}).eq('id',runId).eq('business_id',business);if(r.error)throw new Error('Run finalization failed; reconciliation required');},
};}
export async function executeRename(account:string,approvalId:string){
 const {auth}=await owner(account);
 const approval=await db().from('organization_rename_approvals').select('preview_id').eq('business_id',auth.businessId).eq('id',uuid(approvalId)).single();if(approval.error)throw new Error('Approval unavailable');
 const p=await db().from('organization_rename_previews').select('*').eq('id',approval.data.preview_id).eq('business_id',auth.businessId).eq('ad_account_id',account).single();if(p.error)throw new Error('Account approval mismatch');
 // Check gates before claiming; no live claim should be created while disabled.
 if(p.data.simulated?!simulationAllowed(account):!renameEnabled(auth.businessId))throw new Error('Execution disabled');
 const claim=await db().rpc('organizer_claim',{p_business:auth.businessId,p_actor:auth.user.id,p_approval:approvalId});if(claim.error)throw new Error('Execution already active, approval expired, or authorization changed');
 const id=claim.data.run.id as string;if(!claim.data.claimed)return id;
 const c=await runContext(account,id);const provider=await renameProvider(auth.businessId,c.context.platform!.id,c.saved.snapshot,[auth.user.id,c.approval.actor_id],{writeDeadline:Date.parse(c.run.execution_deadline)});
 if(provider.simulated!==c.preview.simulated)throw new Error('Provider mode changed; reconciliation required');
 const assertWritable=async()=>{if(Date.now()>=Date.parse(c.run.execution_deadline))throw new Error('Execution deadline elapsed');await provider.adapter.assertWritable();};
 await executeRenames(c.preview.changes,{...provider.adapter,read:change=>provider.adapter.read(change),rename:async change=>{await assertWritable();await provider.adapter.rename(change);},assertWritable},audit(auth.businessId,auth.user.id,id));return id;
}
export async function reconcileRename(account:string,runId:string){
 const c=await runContext(account,runId);if(!c.run.active)return runId;
 if(!c.run.finished_at&&Date.now()<Date.parse(c.run.execution_deadline)+30000)throw new Error('Run may still be working. Reconciliation is available after its deadline.');
 const provider=await renameProvider(c.auth.businessId,c.context.platform!.id,c.saved.snapshot,[c.auth.user.id],{readOnly:true});
 if(provider.simulated!==c.preview.simulated)throw new Error('Provider mode changed');
 await reconcileRenames(c.preview.changes,c.events.map(r=>r.event as RenameEvent),provider.adapter,audit(c.auth.businessId,c.auth.user.id,runId));return runId;
}
export async function restoreRename(account:string,runId:string){
 const c=await runContext(account,runId);if(c.run.active)throw new Error('Resolve uncertain outcomes before restoration');
 const provider=await renameProvider(c.auth.businessId,c.context.platform!.id,c.saved.snapshot,[c.auth.user.id],{readOnly:true});if(provider.simulated!==c.preview.simulated)throw new Error('Provider mode changed');
 const latest=new Map<string,RenameEvent>();for(const row of c.events){const e=row.event as RenameEvent;latest.set(e.entityId,e);}
 const successful=[...latest.values()].filter(e=>['verified','reconciled'].includes(e.kind)&&e.after);
 if(!successful.length)throw new Error('No verified names are available to restore');
 const snapshot:Snapshot={...c.saved.snapshot,capturedAt:new Date().toISOString(),nodes:[]};const conflicts:string[]=[];
 for(const event of successful){
  const node=c.saved.snapshot.nodes.find(n=>n.id===event.entityId);if(!node)throw new Error('Original entity missing');
  const change={entityId:node.id,before:event.after!,afterName:event.before.name};
  try{const current=await provider.adapter.read(change);if(!sameState(current,event.after!))throw new Error('EXTERNAL_CHANGE');snapshot.nodes.push({...node,name:current.name,parentExternalId:current.parentId});}
  catch{conflicts.push(node.externalId);}
 }
 // A conflict never silently becomes permission to overwrite or a partly approved restore.
 if(conflicts.length)throw new Error(`Restoration conflicts for ${conflicts.join(', ')}. No proposal created; external or missing entities require review.`);
 const draft=propose(snapshot);for(const e of draft.edits){e.name=latest.get(e.id)!.before.name;e.selected=false;}
 const current=await history(account);if(!current)throw new Error('History missing');
 const r=await db().from('account_organization_versions').insert({baseline_id:c.saved.baselineId,business_id:c.auth.businessId,ad_account_id:account,version:(current.versions[0]?.version??0)+1,created_by:c.auth.user.id,source_snapshot:snapshot,proposal:draft,restores_run_id:runId}).select('id').single();if(r.error)throw new Error('Could not create restoration proposal; reload history');return r.data.id as string;
}
export async function renameHistory(account:string){
 const {auth}=await organizerScope(account);const d=db();
 const previews=await d.from('organization_rename_previews').select('id,version_id,simulated,changes,expires_at').eq('business_id',auth.businessId).eq('ad_account_id',account).order('created_at',{ascending:false}).limit(100);if(previews.error)throw new Error('Rename history unavailable');
 const ids=previews.data.map(p=>p.id);const approvals=ids.length?await d.from('organization_rename_approvals').select('id,preview_id,created_at,actor_id').eq('business_id',auth.businessId).in('preview_id',ids):{data:[],error:null};if(approvals.error)throw new Error('Approval history unavailable');
 const approvalIds=(approvals.data??[]).map(a=>a.id);const runs=approvalIds.length?await d.from('organization_rename_runs').select('*').eq('business_id',auth.businessId).in('approval_id',approvalIds).order('created_at',{ascending:false}):{data:[],error:null};if(runs.error)throw new Error('Run history unavailable');
 const runIds=(runs.data??[]).map(r=>r.id);const events=runIds.length?await allPages((from,to)=>d.from('organization_rename_events').select('run_id,event,created_at,actor_id').eq('business_id',auth.businessId).in('run_id',runIds).order('id').range(from,to)):[];
 return {enabled:simulationAllowed(account)||renameEnabled(auth.businessId),canReview:['owner','admin'].includes(auth.role),previews:previews.data,approvals:approvals.data??[],runs:runs.data??[],events};
}
