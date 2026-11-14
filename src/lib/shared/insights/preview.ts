/** Explicit design fixtures. Imported only by the server-gated development preview route. */
import {fatigueIssues,hierarchyIssues,summarize} from './model';
import {summarizeHours} from './hourly';
import type {Issue,LifecycleCard,Presentation,SavedPresentation} from './model';
import type {Observation} from '@/lib/shared/lifecycle/model';
import {accountHealthIssues} from './health';
import {shiftReportDay} from '@/lib/shared/reports/dates';
/** Add new scenarios within their category; the picker and navigation derive from this registry. */
export const previewScenarioGroups=[
 {id:'performance',label:'Catch-Up & Performance',scenarios:[
  ['daily','Daily catch-up · hourly bars'],['catch-up','Weekly catch-up · seven days'],['results-up','Weekly catch-up · results up'],['results-down','Weekly catch-up · results down'],['long-absence','30-day catch-up'],['correction','Revised recap'],
 ]},
 {id:'lifecycle',label:'Ad Lifecycle',scenarios:[
  ['activation','Ad activated'],['resume','Ad resumed'],['pause','Ad paused'],['early-stop','November 8 early interruption'],['scheduled-end','Scheduled end reached'],['adset-ended','Ad set ended · no metrics'],['multiple','Campaign pause · multiple ads'],['archived','Ad archived'],
 ]},
 {id:'attention',label:'Needs Attention',scenarios:[
  ['delivery-issue','Delivery issue reported'],['connection','Expired Meta connection'],['restriction','Account disabled · policy'],['grace-period','Payment pending · grace period'],['compromised','Account flagged as compromised'],['multiple-issues','Several issues at once'],['billing','Unpaid balance · billing'],['stale','Stale issue evidence'],
 ]},
 {id:'live',label:'Live Meta Alerts (webhooks)',scenarios:[
  ['live-rejection','Rejection · Meta’s wording'],['live-delivery','Delivery issue · Meta’s wording'],['fatigue','Creative fatigue notice'],['fatigue-recap','Catch-up + fatigue notice'],['live-mixed','Urgent issue + notice + change'],
 ]},
 {id:'combined',label:'Combined Updates',scenarios:[
  ['rejection','Lifecycle + rejection'],['catch-up-lifecycle','Catch-up + lifecycle'],['connection-recap','Reconnect + catch-up'],['all','All categories'],['many','Many updates · collapsed history'],
 ]},
 {id:'coverage',label:'Missing Data & Edge Cases',scenarios:[
  ['daily-missing','Daily catch-up · hourly unavailable'],['hourly-partial','Daily catch-up · some hours missing'],['sparse','Missing dates & unavailable results'],['zero','Observed zero results'],['unknown','Unknown currency & missing creative'],['long-names','Very long names'],['empty','No data available'],
 ]},
] as const;
/** What each scenario is for, shown beside it in the preview workbench. */
export const previewScenarioNotes:Record<string,string>={
 daily:'One completed day. Charts 24 advertiser-local hours.',
 'catch-up':'Seven completed days, all observed. The most common catch-up.',
 'results-up':'Comparable previous week; results increased.',
 'results-down':'Comparable previous week; results decreased while spend rose.',
 'long-absence':'Owner was away over 30 days; the catch-up is capped at 30.',
 correction:'Attribution changed after a recap was saved; a revision is shown.',
 activation:'An ad started delivering after review.',
 resume:'An ad became active again after a pause.',
 pause:'The owner paused one ad. Shows the week before vs the week before that.',
 'early-stop':'Reconstructed parent-campaign pause before the planned end.',
 'scheduled-end':'The saved end date passed while the ad was active.',
 'adset-ended':'An ad set reached its end with no saved metrics.',
 multiple:'One campaign pause interrupted six ads.',
 archived:'An ad was archived or deleted in Meta.',
 'delivery-issue':'Meta reports WITH_ISSUES for an ad; cause unknown.',
 'live-rejection':'Webhook-triggered read found DISAPPROVED; explanation quotes Meta’s notice.',
 'live-delivery':'WITH_ISSUES with Meta’s error summary from the webhook.',
 fatigue:'Notice level (navy, not red): Meta flags creative fatigue on an active ad.',
 'fatigue-recap':'A notice joins the daily catch-up instead of interrupting.',
 'live-mixed':'Urgent issue leads; the notice and lifecycle change follow.',
 connection:'Meta authorization expired; data will go stale.',
 restriction:'Meta disabled the account with a policy reason (status 2, reason 1).',
 'grace-period':'Meta reports a grace period (status 9); ads may still run.',
 compromised:'Meta disabled the account as compromised (status 2, reason 15).',
 billing:'Meta reports the account as unsettled (status 3).',
 'multiple-issues':'Rejection and delivery issue on different ads in one update.',
 stale:'Issue evidence is old; status needs a fresh observation.',
 rejection:'Lifecycle change caused by a Meta rejection.',
 'catch-up-lifecycle':'Weekly recap plus an ad that ended.',
 'connection-recap':'Reconnect warning above a normal weekly recap.',
 all:'Issue, recap and lifecycle together — the busiest common case.',
 many:'Seven changes; extra cards collapse into a disclosure.',
 'daily-missing':'One day with no hourly observations at all.',
 'hourly-partial':'One day where only some hours were observed.',
 sparse:'Two days missing and one day without results.',
 zero:'Results observed as zero (not missing). Cost per result unavailable.',
 unknown:'No currency, timezone or creative preview saved.',
 'long-names':'Long account, campaign and ad names to test wrapping.',
 empty:'Nothing synced yet.',
};
export const previewScenarios=previewScenarioGroups.flatMap(group=>group.scenarios.map(scenario=>scenario));
export type PreviewScenario=typeof previewScenarioGroups[number]['scenarios'][number][0];
const at='2026-11-08T18:00:00.000Z';
// Reuses the native SVG visual language of scripts/beta-fixtures/fixture.ts. No Meta-hosted media.
const image='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500" viewBox="0 0 400 500"><rect width="400" height="500" fill="#71415d"/><circle cx="300" cy="130" r="95" fill="#fff" opacity=".12"/><path d="M50 295 Q200 65 350 295" stroke="#f3cfa0" stroke-width="14" fill="none"/><text x="30" y="345" fill="white" font-family="sans-serif" font-size="29" font-weight="bold">AUTUMN GLOW</text><text x="30" y="380" fill="white" font-family="sans-serif" font-size="18">Salon creative preview</text><text x="30" y="464" fill="white" font-family="sans-serif" font-size="13">SYNTHETIC TEST AD · NOT AN OFFER</text></svg>');
function ad(id='preview-ad'):Observation{return {id,level:'ad',parent:'preview-set',campaign:'preview-campaign',name:'Autumn color appointments',configured:'ACTIVE',effective:'ACTIVE',start:'2026-11-01T09:00:00-0500',end:'2026-11-10T16:00:00-0500',dailyBudget:null,lifetimeBudget:null,targeting:{}};}
function lifecycle():LifecycleCard{return {eventId:'preview-event',rootId:'preview-ad',affectedIds:['preview-ad'],brief:{id:'preview-event',title:'Autumn color appointments',explanation:'Meta now reports this advertisement as active. Delivery and results are not guaranteed.',provenance:'observed',observedAt:at,currency:'USD',timezone:'America/New_York',media:[{image,name:'Synthetic salon creative'}],since:'2026-11-01',until:'2026-11-07',affected:[ad()],spend:210,results:21,cpr:10,days:[],configuration:{owner:'Salon appointments ad set',dailyBudget:30,lifetimeBudget:null,platforms:['Facebook','Instagram'],audience:'Ages 25–54',geography:'New York',planned:null,projection:null},limitations:['Synthetic design fixture. No real advertising action occurred.'],breakdowns:[{kind:'age_gender',scope:'Ad-set snapshot, not individual-ad attribution',since:'2026-11-01',until:'2026-11-07',rows:[{label:'25–34 · female',impressions:2100,spend:90},{label:'35–44 · female',impressions:3100,spend:120}]}]}};}
function attention():Issue{return {id:'preview-issue',revision:1,key:'rejected:preview-ad',title:'Meta rejected this advertisement',explanation:'This advertisement was disapproved. Review Meta’s explanation before making changes.',action:'Review in Campaigns',href:'/campaigns',entities:['preview-ad'],code:'DISAPPROVED',observedAt:at,stale:false,resolvedAt:null};}
/** Two weeks of daily ad results before the change day (Nov 7), with one missing day. */
function leadUpDays(){return Array.from({length:14},(_,i)=>({day:shiftReportDay('2026-10-24',i),spend:i<7?28:34,results:i<7?4:2})).filter(d=>d.day!=='2026-11-02');}
/** Webhook-era issues use the production wording functions with synthetic notices. */
function liveIssues(effective:string,summary:string|null,fatigue=false):Issue[]{
 const entity={...ad(),effective};
 const evidence=fatigue?fatigueIssues([entity],new Map([[entity.id,{level:'HIGH',message:'Cost per result has risen as this creative has been shown repeatedly.'}]])):hierarchyIssues([entity],new Map(summary?[[entity.id,{code:'1815869',summary}]]:[]));
 return evidence.map((e,i)=>({...e,id:`preview-live-${e.code}-${i}`,revision:1,observedAt:at,stale:false,resolvedAt:null}));
}
/** Account issues use the production mapping so the preview shows real wording. */
function accountIssue(status:number,reason?:number):Issue[]{return (accountHealthIssues({account_status:status,disable_reason:reason},'1234567890')??[]).map(e=>({...e,id:`preview-account-${status}`,revision:1,observedAt:at,stale:false,resolvedAt:null}));}
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
 case 'pause':card.brief.days=leadUpDays();card.brief.explanation='Meta now reports this advertisement as paused.';card.brief.affected[0].effective='PAUSED';p.lifecycle=[card];break;
 case 'early-stop':case 'multiple':card.brief.explanation='Delivery was interrupted because the parent campaign was paused, before the planned November 10 end.';card.brief.provenance='reconstructed';card.brief.affected[0].effective='CAMPAIGN_PAUSED';card.rootId='preview-campaign';p.lifecycle=[card];if(scenario==='multiple'){card.brief.affected=Array.from({length:6},(_,i)=>({...ad(`preview-ad-${i}`),effective:'CAMPAIGN_PAUSED'}));card.affectedIds=card.brief.affected.map(a=>a.id);}break;
 case 'scheduled-end':card.brief.explanation='The saved scheduled end has been reached. This alone does not confirm the exact time delivery stopped.';p.lifecycle=[card];break;
 case 'rejection':case 'all':card.brief.affected[0].effective='DISAPPROVED';card.brief.explanation='Meta now reports this advertisement as disapproved.';p.lifecycle=[card];p.issues=[issue];if(scenario==='all')p.recap=recap;break;
 case 'connection':p.issues=[{...issue,title:'Reconnect Meta to keep data current',explanation:'Your saved connection requires renewed authorization. Existing reports remain available.',action:'Open Connections',href:'/integration',entities:[],code:'REAUTH_REQUIRED'}];break;
 case 'restriction':p.issues=accountIssue(2,1);break;
 case 'grace-period':p.issues=accountIssue(9);p.recap=recap;break;
 case 'compromised':p.issues=accountIssue(2,15);break;
 case 'billing':p.issues=accountIssue(3);break;
 case 'catch-up-lifecycle':p.recap=recap;card.brief.explanation='This advertisement reached its scheduled end. See the saved performance below.';p.lifecycle=[card];break;
 case 'long-absence':p.recap=summarize(Array.from({length:30},(_,i)=>({...rows[0],day:new Date(Date.UTC(2026,9,9+i)).toISOString().slice(0,10),spend:20+i%5*5,messages:2+i%3})),{since:'2026-10-09',until:'2026-11-07',capped:true},'USD');break;
 case 'sparse':p.recap=summarize(rows.filter((_,i)=>i!==2&&i!==4).map((r,i)=>i===1?{...r,messages:null}:r),{since:'2026-11-01',until:'2026-11-07',capped:false},'USD');break;
 case 'zero':p.recap=summarize(rows.map(r=>({...r,messages:0})),{since:'2026-11-01',until:'2026-11-07',capped:false},'USD');break;
 case 'stale':p.issues=[{...issue,stale:true,observedAt:'2026-11-03T18:00:00Z'}];break;
 case 'unknown':p.currency=null;p.timezone=null;card.brief.currency=null;card.brief.media=[];card.brief.spend=null;card.brief.results=null;card.brief.cpr=null;p.lifecycle=[card];break;
 case 'many':p.recap=recap;p.lifecycle=Array.from({length:7},(_,i)=>({...lifecycle(),eventId:`preview-event-${i}`,brief:{...lifecycle().brief,title:`Salon advertisement ${i+1}`}}));break;
 case 'results-up':p.recap={...recap,comparison:{results:31.3,spend:8.2}};break;
 case 'results-down':p.recap={...recap,comparison:{results:-27.6,spend:12.5}};break;
 case 'adset-ended':card.brief.explanation='The saved scheduled end has been reached. This alone does not confirm when delivery stopped.';card.brief.title='Holiday booking push';card.brief.affected=[{...ad('preview-set'),level:'adset',name:'Holiday booking push'}];card.brief.spend=null;card.brief.results=null;card.brief.cpr=null;card.brief.media=[];p.lifecycle=[card];break;
 case 'archived':card.brief.explanation='Meta reports this advertising as archived or deleted.';card.brief.affected[0].effective='ARCHIVED';p.lifecycle=[card];break;
 case 'live-rejection':p.issues=liveIssues('DISAPPROVED','This ad doesn’t comply with our policy on personal attributes.');break;
 case 'live-delivery':p.issues=liveIssues('WITH_ISSUES','The payment method for this ad account couldn’t be charged.');break;
 case 'fatigue':p.issues=liveIssues('ACTIVE',null,true);break;
 case 'fatigue-recap':p.issues=liveIssues('ACTIVE',null,true);p.recap=recap;break;
 case 'live-mixed':p.issues=[...liveIssues('DISAPPROVED','This ad doesn’t comply with our policy on personal attributes.'),...liveIssues('ACTIVE',null,true)];p.lifecycle=[lifecycle()];break;
 case 'delivery-issue':p.issues=[{...issue,key:'delivery:preview-ad',title:'Meta reports a delivery issue',explanation:'Autumn color appointments has a delivery issue. The saved data does not establish its cause.',code:'WITH_ISSUES'}];break;
 case 'multiple-issues':p.recap=recap;p.issues=[issue,{...issue,id:'preview-issue-2',key:'delivery:preview-ad-2',title:'Meta reports a delivery issue',explanation:'Winter gift cards has a delivery issue. The saved data does not establish its cause.',entities:['preview-ad-2'],code:'WITH_ISSUES'}];break;
 case 'connection-recap':p.recap=recap;p.issues=[{...issue,title:'Reconnect Meta to keep data current',explanation:'Your saved connection requires renewed authorization. This catch-up uses data saved before it expired.',action:'Open Connections',href:'/integration',entities:[],code:'REAUTH_REQUIRED'}];break;
 case 'hourly-partial':{
  p.recap=summarize([rows[6]],{since:'2026-11-07',until:'2026-11-07',capped:false},'USD');
  p.recap.hourly=summarizeHours(Array.from({length:24},(_,hour)=>({...rows[6],hour_of_day:hour,spend:hour>=9&&hour<19?3:0,messages:[10,14,17].includes(hour)?1:0})).filter(r=>r.hour_of_day<6||r.hour_of_day>=12),'2026-11-07','USD');break;
 }
 case 'long-names':p.account='[PREVIEW] Atelier Salon & Spa — Downtown Flagship Location (Main Street) Advertising Account';card.brief.title='Autumn color appointments — balayage, gloss and toner bundle for returning weekday clients';card.brief.configuration!.owner='Returning clients · weekday mornings · 10-mile radius lookalike ad set';p.lifecycle=[card];p.recap=recap;break;
 case 'correction':p.recap=recap;p.revisionOf='preview-original';p.limitations.push('A new saved revision preserves corrected attribution. The original report remains unchanged.');break;
 }
 return {id:`preview-${scenario}`,created_at:at,payload:p};
}
