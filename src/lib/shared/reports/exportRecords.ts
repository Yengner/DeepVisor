import type { ReportMetricKey, ReportMetricTotals, ReportPayload } from '@/lib/server/reports/types';
import { reportMetricDelta, reportMetricValue } from './metrics';
import { BREAKDOWN_METRICS, buildSnapshotBreakdown, snapshotWindows, moneyMetrics } from './breakdowns';
import { buildPerformanceChart, PERFORMANCE_METRICS } from './performance';
import { advertisingGroups } from './advertising';
import { buildTimeAnalysis, WEEKDAYS } from './timeAnalysis';
import { findingEvidence } from './findings';
import { coverageLabel } from './coverage';
export const EXPORT_METRICS = [
  ['spend', 'Spend'], ['conversion', 'Results'], ['costPerResult', 'Cost per result'], ['impressions', 'Impressions'],
  ['clicks', 'Clicks'], ['linkClicks', 'Link clicks'], ['ctr', 'CTR'], ['cpc', 'CPC'], ['cpm', 'CPM'],
  ['leads', 'Leads'], ['messages', 'Messages'], ['calls', 'Calls'], ['conversionRate', 'Result rate'], ['reach', 'Reach'], ['frequency', 'Frequency'],
] as const satisfies ReadonlyArray<readonly [ReportMetricKey, string]>;
export interface ReportExportRecord {
  kind: 'summary' | 'period' | 'previous_summary' | 'previous_period' | 'change' | 'advertising' | 'snapshot' | 'hourly' | 'finding' | 'coverage';
  context: string; id: string; label: string; level: string; status: string;
  from: string | null; to: string | null; currency: string | null;
  basis: 'period' | 'snapshot' | 'evidence'; coverage: string; note: string;
  values: Partial<Record<ReportMetricKey, number | null>>;
  observations?: number;
  primaryContext?: string | null; secondaryContext?: string | null;
}
function totalsValues(totals: ReportMetricTotals, currency: string | null) {
  return Object.fromEntries(EXPORT_METRICS.map(([key]) => [key, moneyMetrics.has(key) && (!currency || currency === 'MIXED') ? null : reportMetricValue(totals, key)]));
}
/** One numerical export contract for PDF and CSV; local chart choices never silently narrow the report. */
export function buildReportExportRecords(payload: ReportPayload): ReportExportRecord[] {
  const currency = payload.meta.currencyCode, q = payload.query;
  const base = { id: '', level: '', status: '', from: q.dateFrom, to: q.dateTo, currency,
    basis: 'period' as const, coverage: coverageLabel(payload.meta.coverage), note: '' };
  const records: ReportExportRecord[] = [{ ...base, kind: 'summary', context: 'Selected report', label: 'Selected-period totals', values: totalsValues(payload.summary, currency),
    note: [...payload.meta.warnings ?? [], payload.comparison.disabledReason ?? ''].filter(Boolean).join(' ') }];
  const chartModels = PERFORMANCE_METRICS.map(([metric]) => [metric, buildPerformanceChart(payload, metric)] as const);
  const points = chartModels[0][1].points;
  points.forEach((p, index) => {
    const source = payload.series.find(point => point.startDate <= p.date && point.endDate >= p.endDate);
    records.push({ ...base, kind: 'period', context: 'Selected report', label: `${p.date} / ${p.endDate}`, from: p.date, to: p.endDate,
      values: { ...(source ? totalsValues(source, currency) : Object.fromEntries(EXPORT_METRICS.map(([key]) => [key, null]))),
        ...Object.fromEntries(chartModels.map(([metric, model]) => [metric, model.points[index]?.current ?? null])) } });
  });
  if (payload.comparison.previousTotals && q.compareMode === 'previous_period' && !payload.comparison.disabledReason && !payload.meta.comparisonDisabledReason) {
    const previousBase = { ...base, from: payload.comparison.previousDateFrom, to: payload.comparison.previousDateTo, coverage: coverageLabel(payload.comparison.coverage) };
    records.push({ ...previousBase, kind: 'previous_summary', context: 'Previous period', label: 'Previous-period totals', values: totalsValues(payload.comparison.previousTotals, currency) });
    for (const point of payload.comparison.previousSeries ?? []) {
      const from = previousBase.from && point.startDate < previousBase.from ? previousBase.from : point.startDate;
      const to = previousBase.to && point.endDate > previousBase.to ? previousBase.to : point.endDate;
      records.push({ ...previousBase, kind: 'previous_period', context: 'Previous period', label: `${from} / ${to}`,
        from, to, values: totalsValues(point, currency) });
    }
    records.push({ ...base, kind: 'change', context: 'Previous-period comparison', label: 'Change from previous period', currency: null,
      note: 'CTR and result rate changes are percentage points (pp); other changes are percent (%). Zero-baseline changes are unavailable.',
      values: Object.fromEntries(EXPORT_METRICS.map(([key]) => [key, moneyMetrics.has(key) && (!currency || currency === 'MIXED') ? null : reportMetricDelta(payload.summary, payload.comparison.previousTotals, key)])) });
  }
  for (const group of advertisingGroups(payload)) for (const row of group.rows) records.push({ ...base, kind: 'advertising', context: `${group.context}: ${group.label}`,
    id: row.id, label: row.name, level: row.level, status: row.status ?? 'Unknown', from: row.startDate, to: row.endDate,
    primaryContext: row.primaryContext, secondaryContext: row.secondaryContext,
    note: [row.creativeContext, 'Recorded status is separate from selected-period results.'].filter(Boolean).join(' '), values: totalsValues(row, currency) });
  const dimensions = ['age_gender', 'country', 'region', 'dma', 'publisher_platform', 'platform_position', 'impression_device'];
  for (const dimension of dimensions) {
    const windows = snapshotWindows(payload.surface, dimension);
    if (!windows.length) records.push({ ...base, kind: 'coverage', context: dimension, label: 'No snapshot measurements', basis: 'snapshot', from: null, to: null,
      coverage: coverageLabel(payload.surface.coverage?.[dimension]), values: {}, note: 'Snapshot coverage is independent of report dates.' });
    for (const window of windows) {
      const models = BREAKDOWN_METRICS.map(([metric]) => [metric, buildSnapshotBreakdown(payload.surface, dimension, metric, window)] as const);
      const bounds = window === 'Coverage unknown' ? [null, null] : window.split(' / ');
      for (const item of models[0][1].items) records.push({ ...base, kind: 'snapshot', context: dimension, id: item.key, label: item.label,
        basis: 'snapshot', from: bounds[0], to: bounds[1], currency: models[0][1].currency, coverage: window,
        observations: item.measurements, note: [...new Set(models.flatMap(([, model]) => model.reason ? [model.reason] : []))].join(' '),
        values: Object.fromEntries(models.map(([metric, model]) => [metric, model.items.find(r => r.key === item.key)?.value ?? null])) });
    }
  }
  for (const mode of (payload.meta.timezone ? ['total', 'average'] as const : [])) {
    const models = PERFORMANCE_METRICS.map(([metric]) => [metric, buildTimeAnalysis(payload.surface, metric, mode, currency)] as const);
    for (const cell of models[0][1]) {
      if (!cell.observations) continue;
      records.push({ ...base, kind: 'hourly', context: mode === 'total' ? 'Observed hourly totals' : 'Average per observed date/hour', id: cell.key,
        label: `${WEEKDAYS[cell.day]} ${cell.hour}:00`, from: cell.dates[0], to: cell.dates.at(-1)!, coverage: coverageLabel(payload.surface.coverage?.hourly), observations: cell.observations,
        note: `Observed dates: ${cell.dates.join('; ')}. Ratios use aggregated measurements, not averages of ratios.`,
        values: Object.fromEntries(models.map(([metric, cells]) => [metric, cells.find(c => c.key === cell.key)?.value ?? null])) });
    }
  }
  if (!payload.meta.timezone || !payload.surface.hourlyTrendExpanded.length) records.push({ ...base, kind: 'coverage', context: 'Hourly', label: 'No hourly observations', from: null, to: null,
    coverage: payload.meta.timezone ? coverageLabel(payload.surface.coverage?.hourly) : 'Timezone unknown', values: {}, note: !payload.meta.timezone ? 'Hourly analysis requires a verified account timezone.' : '' });
  for (const finding of payload.findings) {
    const evidence = findingEvidence(finding), known = evidence.window !== 'Measurement window unknown';
    records.push({ ...base, kind: 'finding', context: 'Saved findings', id: finding.id, label: finding.title, status: finding.status, basis: 'evidence',
      from: known ? finding.metricSnapshot.periodStart! : null, to: known ? finding.metricSnapshot.periodEnd! : null, coverage: evidence.window,
      note: `${finding.severity}; confidence: ${finding.confidence}; detected: ${finding.detectedAt}. ${finding.summary} ${finding.reason ?? ''}`,
      observations: typeof finding.metricSnapshot.occurrenceCount === 'number' ? finding.metricSnapshot.occurrenceCount : undefined,
      values: Object.fromEntries(evidence.metrics.filter(m => m.key !== 'occurrenceCount').map(m => [m.key === 'results' ? 'conversion' : m.key,
        moneyMetrics.has(m.key as ReportMetricKey) && (!currency || currency === 'MIXED') ? null : m.value])) });
  }
  return records;
}
