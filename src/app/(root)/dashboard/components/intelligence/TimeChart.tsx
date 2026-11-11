'use client';
import { useRef, useState } from 'react';
import { buildTimeAnalysis, WEEKDAYS, type HourlyObservation } from '@/lib/shared/reports/timeAnalysis';
import { formatHourLongLabel, hourlyIntensity } from '@/lib/shared/reports/hourly';
import { performanceValueLabel, type PerformanceMetric } from '@/lib/shared/reports/performance';
import styles from './Intelligence.module.css';

const METRICS = [['spend', 'Spend'], ['impressions', 'Impressions'], ['clicks', 'Clicks'], ['ctr', 'CTR'], ['cpc', 'Cost per click'], ['conversion', 'Results'], ['costPerResult', 'Cost per result']] as const;
export default function TimeChart({ rows, currency, today }: { rows: HourlyObservation[]; currency: string | null; today: boolean }) {
  const [metric, setMetric] = useState<PerformanceMetric>('spend');
  const [mode, setMode] = useState<'total' | 'average'>('total');
  const [selected, setSelected] = useState<string | null>(null);
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const cells = buildTimeAnalysis({ hourlyTrendExpanded: rows }, metric, mode, currency);
  const todayDay = cells.find(c => c.observations)?.day;
  const displayed = today ? cells.filter(c => c.day === todayDay) : cells;
  const maximum = Math.max(0, ...displayed.map(c => c.value ?? 0));
  const current = displayed.find(c => c.key === selected) ?? displayed.find(c => c.observations) ?? displayed[0];
  const format = (value: number | null) => performanceValueLabel(value, metric, currency);
  const resultsAvailable = rows.some(row => row.results !== null);
  const costPerResultAvailable = Boolean(currency && currency !== 'MIXED') &&
    rows.some(row => row.spend !== null && row.results !== null && row.results > 0);
  const label = METRICS.find(([key]) => key === metric)![1];
  const calculation = cells[0].isRatio ? 'Ratio of observed totals' : mode === 'average' && !today ? 'Average per observed date' : 'Total across observed dates';
  return <>
    <div className={styles.controls}>
      <label className={styles.select}>
        <span className={styles.srOnly}>Time metric</span>
        <select aria-label="Time metric" value={metric} onChange={e => setMetric(e.target.value as PerformanceMetric)}>
          {METRICS.map(([key, text]) => {
            const unavailable = (key === 'conversion' && !resultsAvailable)
              || (key === 'costPerResult' && !costPerResultAvailable);
            return <option key={key} value={key} disabled={unavailable}>{text}{unavailable ? ' · unavailable' : ''}</option>;
          })}
        </select>
      </label>
      {!today && (
        <div className={styles.segmented} role="group" aria-label="Time calculation">
          {(['total', 'average'] as const).map(value => (
            <button key={value} type="button" disabled={cells[0].isRatio} aria-pressed={mode === value} onClick={() => setMode(value)}>
              {value === 'total' ? 'Total' : 'Daily average'}
            </button>
          ))}
        </div>
      )}
    </div>
    <div className={styles.legend}><span>{today ? 'Hourly activity' : calculation}</span><small>{label}{currency && (metric === 'spend' || metric === 'cpc' || metric === 'costPerResult') ? ` · ${currency}` : ''}</small></div>
    <div className={styles.heatScroll} role="region" aria-label={today ? 'Hourly activity chart' : 'Weekday by hour heatmap'} tabIndex={0}>
      {today ? <div className={styles.todayChart}><div className={styles.barAxis}><span>{format(maximum)}</span><span>0</span></div><div className={styles.hourBars}>{displayed.map((cell, index) => <button type="button" key={cell.key} className={styles.hourBar} data-missing={cell.value == null} data-zero={cell.value === 0} aria-label={`${formatHourLongLabel(cell.hour)}: ${format(cell.value)}`} aria-pressed={current?.key === cell.key} onFocus={() => setSelected(cell.key)} onMouseEnter={() => setSelected(cell.key)} onClick={() => setSelected(cell.key)}><span style={{ height: cell.value == null ? '100%' : `${maximum ? cell.value / maximum * 100 : 0}%` }} /><small>{index % 4 === 0 ? formatHourLongLabel(cell.hour) : ''}</small></button>)}</div></div> : <div className={styles.heatGrid}>
        <span />{Array.from({ length: 24 }, (_, hour) => <span className={styles.hourLabel} key={hour}>{hour % 4 === 0 ? formatHourLongLabel(hour) : ''}</span>)}
        {WEEKDAYS.map((day, dayIndex) => <div className={styles.heatRow} key={day}><span className={styles.dayLabel}>{day.slice(0, 3)}</span>{cells.filter(c => c.day === dayIndex).map(cell => {
          const index = cell.day * 24 + cell.hour;
          const intensity = hourlyIntensity(cell.value, maximum);
          return <button type="button" key={cell.key} ref={el => { refs.current[index] = el; }} className={styles.heatCell} data-missing={cell.value == null} data-zero={cell.value === 0} tabIndex={current?.key === cell.key ? 0 : -1} aria-pressed={current?.key === cell.key}
            aria-label={`${day}, ${formatHourLongLabel(cell.hour)}. ${label}: ${format(cell.value)}. ${cell.observations} observed dates.`}
            style={cell.value != null ? { background: `color-mix(in srgb, var(--chart-line) ${12 + intensity * 88}%, var(--ui-panel))` } : undefined}
            onMouseEnter={() => setSelected(cell.key)} onFocus={() => setSelected(cell.key)} onClick={() => setSelected(cell.key)}
            onKeyDown={e => { const offset = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 24, ArrowUp: -24 }[e.key]; if (offset != null) { e.preventDefault(); refs.current[Math.max(0, Math.min(167, index + offset))]?.focus(); } }} />;
        })}</div>)}
      </div>}
    </div>
    <div className={styles.scale}><span><i className={styles.missingSwatch} />Missing</span><span><i className={styles.zeroSwatch} />Zero</span>{!today && <span className={styles.gradientLegend}>Low <i /> High</span>}</div>
    <div className={styles.inspector} aria-live="polite" aria-atomic="true"><div><strong>{current ? `${today ? 'Today' : WEEKDAYS[current.day]} · ${formatHourLongLabel(current.hour)}` : 'No observations'}</strong><span>{current ? `${current.observations} observed date${current.observations === 1 ? '' : 's'}` : ''}</span></div><div><b>{format(current?.value ?? null)}</b><span>{label}{cells[0].isRatio ? ' · aggregate ratio' : mode === 'average' && !today ? ' · daily average' : ' · total'}</span></div></div>
    <p className={styles.note}>{today ? 'Bar height shows' : 'Darker means more'} {label.toLowerCase()}, not better performance. {today ? 'Unreported hours remain missing.' : 'Use arrow keys or select a cell to inspect.'}</p>
  </>;
}
