'use client';
import { useState } from 'react';
import { IconInfoCircle } from '@tabler/icons-react';
import type { ReportPayload } from '@/lib/server/reports/types';
import { buildTimeAnalysis } from '@/lib/shared/reports/timeAnalysis';
import { PERFORMANCE_METRICS, type PerformanceMetric } from '@/lib/shared/reports/performance';
import { useReportFormat } from '../useReportFormat';
import { MIN_HOUR_OBSERVATIONS } from '@/lib/shared/reports/highlights';
import { formatHourShort } from '@/lib/shared/reports/labels';
import classes from '../Workspace.module.css';
import styles from './Sections.module.css';

const UNOBSERVED = 'repeating-linear-gradient(135deg, var(--dv-surface-muted), var(--dv-surface-muted) 3px, var(--dv-border) 3px, var(--dv-border) 4px)';
/** Cost metrics: a larger value is worse, so the callout names the cheapest slot instead. */
const LOWER_IS_BETTER = new Set<PerformanceMetric>(['costPerResult', 'cpc', 'cpm']);

export function TimeSection({ payload }: { payload: ReportPayload }) {
  const f = useReportFormat(), t = f.t;
  const WEEKDAYS = Array.from({ length: 7 }, (_, i) => f.weekday(i));
  const formatHour = f.hour;
  const [metric, setMetric] = useState<PerformanceMetric>('clicks');
  const [mode, setMode] = useState<'total' | 'average'>('average');
  const [dayChoice, setDay] = useState<number | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const cells = buildTimeAnalysis(payload.surface, metric, mode, payload.meta.currencyCode);
  const max = Math.max(0, ...cells.map(c => c.value ?? 0));
  const hasTimezone = Boolean(payload.meta.timezone);
  const day = dayChoice ?? cells.find(cell => cell.observations > 0)?.day ?? 0;
  const current = hasTimezone ? cells.find(c => c.key === selected) : undefined;
  const name = f.metric(metric);
  const format = (v: number | null) => f.perf(v, metric, payload.meta.currencyCode);
  const caption = t(cells[0].isRatio ? 'time.captionRatio' : mode === 'average' ? 'time.captionAverage' : 'time.captionTotal');
  const showGrid = hasTimezone && payload.surface.hourlyTrendExpanded.length > 0;
  // Same evidence bar as the Overview: a slot needs several observed dates before it is called out.
  const eligible = cells.filter(c => c.value != null && c.observations >= MIN_HOUR_OBSERVATIONS && (LOWER_IS_BETTER.has(metric) || c.value > 0));
  const peak = eligible.length ? eligible.reduce((best, c) => (LOWER_IS_BETTER.has(metric) ? c.value! < best.value! : c.value! > best.value!) ? c : best) : null;

  return <section className={classes.panel} aria-labelledby="time-title">
    <div className={classes.panelHeader}>
      <div><h2 id="time-title">{t('time.title')}</h2></div>
      <label className={classes.metricSelect}>{t('time.metric')}<select aria-label={t('time.metricAria')} value={metric} onChange={e => setMetric(e.target.value as PerformanceMetric)}>{PERFORMANCE_METRICS.map(([key]) => <option key={key} value={key}>{f.metric(key)}</option>)}</select></label>
    </div>
    <div className={styles.controls}>
      <label>{t('time.calc')}<select value={mode} onChange={e => setMode(e.target.value as 'total' | 'average')} disabled={cells[0].isRatio}><option value="average">{t('time.average')}</option><option value="total">{t('time.total')}</option></select></label>
      <label className={styles.mobileDay}>{t('time.day')}<select aria-label={t('time.day')} value={day} onChange={e => setDay(Number(e.target.value))}>{WEEKDAYS.map((label, i) => <option key={label} value={i}>{label}</option>)}</select></label>
    </div>
    {payload.surface.unavailableMetrics?.hourly?.[metric] && <p className={classes.notice}>{payload.surface.unavailableMetrics.hourly[metric]}</p>}
    {!showGrid ? <div className={classes.empty}><h3>{t(payload.surface.coverage?.hourly?.state === 'error' ? 'time.loadFailed' : 'time.unavailable')}</h3><p>{t(!payload.meta.timezone ? 'time.needsZone' : 'time.noRecords')}</p></div> : <>
      <p className={styles.peak}>
        {peak ? <><strong>{t('time.peak', { low: LOWER_IS_BETTER.has(metric) ? 'yes' : 'no', metric: name.toLowerCase(), day: WEEKDAYS[peak.day], from: formatHour(peak.hour), to: formatHour(peak.hour + 1) })}</strong><span>{t('time.peakValue', { value: format(peak.value), count: peak.observations })}</span></>
          : <span>{t('time.noPeak', { min: MIN_HOUR_OBSERVATIONS, metric: name.toLowerCase() })}</span>}
      </p>
      <div className={styles.heatmap}>
        <div className={styles.hourAxis} aria-hidden="true"><span />{Array.from({ length: 24 }, (_, h) => <span key={h}>{h % 3 === 0 ? formatHourShort(h) : ''}</span>)}</div>
        {WEEKDAYS.map((label, d) => <div key={label} className={`${styles.heatRow} ${day === d ? styles.selectedDay : ''}`}><strong>{f.weekday(d, 'short')}</strong>{cells.filter(c => c.day === d).map(cell => <button key={cell.key} type="button" className={styles.heatCell} aria-pressed={selected === cell.key}
          aria-label={t('time.cellAria', { day: label, hour: formatHour(cell.hour), metric: name, value: format(cell.value), count: cell.observations })}
          title={`${label} ${formatHour(cell.hour)} · ${format(cell.value)}`}
          style={{ background: cell.value == null ? UNOBSERVED : `color-mix(in srgb, var(--dv-primary) ${Math.round(10 + (max > 0 ? cell.value / max : 0) * 85)}%, var(--dv-surface))` }}
          onClick={() => setSelected(cell.key)}><span>{formatHour(cell.hour)}</span></button>)}</div>)}
      </div>
      <div className={styles.legend} aria-hidden="true"><span>{t('time.less')}</span><span className={styles.legendRamp} /><span>{t('time.more')}</span><span className={styles.legendNone} style={{ marginLeft: 12 }} /><span>{t('time.noData')}</span></div>
    </>}
    {current && <aside className={styles.inspector} aria-live="polite"><div><strong>{WEEKDAYS[current.day]} · {formatHour(current.hour)}–{formatHour(current.hour + 1)}</strong><p>{name}: {format(current.value)} · {caption}</p><p>{current.dates.length ? t('time.observedList', { count: current.observations, dates: current.dates.map(d => f.day(d, false)).join(', ') }) : t('time.noMeasurements', { count: current.observations })}</p></div><button type="button" onClick={() => setSelected(null)}>{t('time.clear')}</button></aside>}
    {hasTimezone && <details className={classes.dataDetails}><summary>{t('time.inspect')}</summary><div className={classes.tableScroll} role="region" tabIndex={0} aria-label={t('time.data')}><table><caption>{name} · {caption}</caption><thead><tr><th scope="col">{t('time.dayHour')}</th><th scope="col">{name}</th><th scope="col">{t('time.observedDates')}</th></tr></thead><tbody>{cells.filter(c => c.observations).map(cell => <tr key={cell.key}><th scope="row">{WEEKDAYS[cell.day]} {formatHour(cell.hour)}</th><td>{format(cell.value)}</td><td>{cell.observations}</td></tr>)}</tbody></table></div></details>}
    <details className={classes.about}><summary><IconInfoCircle size={14} aria-hidden="true" />{t('breakdown.about')}</summary><ul>
      <li>{t('time.aboutLine', { metric: name, caption, zone: payload.meta.timezone ?? t('time.unknownZone') })}</li>
      <li>{t('time.aboutCells')}</li>
      <li>{t('time.aboutCoverage', { coverage: f.coverageLabel(payload.surface.coverage?.hourly) })}</li>
    </ul></details>
  </section>;
}
