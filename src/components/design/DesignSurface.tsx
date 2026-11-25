'use client';

import { useSyncExternalStore, type ReactNode } from 'react';
import classes from './DesignSurface.module.css';

/** Mantine writes the resolved scheme to <html>; reading it keeps SSR ('light') and hydration consistent. */
function readScheme(): 'light' | 'dark' {
  return document.documentElement.getAttribute('data-mantine-color-scheme') === 'dark' ? 'dark' : 'light';
}
function subscribe(notify: () => void) {
  const observer = new MutationObserver(notify);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-mantine-color-scheme'] });
  return () => observer.disconnect();
}
export const useColorScheme = () => useSyncExternalStore(subscribe, readScheme, () => 'light' as const);

/**
 * Theme is scoped to Stage B surfaces; it does not restyle unapproved pages.
 * The color scheme comes from Mantine, so these surfaces and the rest of the app always agree.
 */
export default function DesignSurface({ children }: { children: ReactNode; label?: string }) {
  const theme = useColorScheme();
  return <div className={classes.surface} data-dv-theme={theme}>
    {children}
  </div>;
}
