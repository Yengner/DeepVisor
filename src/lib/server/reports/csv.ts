import type { ReportPayload } from './types';
import { buildReportExportRecords, EXPORT_METRICS } from '@/lib/shared/reports/exportRecords';
const metricColumns = { spend: 'spend', conversion: 'conversion', costPerResult: 'cost_per_result', impressions: 'impressions', clicks: 'clicks', linkClicks: 'link_clicks', ctr: 'ctr', cpc: 'cpc', cpm: 'cpm', leads: 'leads', messages: 'messages', calls: 'calls', conversionRate: 'conversion_rate', reach: 'reach', frequency: 'frequency' } as const;
export const REPORT_CSV_HEADERS = ['row_type', 'context', 'id', 'name', 'level', 'status', 'primary_context', 'secondary_context',
  ...EXPORT_METRICS.map(([key]) => metricColumns[key]), 'start_date', 'end_date', 'measurement_basis', 'coverage', 'observations',
  'report_date_from', 'report_date_to', 'range_mode', 'group_by', 'compare_mode', 'scope', 'ad_account_ids', 'campaign_ids', 'adset_ids', 'ad_ids',
  'account_timezone', 'currency', 'unavailable_metrics', 'notes', 'data_source', 'generated_at'] as const;
/** Protect spreadsheet formulas in text while preserving actual numeric values (including negatives). */
export function escapeReportCsv(value: string | number | null | undefined): string {
  let text = String(value ?? '');
  if (typeof value === 'string' && /^[\s]*[=+@-]/.test(text)) text = `'${text}`;
  return /[,"\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
export function reportWorkspaceCsvRows(payload: ReportPayload, demo = false): Array<Record<string, string | number>> {
  return buildReportExportRecords(payload).map(row => ({ row_type: row.kind, context: row.context, id: row.id, name: row.label,
    level: row.level, status: row.status, primary_context: row.primaryContext ?? '', secondary_context: row.secondaryContext ?? '',
    ...Object.fromEntries(EXPORT_METRICS.map(([key]) => [metricColumns[key], row.values[key] ?? ''])),
    start_date: row.from ?? '', end_date: row.to ?? '', measurement_basis: row.basis, coverage: row.coverage, observations: row.observations ?? '',
    report_date_from: payload.query.dateFrom, report_date_to: payload.query.dateTo, range_mode: payload.query.rangeMode ?? 'date_range',
    group_by: payload.query.groupBy, compare_mode: payload.query.compareMode, scope: payload.query.scope,
    ad_account_ids: payload.query.adAccountIds.join(';'), campaign_ids: payload.query.campaignIds.join(';'), adset_ids: payload.query.adsetIds.join(';'), ad_ids: payload.query.adIds.join(';'),
    account_timezone: payload.meta.timezone ?? 'unknown', currency: row.currency ?? 'unknown',
    unavailable_metrics: EXPORT_METRICS.filter(([key]) => row.values[key] == null).map(([key]) => metricColumns[key]).join(';'),
    notes: row.note, data_source: demo ? 'demo' : 'saved_account_data', generated_at: payload.meta.generatedAt,
  }));
}
export function renderReportCsv(payload: ReportPayload, demo = false) {
  const rows = reportWorkspaceCsvRows(payload, demo);
  return [REPORT_CSV_HEADERS.join(','), ...rows.map(row => REPORT_CSV_HEADERS.map(key => escapeReportCsv(row[key])).join(','))].join('\r\n');
}
