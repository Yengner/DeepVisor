import 'server-only';
import {observeHierarchyIssues,captureAccountHealth} from '@/lib/server/insights/issues';
import { createAdminClient } from '@/lib/server/supabase/admin';
import { readAllPages } from '@/lib/server/repositories/pagination';
import { asRecord } from '@/lib/shared/utils/format';
import { changes } from '@/lib/shared/lifecycle/model';
import type { Observation } from '@/lib/shared/lifecycle/model';
import type { Database, Json } from '@/lib/shared/types/supabase';
export const lifecycleEnabled=()=>process.env.DEEPVISOR_AD_LIFECYCLE==='true'||process.env.DEEPVISOR_INSIGHTS_EVENTS==='true';
type Job=Database['public']['Tables']['account_sync_jobs']['Row'];
export async function captureLifecycle(job:Job, observed?:Array<{external_id:string;entity_level:string;parent_external_id:string|null;name:string|null;raw:Json}>, merge?:(previous:Observation[])=>Observation[]|null):Promise<boolean> {
 if(!lifecycleEnabled())return true;
 const db=createAdminClient();
 if(merge)return publishObservation(job,null,merge);
 const rows=observed??await readAllPages((from,to)=>db.from('ad_entities').select('external_id,entity_level,parent_external_id,name,raw').eq('business_id',job.business_id).eq('ad_account_id',job.ad_account_id).order('id').range(from,to),{nullDataError:'Lifecycle hierarchy unavailable'});
 const byId=new Map(rows.map(r=>[r.external_id,r]));
 const entities:Observation[]=rows.map(r=>{
  const raw=asRecord(r.raw),parent=asRecord(byId.get(r.parent_external_id??'')?.raw);
  const text=(v:unknown)=>typeof v==='string'?v:null;
  const money=(v:unknown)=>typeof v==='string'&&/^\d+$/.test(v)?Number(v):null;
  const targeting=asRecord(raw.targeting??parent.targeting);
  return {id:r.external_id,level:r.entity_level,parent:r.parent_external_id,campaign:text(raw.campaign_id??parent.campaign_id),name:r.name??'Unnamed advertising',configured:String(raw.status??'UNKNOWN'),effective:String(raw.effective_status??raw.status??'UNKNOWN'),start:text(raw.start_time??parent.start_time),end:text(raw.end_time??parent.end_time),dailyBudget:money(raw.daily_budget),lifetimeBudget:money(raw.lifetime_budget),targeting:{age_min:targeting.age_min??null,age_max:targeting.age_max??null,genders:targeting.genders??null,geo_locations:targeting.geo_locations??null,publisher_platforms:targeting.publisher_platforms??null}};
 });
 return publishObservation(job,entities,null);
}
/**
 * Compare with the last saved observation and publish. `merge` builds the new observation from the
 * previous one (a targeted read); it returns null when the baseline cannot support that, and
 * nothing is published.
 */
async function publishObservation(job:Job,full:Observation[]|null,merge:((previous:Observation[])=>Observation[]|null)|null):Promise<boolean>{
 const db=createAdminClient();
 const previous=await db.from('ad_lifecycle_observations').select('id,entities,observed_at').eq('business_id',job.business_id).eq('ad_account_id',job.ad_account_id).order('observed_at',{ascending:false}).order('id',{ascending:false}).limit(1).maybeSingle();
 if(previous.error)throw previous.error;
 const entities=full??(previous.data&&merge?merge(previous.data.entities as unknown as Observation[]):null);
 if(!entities)return false;
 const at=new Date().toISOString();
 const events=previous.data?changes(previous.data.entities as unknown as Observation[],entities,previous.data.observed_at,at):[];
 const result=await db.rpc('publish_ad_lifecycle',{p_job:job.id,p_generation:job.lease_generation,p_previous:previous.data?.id??null,p_entities:entities as unknown as Json,p_events:events as unknown as Json});
 if(result.error)throw result.error;
 await observeHierarchyIssues(job.business_id,job.ad_account_id,at,entities);
 return true;
}

export async function captureMetaLifecycle(job:Job,accessToken:string,external:string){
 if(!lifecycleEnabled())return;
 const {fetchMetaCampaignSeeds,fetchMetaAdsetSeeds,fetchMetaAdSeeds}=await import('@/lib/server/sync/meta/fetch');
 const input={accessToken,adAccountExternalId:external};
 const [campaigns,sets,ads]=await Promise.all([fetchMetaCampaignSeeds(input),fetchMetaAdsetSeeds(input),fetchMetaAdSeeds(input)]);
 const rows=[...campaigns.map(r=>({...r,level:'campaign',parent:null})),...sets.map(r=>({...r,level:'adset',parent:r.campaignExternalId})),...ads.map(r=>({...r,level:'ad',parent:r.adsetExternalId}))].map(r=>({external_id:r.externalId,entity_level:r.level,parent_external_id:r.parent??null,name:r.name,raw:r.raw??{}}));
 await captureLifecycle(job,rows);
 await captureAccountHealth(job.business_id,job.ad_account_id,external,accessToken).catch(()=>console.warn('Account health observation unavailable; previous evidence retained.'));
}

