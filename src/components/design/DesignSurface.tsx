'use client';

import { useSyncExternalStore, type ReactNode } from 'react';
import { useMantineColorScheme } from '@mantine/core';
import classes from './DesignSurface.module.css';

const key = 'deepvisor-design-theme';
function readTheme() {
  try {
    const value = localStorage.getItem(key);
    if (value === 'light' || value === 'dark') return value;
  } catch { /* Storage may be disabled; system preference still works. */ }
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
function subscribe(notify: () => void) {
  const media = matchMedia('(prefers-color-scheme: dark)');
  window.addEventListener('storage', notify);
  window.addEventListener('dv-theme', notify);
  media.addEventListener('change', notify);
  return () => {
    window.removeEventListener('storage', notify);
    window.removeEventListener('dv-theme', notify);
    media.removeEventListener('change', notify);
  };
}

/** Theme is scoped to Stage B surfaces; it does not restyle unapproved pages. */
export default function DesignSurface({ children }: { children: ReactNode; label?: string }) {
  const storedTheme = useSyncExternalStore(subscribe, readTheme, () => 'light');
  const theme = storedTheme;
  return <div className={classes.surface} data-dv-theme={theme}>
    {children}
  </div>;
}

export function AppearanceSettings() {
  const theme = useSyncExternalStore(subscribe, readTheme, () => 'light');
  const { setColorScheme } = useMantineColorScheme();
  return <section aria-label="Appearance"><h2>Appearance</h2><label>Color theme <select value={theme} onChange={event => {
    const next = event.target.value === 'dark' ? 'dark' : 'light';
    try { localStorage.setItem(key, next); } catch { /* Mantine still applies this session's choice. */ }
    setColorScheme(next); window.dispatchEvent(new Event('dv-theme'));
  }}><option value="light">Light</option><option value="dark">Dark</option></select></label></section>;
}
