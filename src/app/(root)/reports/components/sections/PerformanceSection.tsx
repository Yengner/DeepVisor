'use client';
import { useId, useMemo } from 'react';
import { Area, AreaChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ReportPayload } from '@/lib/server/reports/types';
import { buildPerformanceChart, PERFORMANCE_METRICS, performanceValueLabel, type PerformanceMetric, type PerformancePoint } from '@/lib/shared/reports/performance';
import { formatReportMetric } from '@/lib/shared/reports/metrics';
import { formatReportDay, formatReportRange, formatTimezone } from '@/lib/shared/reports/labels';
import classes from '../Workspace.module.css';

const MONEY = new Set<PerformanceMetric>(['spend', 'costPerResult', 'cpc', 'cpm']);
const ADDITIVE = new Set<PerformanceMetric>(['spend', 'conversion', 'impressions', 'clicks', 'linkClicks']);
const shortDate = (date: string) => formatReportDay(date, false);
const windowLabel = (date: string, end: string) => date === end ? formatReportDay(date) : formatReportRange(date, end);

/** Trend for one metric. The metric is owned by the parent so the KPI cards can drive it. */
export function PerformanceSection({ payload, metric, onMetric }: {
  payload: ReportPayload; metric: PerformanceMetric; onMetric: (metric: PerformanceMetric) => void;
}) {
  const gradientId = useId().replace(/:/g, '');
  const chart = useMemo(() => buildPerformanceChart(payload, metric), [payload, metric]);
  const label = PERFORMANCE_METRICS.find(([key]) => key === metric)![1];
  const currency = payload.meta.currencyCode;
  const units = metric === 'ctr' ? 'Percent' : MONEY.has(metric) ? currency ?? 'Currency unknown' : 'Count';
  const format = (value: number | null) => performanceValueLabel(value, metric, currency);
  const axis = (value: number) => {
    if (metric === 'ctr') return `${value}%`;
    if (MONEY.has(metric) && currency && currency !== 'MIXED') {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 }).format(value);
    }
    return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
  };
  const periodValue = formatReportMetric(payload.summary, metric, currency);
  const groupLabel = payload.query.groupBy === 'day' ? 'Daily' : payload.query.groupBy === 'week' ? 'Weekly' : 'Monthly';

  return <section className={classes.panel} aria-labelledby="performance-title">
    <div className={classes.panelHeader}>
      <div><p className={classes.eyebrow}>Performance over time</p><h2 id="performance-title">{groupLabel} {label.toLowerCase()}</h2></div>
      <label className={classes.metricSelect}>Metric
        <select aria-label="Chart metric" value={metric} onChange={e => onMetric(e.target.value as PerformanceMetric)}>
          {PERFORMANCE_METRICS.map(([key, name]) => <option key={key} value={key}>{name}</option>)}
        </select>
      </label>
    </div>
    <div className={classes.chartMeta}>
      <span className={classes.currentKey}>Selected period</span>
      {chart.showPrevious && <span className={classes.previousKey}>Previous period</span>}
      <span>{units} · {formatTimezone(payload.meta.timezone)}</span>
      <span className={classes.chartTotal}>{ADDITIVE.has(metric) ? 'Total' : 'Overall'}: {periodValue}</span>
    </div>
    {chart.comparisonReason && chart.comparisonReason !== payload.comparison.disabledReason && <p className={classes.notice}>{chart.comparisonReason}</p>}
    {chart.hasData ? <div className={classes.chart} role="img" aria-label={`${label} by ${payload.query.groupBy}. Exact values are in "Inspect chart data" below.`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chart.points} margin={{ top: 16, right: 12, bottom: 4, left: 0 }} accessibilityLayer>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--dv-primary)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--dv-primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--dv-border)" />
          <XAxis dataKey="date" tickFormatter={shortDate} minTickGap={36} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'var(--dv-text-muted)' }} />
          <YAxis width={58} tickFormatter={axis} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'var(--dv-text-muted)' }} />
          <Tooltip cursor={{ stroke: 'var(--dv-border-strong, var(--dv-border))' }} content={({ active, payload: items }) => {
            const point = items?.[0]?.payload as PerformancePoint | undefined;
            return active && point ? <div className={classes.tooltip}>
              <strong>{format(point.current)}</strong><p>{label} · {windowLabel(point.date, point.endDate)}</p>
              {chart.showPrevious && <p>Previous: {format(point.previous)}{point.previousDate ? ` · ${windowLabel(point.previousDate, point.previousEndDate!)}` : ''}</p>}
            </div> : null;
          }} />
          {/* Gaps stay gaps: a missing day is not zero. */}
          <Area name="Selected period" dataKey="current" type="linear" stroke="var(--dv-primary)" strokeWidth={2.5} fill={`url(#${gradientId})`}
            dot={chart.points.length <= 14 ? { r: 3, strokeWidth: 0, fill: 'var(--dv-primary)' } : false} activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--dv-surface)' }}
            connectNulls={false} isAnimationActive={false} />
          {chart.showPrevious && <Line name="Previous period" dataKey="previous" type="linear" stroke="var(--dv-violet, #7463b6)" strokeWidth={2} strokeDasharray="6 5" dot={false} connectNulls={false} isAnimationActive={false} />}
        </AreaChart>
      </ResponsiveContainer>
    </div> : <div className={classes.empty}><h3>No {label.toLowerCase()} trend available</h3>
      <p>{payload.meta.coverage?.state === 'error' ? 'Saved report measurements could not be loaded. Try reloading the report.' : payload.series.length === 0 ? 'No time-series measurements are available for this selection. Detailed advertising remains available in its section.' : chart.unavailableReason ?? 'The selected metric is unavailable for these observations.'}</p></div>}
    <details className={classes.dataDetails}><summary>Inspect chart data</summary>
      <div className={classes.tableScroll} tabIndex={0} role="region" aria-label={`${label} chart data`}>
        <table><caption>{label} · {units} · Missing measurements are unavailable, not zero.</caption>
          <thead><tr><th scope="col">Period</th><th scope="col">{label}</th>{chart.showPrevious && <><th scope="col">Previous period</th><th scope="col">{label}</th></>}</tr></thead>
          <tbody>{chart.points.map(point => <tr key={point.date}><th scope="row">{windowLabel(point.date, point.endDate)}</th><td>{format(point.current)}</td>
            {chart.showPrevious && <><td>{point.previousDate ? windowLabel(point.previousDate, point.previousEndDate!) : 'Unavailable'}</td><td>{format(point.previous)}</td></>}</tr>)}</tbody>
        </table>
      </div>
    </details>
  </section>;
}
