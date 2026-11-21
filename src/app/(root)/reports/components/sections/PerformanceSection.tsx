'use client';
import { useId, useMemo } from 'react';
import { Area, AreaChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ReportPayload } from '@/lib/server/reports/types';
import { buildPerformanceChart, type PerformanceMetric, type PerformancePoint } from '@/lib/shared/reports/performance';
import { useReportFormat } from '../useReportFormat';
import classes from '../Workspace.module.css';

const MONEY = new Set<PerformanceMetric>(['spend', 'costPerResult', 'cpc', 'cpm']);
const ADDITIVE = new Set<PerformanceMetric>(['spend', 'conversion', 'impressions', 'clicks', 'linkClicks']);
const GROUPS = ['day', 'week', 'month'] as const;

/**
 * Trend for one metric. The KPI cards (and "More metrics") choose what is charted; this panel owns
 * only how the trend is grouped, so each control sits next to what it changes.
 */
export function PerformanceSection({ payload, metric, onGroupBy, pending = false }: {
  payload: ReportPayload; metric: PerformanceMetric; onGroupBy: (group: 'day' | 'week' | 'month') => void; pending?: boolean;
}) {
  const f = useReportFormat(), t = f.t;
  const shortDate = (date: string) => f.day(date, false);
  const windowLabel = (date: string, end: string) => date === end ? f.day(date) : f.range(date, end);
  const gradientId = useId().replace(/:/g, '');
  const chart = useMemo(() => buildPerformanceChart(payload, metric), [payload, metric]);
  const label = f.metric(metric);
  const currency = payload.meta.currencyCode;
  const units = metric === 'ctr' ? t('perf.units.percent') : MONEY.has(metric) ? currency ?? t('perf.units.currencyUnknown') : t('perf.units.count');
  const format = (value: number | null) => f.perf(value, metric, currency);
  const axis = (value: number) => {
    if (metric === 'ctr') return `${value}%`;
    if (MONEY.has(metric) && currency && currency !== 'MIXED') {
      return new Intl.NumberFormat(f.intl, { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 }).format(value);
    }
    return new Intl.NumberFormat(f.intl, { notation: 'compact', maximumFractionDigits: 1 }).format(value);
  };
  const periodValue = f.value(payload.summary, metric, currency);
  const group = payload.query.groupBy === 'day' ? 'day' : payload.query.groupBy === 'week' ? 'week' : 'month';

  return <section className={classes.panel} aria-labelledby="performance-title">
    <div className={classes.panelHeader}>
      <div><h2 id="performance-title">{t('perf.title', { group, metric: f.intl === 'en-US' && !/^[A-Z]{3}$/.test(label) ? label.toLowerCase() : label })}</h2></div>
      {payload.query.rangeMode !== 'max' ? (
        <div className={classes.segmented} role="group" aria-label={t('perf.groupBy')}>
          {GROUPS.map(value => (
            <button key={value} type="button" aria-pressed={payload.query.groupBy === value} disabled={pending} onClick={() => onGroupBy(value)}>{t(`perf.group.${value}`)}</button>
          ))}
        </div>
      ) : null}
    </div>
    <div className={classes.chartMeta}>
      <span className={classes.currentKey}>{t('perf.selected')}</span>
      {chart.showPrevious && <span className={classes.previousKey}>{t('perf.previous')}</span>}
      <span>{units} · {f.zone(payload.meta.timezone)}</span>
      <span className={classes.chartTotal}>{t(ADDITIVE.has(metric) ? 'perf.total' : 'perf.overall', { value: periodValue })}</span>
    </div>
    {chart.comparisonReason && chart.comparisonReason !== payload.comparison.disabledReason && <p className={classes.notice}>{chart.comparisonReason}</p>}
    {chart.hasData ? <div className={classes.chart} role="img" aria-label={t('perf.aria', { metric: label, group: t(`perf.group.${group}`).toLowerCase() })}>
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
              {chart.showPrevious && <p>{t('perf.previousValue', { value: format(point.previous) })}{point.previousDate ? ` · ${windowLabel(point.previousDate, point.previousEndDate!)}` : ''}</p>}
            </div> : null;
          }} />
          {/* Gaps stay gaps: a missing day is not zero. */}
          <Area name={t('perf.selected')} dataKey="current" type="linear" stroke="var(--dv-primary)" strokeWidth={2.5} fill={`url(#${gradientId})`}
            dot={chart.points.length <= 14 ? { r: 3, strokeWidth: 0, fill: 'var(--dv-primary)' } : false} activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--dv-surface)' }}
            connectNulls={false} isAnimationActive={false} />
          {chart.showPrevious && <Line name={t('perf.previous')} dataKey="previous" type="linear" stroke="var(--dv-violet, #7463b6)" strokeWidth={2} strokeDasharray="6 5" dot={false} connectNulls={false} isAnimationActive={false} />}
        </AreaChart>
      </ResponsiveContainer>
    </div> : <div className={classes.empty}><h3>{t('perf.noTrend', { metric: label.toLowerCase() })}</h3>
      <p>{payload.meta.coverage?.state === 'error' ? t('perf.loadError') : payload.series.length === 0 ? t('perf.noSeries') : chart.unavailableReason ?? t('perf.metricUnavailable')}</p></div>}
    <details className={classes.dataDetails}><summary>{t('perf.inspect')}</summary>
      <div className={classes.tableScroll} tabIndex={0} role="region" aria-label={t('perf.chartData', { metric: label })}>
        <table><caption>{t('perf.caption', { metric: label, units })}</caption>
          <thead><tr><th scope="col">{t('perf.period')}</th><th scope="col">{label}</th>{chart.showPrevious && <><th scope="col">{t('perf.previous')}</th><th scope="col">{label}</th></>}</tr></thead>
          <tbody>{chart.points.map(point => <tr key={point.date}><th scope="row">{windowLabel(point.date, point.endDate)}</th><td>{format(point.current)}</td>
            {chart.showPrevious && <><td>{point.previousDate ? windowLabel(point.previousDate, point.previousEndDate!) : t('unavailable')}</td><td>{format(point.previous)}</td></>}</tr>)}</tbody>
        </table>
      </div>
    </details>
  </section>;
}
