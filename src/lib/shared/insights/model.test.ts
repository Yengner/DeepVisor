import {describe,expect,it} from 'vitest';
import {accountToday} from '@/lib/shared/reports/dates';
import {recapWindow,summarize,hierarchyIssues,fatigueIssues,issueLevel,urgentIssues,completeComparable,headline,lifecycleStatus} from './model';
import {changes} from '@/lib/shared/lifecycle/model';
import {previewPresentation} from './preview';
import type {Presentation,PerformanceRow,Recap} from './model';
import type {Observation} from '@/lib/shared/lifecycle/model';
import {exportCsv} from './export';
const row=(day:string,spend:number|null=10):PerformanceRow=>({day,spend,leads:0,messages:2,calls:0,currency_code:'USD',entity_external_id:'set1'});
describe('completed-day recaps',()=>{
 it('uses local dates through DST and excludes today',()=>{const today=accountToday('America/New_York',new Date('2026-11-02T04:30:00Z'))!;expect(today).toBe('2026-11-01');expect(recapWindow(today,null)).toEqual({since:'2026-10-25',until:'2026-10-31',capped:false});});
 it('resumes after review and caps long absences at 30 days',()=>{expect(recapWindow('2026-11-09','2026-11-07')?.since).toBe('2026-11-08');expect(recapWindow('2026-11-09','2026-11-08')).toBeNull();expect(recapWindow('2026-11-09','2026-08-01')).toEqual({since:'2026-10-10',until:'2026-11-08',capped:true});});
 it('keeps missing separate from observed zero and derives ratios from totals',()=>{const r=summarize([row('2026-11-01',0),row('2026-11-03',20)],{since:'2026-11-01',until:'2026-11-03',capped:false},'USD');expect(r.days[0].spend).toBe(0);expect(r.days[1].spend).toBeNull();expect(r.spend).toBe(20);expect(r.results).toBe(4);expect(r.cpr).toBe(5);expect(r.observedDays).toBe(2);});
 it('does not manufacture mixed-currency or unknown metrics',()=>{expect(summarize([row('2026-11-01')],{since:'2026-11-01',until:'2026-11-01',capped:false},'EUR').spend).toBeNull();expect(summarize([row('2026-11-01',null)],{since:'2026-11-01',until:'2026-11-01',capped:false},'USD').cpr).toBeNull();});
 it('requires complete, unique entity/date observations for comparisons',()=>{expect(completeComparable([row('2026-11-01')],'2026-11-01','2026-11-02',['set1'])).toBe(false);expect(completeComparable([row('2026-11-01'),row('2026-11-01')],'2026-11-01','2026-11-01',['set1'])).toBe(false);});
});
it('never calls a normal pause a delivery problem',()=>{const entity={id:'ad',name:'Salon',effective:'CAMPAIGN_PAUSED'} as Observation;expect(hierarchyIssues([entity])).toEqual([]);expect(hierarchyIssues([{...entity,effective:'DISAPPROVED'}])[0].code).toBe('DISAPPROVED');expect(hierarchyIssues([{...entity,effective:'WITH_ISSUES'}])[0].explanation).toContain('does not establish');});
it('composes all six combinations without AI activity',()=>{for(const [recap,lifecycle,issues] of [[true,false,false],[false,true,false],[false,true,true],[false,false,true],[true,true,false],[true,true,true]]){const p={recap:recap?{}:null,lifecycle:lifecycle?[{}]:[],issues:issues?[{}]:[]} as Presentation;expect(headline(p)).toBeTruthy();if(issues)expect(headline(p)).toMatch(/check|attention/);}});
it('exports exact saved values, unknowns and escaped spreadsheet formulas',()=>{const p={version:1,account:'=HYPERLINK("bad")',timezone:'America/New_York',currency:'USD',preparedAt:'2026-11-09',syncedAt:null,recap:summarize([row('2026-11-08',null)],{since:'2026-11-08',until:'2026-11-08',capped:false},'USD'),issues:[],lifecycle:[],limitations:['Missing is not zero']} satisfies Presentation;const csv=exportCsv({id:'saved',created_at:'2026-11-09',payload:p});expect(csv).toContain("'=HYPERLINK");expect(csv).toContain('"recap","spend",""');expect(csv).toContain('Missing is not zero');});

