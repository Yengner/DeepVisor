'use client';
import { useState } from 'react';
import { IconCalendarStats, IconInfoCircle } from '@tabler/icons-react';
import type { ReportPayload } from '@/lib/server/reports/types';
import { BREAKDOWN_METRICS, buildSnapshotBreakdown, snapshotWindows, type AudienceView, type BreakdownMetric } from '@/lib/shared/reports/breakdowns';
import { coverageLabel } from '@/lib/shared/reports/coverage';
import { performanceValueLabel } from '@/lib/shared/reports/performance';
import { formatReportRange, formatSnapshotWindow, segmentLabel } from '@/lib/shared/reports/labels';
import { buildAudiencePyramid, type PyramidCell } from '@/lib/shared/reports/audience';
import classes from '../Workspace.module.css';
import styles from './Sections.module.css';

const dimensions = { audience: [['age_gender', 'Age & gender']], geography: [['country', 'Country'], ['region', 'Region'], ['dma', 'DMA']], delivery: [['publisher_platform', 'Platform'], ['platform_position', 'Placement'], ['impression_device', 'Device']] } as const;
const TITLES = { audience: 'Audience', geography: 'Geography', delivery: 'Placements & devices' } as const;
/** Additive metrics have a meaningful share of the total; ratios and unique reach do not. */
const ADDITIVE = new Set<BreakdownMetric>(['spend', 'impressions', 'clicks', 'conversion']);

