import type { ReportPayload } from '@/lib/server/reports/types';
export function reportExportUrl(query: ReportPayload['query'], demo: boolean) {
  const params = new URLSearchParams({ scope: query.scope, date_from: query.dateFrom, date_to: query.dateTo, group_by: query.groupBy, compare: query.compareMode });
  if (query.rangeMode === 'max') params.set('range', 'max');
  if (query.platformIntegrationId) params.set('platform_integration_id', query.platformIntegrationId);
  for (const [key, ids] of [['ad_account_id', query.adAccountIds], ['campaign_id', query.campaignIds], ['adset_id', query.adsetIds], ['ad_id', query.adIds]] as const) if (ids.length) params.set(key, ids.join(','));
  if (demo) params.set('demo', '1');
  return { pdf: `/api/reports/pdf?${params}`, csv: `/api/reports/csv?${params}` };
}