import {accountHealthIssues} from './health';
it('does not infer payment failures from an account restriction or unknown status',()=>{expect(accountHealthIssues({})).toBeNull();expect(accountHealthIssues({account_status:1})).toEqual([]);expect(accountHealthIssues({account_status:3})?.[0].explanation).not.toContain('payment failed');});

import {relatedLifecycle} from './model';
import type {Issue,LifecycleCard} from './model';
it('does not attach an old activation to a new rejection just because IDs match',()=>{
 const issue={entities:['ad'],code:'DISAPPROVED',observedAt:'2026-11-09T15:00:00Z'} as Issue;
 const card={rootId:'ad',affectedIds:['ad'],brief:{observedAt:'2026-11-08T15:00:00Z',affected:[{effective:'ACTIVE'}]}} as LifecycleCard;
 expect(relatedLifecycle(issue,card)).toBe(false);
 expect(relatedLifecycle(issue,{...card,brief:{...card.brief,observedAt:issue.observedAt,affected:[{effective:'DISAPPROVED'} as Observation]}})).toBe(true);
});

import {recapRevision} from './revision';
it('preserves original recap and produces a distinct saved correction only when values change',()=>{
 const recap=summarize([row('2026-11-08')],{since:'2026-11-08',until:'2026-11-08',capped:false},'USD');
 const saved={id:'original',created_at:'2026-11-09',payload:{version:1,account:'Salon',timezone:'America/New_York',currency:'USD',preparedAt:'2026-11-09',syncedAt:null,recap,issues:[],lifecycle:[],limitations:[]} as Presentation};
 expect(recapRevision(saved,recap,null,'2026-11-10')).toBeNull();
 const revision=recapRevision(saved,{...recap,spend:20},null,'2026-11-10');expect(revision?.revisionOf).toBe('original');expect(saved.payload.recap?.spend).toBe(10);
});

import {unresolvedEvidence} from './model';
it('retains the last known issue when entities disappear or only show a paused state',()=>{
 const e={id:'ad',name:'Salon',effective:'DISAPPROVED'} as Observation,issues=hierarchyIssues([e]);
 expect(unresolvedEvidence(issues,[],[])).toHaveLength(1);
 expect(unresolvedEvidence(issues,[{...e,effective:'PAUSED'}],[])).toHaveLength(1);
 expect(unresolvedEvidence(issues,[{...e,effective:'ACTIVE'}],[])).toEqual([]);
});

describe('lifecycle card status',()=>{
 const obs=(level:string,end:string|null):Observation=>({id:`${level}1`,level,parent:null,campaign:null,name:level,configured:'ACTIVE',effective:'ACTIVE',start:null,end,dailyBudget:null,lifetimeBudget:null,targeting:{}});
 const card=(explanation:string)=>({...previewPresentation('scheduled-end').payload.lifecycle[0],brief:{...previewPresentation('scheduled-end').payload.lifecycle[0].brief,explanation}});
 it('recognizes both generated scheduled-end explanations',()=>{
  for(const level of ['ad','adset']){const [c]=changes([obs(level,'2026-11-05T00:00:00Z')],[obs(level,'2026-11-05T00:00:00Z')],'2026-11-04T00:00:00Z','2026-11-06T00:00:00Z');expect(c.kind).toBe('scheduled_end');expect(lifecycleStatus(card(c.explanation))).toBe('ended');}
 });
 it('treats every other change as a generic update',()=>{expect(lifecycleStatus(previewPresentation('pause').payload.lifecycle[0])).toBe('update');expect(lifecycleStatus(card('Meta now reports this advertising as active.'))).toBe('update');});
});

