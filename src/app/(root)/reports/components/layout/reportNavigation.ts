import { buildReportUrl } from '@/lib/shared/utils/reports';
import type { ReportPayload, ReportFilterOptions } from '@/lib/server/reports/types';
export function resolveScope(params: URLSearchParams) {
  if (params.get('ad_id')) {
    return 'ad';
  }

  if (params.get('adset_id')) {
    return 'adset';
  }

  if (params.get('campaign_id')) {
    return 'campaign';
  }

  if (params.get('ad_account_id')) {
    return 'ad_account';
  }

  if (params.get('platform_integration_id')) {
    return 'platform';
  }

  return 'business';
}

export function getActiveFilterCount(payload: ReportPayload) {
  let count = 0;

  if (payload.query.platformIntegrationId) {
    count += 1;
  }

  if (payload.query.adAccountIds.length > 0) {
    count += 1;
  }

  if (payload.query.campaignIds.length > 0) {
    count += 1;
  }

  if (payload.query.adsetIds.length > 0) {
    count += 1;
  }

  if (payload.query.adIds.length > 0) {
    count += 1;
  }

  return count;
}

type ReportBreadcrumbItem = {
  label: string;
  href: string | null;
};

function findFilterLabel(
  options: Array<{ id: string; label: string }>,
  id: string | null | undefined,
  fallback: string
) {
  if (!id) {
    return fallback;
  }

  return options.find((option) => option.id === id)?.label ?? fallback;
}

export function buildReportBreadcrumbs(
  payload: ReportPayload,
  filterOptions: ReportFilterOptions
): ReportBreadcrumbItem[] {
  const items: ReportBreadcrumbItem[] = [];
  const { query } = payload;

  if (query.platformIntegrationId) {
    items.push({
      label: findFilterLabel(filterOptions.platforms, query.platformIntegrationId, 'Platform'),
      href:
        query.adAccountIds.length > 0 ||
        query.campaignIds.length > 0 ||
        query.adsetIds.length > 0 ||
        query.adIds.length > 0
          ? buildReportUrl({
              scope: 'platform',
              platformIntegrationId: query.platformIntegrationId,
              dateFrom: query.dateFrom,
              dateTo: query.dateTo,
              groupBy: query.groupBy,
              compareMode: query.compareMode,
              rangeMode: query.rangeMode,
            })
          : null,
    });
  }

  if (query.adAccountIds.length === 1) {
    items.push({
      label: findFilterLabel(filterOptions.adAccounts, query.adAccountIds[0], 'Ad account'),
      href:
        query.campaignIds.length > 0 || query.adsetIds.length > 0 || query.adIds.length > 0
          ? buildReportUrl({
              scope: 'ad_account',
              platformIntegrationId: query.platformIntegrationId,
              adAccountIds: [query.adAccountIds[0]],
              dateFrom: query.dateFrom,
              dateTo: query.dateTo,
              groupBy: query.groupBy,
              compareMode: query.compareMode,
              rangeMode: query.rangeMode,
            })
          : null,
    });
  }

  if (query.campaignIds.length === 1) {
    items.push({
      label: findFilterLabel(filterOptions.campaigns, query.campaignIds[0], 'Campaign'),
      href:
        query.adsetIds.length > 0 || query.adIds.length > 0
          ? buildReportUrl({
              scope: 'campaign',
              platformIntegrationId: query.platformIntegrationId,
              adAccountIds: query.adAccountIds,
              campaignIds: [query.campaignIds[0]],
              dateFrom: query.dateFrom,
              dateTo: query.dateTo,
              groupBy: query.groupBy,
              compareMode: query.compareMode,
              rangeMode: query.rangeMode,
            })
          : null,
    });
  }

  if (query.adsetIds.length === 1) {
    items.push({
      label: findFilterLabel(filterOptions.adsets, query.adsetIds[0], 'Ad set'),
      href:
        query.adIds.length > 0
          ? buildReportUrl({
              scope: 'adset',
              platformIntegrationId: query.platformIntegrationId,
              adAccountIds: query.adAccountIds,
              campaignIds: query.campaignIds,
              adsetIds: [query.adsetIds[0]],
              dateFrom: query.dateFrom,
              dateTo: query.dateTo,
              groupBy: query.groupBy,
              compareMode: query.compareMode,
              rangeMode: query.rangeMode,
            })
          : null,
    });
  }

  if (query.adIds.length === 1) {
    items.push({
      label: findFilterLabel(filterOptions.ads, query.adIds[0], 'Ad'),
      href: null,
    });
  }

  return items;
}

