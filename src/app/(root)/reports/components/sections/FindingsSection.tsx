'use client';
import { useState } from 'react';
import type { ReportPayload } from '@/lib/server/reports/types';
import { findingEvidence, filterFindings } from '@/lib/shared/reports/findings';
import { reportDrilldownHref } from '@/lib/shared/reports/advertising';
import { performanceValueLabel, type PerformanceMetric } from '@/lib/shared/reports/performance';
import classes from '../Workspace.module.css';
import styles from './Sections.module.css';
export function FindingsSection({ payload, isDemo }: { payload: ReportPayload; isDemo: boolean }) {
  const [severity, setSeverity] = useState('all'), [status, setStatus] = useState('all');
  const findings = filterFindings(payload.findings, severity, status);
  return <section className={classes.panel} aria-labelledby="findings-title"><p className={classes.eyebrow}>Saved historical evidence</p><h2 id="findings-title">Findings</h2>
    <div className={styles.controls}><label>Severity<select aria-label="Severity" value={severity} onChange={e => setSeverity(e.target.value)}><option value="all">All severities</option>{[...new Set(payload.findings.map(f => f.severity))].map(v => <option key={v}>{v}</option>)}</select></label><label>Finding status<select value={status} onChange={e => setStatus(e.target.value)}><option value="all">All statuses</option>{[...new Set(payload.findings.map(f => f.status))].map(v => <option key={v}>{v}</option>)}</select></label></div>
    <p className={styles.hint}>Persisted observations, not new evaluations. Report reload does not run decision evaluation.</p>
    {!findings.length ? <div className={classes.empty}><h3>No saved findings match this view</h3><p>Absence of findings does not establish healthy performance.</p></div> : findings.map(finding => {
      const evidence = findingEvidence(finding), href = reportDrilldownHref(finding.reportHref ?? finding.actionHref, isDemo);
      return <article key={finding.id} className={styles.finding} data-severity={finding.severity}>
        <div className={styles.findingMeta}><span>{finding.severity} · {finding.status}</span><span>Saved {finding.detectedAt.slice(0, 10)}</span></div><h3>{finding.title}</h3><p>{finding.summary}</p>
        <p className={styles.coverage}>{evidence.window} · Confidence: {finding.confidence}</p>
        <details><summary>Inspect saved evidence</summary>{finding.reason && <p>{finding.reason}</p>}
          <dl className={styles.evidence}>{evidence.metrics.map(m => <div key={m.key}><dt>{m.label}</dt><dd>{['spend', 'cpc', 'cpm', 'costPerResult', 'ctr'].includes(m.key) ? performanceValueLabel(m.value, m.key as PerformanceMetric, payload.meta.currencyCode) : m.value.toLocaleString('en-US')}</dd></div>)}</dl>
          {!evidence.metrics.length && <p>No numerical measurements were saved with this finding.</p>}
          <p className={styles.hint}>Saved metric snapshot; values can differ from the currently selected period.</p>
        </details>{href && <a className={styles.drilldown} href={href}>Inspect related report →</a>}
      </article>;
    })}
  </section>;
}
