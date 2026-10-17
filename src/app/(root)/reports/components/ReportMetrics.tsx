'use client';
import type { ReportMetricKey, ReportPayload } from '@/lib/server/reports/types';
import { formatReportMetric, metricDirection, reportMetricDelta } from '@/lib/shared/reports/metrics';
import classes from './Workspace.module.css';
const primary = [['spend', 'Spend'], ['conversion', 'Results'], ['costPerResult', 'Cost per result'], ['impressions', 'Impressions']] as const;
const secondary = [['clicks', 'Clicks'], ['linkClicks', 'Link clicks'], ['ctr', 'CTR'], ['cpc', 'CPC'], ['cpm', 'CPM'], ['reach', 'Reach'], ['frequency', 'Frequency']] as const;
export function ReportMetrics({ payload }: { payload: ReportPayload }) {
  const metric = ([key, label]: readonly [ReportMetricKey, string]) => {
    const delta = reportMetricDelta(payload.summary, payload.comparison.previousTotals, key);
    const direction = metricDirection(key, delta);
    const unavailable = payload.summary.unavailable?.[key];
    return <div key={key} className={classes.metric}>
      <dt>{label}</dt><dd>{formatReportMetric(payload.summary, key, payload.meta.currencyCode)}</dd>
      <dd className={classes.metricComparison}>{unavailable ? <span className={classes.metricNote} title={unavailable}>Unavailable</span> :
        delta != null ? <span className={classes[direction]}>{delta > 0 ? '+' : ''}{delta.toFixed(key === 'ctr' ? 2 : 1)}{key === 'ctr' ? ' pp' : '%'} <span className={classes.metricNote}>vs previous</span></span> :
        <span className={classes.metricNote}>No comparison</span>}</dd>
    </div>;
  };
  return <section aria-label="Report metrics" className={classes.metrics}>
    <dl className={classes.primaryMetrics}>{primary.map(metric)}</dl>
    <details className={classes.secondary}><summary>More metrics <span>Clicks, efficiency & reach</span></summary>
      <dl className={classes.secondaryMetrics}>{secondary.map(metric)}</dl>
      <p className={classes.metricNote}>Reach and frequency require verified unique reach for the whole period.</p>
    </details>
  </section>;
}
