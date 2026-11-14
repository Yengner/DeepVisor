'use client';
import { useState } from 'react';
import { IconInfoCircle } from '@tabler/icons-react';
import type { ReportPayload } from '@/lib/server/reports/types';
import { buildTimeAnalysis, WEEKDAYS } from '@/lib/shared/reports/timeAnalysis';
import { PERFORMANCE_METRICS, performanceValueLabel, type PerformanceMetric } from '@/lib/shared/reports/performance';
import { coverageLabel } from '@/lib/shared/reports/coverage';
import { MIN_HOUR_OBSERVATIONS } from '@/lib/shared/reports/highlights';
import { formatHour, formatHourShort, formatTimezone } from '@/lib/shared/reports/labels';
import classes from '../Workspace.module.css';
import styles from './Sections.module.css';

const UNOBSERVED = 'repeating-linear-gradient(135deg, var(--dv-surface-muted), var(--dv-surface-muted) 3px, var(--dv-border) 3px, var(--dv-border) 4px)';
/** Cost metrics: a larger value is worse, so the callout names the cheapest slot instead. */
const LOWER_IS_BETTER = new Set<PerformanceMetric>(['costPerResult', 'cpc', 'cpm']);

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
  const showGrid = hasTimezone && payload.surface.hourlyTrendExpanded.length > 0;
  // Same evidence bar as the Overview: a slot needs several observed dates before it is called out.
  const eligible = cells.filter(c => c.value != null && c.observations >= MIN_HOUR_OBSERVATIONS && (LOWER_IS_BETTER.has(metric) || c.value > 0));
  const peak = eligible.length ? eligible.reduce((best, c) => (LOWER_IS_BETTER.has(metric) ? c.value! < best.value! : c.value! > best.value!) ? c : best) : null;

  return <section className={classes.panel} aria-labelledby="time-title">
    <div className={classes.panelHeader}>
      <div><p className={classes.eyebrow}>When your ads perform · {formatTimezone(payload.meta.timezone)}</p><h2 id="time-title">Time & day</h2></div>
      <label className={classes.metricSelect}>Metric<select aria-label="Hourly metric" value={metric} onChange={e => setMetric(e.target.value as PerformanceMetric)}>{PERFORMANCE_METRICS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
    </div>
    <div className={styles.controls}>
      <label>Calculation<select value={mode} onChange={e => setMode(e.target.value as 'total' | 'average')} disabled={cells[0].isRatio}><option value="average">Average per observed slot</option><option value="total">Observed total</option></select></label>
      <label className={styles.mobileDay}>Day<select aria-label="Day" value={day} onChange={e => setDay(Number(e.target.value))}>{WEEKDAYS.map((label, i) => <option key={label} value={i}>{label}</option>)}</select></label>
    </div>
    {payload.surface.unavailableMetrics?.hourly?.[metric] && <p className={classes.notice}>{payload.surface.unavailableMetrics.hourly[metric]}</p>}
    {!showGrid ? <div className={classes.empty}><h3>{payload.surface.coverage?.hourly?.state === 'error' ? 'Hourly data could not be loaded' : 'Hourly observations unavailable'}</h3><p>{!payload.meta.timezone ? 'A verified advertiser timezone is required.' : 'No historical hourly records are available for this selection.'}</p></div> : <>
      <p className={styles.peak}>
        {peak ? <><strong>{LOWER_IS_BETTER.has(metric) ? 'Lowest' : 'Highest'} {name.toLowerCase()}: {WEEKDAYS[peak.day]}s, {formatHour(peak.hour)}–{formatHour(peak.hour + 1)}</strong><span>{format(peak.value)} · {peak.observations} observed dates</span></>
          : <span>No hour has {MIN_HOUR_OBSERVATIONS}+ observed dates for {name.toLowerCase()} yet, so none is called out.</span>}
      </p>
      <div className={styles.heatmap}>
        <div className={styles.hourAxis} aria-hidden="true"><span />{Array.from({ length: 24 }, (_, h) => <span key={h}>{h % 3 === 0 ? formatHourShort(h) : ''}</span>)}</div>
        {WEEKDAYS.map((label, d) => <div key={label} className={`${styles.heatRow} ${day === d ? styles.selectedDay : ''}`}><strong>{label.slice(0, 3)}</strong>{cells.filter(c => c.day === d).map(cell => <button key={cell.key} type="button" className={styles.heatCell} aria-pressed={selected === cell.key}
          aria-label={`${label} ${cell.hour}:00, ${name}: ${format(cell.value)}, ${cell.observations} observed dates`}
          title={`${label} ${formatHour(cell.hour)} · ${format(cell.value)}`}
          style={{ background: cell.value == null ? UNOBSERVED : `color-mix(in srgb, var(--dv-primary) ${Math.round(10 + (max > 0 ? cell.value / max : 0) * 85)}%, var(--dv-surface))` }}
          onClick={() => setSelected(cell.key)}><span>{formatHour(cell.hour)}</span></button>)}</div>)}
      </div>
      <div className={styles.legend} aria-hidden="true"><span>Less</span><span className={styles.legendRamp} /><span>More</span><span className={styles.legendNone} style={{ marginLeft: 12 }} /><span>No data</span></div>
    </>}
    {current && <aside className={styles.inspector} aria-live="polite"><div><strong>{WEEKDAYS[current.day]} · {formatHour(current.hour)}–{formatHour(current.hour + 1)}</strong><p>{name}: {format(current.value)} · {caption}</p><p>{current.observations} observed dates{current.dates.length ? `: ${current.dates.join(', ')}` : '. No measurements.'}</p></div><button type="button" onClick={() => setSelected(null)}>Clear selection</button></aside>}
    {hasTimezone && <details className={classes.dataDetails}><summary>Inspect hourly data</summary><div className={classes.tableScroll} role="region" tabIndex={0} aria-label="Hourly data"><table><caption>{name} · {caption}</caption><thead><tr><th scope="col">Day / hour</th><th scope="col">{name}</th><th scope="col">Observed dates</th></tr></thead><tbody>{cells.filter(c => c.observations).map(cell => <tr key={cell.key}><th scope="row">{WEEKDAYS[cell.day]} {cell.hour}:00</th><td>{format(cell.value)}</td><td>{cell.observations}</td></tr>)}</tbody></table></div></details>}
    <details className={classes.about}><summary><IconInfoCircle size={14} aria-hidden="true" />About this data</summary><ul>
      <li>{name} · {caption}. Hours are in the account&apos;s timezone ({payload.meta.timezone ?? 'unknown'}).</li>
      <li>Darker cells mean larger values, not necessarily better performance. Striped cells have no observations — they are not zero.</li>
      <li>Coverage: {coverageLabel(payload.surface.coverage?.hourly)}.</li>
    </ul></details>
  </section>;
}
