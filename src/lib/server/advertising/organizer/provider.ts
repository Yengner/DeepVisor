import 'server-only';
import {createAdminClient} from '../../supabase/admin';
import {getBusinessIntegrationById,resolveIntegrationAccessToken} from '../../integrations/service';
import {MetaRenameAdapter,renameEnabled} from './adapter';
import {stateSchema,type RenameChange} from '@/lib/shared/organizer/renamePlan';
import type {Snapshot} from '@/lib/shared/organizer/model';
import type {RenameAdapter} from './execute';
import type {SupabaseClient} from '@supabase/supabase-js';
const project='gkdyyjqepzayjdpvqnja';
export function simulationAllowed(accountId:string){return ['development','test'].includes(process.env.NODE_ENV??'')&&process.env.DEEPVISOR_ORGANIZER_SIMULATION===project&&process.env.NEXT_PUBLIC_SUPABASE_URL===`https://${project}.supabase.co`&&['eeee4445-0000-4000-8000-000000000001','7e365a93-b133-4574-aa86-89deb51030bf'].includes(accountId);}
export async function renameProvider(businessId:string,integrationId:string,snapshot:Snapshot,actorIds:string[],options:{readOnly?:boolean;writeDeadline?:number}={}){
 const db=createAdminClient() as SupabaseClient;
 const account=await db.from('ad_accounts').select('*').eq('business_id',businessId).eq('id',snapshot.accountId).single();
 if(account.error)throw new Error('Account unavailable');
 const simulated=simulationAllowed(snapshot.accountId);
 const guard=async(writing=true)=>{
  if(writing&&options.readOnly)throw new Error('Read-only provider');
  if(writing&&options.writeDeadline!==undefined&&Date.now()>=options.writeDeadline)throw new Error('Execution deadline elapsed');
  for(const actor of new Set(actorIds)){const r=await db.rpc('organizer_assert_owner',{p_business:businessId,p_actor:actor});if(r.error)throw new Error('Owner/admin authorization changed');}
  if(simulated){if(!simulationAllowed(snapshot.accountId))throw new Error('Simulation disabled');return;}
  if(writing&&!renameEnabled(businessId))throw new Error('Live renaming is disabled');
  const integration=await getBusinessIntegrationById(createAdminClient(),{businessId,integrationId});
  if(!integration||integration.status!=='connected'||integration.platformKey!=='meta'||integration.platformId!==account.data.platform_id)throw new Error('Meta connection unavailable');
 };
 if(simulated){
  if(!account.data.name?.includes('SYNTHETIC'))throw new Error('Synthetic account required');
  const byId=new Map(snapshot.nodes.map(n=>[n.id,n]));
  const adapter:RenameAdapter={
   assertWritable:()=>guard(),
   async read(c){
    const n=byId.get(c.entityId);if(!n)throw new Error('Unknown fixture entity');
    const native=await db.from('ad_entities').select('id').eq('id',n.id).eq('business_id',businessId).eq('ad_account_id',snapshot.accountId).maybeSingle();if(native.error||!native.data)throw new Error('Fixture entity unavailable');
    const seed={id:n.externalId,level:n.level,parentId:n.parentId?byId.get(n.parentId)?.externalId??c.before.parentId:null,accountId:account.data.external_account_id.replace(/^act_/,''),name:n.name,updatedAt:n.createdAt??snapshot.capturedAt,creativeId:n.creativeId};
    const r=await db.from('organization_rename_simulation').upsert({business_id:businessId,ad_account_id:snapshot.accountId,entity_id:n.id,state:seed},{onConflict:'business_id,ad_account_id,entity_id',ignoreDuplicates:true});if(r.error)throw new Error('Simulation persistence failed');
    const row=await db.from('organization_rename_simulation').select('state').eq('business_id',businessId).eq('ad_account_id',snapshot.accountId).eq('entity_id',n.id).single();if(row.error)throw new Error('Simulation read failed');return stateSchema.parse(row.data.state);
   },
   async rename(c){await guard();const result=await db.from('organization_rename_simulation').update({state:{...c.before,name:c.afterName,updatedAt:new Date().toISOString()}}).eq('business_id',businessId).eq('ad_account_id',snapshot.accountId).eq('entity_id',c.entityId);if(result.error)throw new Error('Simulation write failed');},
  };
  return {adapter,simulated,accountId:account.data.external_account_id.replace(/^act_/,'')};
 }
 // Explicit reconciliation/restoration can read after a kill switch, but cannot write.
 await guard(!options.readOnly);
 const integration=await getBusinessIntegrationById(createAdminClient(),{businessId,integrationId});
 const token=integration&&await resolveIntegrationAccessToken(createAdminClient(),integration);if(!token)throw new Error('Meta credential unavailable');
 const live=new MetaRenameAdapter({businessId,accountId:account.data.external_account_id,token,writeDeadline:options.writeDeadline});
 return {adapter:{read:(c:RenameChange)=>live.read(c),assertWritable:async()=>{await guard();await live.assertWritable();},rename:async(c:RenameChange)=>{await guard();await live.rename(c);}},simulated:false,accountId:account.data.external_account_id.replace(/^act_/,'')};
}
