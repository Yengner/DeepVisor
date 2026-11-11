'use client';
import { useState, type ReactNode } from 'react';
import { CircleAlert, Info, TriangleAlert, X } from 'lucide-react';
import classes from './StatusBanner.module.css';

/**
 * Page-level status line. Tone follows docs/DEVELOPMENT_GUIDE.md › Status colors:
 * `info` = expected/in progress, `gap` = data may be stale or missing, `action` = owner must act.
 */
export type StatusTone = 'info' | 'gap' | 'action';
const icons = { info: Info, gap: TriangleAlert, action: CircleAlert } as const;

export default function StatusBanner({ tone, children, dismissible = tone !== 'action' }: { tone: StatusTone; children: ReactNode; dismissible?: boolean }) {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  const Icon = icons[tone];
  return (
    <div className={classes.banner} data-tone={tone} role="status" aria-live="polite">
      <Icon size={16} aria-hidden="true" className={classes.icon} />
      <span className={classes.message}>{children}</span>
      {dismissible && (
        <button type="button" className={classes.dismiss} onClick={() => setHidden(true)} aria-label="Dismiss">
          <X size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
