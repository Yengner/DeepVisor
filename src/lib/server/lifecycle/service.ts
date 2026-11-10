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
export async function captureLifecycle(job:Job, observed?:Array<{external_id:string;entity_level:string;parent_external_id:string|null;name:string|null;raw:Json}>) {
 if(!lifecycleEnabled())return;
 const db=createAdminClient();
 const rows=observed??await readAllPages((from,to)=>db.from('ad_entities').select('external_id,entity_level,parent_external_id,name,raw').eq('business_id',job.business_id).eq('ad_account_id',job.ad_account_id).order('id').range(from,to),{nullDataError:'Lifecycle hierarchy unavailable'});
 const byId=new Map(rows.map(r=>[r.external_id,r]));
 const entities:Observation[]=rows.map(r=>{
  const raw=asRecord(r.raw),parent=asRecord(byId.get(r.parent_external_id??'')?.raw);
  const text=(v:unknown)=>typeof v==='string'?v:null;
  const money=(v:unknown)=>typeof v==='string'&&/^\d+$/.test(v)?Number(v):null;
  const targeting=asRecord(raw.targeting??parent.targeting);
  return {id:r.external_id,level:r.entity_level,parent:r.parent_external_id,campaign:text(raw.campaign_id??parent.campaign_id),name:r.name??'Unnamed advertising',configured:String(raw.status??'UNKNOWN'),effective:String(raw.effective_status??raw.status??'UNKNOWN'),start:text(raw.start_time??parent.start_time),end:text(raw.end_time??parent.end_time),dailyBudget:money(raw.daily_budget),lifetimeBudget:money(raw.lifetime_budget),targeting:{age_min:targeting.age_min??null,age_max:targeting.age_max??null,genders:targeting.genders??null,geo_locations:targeting.geo_locations??null,publisher_platforms:targeting.publisher_platforms??null}};
 });
 const previous=await db.from('ad_lifecycle_observations').select('id,entities,observed_at').eq('business_id',job.business_id).eq('ad_account_id',job.ad_account_id).order('observed_at',{ascending:false}).order('id',{ascending:false}).limit(1).maybeSingle();
 if(previous.error)throw previous.error;
 const at=new Date().toISOString();
 const events=previous.data?changes(previous.data.entities as unknown as Observation[],entities,previous.data.observed_at,at):[];
 const result=await db.rpc('publish_ad_lifecycle',{p_job:job.id,p_generation:job.lease_generation,p_previous:previous.data?.id??null,p_entities:entities as unknown as Json,p_events:events as unknown as Json});
 if(result.error)throw result.error;
 await observeHierarchyIssues(job.business_id,job.ad_account_id,at,entities);
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