/** Ads are leaves: re-reading only them cannot miss a parent cascade. Anything else reads the whole hierarchy. */
export const TARGETED_AD_LIMIT=25;
export function targetedAdIds(objects:unknown):string[]|null{
 if(!Array.isArray(objects)||!objects.length||objects.length>TARGETED_AD_LIMIT)return null;
 const ids=objects.map(o=>{const r=asRecord(o);return r.level==='ad'&&typeof r.id==='string'&&/^\d{1,20}$/.test(r.id)?r.id:null;});
 return ids.every((id):id is string=>id!==null)?[...new Set(ids)]:null;
}
/** Replace the named ads in the previous observation. Null when an ad's ad set is unknown to that baseline. */
export function mergeAds(previous:Observation[],ads:Array<{id:string;adset_id:string|null;name:string|null;status:string|null;effective_status:string|null}>):Observation[]|null{
 const byId=new Map(previous.map(e=>[e.id,e]));
 for(const ad of ads){
  const parent=ad.adset_id?byId.get(ad.adset_id):undefined;
  if(!parent||parent.level!=='adset')return null;
  // A status inherited from a parent means the parent changed too: only a full read can attribute that correctly.
  if(/^(ADSET|CAMPAIGN)_PAUSED$/.test(String(ad.effective_status)))return null;
  byId.set(ad.id,{id:ad.id,level:'ad',parent:parent.id,campaign:parent.campaign,name:ad.name??'Unnamed advertising',configured:String(ad.status??'UNKNOWN'),effective:String(ad.effective_status??ad.status??'UNKNOWN'),start:parent.start,end:parent.end,dailyBudget:null,lifetimeBudget:null,targeting:parent.targeting});
 }
 return [...byId.values()];
}
/**
 * The read behind a provider event (verified webhook). The webhook only named what may have
 * changed; current status always comes from this Marketing API read. Unlike the opportunistic
 * capture inside a performance refresh, a failure here fails the job so the queue retries it.
 */
export async function captureMetaEvents(job:Job,accessToken:string,external:string,objects:unknown):Promise<'targeted'|'full'|'disabled'>{
 if(!lifecycleEnabled())return 'disabled';
 const ids=targetedAdIds(objects);
 let mode:'targeted'|'full'='full';
 if(ids){
  const {fetchMetaObject}=await import('@/lib/server/sync/meta/client');
  const {ResourceDeferred}=await import('@/lib/server/sync/resources/budget');
  try{
   const found=await fetchMetaObject<Record<string,unknown>>({path:'',accessToken,params:{ids:ids.join(','),fields:'id,adset_id,name,status,effective_status'}});
   const ads=ids.map(id=>asRecord(asRecord(found)[id])).filter(ad=>typeof ad.id==='string').map(ad=>({id:String(ad.id),adset_id:typeof ad.adset_id==='string'?ad.adset_id:null,name:typeof ad.name==='string'?ad.name:null,status:typeof ad.status==='string'?ad.status:null,effective_status:typeof ad.effective_status==='string'?ad.effective_status:null}));
   // Every named ad must come back; otherwise (deleted, moved, inaccessible) read everything.
   if(ads.length===ids.length&&await captureLifecycle(job,undefined,previous=>mergeAds(previous,ads)))mode='targeted';
  }catch(error){if(error instanceof ResourceDeferred)throw error;}
 }
 if(mode==='full'){
  const {fetchMetaCampaignSeeds,fetchMetaAdsetSeeds,fetchMetaAdSeeds}=await import('@/lib/server/sync/meta/fetch');
  const input={accessToken,adAccountExternalId:external};
  const [campaigns,sets,ads]=await Promise.all([fetchMetaCampaignSeeds(input),fetchMetaAdsetSeeds(input),fetchMetaAdSeeds(input)]);
  await captureLifecycle(job,[...campaigns.map(r=>({...r,level:'campaign',parent:null})),...sets.map(r=>({...r,level:'adset',parent:r.campaignExternalId})),...ads.map(r=>({...r,level:'ad',parent:r.adsetExternalId}))].map(r=>({external_id:r.externalId,entity_level:r.level,parent_external_id:r.parent??null,name:r.name,raw:r.raw??{}})));
 }
 await captureAccountHealth(job.business_id,job.ad_account_id,external,accessToken).catch(()=>console.warn('Account health observation unavailable; previous evidence retained.'));
 return mode;
}
