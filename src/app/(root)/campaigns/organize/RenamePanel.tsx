'use client';
import {useState} from 'react';
import SpiderMascot from '@/components/brand/SpiderMascot';
import {renameAction} from './actions';
import type {previewRename,renameHistory} from '@/lib/server/organizer/renaming';
import type {RenameEvent} from '@/lib/server/advertising/organizer/execute';
import s from './Organizer.module.css';
type Preview=Awaited<ReturnType<typeof previewRename>>;
type History=Awaited<ReturnType<typeof renameHistory>>;
export default function RenamePanel({accountId,versionId,onRestoration}:{accountId:string;versionId:string;onRestoration:(id:string)=>Promise<void>}){
 const [preview,setPreview]=useState<Preview|null>(null),[history,setHistory]=useState<History|null>(null),[approval,setApproval]=useState(''),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[status,setStatus]=useState('');
 async function run(op:'history'|'preview'|'approve'|'execute'|'reconcile'|'restore',id?:string){
  setBusy(true);setError('');setStatus('');
  try{
   const result=await renameAction(accountId,op,{id:id??(op==='preview'?versionId:op==='approve'?preview?.id:approval),fingerprint:preview?.fingerprint,confirmed});
   if(result.error)throw new Error(result.error);
   if(op==='history')setHistory(result.data as History);
   if(op==='preview'){setPreview(result.data as Preview);setApproval('');setConfirmed(false);}
   if(op==='approve'){setApproval(result.data as string);setStatus('Exact names approved. Execution has not started.');}
   if(op==='restore'){await onRestoration(result.data as string);return;}
   if(op==='execute'||op==='reconcile'){setStatus('Request finished. Check each entity’s verified outcome below.');setApproval('');setPreview(null);setConfirmed(false);}
   if(['execute','reconcile','approve'].includes(op)){const h=await renameAction(accountId,'history');if(h.error)throw new Error(h.error);setHistory(h.data as History);}
  }catch(e){setError(e instanceof Error?e.message:'Operation failed');}finally{setBusy(false);}
 }
 return <section className={s.panel} aria-label="Approved naming changes"><div className={s.header}><SpiderMascot state={busy?'working':error?'attention':'idle'} size={32}/><h2>Approve & verify names</h2></div>
 <p>Only saved, selected name changes are eligible, up to five per approval. Families stay in DeepVisor. Live writes require separate server authorization and are disabled by default.</p>
 <p>Preview reads current provider state. Approval and execution are separate steps. An external edit creates a conflict; it is never silently overwritten.</p>
 {error&&<p role="alert">{error}</p>}<p role="status">{busy?'Processing your request…':status}</p>
 <fieldset disabled={busy} className={s.controls}>
 <button onClick={()=>run('history')}>Load operation history</button>{history&&!history.enabled&&<p>Execution is disabled for this account.</p>}
 <button disabled={!versionId||versionId==='original'||(history!==null&&(!history.canReview||!history.enabled))} onClick={()=>run('preview')}>Review exact saved changes</button>
 {preview&&<div className={s.notice}><h3>{preview.simulated?'SIMULATED · No Meta writes':'Meta name changes'} · Exact approval preview</h3><p>Expires {new Date(preview.expires_at).toLocaleString()}</p>{preview.changes.map(c=><div key={c.entityId} className={s.compare}><p>{c.before.level} · {c.before.id}<br/>Before: {c.before.name}</p><p>After: <strong>{c.afterName}</strong></p></div>)}
 <label><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/> I approve only these exact name changes, and understand that other fields will not be changed.</label>
 <button disabled={!confirmed||!!approval} onClick={()=>run('approve')}>Approve exact names</button>{approval&&<button onClick={()=>run('execute')}>{preview.simulated?'Execute simulated renames':'Execute approved renames'}</button>}</div>}
 {history&&<div><h3>Organization change history</h3>{history.runs.length===0&&<p>No executions recorded.</p>}{history.runs.map(r=>{
 const a=history.approvals.find(a=>a.id===r.approval_id);const p=history.previews.find(p=>p.id===a?.preview_id);
 const rows=history.events.filter(e=>e.run_id===r.id);const latest=new Map<string,RenameEvent>();for(const row of rows){const e=row.event as RenameEvent;latest.set(e.entityId,e);}
 const verified=[...latest.values()].filter(e=>['verified','reconciled'].includes(e.kind)).length;const total=p?.changes.length??0;
 return <article className={s.node} key={r.id}><h4>{p?.simulated?'Simulated':'Meta'} run · {new Date(r.created_at).toLocaleString()}</h4><p>{verified}/{total} names verified. {r.active?'Unresolved or in progress — business execution lock retained.':verified===total?'Every approved name was verified.':'Partial or blocked result; inspect the individual outcomes.'}</p>
 <p>Run {r.id} · Actor {r.actor_id}</p>{[...latest.values()].map(e=><div key={e.entityId} className={s.compare}><p>{e.before.level} · {e.before.id}<br/>{e.before.name} → {e.afterName}</p><p>{e.kind} · Readback: {e.after?.name??'Unavailable'}{e.code&&<><br/>{e.code}</>}</p></div>)}
 <details><summary>Immutable audit events ({rows.length})</summary>{rows.map((row,i)=><p key={i}>{row.created_at} · {(row.event as RenameEvent).kind} · actor {row.actor_id}</p>)}</details>
 {r.active?<button disabled={!history.canReview} onClick={()=>run('reconcile',r.id)}>Reconcile by reading current state</button>:verified>0&&<button disabled={!history.canReview} onClick={()=>run('restore',r.id)}>Preview restoration proposal</button>}</article>;
 })}
 {history.approvals.filter(a=>!history.runs.some(r=>r.approval_id===a.id)).map(a=>{const p=history.previews.find(p=>p.id===a.preview_id);return <article key={a.id} className={s.node}><h4>{p?.simulated?'Simulated · ':''}Saved approval</h4><p>{a.id} · Expires {p?new Date(p.expires_at).toLocaleString():'Unknown'}</p>{p?.changes.map((c:Preview['changes'][number])=><p key={c.entityId}>{c.before.level} · {c.before.id}<br/>{c.before.name} → {c.afterName}</p>)}<button disabled={!history.canReview||!history.enabled||!p||Date.parse(p.expires_at)<=Date.now()} onClick={()=>run('execute',a.id)}>Execute saved approval</button></article>;})}
 </div>}
 </fieldset></section>;
}
