import 'server-only';
import { createHash } from 'node:crypto';
import { createAdminClient } from '@/lib/server/supabase/admin';
import { readAllPages } from '@/lib/server/repositories/pagination';
import { accountToday, previousReportRange } from '@/lib/shared/reports/dates';
import {recapRevision} from '@/lib/shared/insights/revision';
import { recapWindow, summarize, completeComparable } from '@/lib/shared/insights/model';
import type { Issue, IssueEvidence, Presentation, SavedPresentation, PerformanceRow } from '@/lib/shared/insights/model';
import type { Database, Json } from '@/lib/shared/types/supabase';
import type { Observation } from '@/lib/shared/lifecycle/model';
import { lifecycleBrief } from '@/lib/server/lifecycle/brief';
import { observeIssues, observeHierarchyIssues } from './issues';
import {loadHourlyRecap} from './hourly';
export type Scope={business:string;account:string;user:string;integration:string|null};
const db=()=>createAdminClient();
export async function savedPresentation(scope:Scope,id:string):Promise<SavedPresentation|null>{
 const r=await db().from('insight_presentations').select('id,created_at,payload').eq('business_id',scope.business).eq('ad_account_id',scope.account).eq('user_id',scope.user).eq('id',id).maybeSingle();
 if(r.error)throw r.error;return r.data as unknown as SavedPresentation|null;
}
export async function history(scope:Scope,before:string|null){
 let q=db().from('insight_presentations').select('id,created_at,payload').eq('business_id',scope.business).eq('ad_account_id',scope.account).eq('user_id',scope.user).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(21);
 if(before){const cursor=await savedPresentation(scope,before);if(!cursor)throw new Error('Invalid history cursor');q=q.or(`created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`);}
 const r=await q;if(r.error)throw r.error;
 const issues=await db().from('insight_issues').select('id,evidence,observed_at,resolved_at,revision',{count:'exact'}).eq('business_id',scope.business).eq('ad_account_id',scope.account).is('resolved_at',null).order('opened_at',{ascending:false}).limit(50);
 if(issues.error)throw issues.error;
 return {items:r.data.slice(0,20) as unknown as SavedPresentation[],next:r.data.length>20?r.data[19].id:null,issues:issues.data.map(issue),issueCount:issues.count??issues.data.length};
}
function issue(r:{id:string;evidence:Json;observed_at:string;resolved_at:string|null;revision:number}):Issue{
 return {...r.evidence as unknown as IssueEvidence,id:r.id,revision:r.revision,observedAt:r.observed_at,resolvedAt:r.resolved_at,stale:Date.now()-Date.parse(r.observed_at)>24*3600000};
}
async function observeSavedSources(s:Scope){
 const client=db();
 if(s.integration){
  const r=await client.from('platform_integrations').select('status,token_expires_at,updated_at,last_synced_at').eq('business_id',s.business).eq('id',s.integration).single();if(r.error)throw r.error;
  const i=r.data,expired=Boolean(i.token_expires_at&&Date.parse(i.token_expires_at)<=Date.now());
  if(i.status==='needs_reauth'||expired)await observeIssues(s.business,s.account,'connection',expired?i.token_expires_at!:i.updated_at,[{key:'reauth',title:'Reconnect Meta to keep data current',explanation:'The saved connection requires renewed authorization. Existing reports remain available.',action:'Open Connections',href:'/integration',entities:[],code:'REAUTH_REQUIRED'}]);
  else if(i.status==='connected'&&i.last_synced_at)await observeIssues(s.business,s.account,'connection',i.last_synced_at,[]);
 }
 const snapshot=await client.from('ad_lifecycle_observations').select('entities,observed_at').eq('business_id',s.business).eq('ad_account_id',s.account).order('observed_at',{ascending:false}).order('id',{ascending:false}).limit(1).maybeSingle();
 if(snapshot.error)throw snapshot.error;
 if(snapshot.data)await observeHierarchyIssues(s.business,s.account,snapshot.data.observed_at,snapshot.data.entities as unknown as Observation[]);
}
async function publication(s:Scope){
 const c=db();const [account,state,resources,running]=await Promise.all([
 c.from('ad_accounts').select('name,timezone,currency_code,last_synced').eq('business_id',s.business).eq('id',s.account).single(),
 c.from('ad_account_sync_state').select('last_incremental_sync_at,first_full_sync_at,insights_synced_through').eq('ad_account_id',s.account).maybeSingle(),
 c.from('account_sync_resources').select('resource_key,revision,last_success_at,coverage_end,coverage_start').eq('business_id',s.business).eq('ad_account_id',s.account).eq('kind','performance').order('resource_key'),
 c.from('account_sync_jobs').select('id').eq('business_id',s.business).eq('ad_account_id',s.account).eq('status','running').limit(1)]);
 for(const r of [account,state,resources,running])if(r.error)throw r.error;
 const times=[account.data!.last_synced,state.data?.last_incremental_sync_at,state.data?.first_full_sync_at,...resources.data!.map(r=>r.last_success_at)].filter((v):v is string=>Boolean(v)).sort();
 return {account:account.data!,state:state.data,resources:resources.data!,syncedAt:times.at(-1)??null,running:Boolean(running.data!.length),signature:JSON.stringify([account.data!.last_synced,state.data,resources.data])};
}
async function loadRecap(s:Scope,window:NonNullable<ReturnType<typeof recapWindow>>,currency:string|null,syncedAt:string|null){
  const previous=previousReportRange({dateFrom:window.since,dateTo:window.until});
  const rows=await readAllPages((from,to)=>db().from('report_entity_daily_v').select('day,entity_external_id,spend,leads,messages,calls,currency_code').eq('business_id',s.business).eq('ad_account_id',s.account).eq('entity_level','adset').gte('day',previous.dateFrom).lte('day',window.until).order('day').order('entity_external_id').range(from,to),{nullDataError:'Performance unavailable'}) as PerformanceRow[];
  const result=summarize(rows,window,currency);
  if(window.since===window.until&&result.observedDays)result.hourly=await loadHourlyRecap(s.business,s.account,window.since,currency);
  if(result.observedDays){
   const current=rows.filter(r=>r.day!>=window.since),prior=rows.filter(r=>r.day!<window.since),ids=[...new Set(rows.map(r=>r.entity_external_id).filter((v):v is string=>Boolean(v)))];
   const baseline=summarize(prior,{since:previous.dateFrom,until:previous.dateTo,capped:false},currency);
   if(syncedAt&&Date.now()-Date.parse(syncedAt)<=24*3600000&&completeComparable(current,window.since,window.until,ids)&&completeComparable(prior,previous.dateFrom,previous.dateTo,ids)&&baseline.results!==null&&baseline.results>0&&baseline.spend!==null&&baseline.spend>0&&result.results!==null&&result.spend!==null)result.comparison={results:(result.results-baseline.results)/baseline.results*100,spend:(result.spend-baseline.spend)/baseline.spend*100};
  }
 return result.observedDays?result:null;
}
async function reviseSavedRecap(s:Scope,pub:Awaited<ReturnType<typeof publication>>,checked:string|null|undefined){
 if(pub.running||checked===pub.signature)return;
 const c=db(),last=await c.from('insight_presentations').select('id,created_at,payload,source_keys,recap_until').eq('business_id',s.business).eq('ad_account_id',s.account).eq('user_id',s.user).not('recap_until','is',null).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(1).maybeSingle();
 if(last.error)throw last.error;
 if(last.data&&pub.syncedAt&&Date.parse(pub.syncedAt)>Date.parse(last.data.created_at)){
  const old=last.data as unknown as SavedPresentation,window=old.payload.recap;
  if(window){
   const recap=await loadRecap(s,{since:window.since,until:window.until,capped:window.capped},old.payload.currency,pub.syncedAt);
   const after=await publication(s);if(after.signature!==pub.signature||after.running)return;
   const payload=recap?recapRevision(old,recap,pub.syncedAt,new Date().toISOString()):null;
   if(payload){const inserted=await c.from('insight_presentations').insert({business_id:s.business,ad_account_id:s.account,user_id:s.user,fingerprint:createHash('sha256').update(`revision:${old.id}:${pub.signature}`).digest('hex'),payload:payload as unknown as Json,source_keys:last.data.source_keys,recap_until:last.data.recap_until});if(inserted.error&&inserted.error.code!=='23505')throw inserted.error;}
  }
 }
 const checkedResult=await c.from('insight_reviews').update({checked_revision:pub.signature}).eq('user_id',s.user).eq('ad_account_id',s.account);if(checkedResult.error)throw checkedResult.error;
}
export async function prepare(s:Scope,token:string):Promise<(SavedPresentation&{additionalUpdates?:boolean})|null>{
 const c=db();await observeSavedSources(s);
 const [review,pending,pub]=await Promise.all([
 c.from('insight_reviews').select('*').eq('user_id',s.user).eq('ad_account_id',s.account).maybeSingle(),
 c.rpc('pending_insight_sources',{p_account:s.account,p_user:s.user}),publication(s)]);
 if(review.error)throw review.error;if(pending.error)throw pending.error;
 const sources=pending.data as unknown as {issues:Database['public']['Tables']['insight_issues']['Row'][];events:Array<{id:string;root_id:string;affected_ids:string[]}>};
 const issues=sources.issues.map(issue),candidates=sources.events;
 const lifecycle:Presentation['lifecycle']=[];
 for(const event of candidates){const brief=await lifecycleBrief(s.business,s.account,event.id);if(brief)lifecycle.push({eventId:event.id,rootId:event.root_id,affectedIds:event.affected_ids,brief});}
 const today=accountToday(pub.account.timezone);
 let window=today?recapWindow(today,review.data?.reviewed_through??null):null;
 const publishedThrough=[pub.state?.insights_synced_through,...pub.resources.filter(r=>r.last_success_at).map(r=>r.coverage_end)].filter((v):v is string=>Boolean(v)).sort().at(-1);
 if(window&&publishedThrough&&publishedThrough<window.until)window=publishedThrough>=window.since?{...window,until:publishedThrough}:null;
 let recap:Presentation['recap']=null;
 const limitations=['Results are Meta-reported leads, messaging conversations and calls, not confirmed bookings.','Updates reflect saved synchronizations, not continuous live monitoring.'];
 // A running legacy sync can expose intermediate rows. Defer recap until the queue publishes successfully.
 const covered=window&&(pub.state?.insights_synced_through??'')>=window.until;
 const resourceCovered=window&&pub.resources.some(r=>r.last_success_at&&r.coverage_start&&r.coverage_start<=window.since&&r.coverage_end&&r.coverage_end>=window.until);
 if(window&&review.data?.routine_day!==today&&pub.syncedAt&&!pub.running&&(covered||resourceCovered)){
  const result=await loadRecap(s,window,pub.account.currency_code,pub.syncedAt);
  if(result){
   const after=await publication(s);if(after.signature===pub.signature&&!after.running)recap=result;else limitations.push('Performance changed during preparation. Your recap will be available after publication stabilizes.');
  }
 }
 if(pub.syncedAt&&Date.now()-Date.parse(pub.syncedAt)>24*3600000)limitations.push('The last successful synchronization is more than a day old. Current delivery may differ.');
 if(recap&&today&&recap.until<new Date(Date.parse(today+'T00:00:00Z')-86400000).toISOString().slice(0,10))limitations.push(`Published coverage currently ends ${recap.until}; more recent days are not included.`);
 if(!recap&&window)limitations.push('A completed-day recap is not yet available, or today’s recap was already presented.');
 const payload:Presentation={version:1,account:pub.account.name??'Meta account',timezone:pub.account.timezone,currency:pub.account.currency_code,preparedAt:new Date().toISOString(),syncedAt:pub.syncedAt,recap,issues,lifecycle,limitations};
 await reviseSavedRecap(s,pub,review.data?.checked_revision);
 const keys=[...issues.map(i=>`issue:${i.id}:${i.revision}`),...lifecycle.map(e=>`lifecycle:${e.eventId}`)];
 const fingerprint=createHash('sha256').update(JSON.stringify([keys,recap,pub.signature])).digest('hex');
 const result=await c.rpc('present_insights',{p_business:s.business,p_account:s.account,p_user:s.user,p_token:token,p_day:today??new Date().toISOString().slice(0,10),p_expected:review.data?.reviewed_through??null,p_payload:payload as unknown as Json,p_keys:keys,p_fingerprint:fingerprint,p_until:recap?.until??null,p_urgent:issues.length>0});
 if(result.error)throw result.error;if(!result.data)return null;
 const saved=await savedPresentation(s,result.data);
 if(saved){const notification=await c.from('notifications').insert({business_id:s.business,user_id:s.user,dedupe_key:`insights:${saved.id}`,source_type:'insights',source_id:saved.id,title:'Your advertising update',message:issues.length?'An advertising update needs your attention.':'Your saved advertising catch-up is ready.',link:`/insights?id=${saved.id}`,type:'insights',severity:issues.length?'warning':'info',payload_json:{surface:'bell'}});if(notification.error&&notification.error.code!=='23505')console.warn('Insights notification pointer unavailable');}
 if(saved){const delivered=new Set([...saved.payload.issues.map(i=>`issue:${i.id}:${i.revision}`),...saved.payload.lifecycle.map(e=>`lifecycle:${e.eventId}`)]);return {...saved,additionalUpdates:keys.some(key=>!delivered.has(key))};}
 return saved;
}
