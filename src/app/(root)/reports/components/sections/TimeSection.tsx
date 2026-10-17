'use client';
import { useState } from 'react';
import type { ReportPayload } from '@/lib/server/reports/types';
import { buildTimeAnalysis, WEEKDAYS } from '@/lib/shared/reports/timeAnalysis';
import { PERFORMANCE_METRICS, performanceValueLabel, type PerformanceMetric } from '@/lib/shared/reports/performance';
import { coverageLabel } from '@/lib/shared/reports/coverage';
import classes from '../Workspace.module.css';
import styles from './Sections.module.css';
export function TimeSection({ payload }: { payload: ReportPayload }) {
  const [metric, setMetric] = useState<PerformanceMetric>('clicks');
  const [mode, setMode] = useState<'total' | 'average'>('average');
  const [dayChoice, setDay] = useState<number | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const cells = buildTimeAnalysis(payload.surface, metric, mode, payload.meta.currencyCode);
  const max = Math.max(0, ...cells.map(c => c.value ?? 0));
  const hasTimezone = Boolean(payload.meta.timezone);
  const day = dayChoice ?? cells.find(cell => cell.observations > 0)?.day ?? 0;
  const current = hasTimezone ? cells.find(c => c.key === selected) : undefined;
  const name = PERFORMANCE_METRICS.find(([key]) => key === metric)![1];
  const format = (v: number | null) => performanceValueLabel(v, metric, payload.meta.currencyCode);
  const caption = cells[0].isRatio ? 'Ratio from aggregated observed measurements' : mode === 'average' ? 'Average per observed date and hour' : 'Total across observed dates';
  return <section className={classes.panel} aria-labelledby="time-title">
    <div className={classes.panelHeader}><div><p className={classes.eyebrow}>Advertiser-local observations</p><h2 id="time-title">Time & day</h2></div><label className={classes.metricSelect}>Hourly metric<select value={metric} onChange={e => setMetric(e.target.value as PerformanceMetric)}>{PERFORMANCE_METRICS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label></div>
    <div className={styles.controls}><label>Calculation<select value={mode} onChange={e => setMode(e.target.value as 'total' | 'average')} disabled={cells[0].isRatio}><option value="average">Average per observed slot</option><option value="total">Observed total</option></select></label><label className={styles.mobileDay}>Day<select aria-label="Day" value={day} onChange={e => setDay(Number(e.target.value))}>{WEEKDAYS.map((label, i) => <option key={label} value={i}>{label}</option>)}</select></label></div>
    <p className={styles.coverage}>{payload.meta.timezone ?? 'Timezone unknown'} · {coverageLabel(payload.surface.coverage?.hourly)}</p>
    <p className={styles.hint}>{name} · {caption}. Darker cells mean larger values, not necessarily better performance. Unobserved slots are not zero.</p>
    {payload.surface.unavailableMetrics?.hourly?.[metric] && <p className={classes.notice}>{payload.surface.unavailableMetrics.hourly[metric]}</p>}
    {!payload.meta.timezone || !payload.surface.hourlyTrendExpanded.length ? <div className={classes.empty}><h3>{payload.surface.coverage?.hourly?.state === 'error' ? 'Hourly data could not be loaded' : 'Hourly observations unavailable'}</h3><p>{!payload.meta.timezone ? 'A verified advertiser timezone is required.' : 'No historical hourly records are available for this selection.'}</p></div> : <div className={styles.heatmap}>
      <div className={styles.hourAxis}><span />{Array.from({ length: 24 }, (_, h) => <span key={h}>{h}</span>)}</div>
      {WEEKDAYS.map((label, d) => <div key={label} className={`${styles.heatRow} ${day === d ? styles.selectedDay : ''}`}><strong>{label.slice(0, 3)}</strong>{cells.filter(c => c.day === d).map(cell => <button key={cell.key} type="button" className={styles.heatCell} aria-pressed={selected === cell.key}
        aria-label={`${label} ${cell.hour}:00, ${name}: ${format(cell.value)}, ${cell.observations} observed dates`}
        style={{ background: cell.value == null ? 'repeating-linear-gradient(135deg,#f2f3ef,#f2f3ef 4px,#e4e7df 4px,#e4e7df 5px)' : `rgba(19,131,83,${.10 + (max > 0 ? cell.value / max : 0) * .80})` }}
        onClick={() => setSelected(cell.key)}><span>{cell.hour}:00</span></button>)}</div>)}
    </div>}
    {current && <aside className={styles.inspector} aria-live="polite"><strong>{WEEKDAYS[current.day]} · {current.hour}:00–{current.hour}:59</strong><p>{name}: {format(current.value)} · {caption}</p><p>{current.observations} observed dates{current.dates.length ? `: ${current.dates.join(', ')}` : '. No measurements.'}</p><button type="button" onClick={() => setSelected(null)}>Clear selection</button></aside>}
    {hasTimezone && <details className={classes.dataDetails}><summary>Inspect hourly data</summary><div className={classes.tableScroll} role="region" tabIndex={0} aria-label="Hourly data"><table><caption>{name} · {caption}</caption><thead><tr><th scope="col">Day / hour</th><th scope="col">{name}</th><th scope="col">Observed dates</th></tr></thead><tbody>{cells.filter(c => c.observations).map(cell => <tr key={cell.key}><th scope="row">{WEEKDAYS[cell.day]} {cell.hour}:00</th><td>{format(cell.value)}</td><td>{cell.observations}</td></tr>)}</tbody></table></div></details>}
  </section>;
}
