'use client';
import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import SpiderMascot from '@/components/brand/SpiderMascot';
import { snapshotStale,defaults,levels,parentMap,propose,renderName,tokens,validateDraft,type Draft,type Node } from '@/lib/shared/organizer/model';
import { organizerAction } from './actions';
import s from './Organizer.module.css';
import RenamePanel from './RenamePanel';
import type { SavedOrganization as Saved } from '@/lib/server/organizer/service';
export default function Organizer({accountId,accountName}:{accountId:string;accountName:string}){
 const [sourceVersion,setSourceVersion]=useState(''),[expanded,setExpanded]=useState<Set<string>>(new Set());
 const [saved,setSaved]=useState<Saved|null>(null),[draft,setDraft]=useState<Draft|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[consent,setConsent]=useState(false),[search,setSearch]=useState(''),[onlyChanges,setOnlyChanges]=useState(false),[families,setFamilies]=useState(false);
 async function run(operation:'inspect'|'history'|'save',versionId?:string){
  setBusy(true);setError('');setMessage('');
  try{
   const result=await organizerAction(accountId,operation,{consent:consent?'organizer-v1':undefined,baselineId:saved?.baselineId,previous:saved?.versions[0]?.version??0,draft,sourceVersion,versionId});
   if(result.error)throw new Error(result.error);
   if(!result.data){setMessage('No saved organization yet. Authorize inspection to begin.');return;}
   setSourceVersion(result.data.viewVersion?.id??'');setExpanded(new Set());setSaved(result.data);setDraft(result.data.viewVersion?validateDraft(result.data.snapshot,result.data.viewVersion.proposal):propose(result.data.snapshot));
   setMessage(operation==='save'?'New proposal version saved. No Meta changes occurred.':'Saved organization loaded. Review suggestions before selecting changes.');
  }catch(e){setError(e instanceof Error?e.message:'Could not load organizer');}finally{setBusy(false);}
 }
 function dateLabel(value:string|null|undefined){if(!value||Number.isNaN(Date.parse(value)))return 'Unknown';return new Intl.DateTimeFormat('en',{dateStyle:'medium',timeStyle:'short',timeZone:saved?.snapshot.zone??'UTC'}).format(new Date(value));}
 function configure(patch:Partial<Draft['config']>){setDraft(d=>d?{...d,config:{...d.config,...patch}}:d);setMessage('Unsaved changes');}
 function edit(id:string,patch:Partial<Draft['edits'][number]>){setDraft(d=>d?{...d,edits:d.edits.map(e=>e.id===id?{...e,...patch}:e)}:d);setMessage('Unsaved changes');}
 const parents=parentMap(saved?.snapshot.nodes??[]),edits=new Map(draft?.edits.map(e=>[e.id,e]));
 const nodes=saved?.snapshot.nodes??[];
 const byId=new Map(nodes.map(n=>[n.id,n]));
 const children=new Map<string,Node[]>(),creativeCounts=new Map<string,number>();
 for(const node of nodes){const parent=parents.get(node.id);if(parent){const list=children.get(parent)??[];list.push(node);children.set(parent,list);}if(node.creativeId)creativeCounts.set(node.creativeId,(creativeCounts.get(node.creativeId)??0)+1);}
 const visible=new Set(nodes.filter(n=>(!search||`${n.name} ${n.externalId} ${edits.get(n.id)?.name} ${edits.get(n.id)?.family}`.toLowerCase().includes(search.toLowerCase()))&&(!onlyChanges||edits.get(n.id)?.name!==n.name)).map(n=>n.id));
 for(const id of [...visible]){let parent=parents.get(id);while(parent){visible.add(parent);parent=parents.get(parent);}}
 function card(n:Node){const e=edits.get(n.id)!;const peerCount=n.creativeId?(creativeCounts.get(n.creativeId)??1)-1:0;
 return <article className={s.node} key={n.id} data-changed={e.name!==n.name}>
 <details open={expanded.has(n.id)} onToggle={event=>{const open=event.currentTarget.open;setExpanded(current=>{const next=new Set(current);if(open)next.add(n.id);else next.delete(n.id);return next;});}}><summary><span className={s.kind}>{n.level}</span> <strong>{n.name||'Unnamed'}</strong> {e.name!==n.name&&<span className={s.badge}> → {e.name}</span>}</summary>
 {expanded.has(n.id)&&<><div className={s.details}>
 {n.image&&<Image unoptimized src={n.image} width={96} height={96} alt={`Creative for ${n.name}`} loading="lazy" referrerPolicy="no-referrer" onError={event=>{event.currentTarget.hidden=true;}}/>}
 <p>Meta ID: {n.externalId} · Status: {n.status??'Unknown'}<br/>Created: {dateLabel(n.createdAt)}<br/>Performance summary coverage: {n.firstDelivery??'Unknown'} – {n.lastDelivery??'Unknown'}<br/>Verified launch date: unavailable · Recorded summary spend: {n.spend??'Unavailable'} {saved?.snapshot.currency}</p>
 <div className={s.compare}><div><small>Synchronized source name</small><p>{n.name||'Unnamed'}</p></div><label>Proposed name<input maxLength={255} value={e.name} onChange={event=>edit(n.id,{name:event.target.value})}/></label></div>
 <label><input type="checkbox" checked={e.selected} onChange={event=>edit(n.id,{selected:event.target.checked})}/> Include in proposal (does not authorize Meta changes)</label>
 {n.level==='ad'&&<><label>Creative family · your confirmed grouping<input value={e.family} maxLength={120} onChange={event=>edit(n.id,{family:event.target.value})}/></label>{peerCount>0&&<p>Suggestion: {peerCount} other ad(s) reference creative {n.creativeId}. A shared creative ID confirms reuse, not a shared concept. <button onClick={()=>edit(n.id,{family:`Creative ${n.creativeId}`})}>Use this family</button></p>}</>}
 <details><summary>Structured naming fields</summary><p>Leave unknown fields blank. Dates entered here are user-confirmed, not Meta-verified.</p><div className={s.fields}>{tokens.filter(token=>draft?.config[n.level].includes(`{${token}}`)).map(token=><label key={token}>{token}<input value={e.fields[token]??''} maxLength={255} onChange={event=>edit(n.id,{fields:{...e.fields,[token]:event.target.value}})}/></label>)}</div>
 <button onClick={()=>{try{const name=renderName(draft!.config[n.level],e.fields,draft!.config);if(!name)throw new Error('Fill in at least one naming field');edit(n.id,{name});}catch(err){setError((err as Error).message);}}}>Generate name from fields</button><p>Preview: {renderPreview(n,e.fields)}</p></details>
 </div>
 {!families&&<div className={s.children}>{(children.get(n.id)??[]).filter(child=>visible.has(child.id)).map(card)}</div>}
 </>}</details></article>;
 }
 function renderPreview(n:Node,values:Record<string,string>){try{return renderName(draft!.config[n.level],values,draft!.config)||'Add known fields';}catch{return 'Unknown template token';}}
 return <main className={s.page}><header className={s.header}><SpiderMascot state={busy?'scanning':error?'attention':'idle'} size={64}/><div><small>YOUR ACCOUNT, CLEARLY ORGANIZED</small><h1>Organize Account</h1><p>{accountName} · Naming workspace</p></div><Link href="/campaigns">Back to Campaigns</Link></header>
 <p className={s.notice}>Editing and saving proposals never changes Meta. Name execution requires a separate exact approval and enabled server gates. Restoration creates a new proposal and requires fresh approval.</p>
 {error&&<p role="alert" className={s.notice}>{error}</p>}<p role="status">{busy?'Reading or saving account organization…':message}</p>
 <fieldset disabled={busy} className={s.controls} aria-label="Organization controls">{!saved?<section className={s.panel}><h2>Start with your permission</h2><p>DeepVisor will inspect this account’s synchronized campaign, ad-set and ad names, IDs, hierarchy, creative references, creation dates and available performance summaries. We preserve the first snapshot and version your proposals. No new Meta requests or changes are made.</p><label><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/> I authorize inspection and preservation of this account’s organization.</label><div className={s.toolbar}><button disabled={!consent||busy} onClick={()=>run('inspect')}>Inspect account</button><button disabled={busy} onClick={()=>run('history')}>Open saved history</button></div></section>:draft&&<>
 <section className={s.panel}><h2>Organization workspace</h2><p>Original snapshot: {dateLabel(saved.original.capturedAt)}. Viewing source: {dateLabel(saved.snapshot.capturedAt)} · {nodes.length} entities · {saved.snapshot.zone}. This is a saved source snapshot. Approval separately checks current provider state. Missing parents appear at the root.</p>
 <p>Last successful synchronization: {dateLabel(saved.snapshot.syncedAt)}</p>{snapshotStale(saved.snapshot)&&<p role="alert" className={s.notice}>This source is stale or has unknown freshness. Drafts remain previews only. <Link href="/dashboard">Refresh account data</Link> before relying on these proposals.</p>}<label><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/> I authorize a new inspection of synchronized account data.</label><button disabled={!consent||busy} onClick={()=>run('inspect')}>Inspect latest synchronized data</button><details><summary>Naming templates & live preview</summary><p>Use | between optional fields; empty fields are omitted. Supported tokens: {tokens.map(t=>`{${t}}`).join(', ')}.</p>{levels.map(level=><label key={level}>{level}<input value={draft.config[level]} onChange={e=>configure({[level]:e.target.value})}/></label>)}<div className={s.fields}><label>Separator<input maxLength={8} value={draft.config.separator} onChange={e=>configure({separator:e.target.value})}/></label><label>Date format<select value={draft.config.dateFormat} onChange={e=>configure({dateFormat:e.target.value as typeof defaults.dateFormat})}>{['YYYY-MM-DD','DD/MM/YYYY','MM/DD/YYYY'].map(v=><option key={v}>{v}</option>)}</select></label></div><p>Campaign suggestions combine the saved objective and original campaign name. Ad-set and ad names stay unchanged until you provide confirmed fields. Open an entity to preview a generated name.</p></details>
 <div className={s.toolbar}><label>Search names, IDs or families<input value={search} onChange={e=>setSearch(e.target.value)}/></label><label><input type="checkbox" checked={onlyChanges} onChange={e=>setOnlyChanges(e.target.checked)}/> Renames only</label><label><input type="checkbox" checked={families} onChange={e=>setFamilies(e.target.checked)}/> Creative families</label></div>
 <p>{draft.edits.filter(e=>e.selected).length} selected · {draft.edits.filter(e=>e.name!==byId.get(e.id)?.name).length} proposed names changed</p><button disabled={busy||!nodes.length||sourceVersion==='original'} onClick={()=>run('save')}>Save new proposal version</button>
 <label>Version history (latest 100)<select value={sourceVersion} onChange={e=>{const id=e.target.value;if(id==='original'){setSourceVersion(id);setExpanded(new Set());setSaved({...saved,snapshot:saved.original});setDraft(propose(saved.original));setMessage('Viewing original snapshot. Inspect again to start a current proposal.');}else{void run('history',id);}}}><option value="" disabled>Choose a saved version</option><option value="original">Original baseline / fresh draft</option>{saved.versions.map(v=><option key={v.id} value={v.id}>Version {v.version} · {dateLabel(v.created_at)}</option>)}</select></label></section>
 <section aria-label="Account organization" className={s.tree}>{nodes.length===0?<p>No synchronized entities. Sync this account first.</p>:families?[...new Set(draft.edits.filter(e=>byId.get(e.id)?.level==='ad').map(e=>e.family||'Ungrouped'))].map(f=><details className={s.panel} key={f} open><summary>{f}</summary>{nodes.filter(n=>n.level==='ad'&&(edits.get(n.id)?.family||'Ungrouped')===f&&visible.has(n.id)).map(card)}</details>):nodes.filter(n=>!parents.get(n.id)&&visible.has(n.id)).map(card)}</section>
 <RenamePanel key={`${accountId}:${sourceVersion}`} accountId={accountId} versionId={sourceVersion} onRestoration={id=>run('history',id)}/>
 </>}</fieldset>
 </main>;
}
