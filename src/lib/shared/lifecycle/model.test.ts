import {expect,it} from 'vitest';
import {changes,forecast} from './model';
import type {Observation} from './model';
const base:Observation={id:'ad',level:'ad',parent:'set',campaign:'campaign',name:'Ad',configured:'ACTIVE',effective:'ACTIVE',start:null,end:'2026-11-10T21:00:00.000Z',dailyBudget:null,lifetimeBudget:null,targeting:{}};
const before='2026-11-07T23:00:00.000Z',at='2026-11-08T12:00:00.000Z';
it('groups inherited campaign interruptions, excluding already paused siblings',()=>{
 const campaign={...base,id:'campaign',level:'campaign',configured:'PAUSED',effective:'PAUSED'};
 const a={...base,id:'two'},paused={...base,id:'old',configured:'PAUSED',effective:'PAUSED'};
 expect(changes([base,a,paused],[{...base,effective:'CAMPAIGN_PAUSED'},{...a,effective:'CAMPAIGN_PAUSED'},paused,campaign],before,at)).toMatchObject([{kind:'parent_paused',root:'campaign',affected:['ad','two']}]);
});
it('does not manufacture first observations or deletion events',()=>{expect(changes([], [base],before,at)).toEqual([]);expect(changes([base],[],before,at)).toEqual([]);});
it('detects schedule crossings only once and honors extensions',()=>{expect(changes([base],[base],before,'2026-11-11T00:00:00Z')[0].kind).toBe('scheduled_end');expect(changes([base],[{...base,end:'2026-11-12T21:00:00Z'}],before,'2026-11-11T00:00:00Z')).toEqual([]);});
it('requires evidence for forecasts',()=>{expect(forecast([],100)).toBeNull();expect(forecast(Array.from({length:7},(_,i)=>({day:String(i),spend:40,results:4})),100)?.results).toBe(10);});
it.each([
 ['PAUSED','PAUSED','paused'],['ACTIVE','ADSET_PAUSED','unavailable'],['ARCHIVED','ARCHIVED','archived'],['ACTIVE','DISAPPROVED','unavailable']
])('classifies configured %s / effective %s without inventing causes',(configured,effective,kind)=>{
 expect(changes([base],[{...base,configured,effective}],before,at)[0].kind).toBe(kind);
});
it('identifies resumed delivery and does not claim impressions have started',()=>{
 const result=changes([{...base,effective:'PAUSED',configured:'PAUSED'}],[base],before,at)[0];expect(result.kind).toBe('resumed');expect(result.explanation).toContain('not guaranteed');
});
it('includes zero-result spending in the aggregate efficiency baseline',()=>{
 const rows=Array.from({length:7},(_,i)=>({day:String(i),spend:40,results:4}));rows.push({day:'7',spend:280,results:0});expect(forecast(rows,100)?.results).toBe(5);
});
it('does not mistake timezone offsets for chronological order',()=>{
 const ad={...base,end:'2026-11-08T01:00:00-0500'};expect(changes([ad],[ad],'2026-11-08T04:00:00Z','2026-11-08T05:00:00Z')).toEqual([]);
});

it('keeps campaign and ad-set changes with no affected ads as real events',()=>{
 const campaign={...base,id:'campaign',level:'campaign',parent:null};
 expect(changes([campaign],[{...campaign,configured:'PAUSED',effective:'PAUSED'}],before,at)).toMatchObject([{kind:'paused',root:'campaign',affected:[]}]);
});
it('groups parent resumption without duplicating child activation cards',()=>{
 const campaign={...base,id:'campaign',level:'campaign',parent:null};
 expect(changes([{...campaign,configured:'PAUSED',effective:'PAUSED'},{...base,effective:'CAMPAIGN_PAUSED'}],[campaign,base],before,at)).toMatchObject([{kind:'resumed',root:'campaign',affected:['ad']}]);
});
