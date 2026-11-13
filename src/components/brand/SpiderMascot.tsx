import type { CSSProperties } from 'react';
import { cn } from '@/lib/shared/utils/format';
import classes from './SpiderMascot.module.css';

export const spiderStates = ['idle', 'blink', 'walking', 'working', 'thinking', 'scanning', 'success', 'sleep', 'attention', 'wave', 'idea', 'dangle'] as const;
export type SpiderMascotState = typeof spiderStates[number];
/** Native artwork grid. Every placement renders it at a whole-number multiple of this. */
export const SPIDER_FRAME = 32;

export interface SpiderMascotProps {
  state?: SpiderMascotState;
  /** Square layout box in CSS pixels. The artwork is drawn at the largest whole-number
   * multiple of 32 that fits (min 1×), so 32/64/96/128 fill the box exactly. */
  size?: number;
  /** Surface the mascot sits on. Dark adds an outer rim so the ink outline stays visible. */
  tone?: 'light' | 'dark';
  framed?: boolean;
  /** Omit when adjacent text explains the state (decorative default). */
  label?: string;
  /** Explicit pause for hidden/inactive UI. Reduced motion also stops animation. */
  paused?: boolean;
  className?: string;
}

/** Pure function so tests (and callers that need layout math) share one rule. */
export function spiderScale(size: number) {
  const safe = Number.isFinite(size) && size > 0 ? size : 48;
  const scale = Math.max(1, Math.floor(safe / SPIDER_FRAME));
  return { box: Math.max(safe, SPIDER_FRAME * scale), scale };
}

/** CSS-only animation: no timers, effects, network actions, or fabricated task state. */
export default function SpiderMascot({ state = 'idle', size = 48, tone = 'light', framed = false, label, paused = false, className }: SpiderMascotProps) {
  const { box, scale } = spiderScale(size);
  const frame = SPIDER_FRAME * scale;
  const inset = Math.floor((box - frame) / 2);
  const accessibleLabel = label?.trim();
  const row = Math.max(0, spiderStates.indexOf(state));
  return <span className={cn(classes.mascot, classes[tone], framed && classes.framed, className)}
    data-spider-mascot="" data-state={state} data-tone={tone} data-paused={paused || undefined}
    role={accessibleLabel ? 'img' : undefined} aria-label={accessibleLabel || undefined}
    aria-hidden={accessibleLabel ? undefined : true}
    style={{ '--spider-size': `${box}px`, '--spider-frame': `${frame}px`, '--spider-inset': `${inset}px`, '--spider-row': `${-row * frame}px`, '--spider-rows': spiderStates.length } as CSSProperties}>
    <span key={state} className={classes.sprite} aria-hidden="true" />
  </span>;
}
