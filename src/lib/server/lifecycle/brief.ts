import 'server-only';
import {isDeepStrictEqual} from 'node:util';
import {mediaFor} from '@/lib/server/campaigns/exploration/model';
import {createAdminClient} from '@/lib/server/supabase/admin';
import {readAllPages} from '@/lib/server/repositories/pagination';
import {accountToday,shiftReportDay} from '@/lib/shared/reports/dates';
import type {LifecycleBrief} from '@/lib/shared/lifecycle/types';
import {forecast} from '@/lib/shared/lifecycle/model';
import {asRecord} from '@/lib/shared/utils/format';
import type {Observation} from '@/lib/shared/lifecycle/model';
import type {Json} from '@/lib/shared/types/supabase';
export async function lifecycleBrief(business:string,account:string,id:string,refresh=false,readOnly=false):Promise<LifecycleBrief|null>{
 const db=createAdminClient();
 const event=await db.from('ad_lifecycle_events').select('*').eq('business_id',business).eq('ad_account_id',account).eq('id',id).maybeSingle();
 if(event.error)throw event.error;if(!event.data)return null;
 const e=event.data;
 const saved=await db.from('ad_lifecycle_briefs').select('payload,revision').eq('event_id',id).order('revision',{ascending:false}).limit(1).maybeSingle();
 if(saved.error)throw saved.error;if(!refresh&&saved.data&&asRecord(saved.data.payload).contractVersion===2)return saved.data.payload as unknown as LifecycleBrief;
 if(readOnly)return null;
 const [snapshot,a]=await Promise.all([db.from('ad_lifecycle_observations').select('entities,observed_at').eq('id',e.after_id).eq('business_id',business).eq('ad_account_id',account).single(),db.from('ad_accounts').select('currency_code,timezone').eq('id',account).eq('business_id',business).single()]);
 if(snapshot.error)throw snapshot.error;if(a.error)throw a.error;
 const entities=snapshot.data.entities as unknown as Observation[];
 const until=accountToday(a.data.timezone,new Date(e.created_at));if(!until)throw new Error('Account timezone unavailable');
 const since=shiftReportDay(until,-29);
 const rows=await readAllPages((from,to)=>db.from('report_entity_daily_v').select('entity_external_id,day,spend,leads,messages,calls,currency_code').eq('business_id',business).eq('ad_account_id',account).eq('entity_level','ad').in('entity_external_id',e.affected_ids).gte('day',since).lte('day',until).order('entity_external_id').order('day').range(from,to),{nullDataError:'Lifecycle performance unavailable'});
 const valid=rows.filter(r=>r.currency_code===a.data.currency_code);
 const sum=(items:Array<number|null>)=>items.length&&items.every(v=>v!==null)?items.reduce<number>((n,v)=>n+v!,0):null;
 const result=(r:typeof rows[number])=>r.leads===null||r.messages===null||r.calls===null?null:r.leads+r.messages+r.calls;
 const spend=valid.length===rows.length?sum(valid.map(r=>r.spend)):null,results=valid.length===rows.length?sum(valid.map(result)):null;
 const days=[...new Set(valid.map(r=>r.day).filter((v):v is string=>Boolean(v)))].sort().map(day=>{const group=valid.filter(r=>r.day===day);return{day,spend:sum(group.map(r=>r.spend)),results:sum(group.map(result))};});
 const ads=await db.from('ad_entities').select('creative_external_id,name').eq('business_id',business).eq('ad_account_id',account).eq('entity_level','ad').in('external_id',e.affected_ids);
 if(ads.error)throw ads.error;
 const creativeIds=ads.data.map(r=>r.creative_external_id).filter((v):v is string=>Boolean(v));
 const creatives=creativeIds.length?await db.from('ad_creatives').select('*').eq('business_id',business).eq('ad_account_id',account).in('platform_creative_id',creativeIds):{data:[],error:null};
 if(creatives.error)throw creatives.error;
 const media=creatives.data.map(c=>({image:mediaFor(c).image,name:ads.data.find(r=>r.creative_external_id===c.platform_creative_id)?.name??'Ad creative'}));
 const ad=entities.find(r=>e.affected_ids.includes(r.id));
 const set=entities.find(r=>r.id===ad?.parent),campaign=entities.find(r=>r.id===ad?.campaign);
 const owner=set && (set.dailyBudget!==null||set.lifetimeBudget!==null)?set:campaign;
 const factor=10**new Intl.NumberFormat('en',{style:'currency',currency:a.data.currency_code??'USD'}).resolvedOptions().maximumFractionDigits!;
 const targeting=asRecord(set?.targeting??ad?.targeting),geo=asRecord(targeting.geo_locations);
 const dailyBudget=owner?.dailyBudget!=null?owner.dailyBudget/factor:null,lifetimeBudget=owner?.lifetimeBudget!=null?owner.lifetimeBudget/factor:null;
 const endDay=ad?.end?accountToday(a.data.timezone,new Date(ad.end)):null;
 const remainingDays=endDay?Math.max(0,Math.floor((Date.parse(endDay)-Date.parse(until))/86400000)):0;
 const planned=['activated','resumed'].includes(e.kind)&&dailyBudget!==null&&remainingDays>0?dailyBudget*remainingDays:null;
 let projection:ReturnType<typeof forecast>=null;
 if(planned!==null&&owner){
  const history=await readAllPages((from,to)=>db.from('report_entity_daily_v').select('day,spend,leads,messages,calls,currency_code').eq('business_id',business).eq('ad_account_id',account).eq('entity_external_id',owner.id).eq('entity_level',owner.level).gte('day',shiftReportDay(until,-28)).lt('day',until).order('day').range(from,to),{nullDataError:'Projection history unavailable'});
  if(history.every(r=>r.currency_code===a.data.currency_code))projection=forecast(history.filter(r=>r.day).map(r=>({day:r.day!,spend:r.spend,results:r.leads===null||r.messages===null||r.calls===null?null:r.leads+r.messages+r.calls})),planned);
 }
 const configuration={owner:owner?.name??'Budget owner unavailable',dailyBudget,lifetimeBudget,planned,projection,platforms:Array.isArray(targeting.publisher_platforms)?targeting.publisher_platforms.filter((v):v is string=>typeof v==='string'):[],audience:targeting.age_min||targeting.age_max?`Ages ${targeting.age_min??'unknown'}–${targeting.age_max??'unknown'}`:'Targeting age not recorded',geography:Array.isArray(geo.countries)?geo.countries.join(', '):'Location details unavailable'};
 const breakdowns:NonNullable<LifecycleBrief['breakdowns']>=[];
 if(set&&new Set(entities.filter(r=>e.affected_ids.includes(r.id)).map(r=>r.parent)).size===1){
 const dim=await db.from('ad_entities').select('id').eq('business_id',business).eq('ad_account_id',account).eq('external_id',set.id).eq('entity_level','adset').maybeSingle();if(dim.error)throw dim.error;
 if(dim.data)for(const kind of ['age_gender','publisher_platform']){
  const recent=await db.from('ad_audience_breakdowns_summary').select('first_day,last_day').eq('ad_account_id',account).eq('entity_id',dim.data.id).eq('breakdown_type',kind).order('last_day',{ascending:false,nullsFirst:false}).limit(1).maybeSingle();if(recent.error)throw recent.error;
  if(!recent.data?.first_day||!recent.data.last_day)continue;
  const window=recent.data;
  const segment=await readAllPages((from,to)=>db.from('ad_audience_breakdowns_summary').select('dimension_1_value,dimension_2_value,impressions,spend').eq('ad_account_id',account).eq('entity_id',dim.data!.id).eq('breakdown_type',kind).eq('first_day',window.first_day!).eq('last_day',window.last_day!).order('dimension_1_value').order('dimension_2_value').range(from,to),{nullDataError:'Breakdown unavailable'});
  breakdowns.push({kind,scope:`Ad-set context: ${set.name}. Not individual-ad attribution.`,since:window.first_day,until:window.last_day,rows:segment.map(r=>({label:[r.dimension_1_value,r.dimension_2_value].filter(Boolean).join(' · '),impressions:r.impressions,spend:r.spend}))});
 }
 }
 const brief:LifecycleBrief={id,title:entities.find(r=>r.id===e.root_id)?.name??'Advertising update',explanation:e.explanation,provenance:e.provenance,observedAt:snapshot.data.observed_at,currency:a.data.currency_code,timezone:a.data.timezone!,breakdowns,configuration,media,since,until,affected:entities.filter(r=>e.affected_ids.includes(r.id)),spend,results,cpr:spend!==null&&results!==null&&results>0?spend/results:null,days,limitations:['Reported results combine leads, messaging conversations and calls; they are not verified bookings.','Available daily observations only. Missing dates are not zero. Exact intraday interruption spend is unavailable.','Audience and platform observations are not included unless their entity scope and measurement window can be verified.',...(e.provenance==='reconstructed'?['Reconstructed from saved state and your confirmation. The exact pause time and previous state are not established.']:[])]};
 if(saved.data&&isDeepStrictEqual({...brief,contractVersion:2},saved.data.payload))return brief;
 const insert=await db.from('ad_lifecycle_briefs').insert({event_id:id,revision:(saved.data?.revision??0)+1,payload:{...brief,contractVersion:2} as unknown as Json});
 if(insert.error&&insert.error.code!=='23505')throw insert.error;
 if(insert.error){const winner=await db.from('ad_lifecycle_briefs').select('payload').eq('event_id',id).eq('revision',(saved.data?.revision??0)+1).single();if(winner.error)throw winner.error;return winner.data.payload as unknown as LifecycleBrief;}
 return brief;
}

export async function refreshLifecycleBriefs(business:string,account:string){
 if(process.env.DEEPVISOR_AD_LIFECYCLE!=='true'&&process.env.DEEPVISOR_INSIGHTS_EVENTS!=='true')return;
 const db=createAdminClient();const recent=await db.from('ad_lifecycle_events').select('id').eq('business_id',business).eq('ad_account_id',account).gte('created_at',new Date(Date.now()-3*86400000).toISOString()).order('created_at',{ascending:false}).limit(20);
 if(recent.error)throw recent.error;
 for(const event of recent.data)await lifecycleBrief(business,account,event.id,true);
}
