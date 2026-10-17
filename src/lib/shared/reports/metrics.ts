import type { ReportMetricKey, ReportMetricTotals, ReportMetricAvailability } from '@/lib/server/reports/types';

export type ReportMetricInput = {
  spend: number | null; impressions: number | null; clicks: number | null;
  inline_link_clicks: number | null; leads: number | null; messages: number | null; calls: number | null;
  reach?: number | null; currency_code: string | null; unavailable?: ReportMetricAvailability;
};
const additive = {
  spend: 'spend', impressions: 'impressions', clicks: 'clicks', linkClicks: 'inline_link_clicks',
  leads: 'leads', messages: 'messages', calls: 'calls',
} as const;
const monetary = new Set<ReportMetricKey>(['spend', 'costPerResult', 'cpc', 'cpm']);
export function reportMetricValue(totals: ReportMetricTotals, key: ReportMetricKey): number | null {
  return totals.unavailable?.[key] || !Number.isFinite(totals[key]) ? null : totals[key];
}
/** Numeric fields remain compatible with legacy consumers; unavailable is authoritative for reporting. */
export function aggregateReportMetrics(rows: ReportMetricInput[]): ReportMetricTotals {
  const unavailable: ReportMetricAvailability = {
    reach: 'Period-unique reach is not available from overlapping aggregate rows.',
    frequency: 'Frequency requires verified period-unique reach.',
  };
  const values = {} as Record<ReportMetricKey, number>;
  for (const [key, source] of Object.entries(additive) as Array<[keyof typeof additive, typeof additive[keyof typeof additive]]>) {
    values[key] = rows.reduce((sum, row) => sum + (typeof row[source] === 'number' && Number.isFinite(row[source]) ? row[source]! : 0), 0);
    if (!rows.length || rows.some(r => r[source] == null || !Number.isFinite(r[source]) || r.unavailable?.[key])) {
      unavailable[key] = 'Missing source measurements.';
    }
  }
  const currencies = new Set(rows.map(r => r.currency_code));
  if (currencies.size !== 1 || currencies.has(null) || currencies.has('MIXED')) {
    for (const key of monetary) unavailable[key] = 'A single known currency is required.';
  }
  values.reach = 0; values.frequency = 0;
  values.conversion = values.leads + values.messages + values.calls;
  if (['leads', 'messages', 'calls'].some(k => unavailable[k as ReportMetricKey])) unavailable.conversion = 'Result measurements are unavailable.';
  const ratio = (key: ReportMetricKey, numerator: ReportMetricKey, denominator: ReportMetricKey, factor = 1) => {
    values[key] = values[denominator] > 0 ? values[numerator] / values[denominator] * factor : 0;
    if (unavailable[numerator] || unavailable[denominator] || values[denominator] <= 0) {
      unavailable[key] = 'Available measurements and a positive denominator are required.';
    }
  };
  ratio('ctr', 'clicks', 'impressions', 100);
  ratio('cpc', 'spend', 'clicks'); ratio('cpm', 'spend', 'impressions', 1000);
  ratio('costPerResult', 'spend', 'conversion'); ratio('conversionRate', 'conversion', 'clicks', 100);
  return { ...values, unavailable };
}
export function reportMetricDelta(current: ReportMetricTotals, previous: ReportMetricTotals | null, key: ReportMetricKey): number | null {
  const value = reportMetricValue(current, key), prior = previous && reportMetricValue(previous, key);
  if (value == null || prior == null) return null;
  if (key === 'ctr' || key === 'conversionRate') return value - prior;
  return prior > 0 ? (value - prior) / prior * 100 : null;
}
export function metricDirection(key: ReportMetricKey, delta: number | null): 'favorable' | 'unfavorable' | 'neutral' {
  if (delta == null || delta === 0 || ['spend', 'impressions', 'clicks', 'reach', 'frequency', 'cpm'].includes(key)) return 'neutral';
  const lowerIsBetter = ['costPerResult', 'cpc'].includes(key);
  return (lowerIsBetter ? delta < 0 : delta > 0) ? 'favorable' : 'unfavorable';
}
export function formatReportMetric(totals: ReportMetricTotals, key: ReportMetricKey, currency: string | null): string {
  const value = reportMetricValue(totals, key);
  if (value == null || (monetary.has(key) && (!currency || currency === 'MIXED'))) return '—';
  if (monetary.has(key)) return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency!, maximumFractionDigits: 2 }).format(value);
  if (key === 'ctr' || key === 'conversionRate') return `${value.toFixed(2)}%`;
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

export function sourceUnavailable(row: Record<string, unknown>): ReportMetricAvailability {
  const unavailable: ReportMetricAvailability = {};
  for (const [key, source] of Object.entries(additive)) {
    const value = row[source];
    if (value == null || value === '' || !Number.isFinite(Number(value))) unavailable[key as ReportMetricKey] = 'Missing source measurements.';
  }
  return unavailable;
}

export function buildReportKpis(input: {
  totals: ReportMetricTotals; previousTotals: ReportMetricTotals | null; currencyCode: string | null;
}): import('@/lib/server/reports/types').ReportKpi[] {
  const definitions = [
    ['spend', 'Spend'], ['conversion', 'Results'], ['impressions', 'Impressions'], ['clicks', 'Clicks'],
    ['ctr', 'CTR'], ['cpc', 'CPC'], ['cpm', 'CPM'], ['costPerResult', 'Cost / Result'],
  ] as const;
  return definitions.map(([key, label]) => {
    const delta = reportMetricDelta(input.totals, input.previousTotals, key);
    return {
      key, label, value: input.totals[key],
      formattedValue: formatReportMetric(input.totals, key, input.currencyCode),
      unavailableReason: input.totals.unavailable?.[key],
      deltaPercent: delta, deltaUnit: key === 'ctr' ? 'percentage_points' : 'percent',
      direction: metricDirection(key, delta),
    };
  });
}
