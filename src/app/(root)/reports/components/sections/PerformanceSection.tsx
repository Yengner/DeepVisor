'use client';
import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ReportPayload } from '@/lib/server/reports/types';
import { buildPerformanceChart, PERFORMANCE_METRICS, performanceValueLabel, type PerformanceMetric, type PerformancePoint } from '@/lib/shared/reports/performance';
import classes from '../Workspace.module.css';
const shortDate = (date: string) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
const windowLabel = (date: string, end: string) => date === end ? date : `${date} – ${end}`;
export function PerformanceSection({ payload }: { payload: ReportPayload }) {
  const [metric, setMetric] = useState<PerformanceMetric>('spend');
  const chart = useMemo(() => buildPerformanceChart(payload, metric), [payload, metric]);
  const label = PERFORMANCE_METRICS.find(([key]) => key === metric)![1];
  const units = metric === 'ctr' ? 'Percent' : ['spend', 'costPerResult', 'cpc', 'cpm'].includes(metric) ? payload.meta.currencyCode ?? 'Currency unknown' : 'Count';
  const format = (value: number | null) => performanceValueLabel(value, metric, payload.meta.currencyCode);
  return <section className={classes.panel} aria-labelledby="performance-title">
    <div className={classes.panelHeader}><div><p className={classes.eyebrow}>Performance over time</p>
      <h2 id="performance-title">{label}</h2></div>
      <label className={classes.metricSelect}>Chart metric<select value={metric} onChange={e => setMetric(e.target.value as PerformanceMetric)}>
        {PERFORMANCE_METRICS.map(([key, name]) => <option key={key} value={key}>{name}</option>)}
      </select></label>
    </div>
    <div className={classes.chartMeta}><span className={classes.currentKey}>Selected period</span>
      {chart.showPrevious && <span className={classes.previousKey}>Previous period · aligned by day in period</span>}
      <span>{units} · {payload.query.groupBy} · {payload.meta.timezone ?? 'Timezone unknown'}</span>
    </div>
    {chart.comparisonReason && chart.comparisonReason !== payload.comparison.disabledReason && <p className={classes.notice}>{chart.comparisonReason}</p>}
    {chart.hasData ? <div className={classes.chart} role="img" aria-label={`${label} by ${payload.query.groupBy}. Exact values are available in the data table below.`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chart.points} margin={{ top: 20, right: 16, bottom: 8, left: 0 }} accessibilityLayer>
          <CartesianGrid vertical={false} stroke="#e7e9e1" />
          <XAxis dataKey="date" tickFormatter={shortDate} minTickGap={36} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#62685c' }} />
          <YAxis width={65} tickFormatter={v => metric === 'ctr' ? `${v}%` : new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(v)} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#62685c' }} />
          <Tooltip content={({ active, payload: items }) => {
            const point = items?.[0]?.payload as PerformancePoint | undefined;
            return active && point ? <div className={classes.tooltip}>
              <strong>{label}</strong><p>{windowLabel(point.date, point.endDate)}<br />{format(point.current)}</p>
              {chart.showPrevious && <p>Previous: {point.previousDate ? windowLabel(point.previousDate, point.previousEndDate!) : 'No measurement'}<br />{format(point.previous)}</p>}
            </div> : null;
          }} />
          <Line name="Selected period" dataKey="current" type="linear" stroke="#138353" strokeWidth={3} dot={{ r: chart.points.length < 12 ? 3 : 2 }} activeDot={{ r: 6 }} connectNulls={false} isAnimationActive={false} />
          {chart.showPrevious && <Line name="Previous period" dataKey="previous" type="linear" stroke="#7463b6" strokeWidth={2} strokeDasharray="6 5" dot={false} connectNulls={false} isAnimationActive={false} />}
        </LineChart>
      </ResponsiveContainer>
    </div> : <div className={classes.empty}><h3>No {label.toLowerCase()} trend available</h3>
      <p>{payload.meta.coverage?.state === 'error' ? 'Saved report measurements could not be loaded. Try reloading the report.' : payload.series.length === 0 ? 'No time-series measurements are available for this selection. Detailed advertising remains available in its section.' : chart.unavailableReason ?? 'The selected metric is unavailable for these observations.'}</p></div>}
    <details className={classes.dataDetails}><summary>Inspect chart data</summary>
      <div className={classes.tableScroll} tabIndex={0} role="region" aria-label={`${label} chart data`}>
        <table><caption>{label} · {units} · Missing measurements are unavailable.</caption>
          <thead><tr><th scope="col">Period</th><th scope="col">{label}</th>{chart.showPrevious && <><th scope="col">Previous period</th><th scope="col">{label}</th></>}</tr></thead>
          <tbody>{chart.points.map(point => <tr key={point.date}><th scope="row">{windowLabel(point.date, point.endDate)}</th><td>{format(point.current)}</td>
            {chart.showPrevious && <><td>{point.previousDate ? windowLabel(point.previousDate, point.previousEndDate!) : 'Unavailable'}</td><td>{format(point.previous)}</td></>}</tr>)}</tbody>
        </table>
      </div>
    </details>
  </section>;
}
