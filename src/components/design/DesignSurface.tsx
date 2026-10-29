'use client';

import { useState, useSyncExternalStore, type ReactNode } from 'react';
import { Moon, Sun } from 'lucide-react';
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
export default function DesignSurface({ children, label }: { children: ReactNode; label: string }) {
  const storedTheme = useSyncExternalStore(subscribe, readTheme, () => 'light');
  const [temporaryTheme, setTemporaryTheme] = useState<'light' | 'dark' | null>(null);
  const theme = temporaryTheme ?? storedTheme;
  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem(key, next); setTemporaryTheme(null); } catch { setTemporaryTheme(next); }
    window.dispatchEvent(new Event('dv-theme'));
  }
  return <div className={classes.surface} data-dv-theme={theme}>
    <div className={classes.toolbar}>
      <span className={classes.label}>{label}</span>
      <button type="button" className={classes.toggle} onClick={toggle} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>
        {theme === 'dark' ? <Sun size={15} aria-hidden /> : <Moon size={15} aria-hidden />}
        {theme === 'dark' ? 'Light' : 'Dark'}
      </button>
    </div>
    {children}
  </div>;
}