export function BreakdownSection({ payload, section }: { payload: ReportPayload; section: keyof typeof dimensions }) {
  const [dimensionChoice, setDimension] = useState<string>('');
  const [metric, setMetric] = useState<BreakdownMetric>('spend');
  const [view, setView] = useState<AudienceView>('age_gender');
  const [windowChoice, setWindow] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const options = dimensions[section];
  const dimension = options.some(([key]) => key === dimensionChoice) ? dimensionChoice : options[0][0];
  const dimensionLabel = options.find(([key]) => key === dimension)?.[1] ?? '';
  const windows = snapshotWindows(payload.surface, dimension);
  const window = windows.includes(windowChoice) ? windowChoice : windows[0] ?? '';
  const model = buildSnapshotBreakdown(payload.surface, dimension, metric, window, view);
  const metricLabel = BREAKDOWN_METRICS.find(([key]) => key === metric)![1];
  const format = (value: number | null) => metric === 'reach' ? value == null ? 'Unavailable' : value.toLocaleString('en-US') : performanceValueLabel(value, metric, model.currency);
  const coverage = payload.surface.coverage?.[dimension];
  const items = model.items.map(item => ({ ...item, label: segmentLabel(dimension, item.label) }));
  const total = ADDITIVE.has(metric) ? items.reduce((sum, item) => sum + (item.value ?? 0), 0) : 0;
  const share = (value: number | null) => total > 0 && value != null ? (value > 0 && value / total < 0.005 ? '<1%' : `${Math.round(value / total * 100)}%`) : '';
  const selectedItem = items.find(item => item.key === selected);
  const windowText = window && window !== 'Coverage unknown' ? formatSnapshotWindow(window) : coverageLabel(coverage);
  const reportDates = formatReportRange(payload.query.dateFrom, payload.query.dateTo);
  const single = items.length === 1 && items[0].value != null;
  const [layout, setLayout] = useState<'chart' | 'list'>('chart');
  // Age × gender reads best as a butterfly: Female left, Male right, one row per age.
  const pyramid = section === 'audience' && view === 'age_gender' && window !== 'Coverage unknown' && items.length > 1
    ? buildAudiencePyramid(model.items) : null;
  const showPyramid = Boolean(pyramid) && layout === 'chart';
  const pyramidCell = (cell: PyramidCell | null, gender: 'Female' | 'Male', age: string) => {
    const width = cell?.value != null && pyramid!.max > 0 ? Math.max(cell.value > 0 ? 1 : 0, cell.value / pyramid!.max * 100) : 0;
    const name = `${age.replace('-', '–')} · ${gender}`;
    return cell ? <button type="button" className={styles.pyramidCell} data-gender={gender} aria-pressed={selected === cell.key}
      aria-label={`${name}: ${format(cell.value)}${share(cell.value) ? `, ${share(cell.value)} of total` : ''}`}
      onClick={() => setSelected(selected === cell.key ? null : cell.key)}>
      <span className={styles.pyramidValue}>{format(cell.value)}</span>
      <span className={styles.pyramidTrack} aria-hidden="true"><span style={{ width: `${width}%` }} /></span>
    </button> : <span className={styles.pyramidCell} data-gender={gender} data-empty="true" title={`${name}: no measurement`}><span className={styles.pyramidValue}>—</span><span className={styles.pyramidTrack} aria-hidden="true" /></span>;
  };

  return <section className={classes.panel} aria-labelledby={`${section}-title`}>
    <div className={classes.panelHeader}>
      <div><p className={classes.eyebrow}>{section === 'audience' ? 'Who saw your ads' : section === 'geography' ? 'Where your ads ran' : 'Where and on what'}</p><h2 id={`${section}-title`}>{TITLES[section]}</h2></div>
      <label className={classes.metricSelect}>Metric<select aria-label="Breakdown metric" value={metric} onChange={e => { setMetric(e.target.value as BreakdownMetric); setSelected(null); }}>{BREAKDOWN_METRICS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
    </div>
    <div className={styles.controls}>
      {options.length > 1 && <label>Break down by<select aria-label="Dimension" value={dimension} onChange={e => { setDimension(e.target.value); setSelected(null); }}>{options.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>}
      {section === 'audience' && <label>Group<select aria-label="Audience view" value={view} onChange={e => { setView(e.target.value as AudienceView); setSelected(null); }}><option value="age_gender">Age × gender</option><option value="age">Age</option><option value="gender">Gender</option></select></label>}
      {windows.length > 1 && <label>Measurement window<select value={window} onChange={e => { setWindow(e.target.value); setSelected(null); }}>{windows.map(w => <option key={w} value={w}>{formatSnapshotWindow(w)}</option>)}</select></label>}
    </div>
    <p className={styles.windowBadge}>
      <IconCalendarStats size={14} aria-hidden="true" />
      <span>Snapshot <strong>{windowText}</strong></span>
      {window !== 'Coverage unknown' && windowText !== reportDates ? <span>· not the report dates ({reportDates})</span> : null}
    </p>
    {window === 'Coverage unknown' && <p className={classes.notice} style={{ marginTop: 12 }}>Source dates are unknown. Measurements remain separate; totals across sources are not inferred.</p>}
    {model.reason && <p className={classes.notice} style={{ marginTop: 12 }}>{model.reason}</p>}

    {!payload.surface.isMeta || !items.length ? <div className={classes.empty}><h3>{!payload.surface.isMeta ? 'This breakdown is available for Meta only' : coverage?.state === 'error' ? 'Breakdown could not be loaded' : 'No measurements available'}</h3><p>{coverage?.state === 'error' ? 'Reload saved report data to retry.' : 'No source measurements are available for this dimension and scope.'}</p></div>
      : single ? <div className={styles.single}><p>{ADDITIVE.has(metric) ? `All measured ${metricLabel.toLowerCase()} — ${format(items[0].value)} — in ${items[0].label}` : `${items[0].label}: ${format(items[0].value)}`}</p><span>Only one {dimensionLabel.toLowerCase()} has measurements in this snapshot.</span></div>
      : <>
        <div className={styles.barHeading}><strong>{metricLabel} by {dimensionLabel.toLowerCase()}</strong><span>{items.length} segments{total > 0 ? ` · ${format(total)} total` : ''}
          {pyramid ? <span className={styles.layoutToggle} role="group" aria-label="Breakdown layout">
            <button type="button" aria-pressed={layout === 'chart'} onClick={() => setLayout('chart')}>Chart</button>
            <button type="button" aria-pressed={layout === 'list'} onClick={() => setLayout('list')}>List</button>
          </span> : null}</span></div>
        {showPyramid && pyramid ? <div className={styles.pyramid} role="group" aria-label={`${metricLabel} by age and gender`}>
          <div className={styles.pyramidHead} aria-hidden="true"><span data-gender="Female">Female</span><span>Age</span><span data-gender="Male">Male</span></div>
          {pyramid.rows.map(row => <div key={row.age} className={styles.pyramidRow}>
            {pyramidCell(row.Female, 'Female', row.age)}
            <span className={styles.pyramidAge}>{row.age.replace('-', '–')}</span>
            {pyramidCell(row.Male, 'Male', row.age)}
          </div>)}
          {pyramid.hasUnknown ? <p className={styles.pyramidNote}>Unknown gender: {pyramid.rows.filter(row => row.Unknown?.value != null).map(row => `${row.age.replace('-', '–')} ${format(row.Unknown!.value)}`).join(' · ')}</p> : null}
        </div> : <div className={styles.bars} aria-label={`${metricLabel} by segment`}>
          {items.map(item => <button type="button" key={item.key} className={styles.barRow} aria-pressed={selected === item.key} onClick={() => setSelected(selected === item.key ? null : item.key)}>
            <span className={styles.barLabel}>{item.label}</span>
            <span className={styles.barTrack} aria-hidden="true"><span style={{ width: `${item.proportion * 100}%` }} /></span>
            <span className={styles.barShare}>{share(item.value)}</span>
            <strong>{format(item.value)}</strong>
          </button>)}
        </div>}
        {selectedItem && <aside className={styles.inspector} aria-live="polite"><div><strong>{selectedItem.label}</strong><p>{metricLabel}: {format(selectedItem.value)}{share(selectedItem.value) ? ` (${share(selectedItem.value)} of total)` : ''} · {selectedItem.measurements} source measurement{selectedItem.measurements === 1 ? '' : 's'}</p></div><button type="button" onClick={() => setSelected(null)}>Clear selection</button></aside>}
      </>}

    {items.length > 0 && <details className={classes.dataDetails}><summary>Inspect breakdown data</summary><div className={classes.tableScroll} role="region" tabIndex={0} aria-label="Breakdown data"><table><caption>{metricLabel} · snapshot {windowText}</caption><thead><tr><th scope="col">Segment</th><th scope="col">{metricLabel}</th>{total > 0 && <th scope="col">Share</th>}<th scope="col">Measurements</th></tr></thead><tbody>{items.map(item => <tr key={item.key}><th scope="row">{item.label}</th><td>{format(item.value)}</td>{total > 0 && <td>{share(item.value)}</td>}<td>{item.measurements}</td></tr>)}</tbody></table></div></details>}
    <details className={classes.about}><summary><IconInfoCircle size={14} aria-hidden="true" />About this data</summary><ul>
      <li>Breakdowns are Meta snapshots with their own measurement window, independent of the report dates above.</li>
      {section === 'audience' ? <li>This is who received your ads and any attributed outcomes — not verified customer demographics.</li> : <li>Compare one dimension at a time. Delivery does not establish causal impact.</li>}
      {section === 'delivery' && <li>Placement and device sources include delivery only; results and cost per result are unavailable here.</li>}
      <li>Ratios (CTR, CPC, CPM, cost per result) are recomputed from totals, never averaged.</li>
    </ul></details>
  </section>;
}
