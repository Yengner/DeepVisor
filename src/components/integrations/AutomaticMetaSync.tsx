'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type SyncState = { status: string; lastSuccessfulAt: string | null; revision?: string; resourceRefreshEnabled?: boolean };
/** A visible account lease requests shared work. Only pending jobs get frequent status polling. */
export default function AutomaticMetaSync({ accountId }: { accountId: string | null }) {
  const router = useRouter();
  const [state, setState] = useState<SyncState | null>(null);
  useEffect(() => {
    if (!accountId) return;
    const controller = new AbortController();
    let known: string | undefined, lastVisit = 0, checking = false;
    let timer: ReturnType<typeof setTimeout>;
    let nextDelay = 300000;
    const request = async (method: 'GET' | 'POST') => {
      const response = await fetch('/api/sync/automatic-refresh' + (method === 'GET' && known !== undefined ? `?knownRevision=${encodeURIComponent(known)}` : ''), {
        method, cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
        ...(method === 'POST' ? { headers: { 'Content-Type': 'application/json' }, body: '{}' } : {}),
      });
      if (!response.ok) throw new Error('Sync unavailable');
      return response.json();
    };
    const tick = async () => {
      if (controller.signal.aborted || checking || document.visibilityState === 'hidden') return;
      checking = true; clearTimeout(timer);
      try {
        const next = await request('GET') as SyncState;
        if (controller.signal.aborted) return;
        const revision = next.revision ?? next.lastSuccessfulAt ?? '';
        if (known !== undefined && revision !== known) {
          router.refresh();
          window.dispatchEvent(new CustomEvent('deepvisor:data-updated', { detail: { accountId } }));
        }
        known = revision; setState(next);
        let active = ['queued', 'running'].includes(next.status);
        if (Date.now() - lastVisit >= 300000) {
          const result = await request('POST'); lastVisit = Date.now();
          if (controller.signal.aborted) return;
          if (['queued', 'running'].includes(result.status)) { active = true; setState({ ...next, status: result.status }); }
          else if (['reauthentication_required', 'retry_limit', 'failure_backoff', 'initial_sync_required', 'timezone_unavailable'].includes(result.reason)) setState({ ...next, status: result.reason });
        }
        nextDelay = active ? 5000 : 300000;
      } catch { if (!controller.signal.aborted) setState(previous => ({ ...previous, status: 'unavailable', lastSuccessfulAt: previous?.lastSuccessfulAt ?? null })); nextDelay = 60000; }
      finally { checking = false; if (!controller.signal.aborted && document.visibilityState === 'visible') timer = setTimeout(tick, nextDelay); }
    };
    const visible = () => { clearTimeout(timer); if (document.visibilityState !== 'hidden') void tick(); };
    void tick();
    window.addEventListener('focus', visible); document.addEventListener('visibilitychange', visible);
    return () => { controller.abort(); clearTimeout(timer); window.removeEventListener('focus', visible); document.removeEventListener('visibilitychange', visible); };
  }, [accountId, router]);
  if (!accountId || !state || state.status === 'disconnected') return null;
  const message = state.status === 'queued' ? 'Meta refresh queued' : state.status === 'running' ? 'Refreshing Meta data…' :
    state.status === 'reauthentication_required' ? 'Reconnect Meta in Connections to resume synchronization.' :
    state.status === 'retry_limit' ? 'Automatic refresh paused after repeated failures. Check Connections.' :
    state.status === 'failure_backoff' ? 'Automatic refresh is waiting before retrying.' :
    state.status === 'initial_sync_required' ? 'Complete your initial account sync in Connections.' :
    state.status === 'timezone_unavailable' ? 'Account timezone unavailable. Check Connections.' :
    ['failed', 'partial'].includes(state.status) ? 'Last refresh did not complete. Check Connections.' :
    state.status === 'unavailable' ? 'Sync status unavailable.' : null;
  return message ? <div className="px-3 pt-2 text-xs text-slate-500" role="status" aria-live="polite">{message}</div> : null;
}
