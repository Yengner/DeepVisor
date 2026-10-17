import type { ReportMetricKey, ReportSnapshotMeasurement, ReportSurfaceContext } from '@/lib/server/reports/types';
import { isReportDate } from './dates';
export const BREAKDOWN_METRICS = [ ['spend', 'Spend'], ['impressions', 'Impressions'], ['clicks', 'Clicks'], ['conversion', 'Results'], ['ctr', 'CTR'], ['cpc', 'CPC'], ['cpm', 'CPM'], ['costPerResult', 'Cost per result'], ['reach', 'Reach'] ] as const;
export type BreakdownMetric = typeof BREAKDOWN_METRICS[number][0];
export type AudienceView = 'age_gender' | 'age' | 'gender';
export const moneyMetrics = new Set<ReportMetricKey>(['spend', 'cpc', 'cpm', 'costPerResult']);
export function measurementWindow(row: ReportSnapshotMeasurement) {
  return row.dateFrom && row.dateTo && isReportDate(row.dateFrom) && isReportDate(row.dateTo) && row.dateFrom <= row.dateTo
    ? `${row.dateFrom} / ${row.dateTo}` : 'Coverage unknown';
}
export function snapshotWindows(surface: ReportSurfaceContext, dimension: string) {
  return [...new Set((surface.measurements ?? []).filter(r => r.breakdownType === dimension).map(measurementWindow))].sort();
}
function dimensionValue(row: ReportSnapshotMeasurement, key: string) {
  return [row.dimension1, row.dimension2].find(d => d.key === key)?.value || 'Unknown';
}
/** Sum only complete additive measurements; ratios always use the corresponding aggregate inputs. */
export function snapshotMetric(rows: ReportSnapshotMeasurement[], metric: BreakdownMetric): number | null {
  const sum = (key: ReportMetricKey) => rows.length && rows.every(r => typeof r.values[key] === 'number' && Number.isFinite(r.values[key]))
    ? rows.reduce((total, row) => total + row.values[key]!, 0) : null;
  if (moneyMetrics.has(metric)) {
    const currencies = new Set(rows.map(r => r.currencyCode));
    if (currencies.size !== 1 || currencies.has(null) || currencies.has('MIXED')) return null;
  }
  if (metric === 'reach') return rows.length === 1 ? sum('reach') : null;
  const ratio = (a: ReportMetricKey, b: ReportMetricKey, factor = 1) => {
    const numerator = sum(a), denominator = sum(b);
    return numerator != null && denominator != null && denominator > 0 ? numerator / denominator * factor : null;
  };
  if (metric === 'ctr') return ratio('clicks', 'impressions', 100);
  if (metric === 'cpc') return ratio('spend', 'clicks');
  if (metric === 'cpm') return ratio('spend', 'impressions', 1000);
  if (metric === 'costPerResult') return ratio('spend', 'conversion');
  return sum(metric);
}
export function buildSnapshotBreakdown(surface: ReportSurfaceContext, dimension: string, metric: BreakdownMetric, window: string, view: AudienceView = 'age_gender') {
  const rows = (surface.measurements ?? []).filter(r => r.breakdownType === dimension && measurementWindow(r) === window);
  const unknown = window === 'Coverage unknown';
  const groups = new Map<string, { label: string; rows: ReportSnapshotMeasurement[] }>();
  rows.forEach((row, index) => {
    let label = dimension === 'age_gender'
      ? view === 'age' ? dimensionValue(row, 'age') : view === 'gender' ? dimensionValue(row, 'gender')
        : `${dimensionValue(row, 'age')} · ${dimensionValue(row, 'gender')}`
      : [row.dimension1.value, row.dimension2.value].filter(Boolean).join(' · ') || 'Unknown';
    // Unverified windows cannot be assumed compatible even for the same entity/dimension.
    const key = unknown ? `${index}:${label}` : label;
    if (unknown) label += ` · ${row.entityId ?? `Source ${index + 1}`}`;
    const group = groups.get(key) ?? { label, rows: [] };
    group.rows.push(row); groups.set(key, group);
  });
  const currencies = new Set(rows.map(r => r.currencyCode));
  const currency = currencies.size === 1 ? [...currencies][0] : null;
  const deliveryOnly = ['publisher_platform', 'platform_position', 'impression_device'].includes(dimension);
  const unsupported = deliveryOnly && ['conversion', 'costPerResult'].includes(metric);
  const items = [...groups].map(([key, group]) => ({ key, label: group.label,
    value: unsupported || (moneyMetrics.has(metric) && (!currency || currency === 'MIXED')) ? null : snapshotMetric(group.rows, metric),
    measurements: group.rows.length,
  })).sort((a, b) => a.value == null ? b.value == null ? a.label.localeCompare(b.label) : 1 : b.value == null ? -1 : b.value - a.value || a.label.localeCompare(b.label));
  const max = Math.max(0, ...items.map(r => r.value ?? 0));
  return { items: items.map(r => ({ ...r, proportion: r.value == null || max === 0 ? 0 : r.value / max })), currency,
    reason: unsupported ? 'This source contains delivery metrics only; attributed results are unavailable.'
      : moneyMetrics.has(metric) && rows.length && (!currency || currency === 'MIXED') ? 'Monetary comparisons require one known currency.'
      : metric === 'reach' ? 'Reach is shown only for a single verified measurement; overlapping unique audiences cannot be summed.' : null };
}
