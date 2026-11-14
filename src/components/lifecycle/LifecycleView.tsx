'use client';
import {LifecycleOutcomeSection} from './LifecycleOutcome';
import {useMediaQuery} from '@mantine/hooks';
import {useEffect,useState} from 'react';
import {Alert,Badge,Button,Group,Loader,Modal,Paper,SimpleGrid,Stack,Text,Title} from '@mantine/core';
import Link from 'next/link';
import Image from 'next/image';
import SpiderMascot from '@/components/brand/SpiderMascot';
import type {LifecycleBrief} from '@/lib/shared/lifecycle/types';
export function LifecycleReport({id}:{id:string}){
 const [data,setData]=useState<LifecycleBrief|null>(null),[error,setError]=useState(false);
 useEffect(()=>{const c=new AbortController();fetch(`/api/lifecycle?id=${id}`,{signal:c.signal}).then(async r=>{if(!r.ok)throw Error();setData(await r.json());}).catch(()=>{if(!c.signal.aborted)setError(true);});return()=>c.abort();},[id]);
 if(error)return <Alert color="orange">This saved report is unavailable. Try again from Notifications.</Alert>;
 if(!data||data.id!==id)return <Group role="status"><Loader size="sm"/><Text>Loading saved observations…</Text></Group>;
 const money=(v:number|null)=>v===null?'Unavailable':new Intl.NumberFormat('en',{style:'currency',currency:data.currency??'USD'}).format(v);
 const date=(at:string)=>new Intl.DateTimeFormat('en',{dateStyle:'medium',timeStyle:'short',timeZone:data.timezone}).format(new Date(at));
 const peak=Math.max(1,...data.days.map(d=>d.spend??0));
 return <Stack gap="lg">
  <Group><SpiderMascot state="idle" size={64}/><div><Badge variant="light">{data.provenance==='reconstructed'?'Reconstructed interruption':'Meta lifecycle update'}</Badge><Title order={2} size="h3" mt={8}>{data.title}</Title></div></Group>
  {data.media?.length>0&&<Group>{data.media.slice(0,4).map((m,i)=>m.image?<Image key={i} src={m.image} alt={m.name} width={160} height={160} unoptimized style={{objectFit:'contain',borderRadius:12,maxWidth:'40%'}} onError={e=>{e.currentTarget.style.display='none';}}/>:null)}</Group>}
  <Text size="lg">{data.explanation}</Text>
  <Text size="sm" c="dimmed">Observed {date(data.observedAt)} · {data.affected.length} affected ad{data.affected.length===1?'':'s'}</Text>
  <SimpleGrid cols={3} spacing="xs">{[['Spend',money(data.spend)],['Reported results',data.results??'Unavailable'],['Cost / result',money(data.cpr)]].map(([label,value])=><Paper key={label} p="sm" radius="md" bg="var(--mantine-color-default)"><Text size="xs" c="dimmed">{label}</Text><Text fw={700} style={{fontSize:'clamp(14px,3vw,24px)',overflowWrap:'anywhere'}}>{value}</Text></Paper>)}</SimpleGrid>
  <LifecycleOutcomeSection id={id}/>
  <div><Text fw={600}>Recorded daily spend</Text><Text size="xs" c="dimmed">{data.since} – {data.until} · missing observations are not zero</Text><div style={{display:'flex',alignItems:'end',height:110,gap:4,overflowX:'auto',paddingTop:20}} aria-label="Daily spend chart">{data.days.map(d=><div key={d.day} title={`${d.day}: ${money(d.spend)} · ${d.results??'unavailable'} results`} style={{flex:'1 0 8px',height:`${Math.max(2,(d.spend??0)/peak*100)}%`,background:d.spend===null?'transparent':'var(--mantine-color-blue-6)',borderRadius:'4px 4px 0 0'}}/>)}</div></div>
  {data.configuration&&<Paper withBorder p="md" radius="md"><Text fw={600}>Budget & delivery context</Text><Text size="sm">{data.configuration.owner} · Shared daily budget: {money(data.configuration.dailyBudget)}</Text><Text size="sm">{data.configuration.audience} · {data.configuration.geography}</Text><Text size="sm">Eligible platforms: {data.configuration.platforms.join(', ')||'Not explicitly recorded; actual placement is not guaranteed.'}</Text>{data.configuration.planned!==null&&<Text size="sm">Full-day budget scenario, excluding today: {money(data.configuration.planned)}. This is a shared budget, not this ad’s allocation or guaranteed spend.</Text>}{data.configuration.projection?<Text size="sm">At the budget owner’s historical efficiency: approximately {Math.round(data.configuration.projection.results)} reported results ({Math.round(data.configuration.projection.low)}–{Math.round(data.configuration.projection.high)} empirical scenario range). Not a guarantee or confidence interval.</Text>:<Text size="xs" c="dimmed">A supported results projection is unavailable for this event.</Text>}</Paper>}
  <details><summary>Ads, schedule & targeting</summary><Stack mt="sm">{data.affected.map(ad=><Paper key={ad.id} withBorder p="sm" radius="md"><Text fw={600}>{ad.name}</Text><Text size="sm">{ad.effective.replaceAll('_',' ').toLowerCase()}</Text><Text size="sm">Scheduled end: {ad.end?date(ad.end):'Not available'}</Text><Text size="xs" c="dimmed">Meta ID {ad.id} · Budget is shared with the parent ad set or campaign; no per-ad allocation is assumed.</Text></Paper>)}</Stack></details>
  {data.days.some(d=>d.results!==null&&d.results>0)&&<Paper p="md" bg="var(--mantine-color-default)" radius="md"><Text fw={600}>Highest recorded results day</Text><Text size="sm">{[...data.days].sort((a,b)=>(b.results??-1)-(a.results??-1))[0].day}. This describes observed volume, not proof of better audience quality.</Text></Paper>}
  {data.breakdowns?.map(b=><details key={b.kind}><summary>{b.kind==='age_gender'?'Audience demographics':'Platform performance'}</summary><Text size="xs" c="dimmed">{b.scope} Snapshot coverage: {b.since??'unknown'}–{b.until??'unknown'}; separate from the selected performance dates.</Text>{b.rows.map((r,i)=><Group key={i} justify="space-between"><Text size="sm">{r.label}</Text><Text size="sm">{r.impressions.toLocaleString()} impressions · {money(r.spend)}</Text></Group>)}</details>)}
  <details><summary>Data details</summary>{data.limitations.map(t=><Text key={t} size="sm" c="dimmed" mt="xs">{t}</Text>)}<table><caption>Observed daily values</caption><thead><tr><th>Date</th><th>Spend</th><th>Results</th></tr></thead><tbody>{data.days.map(d=><tr key={d.day}><td>{d.day}</td><td>{money(d.spend)}</td><td>{d.results??'Unavailable'}</td></tr>)}</tbody></table></details>
  <Group><Button component="a" href={`/api/lifecycle/${id}/export?format=pdf`} variant="light">Download PDF</Button><Button component="a" href={`/api/lifecycle/${id}/export?format=csv`} variant="subtle">Download CSV</Button></Group>
 </Stack>;
}
export default function LifecyclePopup({accountId}:{accountId:string|null}){
 const mobile=useMediaQuery('(max-width: 600px)');
 const [events,setEvents]=useState<Array<{id:string;explanation:string}>>([]),[selected,setSelected]=useState(''),[dismissError,setDismissError]=useState(false);
 useEffect(()=>{if(!accountId)return;const c=new AbortController();const load=()=>{fetch('/api/lifecycle',{signal:c.signal,cache:'no-store'}).then(r=>r.ok?r.json():null).then(data=>{if(data){setEvents(data.events);setSelected(v=>data.events.some((e:{id:string})=>e.id===v)?v:data.events[0]?.id??'');}}).catch(()=>{});};load();window.addEventListener('deepvisor:data-updated',load);return()=>{c.abort();window.removeEventListener('deepvisor:data-updated',load);};},[accountId]);
 async function dismiss(){setDismissError(false);const results=await Promise.all(events.map(e=>fetch(`/api/lifecycle/${e.id}/ack`,{method:'POST'}).then(r=>r.ok).catch(()=>false)));if(results.every(Boolean)){setEvents([]);setSelected('');}else setDismissError(true);}
 return <Modal fullScreen={mobile} opened={Boolean(selected)} onClose={()=>void dismiss()} title="Your advertising, explained" size="lg" centered radius="lg" padding="lg"><Stack>{events.length>1&&<Group>{events.map((e,i)=><Button key={e.id} variant={selected===e.id?'light':'subtle'} size="xs" onClick={()=>setSelected(e.id)}>Update {i+1}</Button>)}</Group>}{selected&&<LifecycleReport key={selected} id={selected}/>}<Group justify="space-between"><Button component={Link} href={`/lifecycle/${selected}`} variant="subtle">View saved report</Button><Button onClick={()=>void dismiss()}>Dismiss updates</Button></Group>{dismissError&&<Alert color="orange">Could not save your dismissal. Please try again.</Alert>}</Stack></Modal>;
}
