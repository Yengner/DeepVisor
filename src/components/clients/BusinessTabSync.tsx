'use client';

import { useEffect } from 'react';
import { BUSINESS_CHANNEL } from './useSwitchBusiness';

/**
 * A tab left on the previous business reloads as soon as another tab switches, so a form can't be
 * saved into a business other than the one on screen.
 */
export default function BusinessTabSync({ businessId }: { businessId: string }) {
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel(BUSINESS_CHANNEL);
    channel.onmessage = (event) => { if (event.data !== businessId) window.location.assign('/dashboard'); };
    return () => channel.close();
  }, [businessId]);
  return null;
}
