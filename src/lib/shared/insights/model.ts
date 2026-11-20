import { reportDayCount, shiftReportDay } from '@/lib/shared/reports/dates';
import { formatReportDay } from '@/lib/shared/reports/labels';
import type { LifecycleBrief } from '@/lib/shared/lifecycle/types';
import type { Observation } from '@/lib/shared/lifecycle/model';
import type { IdleSuggestion } from '@/lib/shared/suggestions/idle';

export type IssueEvidence = { key: string; title: string; explanation: string; action: string; href: string; entities: string[]; code: string };
export type Issue = IssueEvidence & { id: string; revision: number; observedAt: string; stale: boolean; resolvedAt: string | null };
export type Day = { day: string; spend: number | null; results: number | null };
export type Hour = { hour: number; spend: number | null; results: number | null };
export type HourlyRecap = { hours: Hour[]; observedHours: number; status: 'available'|'unavailable'|'error' };
export type Recap = { since: string; until: string; spend: number | null; results: number | null; cpr: number | null; days: Day[]; hourly?: HourlyRecap; observedDays: number; expectedDays: number; comparison: { results: number; spend: number } | null; capped: boolean };
export type LifecycleCard = { eventId: string; rootId: string; affectedIds: string[]; brief: LifecycleBrief };
export type Presentation = { version: 1; revisionOf?: string; account: string; timezone: string | null; currency: string | null; preparedAt: string; syncedAt: string | null; recap: Recap | null; issues: Issue[]; lifecycle: LifecycleCard[]; limitations: string[];
  /** "Your ads are off" suggestion, only on popups prepared while nothing ran (see suggestions/idle). */
  suggestion?: IdleSuggestion;
  /** One-time greeting on a person's first popup for this ad account (see `Welcome`). */
  welcome?: Welcome };
/**
 * The first popup after an ad account is set up says where the account stands:
 * - `running`: ads are delivering now; the popup also carries the first 7-day recap.
 * - `off`: the account has advertised before but nothing runs now; the popup carries the
 *   "run your best ad again" suggestion (or "fix your ad account first") straight away.
 * - `new`: no ads and no spend were found; the popup offers to make a first Quick ad.
 */
export type Welcome =
  | { kind: 'running'; activeAds: number }
  | { kind: 'off'; lastSpendDay: string }
  | { kind: 'new' };
/** `readAt`: when this person reviewed it in the popup or opened it from history (history only). */
export type SavedPresentation = { id: string; created_at: string; payload: Presentation; readAt?: string | null };

