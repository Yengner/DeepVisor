import 'server-only';
import { getRequiredAppContext } from '../actions/app/context';
import { loadOverviewContext, allPages } from '../dashboard/overview/load';
import { createAdminClient } from '../supabase/admin';
import { mediaFor } from '../campaigns/exploration/model';
import { organizationSignature, propose, validateDraft, type Snapshot, type Level } from '@/lib/shared/organizer/model';
import { z } from 'zod';
import {nativeParent} from '@/lib/shared/organizer/renamePlan';
import type { Json } from '@/lib/shared/types/supabase';
const store = createAdminClient;
type OrganizationVersion={id:string;version:number;created_at:string;proposal:unknown;source_snapshot:Snapshot};
export type SavedOrganization = {baselineId:string;original:Snapshot;snapshot:Snapshot;viewVersion:OrganizationVersion|null;versions:Array<Pick<OrganizationVersion,'id'|'version'|'created_at'>>};
export async function organizerScope(accountId:string) {
 z.string().uuid().parse(accountId);
 const auth=await getRequiredAppContext();
 const context=await loadOverviewContext();
 if(context.account?.id!==accountId || context.businessId!==auth.businessId || context.platform?.vendor!=='meta') throw new Error('Select an authorized Meta account');
 return {auth,context};
}
export async function history(accountId:string,versionId?:string):Promise<SavedOrganization|null> {
 const {auth}=await organizerScope(accountId); const db=store();
 const baseline=await db.from('account_organization_baselines').select('*').eq('business_id',auth.businessId).eq('ad_account_id',accountId).maybeSingle();
 if(baseline.error) throw new Error('Organizer storage is unavailable');
 if(!baseline.data) return null;
 const result=await db.from('account_organization_versions').select('id,version,created_at').eq('business_id',auth.businessId).eq('ad_account_id',accountId).eq('baseline_id',baseline.data.id).order('version',{ascending:false}).limit(100);
 if(result.error) throw new Error('Organization history is unavailable');
 const versions=result.data;
 const selected=versionId??versions[0]?.id;
 let viewVersion:OrganizationVersion|null=null;
 if(selected){
  z.string().uuid().parse(selected);
  const version=await db.from('account_organization_versions').select('id,version,created_at,proposal,source_snapshot').eq('id',selected).eq('baseline_id',baseline.data.id).eq('business_id',auth.businessId).eq('ad_account_id',accountId).single();
  if(version.error)throw new Error('Organization version not found');
  viewVersion=version.data as unknown as OrganizationVersion;
 }
 return {baselineId:baseline.data.id,original:baseline.data.snapshot as unknown as Snapshot,snapshot:viewVersion?.source_snapshot??baseline.data.snapshot as unknown as Snapshot,viewVersion,versions};
}
async function capture(accountId:string):Promise<Snapshot> {
 const {auth,context}=await organizerScope(accountId); const db=createAdminClient();
 const syncState=async()=>{
  const [account,jobs]=await Promise.all([
   db.from('ad_accounts').select('last_synced').eq('id',accountId).eq('business_id',auth.businessId).single(),
   db.from('account_sync_jobs').select('id').eq('business_id',auth.businessId).eq('ad_account_id',accountId).in('status',['queued','running']).limit(1),
  ]);
  if(account.error||jobs.error)throw new Error('Account sync state unavailable');
  if(jobs.data?.length)throw new Error('Account sync is in progress. Inspect again after it completes.');
  return account.data.last_synced;
 };
 const syncedAt=await syncState();
 const entities=await allPages((from,to)=>{
  if(from>=5000)throw new Error('This account reached the 5,000-entity organizer limit. No partial snapshot was saved.');
  return db.from('ad_entities').select('id,external_id,parent_id,entity_level,name,creative_external_id,created_time,objective,optimization_goal,status').eq('business_id',auth.businessId).eq('ad_account_id',accountId).order('id').range(from,to);
 });
 const [creatives,metrics]=await Promise.all([
  allPages((from,to)=>db.from('ad_creatives').select('*').eq('business_id',auth.businessId).eq('ad_account_id',accountId).order('id').range(from,to)),
  allPages((from,to)=>db.from('ad_entity_performance_summary').select('entity_id,spend,first_day,last_day').eq('ad_account_id',accountId).order('entity_id').range(from,to)),
 ]);
 if(await syncState()!==syncedAt)throw new Error('Account data changed during inspection. Please inspect again.');
 const media=new Map(creatives.map(c=>[c.platform_creative_id,mediaFor(c).image]));
 const stats=new Map(metrics.map(m=>[m.entity_id,m]));
 return {accountId,accountName:context.account!.name??'Meta account',capturedAt:new Date().toISOString(),syncedAt,currency:context.account!.currency_code,zone:context.zone,nodes:entities.filter(e=>['campaign','adset','ad'].includes(e.entity_level)).map(e=>({id:e.id,externalId:e.external_id,parentId:e.parent_id,level:e.entity_level as Level,name:e.name??'',creativeId:e.creative_external_id,createdAt:e.created_time,objective:e.objective,optimization:e.optimization_goal,status:e.status,image:media.get(e.creative_external_id??'')??null,spend:stats.get(e.id)?.spend??null,firstDelivery:stats.get(e.id)?.first_day??null,lastDelivery:stats.get(e.id)?.last_day??null}))};
}
async function append(accountId:string,baselineId:string,previous:number,snapshot:Snapshot,proposal:unknown,restoresRunId:string|null=null) {
 const {auth}=await organizerScope(accountId);
 const result=await (store() as import('@supabase/supabase-js').SupabaseClient).from('account_organization_versions').insert({baseline_id:baselineId,business_id:auth.businessId,ad_account_id:accountId,version:previous+1,created_by:auth.user.id,source_snapshot:snapshot as unknown as Json,proposal:proposal as Json,restores_run_id:restoresRunId});
 if(result.error)throw new Error(result.error.code==='23505'?'A newer version exists. Reload before saving.':'Could not save proposal');
 return history(accountId);
}
export async function inspect(accountId:string,consent:unknown) {
 if(consent!=='organizer-v1')throw new Error('Inspection requires your authorization');
 const {auth}=await organizerScope(accountId);
 const existing=await history(accountId);
 const snapshot=await capture(accountId);
 if(!existing){
  const result=await store().from('account_organization_baselines').insert({business_id:auth.businessId,ad_account_id:accountId,created_by:auth.user.id,consent_version:consent,snapshot:snapshot as unknown as Json});
  if(result.error)throw new Error(result.error.code==='23505'?'Another inspection completed. Open saved history.':'Could not preserve the original organization');
 }
 const saved=existing??await history(accountId);
 if(!saved)throw new Error('Snapshot not found');
 return append(accountId,saved.baselineId,saved.versions[0]?.version??0,snapshot,propose(snapshot));
}
export async function save(accountId:string,baselineId:string,previous:number,value:unknown,sourceVersion?:string) {
 await organizerScope(accountId);const saved=await history(accountId);
 if(!saved||saved.baselineId!==baselineId)throw new Error('Snapshot not found');
 if(!Number.isSafeInteger(previous)||previous!==(saved.versions[0]?.version??0))throw new Error('A newer version exists. Reload history before saving.');
 const source=sourceVersion?(await history(accountId,sourceVersion))?.viewVersion?.source_snapshot:null;
 if(!source)throw new Error('Select a saved source version');
 const proposal=validateDraft(source,value);
 const lineage=await (store() as import('@supabase/supabase-js').SupabaseClient).from('account_organization_versions').select('restores_run_id').eq('id',sourceVersion!).eq('baseline_id',baselineId).single();
 if(lineage.error)throw new Error('Source lineage unavailable');
 if(lineage.data.restores_run_id){
  const {auth,context}=await organizerScope(accountId);
  const {renameProvider}=await import('../advertising/organizer/provider');
  const provider=await renameProvider(auth.businessId,context.platform!.id,source,[auth.user.id],{readOnly:true});
  for(const node of source.nodes){const parent=nativeParent(node,source,saved.original);const c={entityId:node.id,before:{id:node.externalId,accountId:provider.accountId,level:node.level,parentId:parent,name:node.name,updatedAt:'',creativeId:node.creativeId},afterName:node.name};const current=await provider.adapter.read(c);if(current.name!==node.name||current.parentId!==parent||current.creativeId!==node.creativeId)throw new Error('Restoration source changed. Create a new restoration preview.');}
 }else if(organizationSignature(await capture(accountId))!==organizationSignature(source))throw new Error('Account organization changed since this proposal. Authorize a new inspection; existing history will be preserved.');
 return append(accountId,baselineId,previous,source,proposal,lineage.data.restores_run_id);
}
