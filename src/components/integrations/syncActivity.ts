'use client';
import { useSyncExternalStore } from 'react';

/**
 * "Meta data is being fetched right now", shared by the two refresh paths (the automatic visit
 * refresh in the shell and the manual Refresh button) and read by the dashboard numbers, which
 * show the working spider instead of a banner. Each source reports separately, so one finishing
 * does not hide the other.
 */
const EVENT = 'deepvisor:sync-activity';
const sources = new Set<string>();

export function setSyncActivity(source: string, active: boolean) {
  const had = sources.has(source);
  if (active) sources.add(source); else sources.delete(source);
  if (had !== active) window.dispatchEvent(new Event(EVENT));
}

function subscribe(notify: () => void) {
  window.addEventListener(EVENT, notify);
  return () => window.removeEventListener(EVENT, notify);
}

export function useSyncActivity() {
  return useSyncExternalStore(subscribe, () => sources.size > 0, () => false);
}
