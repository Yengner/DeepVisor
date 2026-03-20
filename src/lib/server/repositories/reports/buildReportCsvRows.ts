import 'server-only';

import { buildReportPayload } from './buildReportPayload';
import type { ReportQueryInput } from '@/lib/server/reports/types';

export async function buildReportCsvRows(query: ReportQueryInput) {
  const payload = await buildReportPayload(query);

  return payload.breakdown.rows.map((row) => ({
    id: row.id,
    name: row.name,
    level: row.level,
    status: row.status ?? '',
    primary_context: row.primaryContext ?? '',
    secondary_context: row.secondaryContext ?? '',
    spend: row.spend,
    reach: row.reach,
    impressions: row.impressions,
    clicks: row.clicks,
    link_clicks: row.linkClicks,
    leads: row.leads,
    messages: row.messages,
    conversion: row.conversion,
    conversion_rate: row.conversionRate,
    cost_per_result: row.costPerResult,
    ctr: row.ctr,
    cpc: row.cpc,
    cpm: row.cpm,
    frequency: row.frequency,
    start_date: row.startDate ?? '',
    end_date: row.endDate ?? '',
  }));
}
