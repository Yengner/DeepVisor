import 'server-only';
import { createHash } from 'node:crypto';
import { createAdminClient } from '@/lib/server/supabase/admin';
import { readAllPages } from '@/lib/server/repositories/pagination';
import { accountToday, previousReportRange } from '@/lib/shared/reports/dates';
import {recapChange, recapRevision, revisable} from '@/lib/shared/insights/revision';
import {urgentIssues, recapWindow, summarize, completeComparable, idleRecap, chooseWelcome } from '@/lib/shared/insights/model';
import { accountActiveAdCount } from '@/lib/server/campaigns/activity';
import { lastSpendDay, loadIdleSuggestion } from '@/lib/server/suggestions/idle';
import type { Issue, IssueEvidence, Presentation, SavedPresentation, PerformanceRow, Welcome } from '@/lib/shared/insights/model';
import type { Database, Json } from '@/lib/shared/types/supabase';
import type { Observation } from '@/lib/shared/lifecycle/model';
import { lifecycleBrief } from '@/lib/server/lifecycle/brief';
import { observeIssues, observeHierarchyIssues } from './issues';
import {loadHourlyRecap} from './hourly';
import { dailyNotification, presentationDay, type DailyBundle } from '@/lib/shared/insights/notification';
export type Scope={business:string;account:string;user:string;integration:string|null};
const db=()=>createAdminClient();
/**
 * A saved update keeps what was shown, but an issue it named may have been resolved since. Mark
 * those with their current `resolvedAt`, so a re-shown update never demands action on something
 * Meta no longer reports. The saved evidence text itself is left untouched.
 */