export function recapWindow(today: string, reviewed: string | null) {
 const until=shiftReportDay(today,-1), initial=reviewed?shiftReportDay(reviewed,1):shiftReportDay(today,-7), floor=shiftReportDay(today,-30);
 return initial>until?null:{since:initial<floor?floor:initial,until,capped:initial<floor};
}
export function nullableSum(values: Array<number | null>): number | null {
 return values.length && values.every(v=>v!==null && Number.isFinite(v)) ? values.reduce<number>((s,v)=>s+v!,0):null;
}
export type PerformanceRow = { day: string | null; entity_external_id: string | null; spend: number | null; leads: number | null; messages: number | null; calls: number | null; currency_code: string | null };
export function summarize(rows: PerformanceRow[], window: NonNullable<ReturnType<typeof recapWindow>>, currency: string | null): Recap {
 const scoped=rows.filter(r=>r.day && r.day>=window.since && r.day<=window.until);
 const byDay=new Map<string,PerformanceRow[]>();
 for(const r of scoped)byDay.set(r.day!,[...(byDay.get(r.day!)??[]),r]);
 const days:Day[]=[];
 for(let day=window.since;day<=window.until;day=shiftReportDay(day,1)){
  const group=byDay.get(day)??[],valid=Boolean(currency)&&group.every(r=>r.currency_code===currency);
  days.push({day,spend:valid?nullableSum(group.map(r=>r.spend)):null,results:valid?nullableSum(group.map(r=>nullableSum([r.leads,r.messages,r.calls]))):null});
 }
 // Totals describe observed rows; missing calendar days remain visibly missing in the chart.
 const observed=days.filter(d=>byDay.has(d.day)),spend=nullableSum(observed.map(d=>d.spend)),results=nullableSum(observed.map(d=>d.results));
 return {...window,spend,results,cpr:spend!==null&&results!==null&&results>0?spend/results:null,days,observedDays:byDay.size,expectedDays:reportDayCount(window.since,window.until),comparison:null};
}
export function completeComparable(rows: PerformanceRow[], since: string, until: string, entities: string[]): boolean {
 if(!entities.length)return false;
 const keys=new Set(rows.map(r=>`${r.entity_external_id}:${r.day}`));
 if(keys.size!==rows.length)return false;
 return entities.every(id=>{for(let day=since;day<=until;day=shiftReportDay(day,1))if(!keys.has(`${id}:${day}`))return false;return true;});
}
/** Meta's own short notice text for an object, from a verified webhook. Never DeepVisor's inference. */
export type MetaNotice = { code: string | null; summary: string | null };
export type FatigueNotice = { level: string | null; message: string | null };
const quoted=(text:string)=>`Meta’s notice: “${text}”`;
/**
 * Meta keeps WITH_ISSUES/DISAPPROVED on objects the advertiser has switched off. Nothing is
 * blocked when the object, its ad set or its campaign is off, so only switched-on chains count.
 * A parent missing from the observation, or an unknown configured status, is not assumed off.
 */
function switchedOnIn(entities: Observation[]): (e: Observation) => boolean {
 const byId=new Map(entities.map(e=>[e.id,e]));
 const off=(e?:Observation)=>Boolean(e?.configured)&&e!.configured.toUpperCase()!=='ACTIVE';
 return e=>!off(e)&&!off(e.parent?byId.get(e.parent):undefined)&&!off(e.campaign?byId.get(e.campaign):undefined);
}
export function hierarchyIssues(entities: Observation[], notices: ReadonlyMap<string, MetaNotice> = new Map()): IssueEvidence[] {
 const switchedOn=switchedOnIn(entities);
 const rejected=entities.filter(e=>e.effective==='DISAPPROVED'&&switchedOn(e));
 const limited=entities.filter(e=>e.effective==='WITH_ISSUES'&&switchedOn(e));
 const said=(id:string)=>notices.get(id)?.summary??null;
 return [
  ...rejected.map(e=>({key:`rejected:${e.id}`,title:'Meta rejected this advertisement',explanation:said(e.id)?`${e.name} is reported as disapproved. ${quoted(said(e.id)!)}`:`${e.name} is reported as disapproved. Review Meta’s explanation before making changes.`,action:'Review in Campaigns',href:'/campaigns',entities:[e.id],code:'DISAPPROVED'})),
  ...limited.map(e=>({key:`delivery:${e.id}`,title:'Meta reports a delivery issue',explanation:said(e.id)?`${e.name} has a delivery issue. ${quoted(said(e.id)!)}`:`${e.name} has a delivery issue. The saved data does not establish its cause.`,action:'Review in Campaigns',href:'/campaigns',entities:[e.id],code:'WITH_ISSUES'})),
 ];
}
/**
 * Creative fatigue exactly as Meta flagged it, for ads that are still active. It is a notice, not
 * an urgent problem, and DeepVisor computes no fatigue score of its own.
 */
