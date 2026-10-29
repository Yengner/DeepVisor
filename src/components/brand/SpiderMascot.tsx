import type { CSSProperties } from 'react';
import { cn } from '@/lib/shared/utils/format';
import classes from './SpiderMascot.module.css';

export const spiderStates = ['idle', 'blink', 'walking', 'working', 'thinking', 'scanning', 'success', 'sleep', 'attention'] as const;
export type SpiderMascotState = typeof spiderStates[number];
export interface SpiderMascotProps {
  state?: SpiderMascotState;
  /** Square layout box in CSS pixels. Prefer 32, 48, 64 or 96 for pixel artwork. */
  size?: number;
  /** Backplate only; the navy/cyan artwork never changes identity. */
  tone?: 'light' | 'dark';
  framed?: boolean;
  /** Omit when adjacent text explains the state (decorative default). */
  label?: string;
  /** Explicit pause for hidden/inactive UI. Reduced motion also stops animation. */
  paused?: boolean;
  className?: string;
}
/** CSS-only animation: no timers, effects, network actions, or fabricated task state. */
export default function SpiderMascot({ state = 'idle', size = 48, tone = 'light', framed = false, label, paused = false, className }: SpiderMascotProps) {
  const safeSize = Number.isFinite(size) && size > 0 ? size : 48;
  const accessibleLabel = label?.trim();
  const row = Math.max(0, spiderStates.indexOf(state));
  return <span className={cn(classes.mascot, classes[tone], framed && classes.framed, className)}
    data-spider-mascot="" data-state={state} data-paused={paused || undefined}
    role={accessibleLabel ? 'img' : undefined} aria-label={accessibleLabel || undefined}
    aria-hidden={accessibleLabel ? undefined : true}
    style={{ '--spider-size': `${safeSize}px`, '--spider-row': `${row * 100 / (spiderStates.length - 1)}%` } as CSSProperties}>
    <span key={state} className={classes.sprite} aria-hidden="true" />
  </span>;
}
