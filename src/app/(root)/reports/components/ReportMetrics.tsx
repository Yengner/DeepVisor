'use client';
import { IconChevronRight } from '@tabler/icons-react';
import type { ReportMetricKey, ReportPayload } from '@/lib/server/reports/types';
import { metricDirection, reportMetricDelta } from '@/lib/shared/reports/metrics';
import { PERFORMANCE_METRICS, type PerformanceMetric } from '@/lib/shared/reports/performance';
import { comparisonBaseTotals } from '@/lib/shared/reports/comparison';
import classes from './Workspace.module.css';
import { useReportFormat } from './useReportFormat';

/** Same four decision numbers as Overview and Campaigns; delivery volume lives under "More metrics". */
const primary = ['spend', 'conversion', 'costPerResult', 'ctr'] as const;
const secondary = ['impressions', 'clicks', 'linkClicks', 'cpc', 'cpm', 'reach', 'frequency'] as const;
const chartable = new Set<string>(PERFORMANCE_METRICS.map(([key]) => key));

/**
 * Period KPIs. Primary cards double as the chart's metric picker. A change is shown only when
 * comparison is on and both periods have the value; otherwise nothing, rather than repeating
 * "No comparison" on every card.
 */
export function ReportMetrics({ payload, chartMetric, onChartMetric }: {
  payload: ReportPayload; chartMetric: PerformanceMetric; onChartMetric: (metric: PerformanceMetric) => void;
}) {
  const f = useReportFormat(), t = f.t;
  const comparing = payload.query.compareMode === 'previous_period' && Boolean(payload.comparison.previousTotals);
  const delta = (key: ReportMetricKey) => {
    const unavailable = payload.summary.unavailable?.[key];
    if (unavailable) return <span className={classes.kpiNote} title={unavailable}>{t('unavailable')}</span>;
    if (!comparing) return null;
    const change = reportMetricDelta(comparisonBaseTotals(payload), payload.comparison.previousTotals, key);
    if (change == null) return <span className={classes.kpiNote}>{t('kpi.noPrior')}</span>;
    const pp = key === 'ctr';
    return (
      <span className={`${classes.kpiDelta} ${classes[metricDirection(key, change)]}`}>
        {change > 0 ? '▲' : change < 0 ? '▼' : ''} {Math.abs(change).toFixed(pp ? 2 : 1)}{pp ? ' pp' : '%'}
        <span>{f.comparison(payload.comparison)}</span>
      </span>
    );
  };
  const value = (key: ReportMetricKey) => f.value(payload.summary, key, payload.meta.currencyCode);

  return (
    <section aria-label={t('kpi.label')} className={classes.metrics}>
      <div className={classes.kpis}>
        {primary.map(key => { const label = f.metric(key); return (
          <button
            key={key}
            type="button"
            className={classes.kpi}
            aria-pressed={chartMetric === key}
            aria-label={t('kpi.aria', { label, value: value(key) })}
            onClick={() => onChartMetric(key)}
          >
            <span className={classes.kpiLabel}>{label}<span className={classes.kpiChartHint} aria-hidden="true">{chartMetric === key ? t('kpi.charted') : t('kpi.chart')}</span></span>
            <span className={classes.kpiValue}>{value(key)}</span>
            {delta(key)}
          </button>
        ); })}
      </div>
      <details className={classes.secondary}>
        <summary><IconChevronRight size={14} aria-hidden="true" />{t('kpi.more')}</summary>
        <dl className={classes.secondaryMetrics}>
          {secondary.map(key => { const label = f.metric(key); return (
            <div key={key}>
              <dt>{chartable.has(key) ? (
                <button type="button" className={classes.highlightLink} onClick={() => onChartMetric(key as PerformanceMetric)} aria-label={t('kpi.showOnChart', { label })}>{label}</button>
              ) : label}</dt>
              <dd>{value(key)}</dd>
              {delta(key) ? <dd>{delta(key)}</dd> : null}
            </div>
          ); })}
        </dl>
        <p className={classes.secondaryNote}>{t('kpi.reachNote')}</p>
      </details>
    </section>
  );
}
