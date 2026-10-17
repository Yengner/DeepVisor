'use client';
import { useState } from 'react';
import type { ReportPayload } from '@/lib/server/reports/types';
import { PERFORMANCE_METRICS, type PerformanceMetric } from '@/lib/shared/reports/performance';
import { advertisingGroups, advertisingMetricValue, reportDrilldownHref, sortAdvertising } from '@/lib/shared/reports/advertising';
import { formatReportMetric } from '@/lib/shared/reports/metrics';
import PerformanceTable from '../cards/PerformanceTable';
import { CreativePreview } from './CreativePreview';
import classes from '../Workspace.module.css';
import styles from './Sections.module.css';
export function AdvertisingSection({ payload, isDemo }: { payload: ReportPayload; isDemo: boolean }) {
  const [groupKey, setGroup] = useState('selection');
  const [metric, setMetric] = useState<PerformanceMetric>('conversion');
  const [ascending, setAscending] = useState(false);
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(12);
  const groups = advertisingGroups(payload), group = groups.find(g => g.key === groupKey) ?? groups[0];
  const rows = sortAdvertising(group.rows, metric, ascending, search, payload.meta.currencyCode);
  const max = Math.max(0, ...rows.map(row => advertisingMetricValue(row, metric, payload.meta.currencyCode) ?? 0));
  const label = PERFORMANCE_METRICS.find(([key]) => key === metric)![1];
  return <section className={classes.panel} aria-labelledby="advertising-title"><div className={classes.panelHeader}><div><p className={classes.eyebrow}>Campaign → Ad set → Ad</p><h2 id="advertising-title">Advertising</h2></div><label className={classes.metricSelect}>Ranking metric<select value={metric} onChange={e => setMetric(e.target.value as PerformanceMetric)}>{PERFORMANCE_METRICS.map(([key, name]) => <option value={key} key={key}>{name}</option>)}</select></label></div>
    <div className={styles.controls}><label>Entity scope<select value={group.key} onChange={e => { setGroup(e.target.value); setLimit(12); }}>{groups.map(g => <option key={g.key} value={g.key}>{g.label}</option>)}</select></label><label>Sort order<select value={ascending ? 'asc' : 'desc'} onChange={e => setAscending(e.target.value === 'asc')}><option value="desc">Highest first</option><option value="asc">Lowest first</option></select></label><label>Find advertising<input type="search" value={search} onChange={e => { setSearch(e.target.value); setLimit(12); }} placeholder="Name or parent" /></label></div>
    <p className={styles.coverage}>{group.context} · {payload.query.dateFrom} – {payload.query.dateTo} · {rows.length} entities</p>
    <p className={styles.hint}>Ordered by {label.toLowerCase()}; no combined performance score. Recorded status is separate from selected-period results. Account context can include entities outside a narrower selection.</p>
    {!rows.length ? <div className={classes.empty}><h3>No advertising matches this view</h3><p>Change the scope or clear the search.</p></div> : <div className={styles.entityList}>{rows.slice(0, limit).map(row => {
      const value = advertisingMetricValue(row, metric, payload.meta.currencyCode), href = reportDrilldownHref(row.drilldownHref, isDemo);
      return <article key={`${row.level}:${row.id}`} className={styles.entity}>
        {row.level === 'ad' && <CreativePreview key={JSON.stringify(row.creativePreview)} row={row} />}
        <div className={styles.entityBody}><small>{row.level === 'adset' ? 'Ad set' : row.level} · Recorded status: {row.status ?? 'Unknown'}</small><h3>{row.name}</h3><p>{[row.secondaryContext, row.primaryContext].filter(Boolean).join(' / ')}</p>{row.creativeContext && <p>{row.creativeContext}</p>}
          <div className={styles.entityMetric}><strong>{formatReportMetric(row, metric, payload.meta.currencyCode)}</strong><span>{label}</span></div>
          <div className={styles.barTrack} aria-hidden="true"><span style={{ width: `${max > 0 && value != null ? value / max * 100 : 0}%` }} /></div>
          {href && <a className={styles.drilldown} href={href}>Explore {row.drilldownLabel?.toLowerCase() === 'open' ? row.name : row.drilldownLabel ?? row.name} →</a>}
        </div></article>;
    })}</div>}
    {rows.length > limit && <button type="button" className={styles.more} onClick={() => setLimit(n => n + 24)}>Show more ({rows.length - limit} remaining)</button>}
    <details className={classes.dataDetails}><summary>Detailed advertising breakdown</summary><PerformanceTable title={group.label} rows={rows.map(row => ({ ...row, drilldownHref: reportDrilldownHref(row.drilldownHref, isDemo) }))} currencyCode={payload.meta.currencyCode} /></details>
  </section>;
}