describe('lifecycleKind', () => {
 const card=(explanation:string)=>({eventId:'e',rootId:'r',affectedIds:[],brief:{explanation}} as unknown as import('./model').LifecycleCard);
 it('labels each saved lifecycle explanation without inventing a cause', async () => {
  const {lifecycleKind}=await import('./model');
  expect(lifecycleKind(card('The saved scheduled end has been reached. This alone does not confirm the exact time delivery stopped.'))).toBe('ended');
  expect(lifecycleKind(card('Meta now reports this advertising as active. Delivery and results are not guaranteed.'))).toBe('active');
  expect(lifecycleKind(card('Delivery is interrupted because Spring campaign is paused.'))).toBe('interrupted');
  expect(lifecycleKind(card('Meta now reports this ad as paused.'))).toBe('paused');
  expect(lifecycleKind(card('Meta reports this advertising as archived or deleted.'))).toBe('archived');
  expect(lifecycleKind(card('Delivery eligibility changed. The available evidence does not establish a more specific cause.'))).toBe('update');
 });
});

describe('specific headlines', () => {
 const card=(explanation:string,levels:string[]=['ad'])=>({eventId:'e',rootId:'r',affectedIds:[],brief:{explanation,affected:levels.map((level,i)=>({id:`x${i}`,level}))}} as unknown as LifecycleCard);
 const p=(extra:Partial<Presentation>)=>({recap:null,issues:[],lifecycle:[],...extra} as Presentation);
 it('says what changed for a single change', () => {
  expect(headline(p({lifecycle:[card('Meta now reports this ad as paused.')]}))).toBe('An ad was paused');
  expect(headline(p({lifecycle:[card('Delivery is interrupted because Spring is paused.',['ad','ad','ad'])]}))).toBe('Delivery stopped for 3 ads');
  expect(headline(p({lifecycle:[card('The saved scheduled end has been reached. This alone does not confirm when delivery stopped.',['adset'])]}))).toBe('Your advertising reached its scheduled end');
  expect(headline(p({lifecycle:[card('Delivery eligibility changed.')]}))).toBe('Your advertising changed');
 });
 it('counts several changes and names the recap period', () => {
  expect(headline(p({lifecycle:[card('Meta now reports this ad as paused.'),card('Meta now reports this ad as paused.')]}))).toBe('2 changes to your advertising');
  expect(headline(p({recap:{since:'2026-11-07',until:'2026-11-07',expectedDays:1} as Recap}))).toBe('Your results for Nov 7');
  expect(headline(p({recap:{since:'2026-11-01',until:'2026-11-07',expectedDays:7} as Recap}))).toBe('Your last 7 days of results');
 });
});

describe('Meta notices', () => {
  const entity = (over: Record<string, unknown>) => ({ id: '9', level: 'ad', parent: 's', campaign: 'c', name: 'Autumn', configured: 'ACTIVE', effective: 'ACTIVE', start: null, end: null, dailyBudget: null, lifetimeBudget: null, targeting: null, ...over });
  it('quotes Meta’s wording only for a state the read observed', () => {
    const notices = new Map([['9', { code: '1', summary: 'Card declined' }]]);
    expect(hierarchyIssues([entity({ effective: 'WITH_ISSUES' })], notices)[0].explanation).toBe('Autumn has a delivery issue. Meta’s notice: “Card declined”');
    expect(hierarchyIssues([entity({ effective: 'DISAPPROVED' })], notices)[0].explanation).toContain('Meta’s notice: “Card declined”');
    expect(hierarchyIssues([entity({ effective: 'WITH_ISSUES' })])[0].explanation).toContain('does not establish its cause');
    expect(hierarchyIssues([entity({})], notices)).toEqual([]);
  });
  it('raises fatigue as a notice for active ads only, never as urgent', () => {
    const notices = new Map([['9', { level: 'HIGH', message: 'Costs are rising' }], ['8', { level: null, message: null }]]);
    const issues = fatigueIssues([entity({}), entity({ id: '8', effective: 'PAUSED' }), entity({ id: '7' })], notices);
    expect(issues.map(i => i.key)).toEqual(['fatigue:9']);
    expect(issues[0].explanation).toContain('creative fatigue (high)');
    expect(issueLevel(issues[0])).toBe('notice');
    expect(issueLevel({ code: 'DISAPPROVED' })).toBe('urgent');
    expect(urgentIssues([...issues, { code: 'WITH_ISSUES' }])).toEqual([{ code: 'WITH_ISSUES' }]);
  });
});
