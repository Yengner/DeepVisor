import 'server-only';

import { buildReportPayload } from './buildReportPayload';
import { reportMetricValue } from '@/lib/shared/reports/metrics';
import type { ReportPayload, ReportQueryInput } from '@/lib/server/reports/types';

export async function buildReportCsvRows(query: ReportQueryInput) {
  const payload = await buildReportPayload(query);

  return reportCsvRows(payload);
}

export function reportCsvRows(payload: ReportPayload) {
  return payload.breakdown.rows.map((row) => ({
    id: row.id,
    name: row.name,
    level: row.level,
    status: row.status ?? '',
    primary_context: row.primaryContext ?? '',
    secondary_context: row.secondaryContext ?? '',
    spend: reportMetricValue(row, "spend") ?? "",
    reach: reportMetricValue(row, "reach") ?? "",
    impressions: reportMetricValue(row, "impressions") ?? "",
    clicks: reportMetricValue(row, "clicks") ?? "",
    link_clicks: reportMetricValue(row, "linkClicks") ?? "",
    leads: reportMetricValue(row, "leads") ?? "",
    messages: reportMetricValue(row, "messages") ?? "",
    conversion: reportMetricValue(row, "conversion") ?? "",
    conversion_rate: reportMetricValue(row, "conversionRate") ?? "",
    cost_per_result: reportMetricValue(row, "costPerResult") ?? "",
    ctr: reportMetricValue(row, "ctr") ?? "",
    cpc: reportMetricValue(row, "cpc") ?? "",
    cpm: reportMetricValue(row, "cpm") ?? "",
    frequency: reportMetricValue(row, "frequency") ?? "",
    start_date: row.startDate ?? '',
    end_date: row.endDate ?? '',
    report_date_from: payload.query.dateFrom,
    report_date_to: payload.query.dateTo,
    account_timezone: payload.meta.timezone ?? 'unknown',
    currency: payload.meta.currencyCode ?? 'unknown',
    unavailable_metrics: Object.keys(row.unavailable ?? {}).join(';'),
  }));
}
