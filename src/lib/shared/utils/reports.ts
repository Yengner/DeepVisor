export type ReportUrlScope = 'business' | 'platform' | 'ad_account' | 'campaign' | 'adset' | 'ad';
export type ReportUrlGroupBy = 'day' | 'week' | 'month';
export type ReportUrlCompareMode = 'none' | 'previous_period';

export type BuildReportUrlInput = {
  scope?: ReportUrlScope | null;
  platformIntegrationId?: string | null;
  adAccountIds?: string[];
  campaignIds?: string[];
  adsetIds?: string[];
  adIds?: string[];
  dateFrom?: string | null;
  dateTo?: string | null;
  groupBy?: ReportUrlGroupBy | null;
  compareMode?: ReportUrlCompareMode | null;
  demo?: boolean;
};

function normalizeIds(values: string[] | undefined): string[] {
  return Array.from(new Set((values ?? []).map((value) => value.trim()).filter(Boolean)));
}

function inferReportScope(input: {
  platformIntegrationId?: string | null;
  adAccountIds: string[];
  campaignIds: string[];
  adsetIds: string[];
  adIds: string[];
}): ReportUrlScope {
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

export function buildReportUrl(input: BuildReportUrlInput): string {
  const platformIntegrationId = input.platformIntegrationId?.trim() || null;
  const adAccountIds = normalizeIds(input.adAccountIds);
  const campaignIds = normalizeIds(input.campaignIds);
  const adsetIds = normalizeIds(input.adsetIds);
  const adIds = normalizeIds(input.adIds);
  const scope =
    input.scope ??
    inferReportScope({
      platformIntegrationId,
      adAccountIds,
      campaignIds,
      adsetIds,
      adIds,
    });

  const params = new URLSearchParams();
  params.set('scope', scope);

  if (platformIntegrationId) {
    params.set('platform_integration_id', platformIntegrationId);
  }

  if (adAccountIds.length > 0) {
    params.set('ad_account_id', adAccountIds.join(','));
  }

  if (campaignIds.length > 0) {
    params.set('campaign_id', campaignIds.join(','));
  }

  if (adsetIds.length > 0) {
    params.set('adset_id', adsetIds.join(','));
  }

  if (adIds.length > 0) {
    params.set('ad_id', adIds.join(','));
  }

  if (input.dateFrom) {
    params.set('date_from', input.dateFrom);
  }

  if (input.dateTo) {
    params.set('date_to', input.dateTo);
  }

  if (input.groupBy) {
    params.set('group_by', input.groupBy);
  }

  if (input.compareMode && input.compareMode !== 'none') {
    params.set('compare', input.compareMode);
  }

  if (input.demo) {
    params.set('demo', '1');
  }

  const query = params.toString();
  return query ? `/reports?${query}` : '/reports';
}