async function withCurrentStatus<T extends SavedPresentation>(scope:Scope,saved:T[]):Promise<T[]>{
 const ids=[...new Set(saved.flatMap(p=>p.payload.issues.filter(i=>!i.resolvedAt&&i.id).map(i=>i.id)))];
 if(!ids.length)return saved;
 const r=await db().from('insight_issues').select('id,resolved_at').eq('business_id',scope.business).eq('ad_account_id',scope.account).in('id',ids).not('resolved_at','is',null);
 if(r.error)throw r.error;
 const resolved=new Map(r.data.map(i=>[i.id,i.resolved_at as string]));
 if(!resolved.size)return saved;
 return saved.map(p=>({...p,payload:{...p.payload,issues:p.payload.issues.map(i=>resolved.has(i.id)?{...i,resolvedAt:resolved.get(i.id)!}:i)}}));
}
async function storedPresentation(scope:Scope,id:string):Promise<SavedPresentation|null>{
 const r=await db().from('insight_presentations').select('id,created_at,payload').eq('business_id',scope.business).eq('ad_account_id',scope.account).eq('user_id',scope.user).eq('id',id).maybeSingle();
 if(r.error)throw r.error;return r.data as unknown as SavedPresentation|null;
}
export async function savedPresentation(scope:Scope,id:string):Promise<SavedPresentation|null>{
 const saved=await storedPresentation(scope,id);
 return saved?(await withCurrentStatus(scope,[saved]))[0]:null;
}
export async function history(scope:Scope,before:string|null){
 let q=db().from('insight_presentations').select('id,created_at,payload').eq('business_id',scope.business).eq('ad_account_id',scope.account).eq('user_id',scope.user).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(21);
 if(before){const cursor=await storedPresentation(scope,before);if(!cursor)throw new Error('Invalid history cursor');q=q.or(`created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`);}
 const r=await q;if(r.error)throw r.error;
 const issues=await db().from('insight_issues').select('id,evidence,observed_at,resolved_at,revision',{count:'exact'}).eq('business_id',scope.business).eq('ad_account_id',scope.account).is('resolved_at',null).order('opened_at',{ascending:false}).limit(50);
 if(issues.error)throw issues.error;
 const page=await withCurrentStatus(scope,r.data.slice(0,20) as unknown as SavedPresentation[]);
 const reads=await readTimes(scope,page.map(p=>p.id));
 return {items:page.map(p=>({...p,readAt:reads.get(p.id)??null})),next:r.data.length>20?r.data[19].id:null,issues:issues.data.map(issue),issueCount:issues.count??issues.data.length};
}
/** Read = reviewed in the popup (receipt) or opened from history (view), whichever came first. */
async function readTimes(scope:Scope,ids:string[]){
 const times=new Map<string,string>();
 if(!ids.length)return times;
 const [receipts,views]=await Promise.all([
  db().from('insight_receipts').select('presentation_id,reviewed_at').in('presentation_id',ids),
  db().from('insight_history_views').select('presentation_id,viewed_at').eq('user_id',scope.user).in('presentation_id',ids)]);
 if(receipts.error)throw receipts.error;if(views.error)throw views.error;
 for(const r of receipts.data)times.set(r.presentation_id,r.reviewed_at);
 for(const v of views.data){const prior=times.get(v.presentation_id);if(!prior||v.viewed_at<prior)times.set(v.presentation_id,v.viewed_at);}
 return times;
}
/** Mark saved updates read for this person. Only their own presentations in this account are accepted. */
export async function markViewed(scope:Scope,ids:string[]):Promise<number>{
 if(!ids.length)return 0;
 const owned=await db().from('insight_presentations').select('id').eq('business_id',scope.business).eq('ad_account_id',scope.account).eq('user_id',scope.user).in('id',ids);
 if(owned.error)throw owned.error;
 if(!owned.data.length)return 0;
 const r=await db().from('insight_history_views').upsert(owned.data.map(o=>({presentation_id:o.id,user_id:scope.user})),{onConflict:'presentation_id',ignoreDuplicates:true});
 if(r.error)throw r.error;
 return owned.data.length;
}
/** Unread updates for the Overview entry point: newest first, bounded. */
export async function unreadSummary(scope:Scope){
 const r=await db().from('insight_presentations').select('id,created_at,payload').eq('business_id',scope.business).eq('ad_account_id',scope.account).eq('user_id',scope.user).order('created_at',{ascending:false}).limit(20);
 if(r.error)throw r.error;
 // Only the newest is shown (its headline), so only it needs the current issue status.
 const all=r.data as unknown as SavedPresentation[],items=all.length?[...await withCurrentStatus(scope,all.slice(0,1)),...all.slice(1)]:all;
 const reads=await readTimes(scope,items.map(i=>i.id));
 const unread=items.filter(i=>!reads.has(i.id));
 const open=await db().from('insight_issues').select('evidence').eq('business_id',scope.business).eq('ad_account_id',scope.account).is('resolved_at',null).order('opened_at',{ascending:false}).limit(100);
 if(open.error)throw open.error;
 // Only urgent issues raise the chip; Meta's notices (creative fatigue) are counted separately.
 const evidence=open.data.map(r=>r.evidence as unknown as IssueEvidence),urgent=urgentIssues(evidence);
 const topIssue=urgent[0]?.title??null;
 return {unread:unread.length,openIssues:urgent.length,notices:evidence.length-urgent.length,topIssue,latest:items[0]?{id:items[0].id,created_at:items[0].created_at,payload:items[0].payload}:null};
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
/**
 * Re-check the newest saved recap after a sync. A correction is saved only when it is material
 * (results changed, or spend moved by at least 5% and $1), at most once per original report: a
 * later correction updates that one revision. A spend-only correction is saved already read, so
 * it stays in history without competing for attention; a results change is shown as unread.
 * Recaps older than REVISION_WINDOW_DAYS are settled and no longer re-checked.
 */
async function reviseSavedRecap(s:Scope,pub:Awaited<ReturnType<typeof publication>>,checked:string|null|undefined){
 if(pub.running||checked===pub.signature)return;
 const c=db(),last=await c.from('insight_presentations').select('id,created_at,payload,source_keys,recap_until').eq('business_id',s.business).eq('ad_account_id',s.account).eq('user_id',s.user).not('recap_until','is',null).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(1).maybeSingle();
 if(last.error)throw last.error;
 const shown=last.data as unknown as (SavedPresentation|null),window=shown?.payload.recap;
 if(shown&&window&&pub.syncedAt&&Date.parse(pub.syncedAt)>Date.parse(shown.created_at)&&revisable(window,accountToday(pub.account.timezone))){
  const rootId=shown.payload.revisionOf??shown.id;
  const original=rootId===shown.id?shown:await storedPresentation(s,rootId);
  const recap=original?await loadRecap(s,{since:window.since,until:window.until,capped:window.capped},shown.payload.currency,pub.syncedAt):null;
  const after=await publication(s);if(after.signature!==pub.signature||after.running)return;
  const payload=original&&recap?recapRevision(original,shown,recap,pub.syncedAt,new Date().toISOString()):null;
  if(payload){
   const resultsChanged=recapChange(shown.payload.recap!,recap!).results;
   let revisionId:string|null=null;
   if(shown.payload.revisionOf){
    const updated=await c.from('insight_presentations').update({payload:payload as unknown as Json}).eq('id',shown.id).eq('user_id',s.user);if(updated.error)throw updated.error;
    revisionId=shown.id;
    // A new results change makes the revision worth reading again.
    if(resultsChanged){for(const table of ['insight_history_views','insight_receipts'] as const){const r=await c.from(table).delete().eq('presentation_id',shown.id);if(r.error)throw r.error;}}
   }else{
    const inserted=await c.from('insight_presentations').insert({business_id:s.business,ad_account_id:s.account,user_id:s.user,fingerprint:createHash('sha256').update(`revision:${original!.id}`).digest('hex'),payload:payload as unknown as Json,source_keys:last.data!.source_keys,recap_until:last.data!.recap_until}).select('id').maybeSingle();
    if(inserted.error&&inserted.error.code!=='23505')throw inserted.error;
    revisionId=inserted.data?.id??null;
   }
   if(revisionId&&!resultsChanged){const r=await c.from('insight_history_views').upsert({presentation_id:revisionId,user_id:s.user},{onConflict:'presentation_id',ignoreDuplicates:true});if(r.error)throw r.error;}
  }
 }
 const checkedResult=await c.from('insight_reviews').update({checked_revision:pub.signature}).eq('user_id',s.user).eq('ad_account_id',s.account);if(checkedResult.error)throw checkedResult.error;
}
/** First-look greeting (see `chooseWelcome`); spend history is only read when no ad is running. */
async function welcomeFor(c:ReturnType<typeof db>,account:string,activeAds:number|null):Promise<Welcome|undefined>{
 if(activeAds!==null&&activeAds>0)return chooseWelcome(activeAds,null);
 return chooseWelcome(activeAds,await lastSpendDay(c,account).catch(()=>undefined));
}
/** Returned while a first look must wait for the account's setup job to finish; the client asks again. */
export const FIRST_LOOK_WAITING='waiting' as const;
export async function prepare(s:Scope,token:string):Promise<(SavedPresentation&{additionalUpdates?:boolean})|typeof FIRST_LOOK_WAITING|null>{
 const c=db();
 // While the account is still being set up, saved data is partial: no popup until it is ready.
 const setup=await c.from('ad_account_sync_state').select('first_full_sync_completed').eq('ad_account_id',s.account).maybeSingle();
 if(setup.error)throw setup.error;if(setup.data&&!setup.data.first_full_sync_completed)return FIRST_LOOK_WAITING;
 await observeSavedSources(s);
 const [review,pending,pub,activeAds]=await Promise.all([
 c.from('insight_reviews').select('*').eq('user_id',s.user).eq('ad_account_id',s.account).maybeSingle(),
 c.rpc('pending_insight_sources',{p_account:s.account,p_user:s.user}),publication(s),accountActiveAdCount(c,s.business,s.account)]);
 const running=activeAds===null?null:activeAds>0;
 // Nothing running and nothing spent: no recap and no missing-data notes, because no data was expected.
 const idle=running===false;
 if(review.error)throw review.error;if(pending.error)throw pending.error;
 // The account is marked set up a few seconds before its job finishes. A first look prepared in that
 // gap would skip the recap and use up the one-time welcome, so it waits for the job to complete.
 if(!review.data&&pub.running)return FIRST_LOOK_WAITING;
 // No review row yet: this person's first popup for this ad account (present_insights creates it).
 const welcome=!review.data?await welcomeFor(c,s.account,activeAds):undefined;
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
  if(result&&!idleRecap(running,result)){
   const after=await publication(s);if(after.signature===pub.signature&&!after.running)recap=result;else limitations.push('Performance changed during preparation. Your recap will be available after publication stabilizes.');
  }
 }
 if(!idle&&pub.syncedAt&&Date.now()-Date.parse(pub.syncedAt)>24*3600000)limitations.push('The last successful synchronization is more than a day old. Current delivery may differ.');
 if(recap&&today&&recap.until<new Date(Date.parse(today+'T00:00:00Z')-86400000).toISOString().slice(0,10))limitations.push(`Published coverage currently ends ${recap.until}; more recent days are not included.`);
 if(!recap&&window&&!idle)limitations.push('A completed-day recap is not yet available, or today’s recap was already presented.');
 // Ads off for a while: now and then offer to run the best ad again or try a new one (read-only).
 const suggestion=idle&&today&&pub.account.timezone?await loadIdleSuggestion(c,{businessId:s.business,accountId:s.account,timezone:pub.account.timezone,currency:pub.account.currency_code,today,activeNow:running,welcome:welcome?.kind==='off'}).catch(()=>{console.warn('Idle suggestion unavailable');return null;}):null;
 const payload:Presentation={version:1,account:pub.account.name??'Meta account',timezone:pub.account.timezone,currency:pub.account.currency_code,preparedAt:new Date().toISOString(),syncedAt:pub.syncedAt,recap,issues,lifecycle,limitations,...(suggestion?{suggestion}:{}),...(welcome?{welcome}:{})};
 await reviseSavedRecap(s,pub,review.data?.checked_revision);
 const keys=[...issues.map(i=>`issue:${i.id}:${i.revision}`),...lifecycle.map(e=>`lifecycle:${e.eventId}`),...(suggestion?[`suggestion:${today}`]:[]),...(welcome?[`welcome:${welcome.kind}`]:[])];
 const fingerprint=createHash('sha256').update(JSON.stringify([keys,recap,pub.signature])).digest('hex');
 const result=await c.rpc('present_insights',{p_business:s.business,p_account:s.account,p_user:s.user,p_token:token,p_day:today??new Date().toISOString().slice(0,10),p_expected:review.data?.reviewed_through??null,p_payload:payload as unknown as Json,p_keys:keys,p_fingerprint:fingerprint,p_until:recap?.until??null,p_urgent:urgentIssues(issues).length>0});
 if(result.error)throw result.error;if(!result.data)return null;
 const saved=await savedPresentation(s,result.data);
 if(saved)await notifyDaily(s,saved,urgentIssues(issues).length>0).catch(()=>console.warn('Insights notification pointer unavailable'));
 if(saved){const delivered=new Set([...saved.payload.issues.map(i=>`issue:${i.id}:${i.revision}`),...saved.payload.lifecycle.map(e=>`lifecycle:${e.eventId}`)]);return {...saved,additionalUpdates:keys.some(key=>!delivered.has(key))};}
 return saved;
}

