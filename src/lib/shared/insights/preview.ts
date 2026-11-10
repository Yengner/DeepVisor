/** Explicit design fixtures. Imported only by the server-gated development preview route. */
import {summarize} from './model';
import {summarizeHours} from './hourly';
import type {Issue,LifecycleCard,Presentation,SavedPresentation} from './model';
import type {Observation} from '@/lib/shared/lifecycle/model';
export const previewScenarios=[
 ['catch-up','Weekly catch-up + performance'],['daily','Daily catch-up · hourly bars'],['daily-missing','Daily catch-up · hourly unavailable'],['activation','Ad activated'],['resume','Ad resumed'],
 ['pause','Ad paused'],['early-stop','November 8 early interruption'],['scheduled-end','Scheduled end reached'],
 ['multiple','Campaign pause · multiple ads'],['rejection','Lifecycle + rejection'],
 ['connection','Expired Meta connection'],['restriction','Account restriction'],['billing','Confirmed billing issue · visual fixture'],
 ['catch-up-lifecycle','Catch-up + lifecycle'],['all','All categories'],['long-absence','30-day catch-up'],
 ['sparse','Missing dates & unavailable results'],['zero','Observed zero results'],['stale','Stale issue evidence'],
 ['unknown','Unknown currency & missing creative'],['many','Many updates · collapsed history'],['correction','Revised recap'],['empty','No data available'],
] as const;
export type PreviewScenario=typeof previewScenarios[number][0];
const at='2026-11-08T18:00:00.000Z';
// Reuses the native SVG visual language of scripts/beta-fixtures/fixture.ts. No Meta-hosted media.
const image='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500" viewBox="0 0 400 500"><rect width="400" height="500" fill="#71415d"/><circle cx="300" cy="130" r="95" fill="#fff" opacity=".12"/><path d="M50 295 Q200 65 350 295" stroke="#f3cfa0" stroke-width="14" fill="none"/><text x="30" y="345" fill="white" font-family="sans-serif" font-size="29" font-weight="bold">AUTUMN GLOW</text><text x="30" y="380" fill="white" font-family="sans-serif" font-size="18">Salon creative preview</text><text x="30" y="464" fill="white" font-family="sans-serif" font-size="13">SYNTHETIC TEST AD · NOT AN OFFER</text></svg>');
function ad(id='preview-ad'):Observation{return {id,level:'ad',parent:'preview-set',campaign:'preview-campaign',name:'Autumn color appointments',configured:'ACTIVE',effective:'ACTIVE',start:'2026-11-01T09:00:00-0500',end:'2026-11-10T16:00:00-0500',dailyBudget:null,lifetimeBudget:null,targeting:{}};}
function lifecycle():LifecycleCard{return {eventId:'preview-event',rootId:'preview-ad',affectedIds:['preview-ad'],brief:{id:'preview-event',title:'Autumn color appointments',explanation:'Meta now reports this advertisement as active. Delivery and results are not guaranteed.',provenance:'observed',observedAt:at,currency:'USD',timezone:'America/New_York',media:[{image,name:'Synthetic salon creative'}],since:'2026-11-01',until:'2026-11-07',affected:[ad()],spend:210,results:21,cpr:10,days:[],configuration:{owner:'Salon appointments ad set',dailyBudget:30,lifetimeBudget:null,platforms:['Facebook','Instagram'],audience:'Ages 25–54',geography:'New York',planned:null,projection:null},limitations:['Synthetic design fixture. No real advertising action occurred.'],breakdowns:[{kind:'age_gender',scope:'Ad-set snapshot, not individual-ad attribution',since:'2026-11-01',until:'2026-11-07',rows:[{label:'25–34 · female',impressions:2100,spend:90},{label:'35–44 · female',impressions:3100,spend:120}]}]}};}
function attention():Issue{return {id:'preview-issue',revision:1,key:'rejected:preview-ad',title:'Meta rejected this advertisement',explanation:'This advertisement was disapproved. Review Meta’s explanation before making changes.',action:'Review in Campaigns',href:'/campaigns',entities:['preview-ad'],code:'DISAPPROVED',observedAt:at,stale:false,resolvedAt:null};}
export function previewPresentation(scenario:PreviewScenario):SavedPresentation{
 const rows=[24,30,36,18,42,30,30].map((spend,i)=>({day:`2026-11-0${i+1}`,spend,leads:0,messages:[2,3,4,1,5,3,3][i],calls:0,currency_code:'USD',entity_external_id:'preview-set'}));
 const recap=summarize(rows,{since:'2026-11-01',until:'2026-11-07',capped:false},'USD');
 const p:Presentation={version:1,account:'[PREVIEW] Atelier Salon',timezone:'America/New_York',currency:'USD',preparedAt:at,syncedAt:at,recap:null,issues:[],lifecycle:[],limitations:['DEVELOPMENT PREVIEW — all metrics, creatives and events are synthetic.','No Meta calls, database writes, notifications, or review acknowledgements occur in this preview.']};
 const card=lifecycle(),issue=attention();
 switch(scenario){
 case 'empty':p.syncedAt=null;break;
 case 'catch-up':p.recap=recap;break;
 case 'daily':case 'daily-missing':{
  p.recap=summarize([rows[6]],{since:'2026-11-07',until:'2026-11-07',capped:false},'USD');
  p.recap.hourly=summarizeHours(scenario==='daily'?Array.from({length:24},(_,hour)=>({...rows[6],hour_of_day:hour,spend:hour>=9&&hour<19?3:0,messages:[10,14,17].includes(hour)?1:0})):[],'2026-11-07','USD');break;
 }
 case 'activation':p.lifecycle=[card];break;
 case 'resume':card.brief.explanation='Meta reports this advertisement as active again after a pause. Delivery is not guaranteed.';p.lifecycle=[card];break;
 case 'pause':card.brief.explanation='Meta now reports this advertisement as paused.';card.brief.affected[0].effective='PAUSED';p.lifecycle=[card];break;
 case 'early-stop':case 'multiple':card.brief.explanation='Delivery was interrupted because the parent campaign was paused, before the planned November 10 end.';card.brief.provenance='reconstructed';card.brief.affected[0].effective='CAMPAIGN_PAUSED';card.rootId='preview-campaign';p.lifecycle=[card];if(scenario==='multiple'){card.brief.affected=Array.from({length:6},(_,i)=>({...ad(`preview-ad-${i}`),effective:'CAMPAIGN_PAUSED'}));card.affectedIds=card.brief.affected.map(a=>a.id);}break;
 case 'scheduled-end':card.brief.explanation='The saved scheduled end has been reached. This alone does not confirm the exact time delivery stopped.';p.lifecycle=[card];break;
 case 'rejection':case 'all':card.brief.affected[0].effective='DISAPPROVED';card.brief.explanation='Meta now reports this advertisement as disapproved.';p.lifecycle=[card];p.issues=[issue];if(scenario==='all')p.recap=recap;break;
 case 'connection':p.issues=[{...issue,title:'Reconnect Meta to keep data current',explanation:'Your saved connection requires renewed authorization. Existing reports remain available.',action:'Open Connections',href:'/integration',entities:[],code:'REAUTH_REQUIRED'}];break;
 case 'restriction':p.issues=[{...issue,title:'Meta reports an unavailable advertising account',explanation:'Delivery may be blocked at the account level. Check Meta’s notices for the confirmed reason.',entities:[],code:'ACCOUNT_STATUS_2'}];break;
 case 'billing':p.issues=[{...issue,title:'A payment issue is preventing delivery',explanation:'Visual fixture only: this represents an explicit provider-confirmed billing issue. Production detection does not infer this from account status.',action:'Review billing in Meta',entities:[],code:'PREVIEW_CONFIRMED_BILLING'}];break;
 case 'catch-up-lifecycle':p.recap=recap;card.brief.explanation='This advertisement reached its scheduled end. See the saved performance below.';p.lifecycle=[card];break;
 case 'long-absence':p.recap=summarize(Array.from({length:30},(_,i)=>({...rows[0],day:new Date(Date.UTC(2026,9,9+i)).toISOString().slice(0,10),spend:20+i%5*5,messages:2+i%3})),{since:'2026-10-09',until:'2026-11-07',capped:true},'USD');break;
 case 'sparse':p.recap=summarize(rows.filter((_,i)=>i!==2&&i!==4).map((r,i)=>i===1?{...r,messages:null}:r),{since:'2026-11-01',until:'2026-11-07',capped:false},'USD');break;
 case 'zero':p.recap=summarize(rows.map(r=>({...r,messages:0})),{since:'2026-11-01',until:'2026-11-07',capped:false},'USD');break;
 case 'stale':p.issues=[{...issue,stale:true,observedAt:'2026-11-03T18:00:00Z'}];break;
 case 'unknown':p.currency=null;p.timezone=null;card.brief.currency=null;card.brief.media=[];card.brief.spend=null;card.brief.results=null;card.brief.cpr=null;p.lifecycle=[card];break;
 case 'many':p.recap=recap;p.lifecycle=Array.from({length:7},(_,i)=>({...lifecycle(),eventId:`preview-event-${i}`,brief:{...lifecycle().brief,title:`Salon advertisement ${i+1}`}}));break;
 case 'correction':p.recap=recap;p.revisionOf='preview-original';p.limitations.push('A new saved revision preserves corrected attribution. The original report remains unchanged.');break;
 }
 return {id:`preview-${scenario}`,created_at:at,payload:p};
}
