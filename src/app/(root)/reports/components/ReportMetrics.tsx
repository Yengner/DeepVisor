'use client';
import { IconChevronRight } from '@tabler/icons-react';
import type { ReportMetricKey, ReportPayload } from '@/lib/server/reports/types';
import { formatReportMetric, metricDirection, reportMetricDelta } from '@/lib/shared/reports/metrics';
import { PERFORMANCE_METRICS, type PerformanceMetric } from '@/lib/shared/reports/performance';
import { comparisonBaseTotals, comparisonLabel } from '@/lib/shared/reports/comparison';
import classes from './Workspace.module.css';

const primary = [['spend', 'Spend'], ['conversion', 'Results'], ['costPerResult', 'Cost per result'], ['impressions', 'Impressions']] as const;
const secondary = [['clicks', 'Clicks'], ['linkClicks', 'Link clicks'], ['ctr', 'CTR'], ['cpc', 'CPC'], ['cpm', 'CPM'], ['reach', 'Reach'], ['frequency', 'Frequency']] as const;
const chartable = new Set<string>(PERFORMANCE_METRICS.map(([key]) => key));

/**
 * Period KPIs. Primary cards double as the chart's metric picker. A change is shown only when
 * comparison is on and both periods have the value; otherwise nothing, rather than repeating
 * "No comparison" on every card.
 */
export function ReportMetrics({ payload, chartMetric, onChartMetric }: {
  payload: ReportPayload; chartMetric: PerformanceMetric; onChartMetric: (metric: PerformanceMetric) => void;
}) {
  const comparing = payload.query.compareMode === 'previous_period' && Boolean(payload.comparison.previousTotals);
  const delta = (key: ReportMetricKey) => {
    const unavailable = payload.summary.unavailable?.[key];
    if (unavailable) return <span className={classes.kpiNote} title={unavailable}>Unavailable</span>;
    if (!comparing) return null;
    const change = reportMetricDelta(comparisonBaseTotals(payload), payload.comparison.previousTotals, key);
    if (change == null) return <span className={classes.kpiNote}>No prior value</span>;
    const pp = key === 'ctr';
    return (
      <span className={`${classes.kpiDelta} ${classes[metricDirection(key, change)]}`}>
        {change > 0 ? '▲' : change < 0 ? '▼' : ''} {Math.abs(change).toFixed(pp ? 2 : 1)}{pp ? ' pp' : '%'}
        <span>{comparisonLabel(payload.comparison)}</span>
      </span>
    );
  };
  const value = (key: ReportMetricKey) => formatReportMetric(payload.summary, key, payload.meta.currencyCode);

  return (
    <section aria-label="Report metrics" className={classes.metrics}>
      <div className={classes.kpis}>
        {primary.map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={classes.kpi}
            aria-pressed={chartMetric === key}
            aria-label={`${label}: ${value(key)}. Show ${label.toLowerCase()} on the chart`}
            onClick={() => onChartMetric(key)}
          >
            <span className={classes.kpiLabel}>{label}<span className={classes.kpiChartHint} aria-hidden="true">{chartMetric === key ? 'Charted' : 'Chart'}</span></span>
            <span className={classes.kpiValue}>{value(key)}</span>
            {delta(key)}
          </button>
        ))}
      </div>
      <details className={classes.secondary}>
        <summary><IconChevronRight size={14} aria-hidden="true" />More metrics</summary>
        <dl className={classes.secondaryMetrics}>
          {secondary.map(([key, label]) => (
            <div key={key}>
              <dt>{chartable.has(key) ? (
                <button type="button" className={classes.highlightLink} onClick={() => onChartMetric(key as PerformanceMetric)} aria-label={`Show ${label} on the chart`}>{label}</button>
              ) : label}</dt>
              <dd>{value(key)}</dd>
              {delta(key) ? <dd>{delta(key)}</dd> : null}
            </div>
          ))}
        </dl>
        <p className={classes.secondaryNote}>Reach and frequency need verified unique reach for the whole period, so they are often unavailable.</p>
      </details>
    </section>
  );
}