/** One bell item per account per day: a later update the same day refreshes it and marks it unread. */
async function notifyDaily(s:Scope,saved:SavedPresentation,urgent:boolean){
 const c=db(),day=presentationDay(saved.created_at,saved.payload.timezone),key=`insights:${s.account}:${day}`;
 for(let attempt=0;attempt<2;attempt++){
  const existing=await c.from('notifications').select('id,payload_json').eq('user_id',s.user).eq('dedupe_key',key).maybeSingle();
  if(existing.error)throw existing.error;
  const prior=existing.data?.payload_json as unknown as Partial<DailyBundle>|null;
  // Count only updates that still exist: reconnecting or deleting data removes saved ones, and the
  // bell must not promise "3 updates" when the day's history shows 1.
  const priorIds=prior&&Array.isArray(prior.presentationIds)?prior.presentationIds.filter((id):id is string=>typeof id==='string'):[];
  const kept=priorIds.length?await c.from('insight_presentations').select('id').eq('user_id',s.user).in('id',priorIds):{data:[],error:null};
  if(kept.error)throw kept.error;
  const live=new Set((kept.data??[]).map(row=>row.id));
  const next=dailyNotification(prior?{day,presentationIds:priorIds.filter(id=>live.has(id)),urgent:Boolean(prior.urgent)}:null,{id:saved.id,urgent,day});
  const fields={title:next.title,message:next.message,link:next.link,severity:next.severity,source_id:saved.id,payload_json:{surface:'bell',...next.bundle} as unknown as Json};
  if(existing.data){
   const r=await c.from('notifications').update({...fields,read:false,read_at:null,updated_at:new Date().toISOString()}).eq('id',existing.data.id);
   if(r.error)throw r.error;return;
  }
  const r=await c.from('notifications').insert({...fields,business_id:s.business,user_id:s.user,dedupe_key:key,source_type:'insights',type:'insights'});
  if(!r.error)return;
  if(r.error.code!=='23505')throw r.error; // Another tab created today's bundle first: update it instead.
 }
}
