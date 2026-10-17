import type { ReportMetricKey, ReportPayload, ReportTimeSeriesPoint } from '@/lib/server/reports/types';
import { reportDayCount, shiftReportDay } from './dates';
import { reportMetricValue } from './metrics';

export const PERFORMANCE_METRICS = [
  ['spend', 'Spend'], ['conversion', 'Results'], ['costPerResult', 'Cost per result'],
  ['impressions', 'Impressions'], ['clicks', 'Clicks'], ['linkClicks', 'Link clicks'],
  ['ctr', 'CTR'], ['cpc', 'CPC'], ['cpm', 'CPM'],
] as const satisfies ReadonlyArray<readonly [ReportMetricKey, string]>;
export type PerformanceMetric = typeof PERFORMANCE_METRICS[number][0];
export interface PerformancePoint {
  date: string; endDate: string; previousDate: string | null; previousEndDate: string | null;
  current: number | null; previous: number | null;
}
const monetary = new Set(['spend', 'costPerResult', 'cpc', 'cpm']);
export function performanceValueLabel(value: number | null, metric: PerformanceMetric, currency: string | null) {
  if (value == null) return 'Unavailable';
  if (monetary.has(metric)) {
    if (!currency || currency === 'MIXED') return 'Unavailable';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
  }
  return metric === 'ctr' ? `${value.toFixed(2)}%` : value.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

/** Align periods by relative measurement boundaries, never by array index or calendar label. */
export function buildPerformanceChart(payload: ReportPayload, metric: PerformanceMetric) {
  const { query, comparison } = payload;
  const value = (point: ReportTimeSeriesPoint | undefined) => !point ||
    (monetary.has(metric) && (!payload.meta.currencyCode || payload.meta.currencyCode === 'MIXED'))
    ? null : reportMetricValue(point, metric);
  const bounds = (point: ReportTimeSeriesPoint, start: string, end: string) => ({
    start: point.startDate < start ? start : point.startDate,
    end: point.endDate > end ? end : point.endDate,
  });
  const signature = (point: ReportTimeSeriesPoint, start: string, end: string) => {
    const b = bounds(point, start, end);
    return `${reportDayCount(start, b.start) - 1}:${reportDayCount(b.start, b.end)}`;
  };
  let comparisonReason = comparison.disabledReason ?? payload.meta.comparisonDisabledReason ?? null;
  const previous = comparison.previousSeries ?? [];
  let showPrevious = query.compareMode === 'previous_period' && !comparisonReason && previous.length > 0 &&
    Boolean(comparison.previousDateFrom && comparison.previousDateTo);
  const priorByWindow = new Map(previous.map(point => [
    signature(point, comparison.previousDateFrom!, comparison.previousDateTo!), point,
  ]));
  if (showPrevious && query.groupBy !== 'day' && payload.series.some(point =>
    !priorByWindow.has(signature(point, query.dateFrom, query.dateTo)))) {
    showPrevious = false;
    comparisonReason = 'Trend comparison requires matching bucket boundaries. Choose daily grouping to compare these periods.';
  }
  if (query.compareMode === 'previous_period' && !showPrevious && !comparisonReason) {
    comparisonReason = 'Previous-period trend measurements are unavailable.';
  }
  const currentByDate = new Map(payload.series.map(point => [point.startDate, point]));
  const windows = query.groupBy === 'day' && query.rangeMode !== 'max'
    ? Array.from({ length: reportDayCount(query.dateFrom, query.dateTo) }, (_, i) => {
      const date = shiftReportDay(query.dateFrom, i);
      return { date, endDate: date, point: currentByDate.get(date) };
    })
    : payload.series.map(point => {
      const b = bounds(point, query.dateFrom, query.dateTo);
      return { date: b.start, endDate: b.end, point };
    });
  const points: PerformancePoint[] = windows.map(({ date, endDate, point }) => {
    const key = `${reportDayCount(query.dateFrom, date) - 1}:${reportDayCount(date, endDate)}`;
    const prior = showPrevious ? priorByWindow.get(key) : undefined;
    const b = prior ? bounds(prior, comparison.previousDateFrom!, comparison.previousDateTo!) : null;
    return { date, endDate, current: value(point), previous: value(prior), previousDate: b?.start ?? null, previousEndDate: b?.end ?? null };
  });
  return { points, showPrevious, comparisonReason, hasData: points.some(p => p.current != null),
    unavailableReason: payload.summary.unavailable?.[metric] ?? null };
}