export function fatigueIssues(entities: Observation[], notices: ReadonlyMap<string, FatigueNotice>): IssueEvidence[] {
 return entities.filter(e=>e.level==='ad'&&e.effective==='ACTIVE'&&notices.has(e.id)).map(e=>{
  const notice=notices.get(e.id)!,level=notice.level?` (${notice.level.toLowerCase()})`:'';
  return {key:`fatigue:${e.id}`,title:'Meta flags creative fatigue',explanation:`Meta reports that ${e.name} is showing creative fatigue${level}.${notice.message?` ${quoted(notice.message)}`:''} A fresh creative may help; nothing has been changed.`,action:'Review in Campaigns',href:'/campaigns',entities:[e.id],code:'CREATIVE_FATIGUE'};
 });
}
/** Urgent issues block or threaten delivery. Notices are worth a look but nothing is stopped. */
export function issueLevel(issue: Pick<IssueEvidence,'code'>): 'urgent' | 'notice' { return issue.code==='CREATIVE_FATIGUE'?'notice':'urgent'; }
/** Resolved issues (a re-shown saved update can carry them) are never urgent. */
export const urgentIssues = <T extends Pick<IssueEvidence,'code'> & { resolvedAt?: string | null }>(issues: T[]): T[] => issues.filter(i=>issueLevel(i)==='urgent'&&!i.resolvedAt);
export function relatedLifecycle(issue: Issue, card: LifecycleCard) {
 const sameObservation=Math.abs(Date.parse(issue.observedAt)-Date.parse(card.brief.observedAt))<=15*60000;
 const consistentStatus=card.brief.affected.some(e=>e.effective===issue.code);
 return sameObservation&&consistentStatus&&issue.entities.some(id=>id===card.rootId||card.affectedIds.includes(id));
}
export function headline(p: Presentation): string {
 if(urgentIssues(p.issues).length)return p.recap?'Your results, and something to check':'Your advertising needs attention';
 if(p.welcome)return welcomeHeadline(p.welcome);
 const active=p.issues.filter(i=>!i.resolvedAt);
 if(active.length&&!p.recap&&!p.lifecycle.length)return active.length===1?active[0].title:`${active.length} notices from Meta`;
 if(p.issues.length&&!active.length&&!p.recap&&!p.lifecycle.length)return p.issues.length===1?'An earlier issue has cleared':'Earlier issues have cleared';
 if(p.recap)return p.lifecycle.length?'Your results and recent changes':recapHeadline(p.recap);
 if(p.lifecycle.length===1)return changeHeadline(p.lifecycle[0]);
 if(p.lifecycle.length)return `${p.lifecycle.length} changes to your advertising`;
 return p.suggestion?'Your ads are off':'No new observations yet';
}
/**
 * Pick the first-look greeting. `activeAds` is null when delivery is unknown (no saved ads, or the
 * hierarchy could not be read); `lastSpendDay` is null when the account never spent and undefined
 * when that could not be read. Unknown delivery after earlier spend gets no greeting, never a guess.
 */
export function chooseWelcome(activeAds: number | null, lastSpendDay: string | null | undefined): Welcome | undefined {
 if(activeAds!==null&&activeAds>0)return {kind:'running',activeAds};
 if(lastSpendDay===undefined)return undefined;
 if(lastSpendDay===null)return {kind:'new'};
 return activeAds===0?{kind:'off',lastSpendDay}:undefined;
}
export function welcomeHeadline(w: Welcome): string {
 if(w.kind==='running')return w.activeAds===1?'Welcome! Your ad is running':`Welcome! ${w.activeAds} ads are running`;
 return w.kind==='off'?'Welcome! Your ads are off right now':'Welcome! Let’s make your first ad';
}
function recapHeadline(r: Recap): string {
 if(!r.since||!r.until)return 'Here’s your advertising catch-up';
 return r.since===r.until?`Your results for ${formatReportDay(r.since,false)}`:`Your last ${r.expectedDays} days of results`;
}
/** Say what happened when an update holds one change, using the same labels as the card. */
function changeHeadline(card: LifecycleCard): string {
 if(!card.brief?.explanation)return 'Your advertising changed';
 const ads=(card.brief.affected??[]).filter(a=>a.level==='ad').length;
 const onlyAds=ads>0&&ads===card.brief.affected.length;
 const subject=onlyAds?(ads===1?'An ad':`${ads} ads`):'Your advertising';
 const plural=onlyAds&&ads>1;
 switch(lifecycleKind(card)){
  case 'ended':return `${subject} reached ${plural?'their':'its'} scheduled end`;
  case 'active':return `${subject} ${plural?'are':'is'} now active`;
  case 'resumed':return `${subject} ${plural?'are':'is'} active again`;
  case 'paused':return `${subject} ${plural?'were':'was'} paused`;
  case 'interrupted':return onlyAds?`Delivery stopped for ${ads===1?'an ad':`${ads} ads`}`:'Delivery was interrupted';
  case 'archived':return `${subject} ${plural?'were':'was'} archived`;
  case 'rejected':return plural?`Meta rejected ${ads} ads`:'Meta rejected an ad';
  default:return 'Your advertising changed';
 }
}

