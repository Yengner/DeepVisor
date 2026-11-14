'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/client/supabase/browser';

/**
 * Live "something changed" signal for the selected ad account (private Supabase Realtime topic,
 * members only). The message carries no advertising data: it only tells the page to re-read
 * through its normal authorized APIs, by firing the same `deepvisor:data-updated` event the
 * polling path uses. Polling stays in place, so a missed or unavailable signal costs nothing.
 */
export function useAccountSignals(accountId: string | null, enabled: boolean) {
  const router = useRouter();
  useEffect(() => {
    if (!enabled || !accountId) return;
    const supabase = createClient();
    let closed = false, timer: ReturnType<typeof setTimeout> | undefined, pendingData = false;
    const flush = () => {
      timer = undefined;
      if (closed) return;
      // Hidden tabs catch up on focus through the existing visibility handlers.
      if (document.visibilityState !== 'visible') return;
      if (pendingData) router.refresh();
      pendingData = false;
      window.dispatchEvent(new CustomEvent('deepvisor:data-updated', { detail: { accountId, live: true } }));
    };
    const channel = supabase.channel(`account:${accountId}`, { config: { private: true } })
      .on('broadcast', { event: 'changed' }, message => {
        if ((message.payload as { kind?: string } | undefined)?.kind === 'data') pendingData = true;
        // A burst of changes (one sync publishes several) becomes one refresh.
        if (!timer) timer = setTimeout(flush, 1200);
      });
    void supabase.realtime.setAuth().then(() => { if (!closed) channel.subscribe(); }).catch(() => undefined);
    return () => { closed = true; if (timer) clearTimeout(timer); void supabase.removeChannel(channel); };
  }, [accountId, enabled, router]);
}
