'use client';
import { useState } from 'react';
import type { ReportPayload } from '@/lib/server/reports/types';
import { BREAKDOWN_METRICS, buildSnapshotBreakdown, snapshotWindows, type AudienceView, type BreakdownMetric } from '@/lib/shared/reports/breakdowns';
import { coverageLabel } from '@/lib/shared/reports/coverage';
import { performanceValueLabel } from '@/lib/shared/reports/performance';
import classes from '../Workspace.module.css';
import styles from './Sections.module.css';
const dimensions = { audience: [['age_gender', 'Age & gender']], geography: [['country', 'Country'], ['region', 'Region'], ['dma', 'DMA']], delivery: [['publisher_platform', 'Platform'], ['platform_position', 'Placement'], ['impression_device', 'Device']] } as const;
export function BreakdownSection({ payload, section }: { payload: ReportPayload; section: keyof typeof dimensions }) {
  const [dimensionChoice, setDimension] = useState<string>('');
  const [metric, setMetric] = useState<BreakdownMetric>('spend');
  const [view, setView] = useState<AudienceView>('age_gender');
  const [windowChoice, setWindow] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const options = dimensions[section];
  const dimension = options.some(([key]) => key === dimensionChoice) ? dimensionChoice : options[0][0];
  const windows = snapshotWindows(payload.surface, dimension);
  const window = windows.includes(windowChoice) ? windowChoice : windows[0] ?? '';
  const model = buildSnapshotBreakdown(payload.surface, dimension, metric, window, view);
  const metricLabel = BREAKDOWN_METRICS.find(([key]) => key === metric)![1];
  const format = (value: number | null) => metric === 'reach' ? value == null ? 'Unavailable' : value.toLocaleString('en-US') : performanceValueLabel(value, metric, model.currency);
  const coverage = payload.surface.coverage?.[dimension];
  const selectedItem = model.items.find(item => item.key === selected);
  return <section className={classes.panel} aria-labelledby={`${section}-title`}>
    <div className={classes.panelHeader}><div><p className={classes.eyebrow}>Snapshot analysis</p><h2 id={`${section}-title`}>{section === 'audience' ? 'Audience' : section === 'geography' ? 'Geography' : 'Placements & devices'}</h2></div>
      <label className={classes.metricSelect}>Breakdown metric<select value={metric} onChange={e => { setMetric(e.target.value as BreakdownMetric); setSelected(null); }}>{BREAKDOWN_METRICS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label></div>
    <div className={styles.controls}>
      {options.length > 1 && <label>Dimension<select value={dimension} onChange={e => { setDimension(e.target.value); setSelected(null); }}>{options.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>}
      {section === 'audience' && <label>Audience view<select value={view} onChange={e => { setView(e.target.value as AudienceView); setSelected(null); }}><option value="age_gender">Age × gender</option><option value="age">Age</option><option value="gender">Gender</option></select></label>}
      {windows.length > 1 && <label>Measurement window<select value={window} onChange={e => { setWindow(e.target.value); setSelected(null); }}>{windows.map(w => <option key={w}>{w}</option>)}</select></label>}
    </div>
    <p className={styles.coverage}>{window || coverageLabel(coverage)} · Snapshot dates are independent of the report period.</p>
    {window === 'Coverage unknown' && <p className={classes.notice}>Source dates are unknown. Measurements remain separate; totals across sources are not inferred.</p>}
    {model.reason && <p className={classes.notice}>{model.reason}</p>}
    <p className={styles.hint}>{section === 'audience' ? 'Advertising delivery and attributed outcomes, where supplied. These are not verified customer demographics.' : 'Compare one dimension at a time. Delivery does not establish causal impact.'}</p>
    {!payload.surface.isMeta || !model.items.length ? <div className={classes.empty}><h3>{!payload.surface.isMeta ? 'This breakdown is available for Meta only' : coverage?.state === 'error' ? 'Breakdown could not be loaded' : 'No measurements available'}</h3><p>{coverage?.state === 'error' ? 'Reload saved report data to retry.' : 'No source measurements are available for this dimension and scope.'}</p></div> : <>
      <div className={styles.barHeading}><strong>{metricLabel}</strong><span>{model.items.length} segments · {model.currency ?? 'Currency unknown'}</span></div>
      <div className={styles.bars} aria-label={`${metricLabel} by segment`}>
        {model.items.map(item => <button type="button" key={item.key} className={styles.barRow} aria-pressed={selected === item.key} onClick={() => setSelected(selected === item.key ? null : item.key)}>
          <span className={styles.barLabel}>{item.label}</span><span className={styles.barTrack} aria-hidden="true"><span style={{ width: `${item.proportion * 100}%` }} /></span><strong>{format(item.value)}</strong>
        </button>)}
      </div>
      {selectedItem && <aside className={styles.inspector} aria-live="polite"><strong>{selectedItem.label}</strong><p>{metricLabel}: {format(selectedItem.value)} · {selectedItem.measurements} source measurement{selectedItem.measurements === 1 ? '' : 's'}</p><button type="button" onClick={() => setSelected(null)}>Clear selection</button></aside>}
      <details className={classes.dataDetails}><summary>Inspect breakdown data</summary><div className={classes.tableScroll} role="region" tabIndex={0} aria-label="Breakdown data"><table><caption>{metricLabel} · {window}</caption><thead><tr><th scope="col">Segment</th><th scope="col">{metricLabel}</th><th scope="col">Measurements</th></tr></thead><tbody>{model.items.map(item => <tr key={item.key}><th scope="row">{item.label}</th><td>{format(item.value)}</td><td>{item.measurements}</td></tr>)}</tbody></table></div></details>
    </>}
  </section>;
}