/**
 * Presentation-only status for a lifecycle card. Saved briefs carry no change kind, so this
 * matches the explanation shared by both scheduled-end generators in lifecycle/model.ts.
 * Anything unrecognized is shown as a generic update rather than guessed.
 */
export function lifecycleStatus(card: LifecycleCard): 'ended' | 'update' {
 return card.brief.explanation.startsWith('The saved scheduled end has been reached')?'ended':'update';
}

/** Absence, UNKNOWN, or a pause is not proof that an earlier rejection was cleared. */
export function unresolvedEvidence(previous:IssueEvidence[],entities:Observation[],current:IssueEvidence[]):Array<IssueEvidence&{_unobserved:true}>{
 const byId=new Map(entities.map(e=>[e.id,e])),keys=new Set(current.map(i=>i.key)),switchedOn=switchedOnIn(entities);
 // Still unresolved: an entity that wasn't observed, or one still in a problem state while switched on.
 const open=(id:string)=>{const e=byId.get(id);return !e||(!['ACTIVE','ARCHIVED','DELETED'].includes(e.effective)&&switchedOn(e));};
 return previous.filter(i=>!keys.has(i.key)&&i.entities.some(open)).map(i=>({...i,_unobserved:true}));
}

export type LifecycleKind = 'ended' | 'active' | 'resumed' | 'paused' | 'interrupted' | 'archived' | 'rejected' | 'update';
/**
 * Presentation-only label for a lifecycle card, read from the fixed explanations written by
 * lifecycle/model.ts (and the observed status they describe). Unrecognized text stays a generic
 * update: the label never claims more than the saved explanation says.
 */
export function lifecycleKind(card: LifecycleCard): LifecycleKind {
 const text=card.brief.explanation;
 if(lifecycleStatus(card)==='ended')return 'ended';
 if(/disapproved/i.test(text))return 'rejected';
 if(/interrupted/i.test(text))return 'interrupted';
 if(/archived or deleted/i.test(text))return 'archived';
 if(/as paused/i.test(text))return 'paused';
 if(/active again/i.test(text))return 'resumed';
 if(/as active/i.test(text))return 'active';
 return 'update';
}
export const LIFECYCLE_LABEL: Record<LifecycleKind, string> = {
 ended:'Scheduled end reached', active:'Now active', resumed:'Active again', paused:'Paused',
 interrupted:'Delivery interrupted', archived:'Archived or deleted', rejected:'Rejected by Meta', update:'Advertising update',
};

/**
 * Quiet when idle: no ad is running now (`activeNow === false`, from the saved delivery chain)
 * and the recap period spent exactly nothing, so no performance was expected and there is
 * nothing to recap. Unknown delivery (`null`) or unknown spend is never treated as idle, and a
 * period that spent money is always recapped even after the ads stopped.
 */
export function idleRecap(activeNow: boolean | null, recap: Pick<Recap, 'spend'> | null): boolean {
  return activeNow === false && recap !== null && recap.spend === 0;
}
