import { completedReportRange, isReportDate } from '@/lib/shared/reports/dates';
import type {
  ReportCompareMode,
  ReportGroupBy,
  ReportQueryInput,
  ReportScope,
} from './types';

function toArray(value: string | string[] | undefined): string[] {
  if (!value) {
    return [];
  }

  const raw = Array.isArray(value) ? value.join(',') : value;
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean).filter((id, index, ids) => ids.indexOf(id) === index);
}

function resolveDefaultGroupBy(dateFrom: string, dateTo: string): ReportGroupBy {
  const start = new Date(`${dateFrom}T00:00:00.000Z`);
  const end = new Date(`${dateTo}T00:00:00.000Z`);
  const days = Math.max(
    1,
    Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1
  );

  if (days <= 31) {
    return 'day';
  }

  if (days <= 180) {
    return 'week';
  }

  return 'month';
}

function inferScope(input: {
  platformIntegrationId?: string | null;
  adAccountIds: string[];
  campaignIds: string[];
  adsetIds: string[];
  adIds: string[];
}): ReportScope {
  if (input.adIds.length > 0) {
    return 'ad';
  }

  if (input.adsetIds.length > 0) {
    return 'adset';
  }

  if (input.campaignIds.length > 0) {
    return 'campaign';
  }

  if (input.adAccountIds.length > 0) {
    return 'ad_account';
  }

  if (input.platformIntegrationId) {
    return 'platform';
  }

  return 'business';
}

export function parseReportQueryInput(
  businessId: string,
  searchParams: Record<string, string | string[] | undefined>,
  now = new Date()
): ReportQueryInput {
  const defaults = completedReportRange(now.toISOString().slice(0, 10), 30);
  const adAccountIds = toArray(searchParams.ad_account_id);
  const campaignIds = toArray(searchParams.campaign_id);
  const adsetIds = toArray(searchParams.adset_id);
  const adIds = toArray(searchParams.ad_id);
  const platformIntegrationId = toArray(searchParams.platform_integration_id)[0] ?? null;
  const requestedScope = toArray(searchParams.scope)[0] as ReportScope | undefined;
  const dateFrom = toArray(searchParams.date_from)[0];
  const dateTo = toArray(searchParams.date_to)[0];
  const requestedRangeMode = toArray(searchParams.range)[0];

  if ((dateFrom || dateTo) && (!dateFrom || !dateTo || !isReportDate(dateFrom) || !isReportDate(dateTo) || dateFrom > dateTo)) {
    throw new Error('Report dates must be a valid, ordered calendar date range.');
  }
  const preset = toArray(searchParams.preset)[0];
  if (preset && !['7', '30', '90'].includes(preset)) throw new Error('Invalid report preset.');
  const presetDays = preset ? Number(preset) as 7 | 30 | 90 : !dateFrom && requestedRangeMode !== 'max' ? 30 : undefined;
  const placeholderRange = presetDays ? completedReportRange(now.toISOString().slice(0, 10), presetDays) : defaults;
  const normalizedDateFrom = dateFrom ?? placeholderRange.dateFrom;
  const normalizedDateTo = dateTo ?? placeholderRange.dateTo;
  const compare = toArray(searchParams.compare)[0];
  const groupBy = toArray(searchParams.group_by)[0] as ReportGroupBy | undefined;
  const rangeMode = requestedRangeMode === 'max' ? 'max' : 'date_range';

  return {
    businessId,
    scope:
      !adIds.length && !adsetIds.length && !campaignIds.length && !adAccountIds.length && requestedScope &&
      ['business', 'platform', 'ad_account', 'campaign', 'adset', 'ad'].includes(requestedScope)
        ? requestedScope
        : inferScope({
            platformIntegrationId,
            adAccountIds,
            campaignIds,
            adsetIds,
            adIds,
          }),
    platformIntegrationId,
    adAccountIds,
    campaignIds,
    adsetIds,
    adIds,
    dateFrom: normalizedDateFrom,
    dateTo: normalizedDateTo,
    groupBy:
      rangeMode === 'max'
        ? 'month'
        : groupBy && ['day', 'week', 'month'].includes(groupBy)
          ? groupBy
          : resolveDefaultGroupBy(normalizedDateFrom, normalizedDateTo),
    compareMode:
      rangeMode === 'date_range' && compare === 'previous_period'
        ? ('previous_period' satisfies ReportCompareMode)
        : ('none' satisfies ReportCompareMode),
    rangeMode,
    presetDays: rangeMode === "max" ? undefined : presetDays,
  };
}
