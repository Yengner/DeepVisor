'use client';
import { useState } from 'react';
import { IconChevronRight, IconInfoCircle, IconSpeakerphone, IconStack2 } from '@tabler/icons-react';
import type { ReportPayload } from '@/lib/server/reports/types';
import { PERFORMANCE_METRICS, type PerformanceMetric } from '@/lib/shared/reports/performance';
import { advertisingGroups, advertisingMetricValue, reportDrilldownHref, sortAdvertising } from '@/lib/shared/reports/advertising';
import { humanizeContext } from '@/lib/shared/reports/labels';
import { useLabels } from '@/lib/client/hooks/useLabels';
import { useReportFormat } from '../useReportFormat';
import StatusBadge from '@/components/product/StatusBadge';
import PerformanceTable from '../cards/PerformanceTable';
import { CreativePreview } from './CreativePreview';
import classes from '../Workspace.module.css';
import styles from './Sections.module.css';


export function AdvertisingSection({ payload, isDemo }: { payload: ReportPayload; isDemo: boolean }) {
  const f = useReportFormat(), t = f.t, labels = useLabels();
  const [groupKey, setGroup] = useState('selection');
  const [metric, setMetric] = useState<PerformanceMetric>('conversion');
  const [ascending, setAscending] = useState(false);
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(12);
  const currency = payload.meta.currencyCode;
  const groups = advertisingGroups(payload), group = groups.find(g => g.key === groupKey) ?? groups[0];
  const rows = sortAdvertising(group.rows, metric, ascending, search, currency);
  const max = Math.max(0, ...rows.map(row => advertisingMetricValue(row, metric, currency) ?? 0));
  const label = f.metric(metric);
  const groupLabel = (g: { key: string; label: string }) => g.key !== 'selection' && t.has(`advertising.group.${g.key}` as never) ? t(`advertising.group.${g.key}` as never) : g.label;
  const groupContext = (g: { key: string; context: string }) => t.has(`advertising.context.${g.key}` as never) ? t(`advertising.context.${g.key}` as never) : g.context;

  return <section className={classes.panel} aria-labelledby="advertising-title">
    <div className={classes.panelHeader}>
      <div><h2 id="advertising-title">{t('advertising.title')}</h2></div>
      <label className={classes.metricSelect}>{t('advertising.rankBy')}<select aria-label={t('advertising.rankAria')} value={metric} onChange={e => setMetric(e.target.value as PerformanceMetric)}>{PERFORMANCE_METRICS.map(([key]) => <option value={key} key={key}>{f.metric(key)}</option>)}</select></label>
    </div>
    <div className={styles.controls}>
      <label>{t('advertising.show')}<select aria-label={t('advertising.showAria')} value={group.key} onChange={e => { setGroup(e.target.value); setLimit(12); }}>{groups.map(g => <option key={g.key} value={g.key}>{groupLabel(g)}</option>)}</select></label>
      <label>{t('advertising.order')}<select aria-label={t('advertising.orderAria')} value={ascending ? 'asc' : 'desc'} onChange={e => setAscending(e.target.value === 'asc')}><option value="desc">{t('advertising.highest')}</option><option value="asc">{t('advertising.lowest')}</option></select></label>
      <label className={styles.search}>{t('advertising.search')}<input type="search" value={search} onChange={e => { setSearch(e.target.value); setLimit(12); }} placeholder={t('advertising.searchPlaceholder')} /></label>
    </div>
    <p className={styles.coverage}>{t('advertising.items', { count: rows.length, context: groupContext(group), dates: f.range(payload.query.dateFrom, payload.query.dateTo) })}</p>

    {!rows.length ? <div className={classes.empty}><h3>{t('advertising.none')}</h3><p>{t('advertising.noneBody')}</p></div> : <ol className={styles.entityList} style={{ listStyle: 'none', padding: 0 }}>{rows.slice(0, limit).map((row, index) => {
      const value = advertisingMetricValue(row, metric, currency), href = reportDrilldownHref(row.drilldownHref, isDemo);
      const context = [row.secondaryContext, row.primaryContext].map(v => v && /^[A-Z][A-Z0-9_]+$/.test(v) ? labels.objective(v) : humanizeContext(v)).filter(v => v && v !== '—').join(' · ');
      return <li key={`${row.level}:${row.id}`} className={styles.entity}>
        <span className={styles.entityRank}>{index + 1}</span>
        {row.level === 'ad' ? <CreativePreview key={JSON.stringify(row.creativePreview)} row={row} />
          : <span className={styles.preview} aria-hidden="true">{row.level === 'campaign' ? <IconSpeakerphone size={22} /> : <IconStack2 size={22} />}</span>}
        <div className={styles.entityBody}>
          <h3 title={row.name}>{row.name}</h3>
          {context ? <p title={context}>{context}</p> : null}
          {row.creativeContext ? <p>{row.creativeContext}</p> : null}
          <div className={styles.entityTags}><span className={styles.levelTag}>{t(`level.${row.level}`)}</span>{row.status ? <StatusBadge status={row.status} /> : null}</div>
        </div>
        <div className={styles.entityMetric}>
          <strong>{f.value(row, metric, currency)}</strong>
          <span className={styles.barTrack} aria-hidden="true"><span style={{ width: `${max > 0 && value != null ? value / max * 100 : 0}%` }} /></span>
          <span>{label}</span>
        </div>
        {href ? <a className={styles.drilldown} href={href} aria-label={t('advertising.openFor', { name: row.name })}>{t('advertising.open')}<IconChevronRight size={14} aria-hidden="true" /></a> : <span />}
      </li>;
    })}</ol>}
    {rows.length > limit && <button type="button" className={styles.more} onClick={() => setLimit(n => n + 24)}>{t('advertising.more', { count: Math.min(24, rows.length - limit), remaining: rows.length - limit })}</button>}
    <details className={classes.dataDetails}><summary>{t('advertising.table')}</summary><PerformanceTable title={groupLabel(group)} rows={rows.map(row => ({ ...row, drilldownHref: reportDrilldownHref(row.drilldownHref, isDemo) }))} currencyCode={currency} /></details>
    <details className={classes.about}><summary><IconInfoCircle size={14} aria-hidden="true" />{t('breakdown.about')}</summary><ul>
      <li>{t('advertising.aboutOrder', { metric: label.toLowerCase() })}</li>
      <li>{t('advertising.aboutStatus')}</li>
      <li>{t('advertising.aboutContext')}</li>
    </ul></details>
  </section>;
}
