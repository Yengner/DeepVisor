'use client';
import { useState } from 'react';
import { IconCalendarStats, IconInfoCircle } from '@tabler/icons-react';
import type { ReportPayload } from '@/lib/server/reports/types';
import { BREAKDOWN_METRICS, buildSnapshotBreakdown, snapshotWindows, type AudienceView, type BreakdownMetric } from '@/lib/shared/reports/breakdowns';
import { useReportFormat } from '../useReportFormat';
import { buildAudiencePyramid, type PyramidCell } from '@/lib/shared/reports/audience';
import classes from '../Workspace.module.css';
import styles from './Sections.module.css';

const dimensions = { audience: ['age_gender'], geography: ['country', 'region', 'dma'], delivery: ['publisher_platform', 'platform_position', 'impression_device'] } as const;
/** Additive metrics have a meaningful share of the total; ratios and unique reach do not. */
const ADDITIVE = new Set<BreakdownMetric>(['spend', 'impressions', 'clicks', 'conversion']);

export function BreakdownSection({ payload, section }: { payload: ReportPayload; section: keyof typeof dimensions }) {
  const f = useReportFormat(), t = f.t;
  const [dimensionChoice, setDimension] = useState<string>('');
  const [metric, setMetric] = useState<BreakdownMetric>('spend');
  const [view, setView] = useState<AudienceView>('age_gender');
  const [windowChoice, setWindow] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const options = dimensions[section];
  const dimension: string = (options as readonly string[]).includes(dimensionChoice) ? dimensionChoice : options[0];
  const dimensionLabel = t.has(`breakdown.dimension.${dimension}` as never) ? t(`breakdown.dimension.${dimension}` as never) : dimension;
  const windows = snapshotWindows(payload.surface, dimension);
  const window = windows.includes(windowChoice) ? windowChoice : windows[0] ?? '';
  const model = buildSnapshotBreakdown(payload.surface, dimension, metric, window, view);
  const metricLabel = f.metric(metric);
  const format = (value: number | null) => metric === 'reach' ? value == null ? t('unavailable') : f.number(value, 0) : f.perf(value, metric, model.currency);
  const coverage = payload.surface.coverage?.[dimension];
  // Age × gender and Facebook/Instagram follow the report dates when saved daily data covers them.
  const periodBased = coverage?.basis === 'period';
  const items = model.items.map(item => ({ ...item, label: f.segment(dimension, item.label) }));
  const total = ADDITIVE.has(metric) ? items.reduce((sum, item) => sum + (item.value ?? 0), 0) : 0;
  const share = (value: number | null) => total > 0 && value != null ? (value > 0 && value / total < 0.005 ? '<1%' : `${Math.round(value / total * 100)}%`) : '';
  const selectedItem = items.find(item => item.key === selected);
  const windowText = window && window !== 'Coverage unknown' ? f.snapshot(window) : f.coverageLabel(coverage);
  const reportDates = f.range(payload.query.dateFrom, payload.query.dateTo);
  const single = items.length === 1 && items[0].value != null;
  const [layout, setLayout] = useState<'chart' | 'list'>('chart');
  // Age × gender reads best as a butterfly: Female left, Male right, one row per age.
  const pyramid = section === 'audience' && view === 'age_gender' && window !== 'Coverage unknown' && items.length > 1
    ? buildAudiencePyramid(model.items) : null;
  const showPyramid = Boolean(pyramid) && layout === 'chart';
  const genderName = (gender: 'Female' | 'Male') => t(`gender.${gender === 'Female' ? 'female' : 'male'}`);
  const pyramidCell = (cell: PyramidCell | null, gender: 'Female' | 'Male', age: string) => {
    const width = cell?.value != null && pyramid!.max > 0 ? Math.max(cell.value > 0 ? 1 : 0, cell.value / pyramid!.max * 100) : 0;
    const name = `${age.replace('-', '–')} · ${genderName(gender)}`;
    return cell ? <button type="button" className={styles.pyramidCell} data-gender={gender} aria-pressed={selected === cell.key}
      aria-label={`${name}: ${format(cell.value)}${share(cell.value) ? `, ${t('breakdown.ofTotal', { share: share(cell.value) })}` : ''}`}
      onClick={() => setSelected(selected === cell.key ? null : cell.key)}>
      <span className={styles.pyramidValue}>{format(cell.value)}</span>
      <span className={styles.pyramidTrack} aria-hidden="true"><span style={{ width: `${width}%` }} /></span>
    </button> : <span className={styles.pyramidCell} data-gender={gender} data-empty="true" title={t('breakdown.noMeasurement', { name })}><span className={styles.pyramidValue}>—</span><span className={styles.pyramidTrack} aria-hidden="true" /></span>;
  };

  return <section className={classes.panel} aria-labelledby={`${section}-title`}>
    <div className={classes.panelHeader}>
      <div><h2 id={`${section}-title`}>{t(`breakdown.title.${section}`)}</h2></div>
      <label className={classes.metricSelect}>{t('breakdown.metric')}<select aria-label={t('breakdown.metricAria')} value={metric} onChange={e => { setMetric(e.target.value as BreakdownMetric); setSelected(null); }}>{BREAKDOWN_METRICS.map(([key]) => <option key={key} value={key}>{f.metric(key)}</option>)}</select></label>
    </div>
    <div className={styles.controls}>
      {options.length > 1 && <label>{t('breakdown.by')}<select aria-label={t('breakdown.byAria')} value={dimension} onChange={e => { setDimension(e.target.value); setSelected(null); }}>{options.map(key => <option key={key} value={key}>{t(`breakdown.dimension.${key}`)}</option>)}</select></label>}
      {section === 'audience' && <label>{t('breakdown.group')}<select aria-label={t('breakdown.groupAria')} value={view} onChange={e => { setView(e.target.value as AudienceView); setSelected(null); }}><option value="age_gender">{t('breakdown.view.age_gender')}</option><option value="age">{t('breakdown.view.age')}</option><option value="gender">{t('breakdown.view.gender')}</option></select></label>}
      {windows.length > 1 && <label>{t('breakdown.window')}<select value={window} onChange={e => { setWindow(e.target.value); setSelected(null); }}>{windows.map(w => <option key={w} value={w}>{f.snapshot(w)}</option>)}</select></label>}
    </div>
    <p className={styles.windowBadge}>
      <IconCalendarStats size={14} aria-hidden="true" />
      {periodBased ? <>
        <span>{t.rich('breakdown.selected', { window: windowText, b: chunks => <strong>{chunks}</strong> })}</span>
        {coverage?.state === 'partial' ? <span>{t('breakdown.partial', { observed: coverage.observedDays ?? 0, expected: coverage.expectedDays ?? 0, dates: reportDates })}</span> : null}
      </> : <>
        <span>{t.rich('breakdown.snapshot', { window: windowText, b: chunks => <strong>{chunks}</strong> })}</span>
        {window !== 'Coverage unknown' && windowText !== reportDates ? <span>{t('breakdown.notSelected', { dates: reportDates })}</span> : null}
      </>}
    </p>
    {window === 'Coverage unknown' && <p className={classes.notice} style={{ marginTop: 12 }}>{t('breakdown.unknownSource')}</p>}
    {model.reason && <p className={classes.notice} style={{ marginTop: 12 }}>{model.reason}</p>}

    {!payload.surface.isMeta || !items.length ? <div className={classes.empty}><h3>{!payload.surface.isMeta ? t('breakdown.metaOnly') : coverage?.state === 'error' ? t('breakdown.loadFailed') : t('breakdown.none')}</h3><p>{coverage?.state === 'error' ? t('breakdown.retry') : t('breakdown.noneBody')}</p></div>
      : single ? <div className={styles.single}><p>{ADDITIVE.has(metric) ? t('breakdown.allMeasured', { metric: metricLabel.toLowerCase(), value: format(items[0].value), where: items[0].label }) : `${items[0].label}: ${format(items[0].value)}`}</p><span>{t('breakdown.onlyOne', { dimension: dimensionLabel.toLowerCase() })}</span></div>
      : <>
        <div className={styles.barHeading}><strong>{t('breakdown.heading', { metric: metricLabel, dimension: dimensionLabel.toLowerCase() })}</strong><span>{t('breakdown.segments', { count: items.length })}{total > 0 ? t('breakdown.segmentsTotal', { total: format(total) }) : ''}
          {pyramid ? <span className={styles.layoutToggle} role="group" aria-label={t('breakdown.layout')}>
            <button type="button" aria-pressed={layout === 'chart'} onClick={() => setLayout('chart')}>{t('breakdown.chart')}</button>
            <button type="button" aria-pressed={layout === 'list'} onClick={() => setLayout('list')}>{t('breakdown.list')}</button>
          </span> : null}</span></div>
        {showPyramid && pyramid ? <div className={styles.pyramid} role="group" aria-label={t('breakdown.byAgeGender', { metric: metricLabel })}>
          <div className={styles.pyramidHead} aria-hidden="true"><span data-gender="Female">{genderName('Female')}</span><span>{t('breakdown.age')}</span><span data-gender="Male">{genderName('Male')}</span></div>
          {pyramid.rows.map(row => <div key={row.age} className={styles.pyramidRow}>
            {pyramidCell(row.Female, 'Female', row.age)}
            <span className={styles.pyramidAge}>{row.age.replace('-', '–')}</span>
            {pyramidCell(row.Male, 'Male', row.age)}
          </div>)}
          {pyramid.hasUnknown ? <p className={styles.pyramidNote}>{t('breakdown.unknownGender', { values: '' })}{pyramid.rows.filter(row => row.Unknown?.value != null).map(row => `${row.age.replace('-', '–')} ${format(row.Unknown!.value)}`).join(' · ')}</p> : null}
        </div> : <div className={styles.bars} aria-label={t('breakdown.bySegment', { metric: metricLabel })}>
          {items.map(item => <button type="button" key={item.key} className={styles.barRow} aria-pressed={selected === item.key} onClick={() => setSelected(selected === item.key ? null : item.key)}>
            <span className={styles.barLabel}>{item.label}</span>
            <span className={styles.barTrack} aria-hidden="true"><span style={{ width: `${item.proportion * 100}%` }} /></span>
            <span className={styles.barShare}>{share(item.value)}</span>
            <strong>{format(item.value)}</strong>
          </button>)}
        </div>}
        {selectedItem && <aside className={styles.inspector} aria-live="polite"><div><strong>{selectedItem.label}</strong><p>{t('breakdown.inspector', { metric: metricLabel, value: format(selectedItem.value), share: share(selectedItem.value) ? t('breakdown.shareTotal', { share: share(selectedItem.value) }) : '', count: selectedItem.measurements })}</p></div><button type="button" onClick={() => setSelected(null)}>{t('breakdown.clear')}</button></aside>}
      </>}

    {items.length > 0 && <details className={classes.dataDetails}><summary>{t('breakdown.inspect')}</summary><div className={classes.tableScroll} role="region" tabIndex={0} aria-label={t('breakdown.data')}><table><caption>{t(periodBased ? 'breakdown.captionSelected' : 'breakdown.captionSnapshot', { metric: metricLabel, window: windowText })}</caption><thead><tr><th scope="col">{t('breakdown.segment')}</th><th scope="col">{metricLabel}</th>{total > 0 && <th scope="col">{t('breakdown.share')}</th>}<th scope="col">{t('breakdown.measurements')}</th></tr></thead><tbody>{items.map(item => <tr key={item.key}><th scope="row">{item.label}</th><td>{format(item.value)}</td>{total > 0 && <td>{share(item.value)}</td>}<td>{item.measurements}</td></tr>)}</tbody></table></div></details>}
    <details className={classes.about}><summary><IconInfoCircle size={14} aria-hidden="true" />{t('breakdown.about')}</summary><ul>
      <li>{t(periodBased ? 'breakdown.aboutPeriod' : 'breakdown.aboutSnapshot')}</li>
      <li>{t(section === 'audience' ? 'breakdown.aboutAudience' : 'breakdown.aboutCompare')}</li>
      {section === 'delivery' && <li>{t('breakdown.aboutDelivery')}</li>}
      <li>{t('breakdown.aboutRatios')}</li>
    </ul></details>
  </section>;
}
