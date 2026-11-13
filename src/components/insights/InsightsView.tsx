'use client';
import { useCallback,useEffect,useRef,useState } from 'react';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import Image from 'next/image';
import { Modal } from '@mantine/core';
import { AlertTriangle, CircleAlert, Flag, Info } from 'lucide-react';
import { useMediaQuery } from '@mantine/hooks';
import SpiderMascot from '@/components/brand/SpiderMascot';
import StatusBanner from '@/components/ui/states/StatusBanner';
import {recapChart} from '@/lib/shared/insights/hourly';
import { headline,lifecycleStatus,relatedLifecycle } from '@/lib/shared/insights/model';
import type { Issue,LifecycleCard,SavedPresentation } from '@/lib/shared/insights/model';
import styles from './InsightsView.module.css';
import {InsightDataNotice,MissingObservationTrack} from './InsightDataState';
const number=(v:number|null)=>v===null?'—':new Intl.NumberFormat('en',{maximumFractionDigits:0}).format(v);
function money(v:number|null,currency:string|null){if(v===null)return '—';return currency?new Intl.NumberFormat('en',{style:'currency',currency,maximumFractionDigits:2}).format(v):`${v.toFixed(2)} (currency unknown)`;}
function Metrics({spend,results,cpr,currency}:{spend:number|null;results:number|null;cpr:number|null;currency:string|null}){
 return <dl className={styles.metrics}><div><dt>Reported results</dt><dd>{number(results)}</dd></div><div><dt>Spend</dt><dd>{money(spend,currency)}</dd></div><div><dt>Cost / result</dt><dd>{money(cpr,currency)}</dd></div></dl>;
}
function Creative({card,currency,preview=false}:{card:LifecycleCard;currency:string|null;preview?:boolean}){
 const b=card.brief,creative=b.media.find(m=>m.image),config=b.configuration;
 const ended=lifecycleStatus(card)==='ended',adLevel=b.affected.length>0&&b.affected.every(a=>a.level==='ad');
 const ads=b.affected.filter(a=>a.level==='ad').length;
 const count=ads?`${ads} ${ads===1?'ad':'ads'} affected`:`${b.affected.length} affected`;
 // Budget owner: the ad set when it holds the budget, otherwise the campaign. Shown by name only.
 const group=config&&config.owner!=='Budget owner unavailable'?config.owner:null;
 const label=ended?`${adLevel?'Ad':'Delivery'} ended · Scheduled end reached`:'Advertising update';
 const noMetrics=b.spend===null&&b.results===null&&b.cpr===null;
 // A scheduled end is expected; the timeline already states that missing dates are not zero.
 const missing=!ended&&(!creative||!currency||b.spend===null||b.results===null);
 return <section className={styles.lifecycleCard} aria-label={`${label}: ${b.title}`}>
  <header className={styles.statusBand}>{ended?<Flag size={18} aria-hidden="true"/>:<Info size={18} aria-hidden="true"/>}<div><strong>{label}</strong><span>{count}{group?` · ${group}`:''}</span></div></header>
  <div className={styles.lifecycleBody}>
  <div className={styles.creativeHeading}>{creative?.image&&<div className={styles.lifecycleCreative}><Image src={creative.image} alt={creative.name} width={72} height={92} unoptimized onError={e=>{e.currentTarget.parentElement!.style.display='none';}}/>{ended&&<span>Ended</span>}</div>}<div><h3>{b.title}</h3><p>{b.explanation}</p></div></div>
  {b.provenance==='reconstructed'&&<p className={styles.notice}>Reconstructed from saved state and your confirmation. Exact interruption time is unverified.</p>}
  {ended&&<div className={styles.timeline}><div className={styles.timelineLabels}><span>Reporting window starts · {b.since}</span><strong>Scheduled end reached</strong></div><div className={styles.timelineTrack} aria-hidden="true"><span/><span/></div><p>Observations through {b.until} · missing dates are not zero</p></div>}
  {!(ended&&noMetrics)&&<Metrics spend={b.spend} results={b.results} cpr={b.cpr} currency={currency}/>}
  {missing&&<div className={styles.dataInset}><InsightDataNotice title="Some advertising details aren’t available">{!creative?'No creative preview is saved. ':''}{!currency?'The account currency is unknown. ':''}{b.spend===null||b.results===null?'Unavailable metrics are shown as dashes; they do not mean zero.':'Available metrics are shown above.'}</InsightDataNotice>{!creative&&<div className={styles.missingMedia}>Creative preview unavailable</div>}</div>}
  {!ended&&<p className={styles.caption}>Affected-ad observations · {b.since} – {b.until}. Missing dates are not zero.</p>}
  {config&&<details><summary>Schedule, audience &amp; budget</summary><p>{config.owner} · {config.dailyBudget!==null?`${money(config.dailyBudget,currency)} daily`:config.lifetimeBudget!==null?`${money(config.lifetimeBudget,currency)} lifetime`:'Budget unavailable'}</p><p>{config.audience} · {config.geography}</p><p>{config.platforms.length?config.platforms.join(' / '):'Placements not recorded'}</p>{b.affected.slice(0,5).map(e=><p key={e.id}>{e.name}: {e.start??'Start not recorded'} → {e.end??'End not recorded'}</p>)}</details>}
  {preview?<span className={styles.caption}>Report link disabled in preview</span>:<Link className={styles.link} href={`/lifecycle/${b.id}`}>Explore advertising report →</Link>}
  </div>
 </section>;
}
function AttentionCard({issue:i,related,currency,preview=false}:{issue:Issue;related:LifecycleCard[];currency:string|null;preview?:boolean}){
 const creative=related.flatMap(c=>c.brief.media).find(m=>m.image);
 const rejected=i.code==='DISAPPROVED';
 const status=i.stale?'Status needs confirmation':rejected?'Not delivering':'Delivery issue reported';
 return <section className={styles.urgentCard} aria-label={`Needs attention: ${i.title}`}>
  <div className={styles.urgentHeader}><span><AlertTriangle size={16} aria-hidden="true"/>Action required · {rejected?'Ad rejected':'Needs attention'}</span><span>{status}</span></div>
  <div className={styles.urgentBody}>
   {creative?.image&&<div className={styles.urgentCreative}><Image src={creative.image} alt={creative.name} width={84} height={108} unoptimized onError={e=>{e.currentTarget.parentElement!.style.display='none';}}/><span>{i.stale?'Last observed':rejected?'Rejected':'Attention'}</span></div>}
   <div className={styles.urgentDetail}><h3>{i.title}</h3><p>{i.explanation}</p>
    <div className={styles.urgentNotice}><CircleAlert size={15} aria-hidden="true"/><span>{i.stale?`Last confirmed ${new Date(i.observedAt).toLocaleDateString()}. Refresh observations to confirm current status.`:rejected?'This ad cannot deliver while Meta reports it as rejected.':'Review the reported issue before making changes to your advertising.'}</span></div>
    <div className={styles.urgentActions}>{preview?<button type="button" className={styles.urgentPrimary} disabled>{i.action}</button>:<Link className={styles.urgentPrimary} href={i.href}>{i.action}</Link>}</div>
    {related.length>0&&<details className={styles.urgentRelated}><summary>View performance</summary>{related.map(c=><Creative key={c.eventId} card={c} currency={currency} preview={preview}/>)}</details>}
    {related.length>0&&<p className={styles.caption}>{related.length} related advertising {related.length===1?'change':'changes'}{preview?' · preview only':''}</p>}
    {preview&&!related.length&&<p className={styles.caption}>Preview only · No real advertising activity</p>}
   </div>
  </div>
 </section>;
}
export function InsightContent({saved,preview=false}:{saved:SavedPresentation;preview?:boolean}){
 const p=saved.payload,r=p.recap,[metric,setMetric]=useState<'spend'|'results'>('spend');
 const chart=r?recapChart(r):null;
 const max=Math.max(1,...(chart?.points.map(d=>d[metric]??0)??[]));
 const unavailableHours=Boolean(chart?.hourly&&chart.observed===0);
 const partial=Boolean(r&&(r.observedDays<r.expectedDays||r.spend===null||r.results===null));
 const zeroResults=r?.results===0;
 const dataState=unavailableHours||partial||zeroResults;
 const dataTitle=unavailableHours?(r?.hourly?.status==='error'?'Hourly breakdown couldn’t be loaded for this report':'Hourly breakdown isn’t available for this report'):partial?'This report has incomplete performance data':zeroResults?'No results were reported for this period':null;
 const related=new Set(p.issues.flatMap(i=>p.lifecycle.filter(c=>relatedLifecycle(i,c)).map(c=>c.eventId)));
 const cards:Array<{key:string;node:React.ReactNode}>=[...p.issues.map(i=>({key:i.id,node:<AttentionCard issue={i} related={p.lifecycle.filter(c=>relatedLifecycle(i,c))} currency={p.currency} preview={preview}/>})),...p.lifecycle.filter(c=>!related.has(c.eventId)).map(c=>({key:c.eventId,node:<Creative card={c} currency={p.currency} preview={preview}/>}))];
 return <div className={styles.content} data-insight-preview={preview?saved.id:undefined}>
  <header className={styles.heading}><SpiderMascot state={p.issues.length?'attention':'idle'} size={64} paused/><div><span className={styles.eyebrow}>{p.account}{p.revisionOf?' · Revised report':''}</span><h2>{headline(p)}</h2><p>{r?`${r.since} – ${r.until} · completed days`:'Saved changes from your advertising account'}</p></div></header>
  {cards.filter(c=>p.issues.some(i=>i.id===c.key)).slice(0,1).map(c=><div key={c.key}>{c.node}</div>)}
  {!r&&!p.issues.length&&!p.lifecycle.length&&<section className={`${styles.card} ${styles.dataState}`}><Metrics spend={null} results={null} cpr={null} currency={p.currency}/><div className={styles.dataInset}><InsightDataNotice title="No saved observations available">Your catch-up will appear once synchronization provides usable data. Missing information is not zero.</InsightDataNotice><MissingObservationTrack/></div></section>}
  {r&&chart&&<section className={`${styles.performance} ${dataState?styles.dataState:''}`} aria-label="Performance catch-up"><Metrics spend={r.spend} results={r.results} cpr={r.cpr} currency={p.currency}/>
   <div className={dataState?styles.dataInset:undefined}>
   <div className={styles.chartHeading}><h3>{chart.hourly?'Hourly':'Daily'} {metric}</h3><div className={styles.segment} aria-label="Chart metric">{(['spend','results'] as const).map(m=><button key={m} type="button" aria-pressed={metric===m} onClick={()=>setMetric(m)}>{m==='spend'?'Spend':'Results'}</button>)}</div></div>
   {dataTitle&&<InsightDataNotice title={dataTitle} hourly={unavailableHours}>{unavailableHours?`${r.spend!==null&&r.results!==null?'Your daily totals are available above.':'Available daily totals are shown above.'} Hours with no data are not zero spend.`:partial?`${r.observedDays} of ${r.expectedDays} days have observations. Gaps and unavailable metrics are not zero.`:'Zero is an observed result count. Cost per result is unavailable when there are no results.'}</InsightDataNotice>}
   {unavailableHours?<MissingObservationTrack hourly/>:<div className={styles.chart} data-granularity={chart.hourly?'hour':'day'} role="img" aria-label={`${chart.hourly?'Hourly':'Daily'} ${metric}, zero baseline. ${chart.observed} of ${chart.expected} ${chart.hourly?'hour slots':'days'} observed. Values in the accessible data table below.`}>{chart.points.map((d,index)=><div key={d.label} className={styles.column}><div className={styles.barTrack}>{d[metric]===null?<span className={styles.gap} title={`${d.label}: no observation`}>·</span>:<span className={styles.bar} style={{height:`${Math.max(d[metric]===0?0:2,d[metric]!/max*100)}%`}} title={`${d.label}: ${metric==='spend'?money(d.spend,p.currency):number(d.results)}`}/>}</div><span className={styles.date}>{chart.hourly?(index%6===0?d.label:''):chart.points.length<=7||index===0||index===chart.points.length-1?d.label.slice(5):''}</span></div>)}</div>}
   {chart.hourly&&!unavailableHours&&<p className={styles.caption}>{chart.observed} of 24 advertiser-local hour slots have observations · {p.timezone??'Timezone unavailable'}. Missing hours are not zero; hourly observations may not reconcile with daily totals. Repeated daylight-saving hours share a clock-hour slot.</p>}
   {r.comparison&&<p className={styles.observation}>Reported results {r.comparison.results>=0?'increased':'decreased'} {Math.abs(r.comparison.results).toFixed(1)}% against the previous {r.expectedDays} completed days. Spend {r.comparison.spend>=0?'increased':'decreased'} {Math.abs(r.comparison.spend).toFixed(1)}%.</p>}
   <p className={styles.caption}>{p.timezone??'Timezone unavailable'} · {r.observedDays} of {r.expectedDays} days have observations. {r.capped?'Your catch-up is limited to the latest 30 completed days. ':''}Results combine leads, conversations and calls; they are not verified bookings.</p>
   <details><summary>View {chart.hourly?'hourly':'daily'} values</summary><table><thead><tr><th>{chart.hourly?'Hour':'Date'}</th><th>Spend</th><th>Results</th></tr></thead><tbody>{chart.points.map(d=><tr key={d.label}><td>{d.label}</td><td>{money(d.spend,p.currency)}</td><td>{number(d.results)}</td></tr>)}</tbody></table></details>
   </div>
  </section>}
  {cards.filter(c=>!p.issues.slice(0,1).some(i=>i.id===c.key)).slice(0,p.issues.length?2:3).map(c=><div key={c.key}>{c.node}</div>)}
  {cards.length>3&&<details className={styles.more}><summary>{cards.length-3} more updates included in this review</summary>{cards.slice(3).map(c=><div key={c.key}>{c.node}</div>)}</details>}
  <details className={styles.details}><summary>Data &amp; coverage</summary><p>Timezone: {p.timezone??'Unavailable'} · Last successful sync: {p.syncedAt?new Date(p.syncedAt).toLocaleString():'Unavailable'}</p><p>Saved {new Date(saved.created_at).toLocaleString()}. This report preserves the values shown at that time. Later attribution corrections can change current reports.</p>{p.limitations.map(t=><p key={t}>{t}</p>)}</details>
  {!preview&&<div className={styles.actions}><a href={`/api/insights/export?id=${saved.id}&format=pdf`}>Download PDF</a><a href={`/api/insights/export?id=${saved.id}&format=csv`}>Download CSV</a><Link href="/insights">All updates</Link></div>}
 </div>;
}
export default function InsightsPopup({accountId}:{accountId:string|null}){
 const [saved,setSaved]=useState<SavedPresentation|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[additional,setAdditional]=useState(false);
 const active=useRef<SavedPresentation|null>(null),token=useRef(''),inflight=useRef(false),mounted=useRef(true);
 const mobile=useMediaQuery('(max-width: 600px)'),pathname=usePathname();
 const load=useCallback(async()=>{
  if(!accountId||pathname.startsWith('/insights')||inflight.current||document.visibilityState!=='visible')return;
  // Avoid interrupting another dialog or a person currently entering information.
  if(!active.current&&(document.querySelector('[role="dialog"],dialog[open]')||document.activeElement?.matches('input,textarea,[contenteditable="true"]')))return;
  inflight.current=true;
  try{const res=await fetch('/api/insights',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:token.current})});if(!res.ok)throw new Error();const data=await res.json();if(mounted.current)setAdditional(Boolean(data.presentation?.additionalUpdates));if(mounted.current&&data.presentation&&!active.current&&!document.querySelector('[role="dialog"],dialog[open]')){active.current=data.presentation;setSaved(data.presentation);setError('');}}
  catch{if(mounted.current)setError('Updates are temporarily unavailable. Your advertising is unchanged.');}finally{inflight.current=false;}
 },[accountId,pathname]);
 useEffect(()=>{mounted.current=true;if(!token.current)token.current=crypto.randomUUID();const refresh=()=>{void load();};refresh();window.addEventListener('deepvisor:data-updated',refresh);window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);const interval=window.setInterval(()=>{if(active.current)void load();},120000);return()=>{mounted.current=false;window.clearInterval(interval);window.removeEventListener('deepvisor:data-updated',refresh);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);};},[load,pathname]);
 async function dismiss(){if(!saved||busy)return;setBusy(true);try{const r=await fetch('/api/insights/ack',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:saved.id,token:token.current})});if(!r.ok)throw new Error();active.current=null;setSaved(null);setError('');}catch{setError('Could not save your review. Please try again.');}finally{setBusy(false);}}
 return <>{!saved&&error&&<StatusBanner tone="gap">{error}</StatusBanner>}<Modal opened={Boolean(saved)} onClose={()=>void dismiss()} title="Insights & Events" size={740} fullScreen={mobile} radius="lg" closeOnClickOutside={false} closeOnEscape={!busy} classNames={{content:styles.modalContent,header:styles.modalHeader,title:styles.modalTitle}}>{saved&&<InsightContent saved={saved}/>}<footer className={styles.footer}>{error&&<p role="alert">{error}</p>}<span>{additional?'Additional updates are available. They remain unread until presented.':'Keep this update in your history.'}</span><button type="button" onClick={()=>void dismiss()} disabled={busy}>{busy?'Saving…':'Got it'}</button></footer></Modal></>;
}
export function InsightsHistory(){
 const [items,setItems]=useState<SavedPresentation[]>([]),[issues,setIssues]=useState<Issue[]>([]),[next,setNext]=useState<string|null>(null),[selected,setSelected]=useState<SavedPresentation|null>(null),[filter,setFilter]=useState('all'),[error,setError]=useState(''),[loading,setLoading]=useState(false);
 const mobile=useMediaQuery('(max-width: 600px)');
 const load=useCallback(async(before?:string)=>{setLoading(true);try{const r=await fetch(`/api/insights${before?`?before=${before}`:''}`);if(!r.ok)throw new Error();const data=await r.json();setItems(prev=>before?[...prev,...data.items]:data.items);setIssues(data.issues);setNext(data.next);setError('');}catch{setError('Your saved updates could not be loaded.');}finally{setLoading(false);}},[]);
 useEffect(()=>{void load();const id=new URLSearchParams(window.location.search).get('id');if(id)void fetch(`/api/insights?id=${encodeURIComponent(id)}`).then(r=>r.ok?r.json():null).then(d=>{if(d)setSelected(d);}).catch(()=>setError('This update is unavailable.'));},[load]);
 const visible=items.filter(i=>filter==='all'||(filter==='performance'?i.payload.recap:filter==='attention'?i.payload.issues.length:i.payload.lifecycle.length));
 return <div className={styles.history}><header className={styles.heading}><SpiderMascot size={64} paused/><div><span className={styles.eyebrow}>Your advertising, in context</span><h1>Insights &amp; Events</h1><p>Revisit your results, important changes, and issues to check.</p></div></header>{issues.some(i=>!i.resolvedAt)&&<section className={styles.attention}><h2>Still needs attention</h2>{issues.filter(i=>!i.resolvedAt).map(i=><p key={i.id}><Link href={i.href}>{i.title}</Link>{i.stale?' · status needs a fresh observation':''}</p>)}<p>Dismissing an update does not resolve an issue.</p></section>}<label className={styles.filter}>Show <select value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All updates</option><option value="performance">Performance</option><option value="lifecycle">Advertising changes</option><option value="attention">Needs attention</option></select></label>{error&&<p role="alert">{error} <button onClick={()=>void load()}>Retry</button></p>}{!loading&&!visible.length&&<section className={styles.card}><h2>No saved updates yet</h2><p>Updates appear when synchronized data provides a completed-day recap or a confirmed advertising change.</p></section>}{visible.map(i=><button key={i.id} className={styles.historyCard} onClick={()=>setSelected(i)}><span className={styles.eyebrow}>{new Date(i.created_at).toLocaleString()}</span><strong>{i.payload.revisionOf?'Revised report · ':''}{headline(i.payload)}</strong><span>{i.payload.recap?`${i.payload.recap.since} – ${i.payload.recap.until}`:i.payload.account} · {i.payload.lifecycle.length} changes · {i.payload.issues.length} issues</span></button>)}{loading&&<p role="status">Loading saved updates…</p>}{next&&<button disabled={loading} onClick={()=>void load(next)}>Load older updates</button>}<Modal opened={Boolean(selected)} onClose={()=>setSelected(null)} title="Saved advertising update" classNames={{content:styles.modalContent,header:styles.modalHeader,title:styles.modalTitle}} size={740} fullScreen={mobile} radius="lg">{selected&&<InsightContent saved={selected}/>}</Modal></div>;
}
