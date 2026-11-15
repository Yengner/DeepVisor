'use client';
import { useState } from 'react';
import { IconChevronRight, IconInfoCircle, IconSpeakerphone, IconStack2 } from '@tabler/icons-react';
import type { ReportPayload } from '@/lib/server/reports/types';
import { PERFORMANCE_METRICS, type PerformanceMetric } from '@/lib/shared/reports/performance';
import { advertisingGroups, advertisingMetricValue, reportDrilldownHref, sortAdvertising } from '@/lib/shared/reports/advertising';
import { formatReportMetric } from '@/lib/shared/reports/metrics';
import { formatReportRange, humanizeContext } from '@/lib/shared/reports/labels';
import StatusBadge from '@/components/product/StatusBadge';
import PerformanceTable from '../cards/PerformanceTable';
import { CreativePreview } from './CreativePreview';
import classes from '../Workspace.module.css';
import styles from './Sections.module.css';

const LEVEL = { campaign: 'Campaign', adset: 'Ad set', ad: 'Ad' } as const;

export function AdvertisingSection({ payload, isDemo }: { payload: ReportPayload; isDemo: boolean }) {
  const [groupKey, setGroup] = useState('selection');
  const [metric, setMetric] = useState<PerformanceMetric>('conversion');
  const [ascending, setAscending] = useState(false);
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(12);
  const currency = payload.meta.currencyCode;
  const groups = advertisingGroups(payload), group = groups.find(g => g.key === groupKey) ?? groups[0];
  const rows = sortAdvertising(group.rows, metric, ascending, search, currency);
  const max = Math.max(0, ...rows.map(row => advertisingMetricValue(row, metric, currency) ?? 0));
  const label = PERFORMANCE_METRICS.find(([key]) => key === metric)![1];

  return <section className={classes.panel} aria-labelledby="advertising-title">
    <div className={classes.panelHeader}>
      <div><p className={classes.eyebrow}>Campaign → Ad set → Ad</p><h2 id="advertising-title">Advertising</h2></div>
      <label className={classes.metricSelect}>Rank by<select aria-label="Ranking metric" value={metric} onChange={e => setMetric(e.target.value as PerformanceMetric)}>{PERFORMANCE_METRICS.map(([key, name]) => <option value={key} key={key}>{name}</option>)}</select></label>
    </div>
    <div className={styles.controls}>
      <label>Show<select aria-label="Entity scope" value={group.key} onChange={e => { setGroup(e.target.value); setLimit(12); }}>{groups.map(g => <option key={g.key} value={g.key}>{g.label}</option>)}</select></label>
      <label>Order<select aria-label="Sort order" value={ascending ? 'asc' : 'desc'} onChange={e => setAscending(e.target.value === 'asc')}><option value="desc">Highest first</option><option value="asc">Lowest first</option></select></label>
      <label className={styles.search}>Search<input type="search" value={search} onChange={e => { setSearch(e.target.value); setLimit(12); }} placeholder="Name, campaign or ad set" /></label>
    </div>
    <p className={styles.coverage}>{rows.length} {rows.length === 1 ? 'item' : 'items'} · {group.context} · {formatReportRange(payload.query.dateFrom, payload.query.dateTo)}</p>

    {!rows.length ? <div className={classes.empty}><h3>No advertising matches this view</h3><p>Change what is shown or clear the search.</p></div> : <ol className={styles.entityList} style={{ listStyle: 'none', padding: 0 }}>{rows.slice(0, limit).map((row, index) => {
      const value = advertisingMetricValue(row, metric, currency), href = reportDrilldownHref(row.drilldownHref, isDemo);
      const context = [row.secondaryContext, row.primaryContext].map(humanizeContext).filter(v => v && v !== '—').join(' · ');
      return <li key={`${row.level}:${row.id}`} className={styles.entity}>
        <span className={styles.entityRank}>{index + 1}</span>
        {row.level === 'ad' ? <CreativePreview key={JSON.stringify(row.creativePreview)} row={row} />
          : <span className={styles.preview} aria-hidden="true">{row.level === 'campaign' ? <IconSpeakerphone size={22} /> : <IconStack2 size={22} />}</span>}
        <div className={styles.entityBody}>
          <h3 title={row.name}>{row.name}</h3>
          {context ? <p title={context}>{context}</p> : null}
          {row.creativeContext ? <p>{row.creativeContext}</p> : null}
          <div className={styles.entityTags}><span className={styles.levelTag}>{LEVEL[row.level]}</span>{row.status ? <StatusBadge status={row.status} /> : null}</div>
        </div>
        <div className={styles.entityMetric}>
          <strong>{formatReportMetric(row, metric, currency)}</strong>
          <span className={styles.barTrack} aria-hidden="true"><span style={{ width: `${max > 0 && value != null ? value / max * 100 : 0}%` }} /></span>
          <span>{label}</span>
        </div>
        {href ? <a className={styles.drilldown} href={href} aria-label={`Open report for ${row.name}`}>Open<IconChevronRight size={14} aria-hidden="true" /></a> : <span />}
      </li>;
    })}</ol>}
    {rows.length > limit && <button type="button" className={styles.more} onClick={() => setLimit(n => n + 24)}>Show {Math.min(24, rows.length - limit)} more ({rows.length - limit} remaining)</button>}
    <details className={classes.dataDetails}><summary>Full table with every metric</summary><PerformanceTable title={group.label} rows={rows.map(row => ({ ...row, drilldownHref: reportDrilldownHref(row.drilldownHref, isDemo) }))} currencyCode={currency} /></details>
    <details className={classes.about}><summary><IconInfoCircle size={14} aria-hidden="true" />About this data</summary><ul>
      <li>Ordered by {label.toLowerCase()} for the selected dates — there is no combined performance score.</li>
      <li>Status is Meta&apos;s latest saved status, separate from results in the selected period.</li>
      <li>Account context can include advertising outside a narrower selection.</li>
    </ul></details>
  </section>;
}
