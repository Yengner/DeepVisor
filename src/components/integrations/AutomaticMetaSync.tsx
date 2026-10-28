'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

type SyncState = { status: string; lastSuccessfulAt: string | null };
/** Mounted only in the authenticated shell. Polling observes work; it never performs Meta writes. */
export default function AutomaticMetaSync({ accountId }: { accountId: string | null }) {
  const router=useRouter();
  const pathname=usePathname();
  const [state,setState]=useState<SyncState|null>(null);
  useEffect(()=>{
    if(!accountId)return;
    const controller=new AbortController();let known:string|null|undefined;
    let timer:ReturnType<typeof setTimeout>;let checking=false;
    const request=async(method:'GET'|'POST')=>{
      const response=await fetch('/api/sync/automatic-refresh'+(method==='GET'?`?knownSuccessfulAt=${encodeURIComponent(known??'')}`:''),{
        method,cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(15000)]),
        ...(method==='POST'?{headers:{'Content-Type':'application/json'},body:'{}'}:{}),
      });
      if(!response.ok)throw new Error('Sync unavailable');return response.json();
    };
    const observe=async()=>{
      const next=await request('GET') as SyncState;
      if(controller.signal.aborted)return;
      if(known!==undefined&&next.lastSuccessfulAt&&known!==next.lastSuccessfulAt)router.refresh();
      known=next.lastSuccessfulAt;setState(next);return next;
    };
    const visit=async()=>{
      if(checking||document.visibilityState==='hidden')return;checking=true;
      try{await observe();const result=await request('POST');
        if(!controller.signal.aborted&&['queued','running'].includes(result.status))setState(previous=>({...previous,lastSuccessfulAt:previous?.lastSuccessfulAt??null,status:result.status}));
        if(!controller.signal.aborted&&['reauthentication_required','retry_limit','failure_backoff','initial_sync_required','timezone_unavailable'].includes(result.reason))
          setState(previous=>({lastSuccessfulAt:previous?.lastSuccessfulAt??null,status:result.reason}));
      }catch{if(!controller.signal.aborted)setState(previous=>({status:'unavailable',lastSuccessfulAt:previous?.lastSuccessfulAt??null}));}
      finally{checking=false;}
    };
    const poll=async()=>{
      let active=false;
      try{if(document.visibilityState!=='hidden'){const next=await observe();active=['queued','running'].includes(next?.status??'');}}
      catch{if(!controller.signal.aborted)setState(previous=>({status:'unavailable',lastSuccessfulAt:previous?.lastSuccessfulAt??null}));}
      if(!controller.signal.aborted)timer=setTimeout(poll,active?5000:30000);
    };
    void visit();timer=setTimeout(poll,5000);
    window.addEventListener('focus',visit);document.addEventListener('visibilitychange',visit);
    return()=>{controller.abort();clearTimeout(timer);window.removeEventListener('focus',visit);document.removeEventListener('visibilitychange',visit);};
  },[accountId,router,pathname]);
  if(!accountId||!state||state.status==='disconnected')return null;
  const message=state.status==='queued'?'Meta refresh queued':state.status==='running'?'Refreshing Meta data…':
    state.status==='reauthentication_required'?'Reconnect Meta in Connections to resume synchronization.':
    state.status==='retry_limit'?'Automatic refresh paused after repeated failures. Check Connections.':
    state.status==='failure_backoff'?'Automatic refresh is waiting before retrying.':
    state.status==='initial_sync_required'?'Complete your initial account sync in Connections.':
    state.status==='timezone_unavailable'?'Account timezone unavailable. Check Connections.':
    ['failed','partial'].includes(state.status)?'Last refresh did not complete. Check Connections.':state.status==='unavailable'?'Sync status unavailable.':
    state.lastSuccessfulAt?'Meta synchronization':'No successful synchronization yet';
  return <div className="px-3 pt-2 text-xs text-slate-500" role="status" aria-live="polite">
    {message}{state.lastSuccessfulAt&&<> · Last successful sync <time dateTime={state.lastSuccessfulAt}>{new Date(state.lastSuccessfulAt).toLocaleString()}</time></>}
  </div>;
}
