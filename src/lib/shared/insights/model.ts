import { reportDayCount, shiftReportDay } from '@/lib/shared/reports/dates';
import type { LifecycleBrief } from '@/lib/shared/lifecycle/types';
import type { Observation } from '@/lib/shared/lifecycle/model';

export type IssueEvidence = { key: string; title: string; explanation: string; action: string; href: string; entities: string[]; code: string };
export type Issue = IssueEvidence & { id: string; revision: number; observedAt: string; stale: boolean; resolvedAt: string | null };
export type Day = { day: string; spend: number | null; results: number | null };
export type Hour = { hour: number; spend: number | null; results: number | null };
export type HourlyRecap = { hours: Hour[]; observedHours: number; status: 'available'|'unavailable'|'error' };
export type Recap = { since: string; until: string; spend: number | null; results: number | null; cpr: number | null; days: Day[]; hourly?: HourlyRecap; observedDays: number; expectedDays: number; comparison: { results: number; spend: number } | null; capped: boolean };
export type LifecycleCard = { eventId: string; rootId: string; affectedIds: string[]; brief: LifecycleBrief };
export type Presentation = { version: 1; revisionOf?: string; account: string; timezone: string | null; currency: string | null; preparedAt: string; syncedAt: string | null; recap: Recap | null; issues: Issue[]; lifecycle: LifecycleCard[]; limitations: string[] };
export type SavedPresentation = { id: string; created_at: string; payload: Presentation };

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
export function hierarchyIssues(entities: Observation[]): IssueEvidence[] {
 const rejected=entities.filter(e=>e.effective==='DISAPPROVED');
 const limited=entities.filter(e=>e.effective==='WITH_ISSUES');
 return [
  ...rejected.map(e=>({key:`rejected:${e.id}`,title:'Meta rejected this advertisement',explanation:`${e.name} is reported as disapproved. Review Meta’s explanation before making changes.`,action:'Review in Campaigns',href:'/campaigns',entities:[e.id],code:'DISAPPROVED'})),
  ...limited.map(e=>({key:`delivery:${e.id}`,title:'Meta reports a delivery issue',explanation:`${e.name} has a delivery issue. The saved data does not establish its cause.`,action:'Review in Campaigns',href:'/campaigns',entities:[e.id],code:'WITH_ISSUES'})),
 ];
}
export function relatedLifecycle(issue: Issue, card: LifecycleCard) {
 const sameObservation=Math.abs(Date.parse(issue.observedAt)-Date.parse(card.brief.observedAt))<=15*60000;
 const consistentStatus=card.brief.affected.some(e=>e.effective===issue.code);
 return sameObservation&&consistentStatus&&issue.entities.some(id=>id===card.rootId||card.affectedIds.includes(id));
}
export function headline(p: Presentation): string {
 if(p.issues.length)return p.recap?'Your results, and something to check':'Your advertising needs attention';
 if(p.recap)return p.lifecycle.length?'Your results and recent changes':'Here’s your advertising catch-up';
 return p.lifecycle.length?'Your advertising changed':'No new observations yet';
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
 const states=new Map(entities.map(e=>[e.id,e.effective])),keys=new Set(current.map(i=>i.key));
 return previous.filter(i=>!keys.has(i.key)&&i.entities.some(id=>!['ACTIVE','ARCHIVED','DELETED'].includes(states.get(id)??'UNKNOWN'))).map(i=>({...i,_unobserved:true}));
}
