'use client';
import { useState } from 'react';
import { IconInfoCircle } from '@tabler/icons-react';
import type { ReportPayload } from '@/lib/server/reports/types';
import { findingEvidence, filterFindings } from '@/lib/shared/reports/findings';
import { reportDrilldownHref } from '@/lib/shared/reports/advertising';
import { type PerformanceMetric } from '@/lib/shared/reports/performance';
import { useReportFormat } from '../useReportFormat';
import classes from '../Workspace.module.css';
import styles from './Sections.module.css';
export function FindingsSection({ payload, isDemo }: { payload: ReportPayload; isDemo: boolean }) {
  const f = useReportFormat(), t = f.t;
  const [severity, setSeverity] = useState('all'), [status, setStatus] = useState('all');
  const findings = filterFindings(payload.findings, severity, status);
  return <section className={classes.panel} aria-labelledby="findings-title"><h2 id="findings-title">{t('findings.title')}</h2>
    {payload.findings.length > 0 && <div className={styles.controls}><label>{t('findings.severity')}<select aria-label={t('findings.severity')} value={severity} onChange={e => setSeverity(e.target.value)}><option value="all">{t('findings.allSeverities')}</option>{[...new Set(payload.findings.map(f => f.severity))].map(v => <option key={v}>{v}</option>)}</select></label><label>{t('findings.status')}<select value={status} onChange={e => setStatus(e.target.value)}><option value="all">{t('findings.allStatuses')}</option>{[...new Set(payload.findings.map(f => f.status))].map(v => <option key={v}>{v}</option>)}</select></label></div>}
    {!findings.length ? <div className={classes.empty}><h3>{t(payload.findings.length ? 'findings.noMatch' : 'findings.none')}</h3><p>{t('findings.noneBody')}</p></div> : findings.map(finding => {
      const evidence = findingEvidence(finding), href = reportDrilldownHref(finding.reportHref ?? finding.actionHref, isDemo);
      return <article key={finding.id} className={styles.finding} data-severity={finding.severity}>
        <div className={styles.findingMeta}><span>{finding.severity} · {finding.status}</span><span>{t('findings.saved', { day: f.day(finding.detectedAt.slice(0, 10)) })}</span></div><h3>{finding.title}</h3><p>{finding.summary}</p>
        <p className={styles.coverage}>{t('findings.confidence', { window: evidence.window, confidence: finding.confidence })}</p>
        <details><summary>{t('findings.inspect')}</summary>{finding.reason && <p>{finding.reason}</p>}
          <dl className={styles.evidence}>{evidence.metrics.map(m => <div key={m.key}><dt>{m.label}</dt><dd>{['spend', 'cpc', 'cpm', 'costPerResult', 'ctr'].includes(m.key) ? f.perf(m.value, m.key as PerformanceMetric, payload.meta.currencyCode) : f.number(m.value)}</dd></div>)}</dl>
          {!evidence.metrics.length && <p>{t('findings.noNumbers')}</p>}
          <p className={styles.hint}>{t('findings.snapshot')}</p>
        </details>{href && <a className={styles.drilldown} href={href}>{t('findings.related')}</a>}
      </article>;
    })}
    <details className={classes.about}><summary><IconInfoCircle size={14} aria-hidden="true" />{t('breakdown.about')}</summary><ul>
      <li>{t('findings.aboutSaved')}</li>
      <li>{t('findings.aboutSnapshot')}</li>
    </ul></details>
  </section>;
}
