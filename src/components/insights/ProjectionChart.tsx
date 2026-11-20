'use client';
import { useId } from 'react';
import styles from './ProjectionChart.module.css';

/**
 * "If you run it again": expected conversations building up over the run, as a shaded range from
 * the owner's own best and worst weeks (low–high) with the middle drawn as a line. On open, the range
 * grows from day 1 to the last day and the line draws itself; reduced motion shows it finished.
 * Linear build-up is an illustration of the range, not a day-by-day prediction.
 */
export default function ProjectionChart({ low, high, days, dayLabel, rangeLabel, ariaLabel }: {
  low: number; high: number; days: number;
  dayLabel: (day: number) => string; rangeLabel: string; ariaLabel: string;
}) {
  const id = useId().replace(/:/g, '');
  const width = 320, height = 150, left = 8, right = 92, top = 18, bottom = 30;
  const plotW = width - left - right, plotH = height - top - bottom;
  const max = Math.max(high, 1);
  const x = (day: number) => left + (day / days) * plotW;
  const y = (value: number) => top + plotH - (value / max) * plotH;
  const mid = (low + high) / 2;
  const band = `M${x(0)},${y(0)} L${x(days)},${y(high)} L${x(days)},${y(low)} Z`;
  // First and last day only: every day's label collides on a phone, and the range is what matters.
  const ticks = [1, days];
  return (
    <figure className={styles.figure}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={ariaLabel} className={styles.svg}>
        <defs>
          <clipPath id={`grow-${id}`}><rect className={styles.reveal} x="0" y="0" width={width} height={height} /></clipPath>
        </defs>
        <line x1={left} x2={left + plotW} y1={top + plotH} y2={top + plotH} className={styles.axis} />
        <g clipPath={`url(#grow-${id})`}>
          <path d={band} className={styles.band} />
          <line x1={x(days)} x2={x(days)} y1={y(high)} y2={y(low)} className={styles.rangeEdge} />
        </g>
        <line x1={x(0)} y1={y(0)} x2={x(days)} y2={y(mid)} className={styles.line} pathLength={1} />
        <circle cx={x(days)} cy={y(mid)} r="5" className={styles.dot} />
        <text x={x(days) + 12} y={y(mid) + 6} className={styles.endLabel}>{rangeLabel}</text>
        {ticks.map(day => (
          <text key={day} x={x(day === 1 ? 0 : days)} y={height - 8} textAnchor={day === 1 ? 'start' : 'end'} className={styles.tick}>{dayLabel(day)}</text>
        ))}
      </svg>
    </figure>
  );
}
