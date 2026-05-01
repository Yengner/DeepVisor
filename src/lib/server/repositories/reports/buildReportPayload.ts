import 'server-only';

import { createSupabaseClient } from '@/lib/server/supabase/server';
import { parseDailyMetricsRowsFromTimeIncrementMetrics } from '@/lib/server/repositories/ad_accounts/normalizers';
import { derivePerformanceMetrics } from '@/lib/server/repositories/campaigns/normalizers';
import { chunkArray } from '@/lib/server/repositories/utils';
import { buildReportUrl } from '@/lib/shared';
import type { Database } from '@/lib/shared/types/supabase';
import type {
  ReportBreakdownRow,
  ReportComparisonSummary,
  ReportFilterOptions,
  ReportKpi,
  ReportMetricTotals,
  ReportPayload,
  ReportQueryInput,
  ReportRankingContext,
  ReportTimeSeriesPoint,
} from '@/lib/server/reports/types';

type SupabaseClient = Awaited<ReturnType<typeof createSupabaseClient>>;

type MetricsRow = {
  day: string;
  spend: number;
  reach: number;
  impressions: number;
  clicks: number;
  inline_link_clicks: number;
  leads: number;
  messages: number;
  calls: number;
  currency_code: string | null;
};

type BusinessProfileRow = Pick<
  Database['public']['Tables']['business_profiles']['Row'],
  'id' | 'business_name'
>;

type PlatformRow = {
  id: string;
  platform_id: string;
  status: string;
  platforms: { key: string; name: string } | { key: string; name: string }[] | null;
};

type AdAccountRow = Pick<
  Database['public']['Tables']['ad_accounts']['Row'],
  'id' | 'business_id' | 'platform_id' | 'external_account_id' | 'name' | 'status' | 'currency_code'
> & {
  platform_integration_id?: string;
  platform_label?: string;
};

type CampaignDimRow = Pick<
  Database['public']['Tables']['campaign_dims']['Row'],
  'id' | 'ad_account_id' | 'external_id' | 'name' | 'objective' | 'status'
>;

type CampaignPerformanceRow = Pick<
  Database['public']['Tables']['campaigns_performance_daily']['Row'],
  | 'campaign_id'
  | 'day'
  | 'currency_code'
  | 'spend'
  | 'reach'
  | 'impressions'
  | 'clicks'
  | 'inline_link_clicks'
  | 'leads'
  | 'messages'
  | 'calls'
>;

type AdsetDimRow = Pick<
  Database['public']['Tables']['adset_dims']['Row'],
  'id' | 'ad_account_id' | 'campaign_external_id' | 'external_id' | 'name' | 'optimization_goal' | 'status'
>;

type AdsetPerformanceRow = Pick<
  Database['public']['Tables']['adsets_performance_daily']['Row'],
  | 'adset_id'
  | 'day'
  | 'currency_code'
  | 'spend'
  | 'reach'
  | 'impressions'
  | 'clicks'
  | 'inline_link_clicks'
  | 'leads'
  | 'messages'
  | 'calls'
>;

type AdDimRow = Pick<
  Database['public']['Tables']['ad_dims']['Row'],
  'id' | 'ad_account_id' | 'adset_external_id' | 'external_id' | 'name' | 'status' | 'creative_id'
>;

type AdCreativeRow = Pick<
  Database['public']['Tables']['ad_creatives']['Row'],
  'id' | 'platform_creative_id' | 'name' | 'headline' | 'primary_text' | 'description' | 'creative_type'
>;

type AdPerformanceRow = Pick<
  Database['public']['Tables']['ads_performance_daily']['Row'],
  | 'ad_id'
  | 'day'
  | 'currency_code'
  | 'spend'
  | 'reach'
  | 'impressions'
  | 'clicks'
  | 'inline_link_clicks'
  | 'leads'
  | 'messages'
  | 'calls'
>;

type AdAccountTimeseriesRow = Pick<
  Database['public']['Tables']['ad_accounts']['Row'],
  'id' | 'currency_code' | 'time_increment_metrics'
>;

type EntityAggregate = {
  spend: number;
  reach: number;
  impressions: number;
  clicks: number;
  linkClicks: number;
  leads: number;
  messages: number;
  calls: number;
  startDate: string | null;
  endDate: string | null;
  currencyCodes: Set<string>;
};

type FilterContext = {
  business: BusinessProfileRow;
  platforms: Array<{ id: string; platformId: string; label: string; status: string }>;
  adAccounts: AdAccountRow[];
  campaigns: CampaignDimRow[];
  adsets: AdsetDimRow[];
  ads: AdDimRow[];
};

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatDateRange(dateFrom: string, dateTo: string): string {
  return `${dateFrom} to ${dateTo}`;
}

function sumMetrics(rows: MetricsRow[]): ReportMetricTotals {
  let spend = 0;
  let reach = 0;
  let impressions = 0;
  let clicks = 0;
  let linkClicks = 0;
  let leads = 0;
  let messages = 0;
  let calls = 0;

  for (const row of rows) {
    spend += row.spend;
    reach += row.reach;
    impressions += row.impressions;
    clicks += row.clicks;
    linkClicks += row.inline_link_clicks;
    leads += row.leads;
    messages += row.messages;
    calls += row.calls;
  }

  const derived = derivePerformanceMetrics({
    spend,
    reach,
    impressions,
    clicks,
    leads,
    messages,
    calls,
  });

  return {
    spend,
    reach,
    impressions,
    clicks,
    linkClicks,
    leads,
    messages,
    calls,
    conversion: derived.conversion,
    conversionRate: derived.conversion_rate,
    costPerResult: derived.cost_per_result,
    ctr: derived.ctr,
    cpc: derived.cpc,
    cpm: derived.cpm,
    frequency: derived.frequency,
  };
}

function getPreviousPeriodRange(input: Pick<ReportQueryInput, 'dateFrom' | 'dateTo'>) {
  const start = new Date(`${input.dateFrom}T00:00:00.000Z`);
  const end = new Date(`${input.dateTo}T00:00:00.000Z`);
  const days = Math.max(
    1,
    Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1
  );
  const previousEnd = new Date(start);
  previousEnd.setUTCDate(previousEnd.getUTCDate() - 1);
  const previousStart = new Date(previousEnd);
  previousStart.setUTCDate(previousStart.getUTCDate() - (days - 1));

  return {
    dateFrom: toIsoDate(previousStart),
    dateTo: toIsoDate(previousEnd),
  };
}

function groupDateKey(day: string, groupBy: ReportQueryInput['groupBy']) {
  const date = new Date(`${day}T00:00:00.000Z`);

  if (groupBy === 'month') {
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    return {
      key,
      label: key,
      startDate: `${key}-01`,
      endDate: day,
    };
  }

  if (groupBy === 'week') {
    const weekday = date.getUTCDay();
    const diff = weekday === 0 ? -6 : 1 - weekday;
    const start = new Date(date);
    start.setUTCDate(start.getUTCDate() + diff);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 6);

    return {
      key: toIsoDate(start),
      label: `${toIsoDate(start)} - ${toIsoDate(end)}`,
      startDate: toIsoDate(start),
      endDate: toIsoDate(end),
    };
  }

  return {
    key: day,
    label: day,
    startDate: day,
    endDate: day,
  };
}

function formatCurrency(value: number, currencyCode: string | null): string {
  if (!currencyCode || currencyCode === 'MIXED') {
    return value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `$${value.toFixed(2)}`;
  }
}

function resolveCurrencyCode(rows: MetricsRow[]): string | null {
  const codes = Array.from(new Set(rows.map((row) => row.currency_code).filter(Boolean)));
  if (codes.length === 0) {
    return null;
  }

  if (codes.length === 1) {
    return codes[0] ?? null;
  }

  return 'MIXED';
}

function formatDelta(current: number, previous: number): number | null {
  if (!Number.isFinite(previous) || previous <= 0) {
    return null;
  }

  return ((current - previous) / previous) * 100;
}

function buildKpis(input: {
  totals: ReportMetricTotals;
  previousTotals: ReportMetricTotals | null;
  currencyCode: string | null;
}): ReportKpi[] {
  const { totals, previousTotals, currencyCode } = input;

  return [
    {
      key: 'spend',
      label: 'Spend',
      value: totals.spend,
      formattedValue: formatCurrency(totals.spend, currencyCode),
      deltaPercent: previousTotals ? formatDelta(totals.spend, previousTotals.spend) : null,
    },
    {
      key: 'conversion',
      label: 'Results',
      value: totals.conversion,
      formattedValue: totals.conversion.toLocaleString(),
      deltaPercent: previousTotals ? formatDelta(totals.conversion, previousTotals.conversion) : null,
    },
    {
      key: 'impressions',
      label: 'Impressions',
      value: totals.impressions,
      formattedValue: totals.impressions.toLocaleString(),
      deltaPercent: previousTotals ? formatDelta(totals.impressions, previousTotals.impressions) : null,
    },
    {
      key: 'clicks',
      label: 'Clicks',
      value: totals.clicks,
      formattedValue: totals.clicks.toLocaleString(),
      deltaPercent: previousTotals ? formatDelta(totals.clicks, previousTotals.clicks) : null,
    },
    {
      key: 'ctr',
      label: 'CTR',
      value: totals.ctr,
      formattedValue: `${totals.ctr.toFixed(2)}%`,
      deltaPercent: previousTotals ? formatDelta(totals.ctr, previousTotals.ctr) : null,
    },
    {
      key: 'cpc',
      label: 'CPC',
      value: totals.cpc,
      formattedValue: formatCurrency(totals.cpc, currencyCode),
      deltaPercent: previousTotals ? formatDelta(totals.cpc, previousTotals.cpc) : null,
    },
    {
      key: 'cpm',
      label: 'CPM',
      value: totals.cpm,
      formattedValue: formatCurrency(totals.cpm, currencyCode),
      deltaPercent: previousTotals ? formatDelta(totals.cpm, previousTotals.cpm) : null,
    },
    {
      key: 'costPerResult',
      label: 'Cost / Result',
      value: totals.costPerResult,
      formattedValue: formatCurrency(totals.costPerResult, currencyCode),
      deltaPercent: previousTotals
        ? formatDelta(totals.costPerResult, previousTotals.costPerResult)
        : null,
    },
  ];
}

function groupSeries(rows: MetricsRow[], groupBy: ReportQueryInput['groupBy']): ReportTimeSeriesPoint[] {
  const grouped = new Map<
    string,
    {
      label: string;
      startDate: string;
      endDate: string;
      rows: MetricsRow[];
    }
  >();

  for (const row of rows) {
    const grouping = groupDateKey(row.day, groupBy);
    const current = grouped.get(grouping.key) ?? {
      label: grouping.label,
      startDate: grouping.startDate,
      endDate: grouping.endDate,
      rows: [],
    };
    current.rows.push(row);
    current.endDate = grouping.endDate > current.endDate ? grouping.endDate : current.endDate;
    grouped.set(grouping.key, current);
  }

  return Array.from(grouped.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => ({
      key,
      label: value.label,
      startDate: value.startDate,
      endDate: value.endDate,
      ...sumMetrics(value.rows),
    }));
}

async function getBusinessProfile(
  supabase: SupabaseClient,
  businessId: string
): Promise<BusinessProfileRow> {
  const { data, error } = await supabase
    .from('business_profiles')
    .select('id, business_name')
    .eq('id', businessId)
    .maybeSingle();

  if (error || !data) {
    throw error ?? new Error('Business profile not found');
  }

  return data;
}

async function getPlatforms(
  supabase: SupabaseClient,
  businessId: string
): Promise<FilterContext['platforms']> {
  const { data, error } = await supabase
    .from('platform_integrations')
    .select('id, platform_id, status, platforms ( key, name )')
    .eq('business_id', businessId)
    .order('updated_at', { ascending: false });

  if (error) {
    throw error;
  }

  return ((data ?? []) as PlatformRow[]).map((row) => {
    const platform = Array.isArray(row.platforms) ? row.platforms[0] ?? null : row.platforms;

    return {
      id: row.id,
      platformId: row.platform_id,
      label: platform?.name ?? platform?.key ?? 'Platform',
      status: row.status,
    };
  });
}

async function getAdAccounts(
  supabase: SupabaseClient,
  input: {
    businessId: string;
    platformIntegrationId?: string | null;
  }
): Promise<AdAccountRow[]> {
  let platformId: string | null = null;

  if (input.platformIntegrationId) {
    const { data, error } = await supabase
      .from('platform_integrations')
      .select('platform_id')
      .eq('id', input.platformIntegrationId)
      .eq('business_id', input.businessId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    platformId = data?.platform_id ?? null;
  }

  let query = supabase
    .from('ad_accounts')
    .select('id, business_id, platform_id, external_account_id, name, status, currency_code')
    .eq('business_id', input.businessId)
    .order('name', { ascending: true });

  if (platformId) {
    query = query.eq('platform_id', platformId);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data ?? []) as AdAccountRow[];
}

async function listCampaignDims(
  supabase: SupabaseClient,
  input: {
    adAccountIds: string[];
    externalIds?: string[];
  }
): Promise<CampaignDimRow[]> {
  const rows: CampaignDimRow[] = [];

  for (const adAccountIdsChunk of chunkArray(input.adAccountIds, 100)) {
    let query = supabase
      .from('campaign_dims')
      .select('id, ad_account_id, external_id, name, objective, status')
      .in('ad_account_id', adAccountIdsChunk);

    if (input.externalIds && input.externalIds.length > 0) {
      query = query.in('external_id', input.externalIds);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    rows.push(...((data ?? []) as CampaignDimRow[]));
  }

  return rows;
}

async function listAdsetDims(
  supabase: SupabaseClient,
  input: {
    adAccountIds: string[];
    campaignExternalIds?: string[];
    externalIds?: string[];
  }
): Promise<AdsetDimRow[]> {
  const rows: AdsetDimRow[] = [];

  for (const adAccountIdsChunk of chunkArray(input.adAccountIds, 100)) {
    let query = supabase
      .from('adset_dims')
      .select('id, ad_account_id, campaign_external_id, external_id, name, optimization_goal, status')
      .in('ad_account_id', adAccountIdsChunk);

    if (input.campaignExternalIds && input.campaignExternalIds.length > 0) {
      query = query.in('campaign_external_id', input.campaignExternalIds);
    }

    if (input.externalIds && input.externalIds.length > 0) {
      query = query.in('external_id', input.externalIds);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    rows.push(...((data ?? []) as AdsetDimRow[]));
  }

  return rows;
}

async function listAdDims(
  supabase: SupabaseClient,
  input: {
    adAccountIds: string[];
    adsetExternalIds?: string[];
    externalIds?: string[];
  }
): Promise<AdDimRow[]> {
  const rows: AdDimRow[] = [];

  for (const adAccountIdsChunk of chunkArray(input.adAccountIds, 100)) {
    let query = supabase
      .from('ad_dims')
      .select('id, ad_account_id, adset_external_id, external_id, name, status, creative_id')
      .in('ad_account_id', adAccountIdsChunk);

    if (input.adsetExternalIds && input.adsetExternalIds.length > 0) {
      query = query.in('adset_external_id', input.adsetExternalIds);
    }

    if (input.externalIds && input.externalIds.length > 0) {
      query = query.in('external_id', input.externalIds);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    rows.push(...((data ?? []) as AdDimRow[]));
  }

  return rows;
}

async function listAdCreatives(
  supabase: SupabaseClient,
  input: {
    platformCreativeIds: string[];
  }
): Promise<AdCreativeRow[]> {
  if (input.platformCreativeIds.length === 0) {
    return [];
  }

  const rows: AdCreativeRow[] = [];

  for (const idsChunk of chunkArray(input.platformCreativeIds, 200)) {
    const { data, error } = await supabase
      .from('ad_creatives')
      .select('id, platform_creative_id, name, headline, primary_text, description, creative_type')
      .in('platform_creative_id', idsChunk);

    if (error) {
      throw error;
    }

    rows.push(...((data ?? []) as AdCreativeRow[]));
  }

  return rows;
}

async function listDailyRows<T extends MetricsRow>(
  supabase: SupabaseClient,
  input: {
    table:
      | 'campaigns_performance_daily'
      | 'adsets_performance_daily'
      | 'ads_performance_daily';
    idColumn: string;
    ids: string[];
    dateFrom: string;
    dateTo: string;
    select: string;
  }
): Promise<T[]> {
  const rows: T[] = [];

  for (const idsChunk of chunkArray(input.ids, 200)) {
    const { data, error } = await supabase
      .from(input.table)
      .select(input.select)
      .in(input.idColumn, idsChunk)
      .gte('day', input.dateFrom)
      .lte('day', input.dateTo)
      .order('day', { ascending: true });

    if (error) {
      throw error;
    }

    rows.push(...((data ?? []) as unknown as T[]));
  }

  return rows;
}

async function listAdAccountDailyRows(
  supabase: SupabaseClient,
  input: {
    ids: string[];
    dateFrom: string;
    dateTo: string;
  }
): Promise<MetricsRow[]> {
  const rows: MetricsRow[] = [];

  for (const idsChunk of chunkArray(input.ids, 200)) {
    const { data, error } = await supabase
      .from('ad_accounts')
      .select('id, currency_code, time_increment_metrics')
      .in('id', idsChunk);

    if (error) {
      throw error;
    }

    for (const row of (data ?? []) as AdAccountTimeseriesRow[]) {
      rows.push(
        ...parseDailyMetricsRowsFromTimeIncrementMetrics(row.time_increment_metrics, {
          currencyCode: row.currency_code,
        })
          .filter((metricRow) => metricRow.day >= input.dateFrom && metricRow.day <= input.dateTo)
          .map((metricRow) => ({
            day: metricRow.day,
            currency_code: metricRow.currency_code,
            spend: metricRow.spend,
            reach: metricRow.reach,
            impressions: metricRow.impressions,
            clicks: metricRow.clicks,
            inline_link_clicks: metricRow.inline_link_clicks,
            leads: metricRow.leads,
            messages: metricRow.messages,
            calls: metricRow.calls ?? 0,
          }))
      );
    }
  }

  return rows;
}

async function getFilterContext(
  supabase: SupabaseClient,
  query: ReportQueryInput
): Promise<FilterContext> {
  const business = await getBusinessProfile(supabase, query.businessId);
  const platforms = await getPlatforms(supabase, query.businessId);
  const adAccounts = await getAdAccounts(supabase, {
    businessId: query.businessId,
    platformIntegrationId: query.platformIntegrationId,
  });
  const allowedAdAccountIds =
    query.adAccountIds.length > 0
      ? adAccounts.filter((row) => query.adAccountIds.includes(row.id)).map((row) => row.id)
      : adAccounts.map((row) => row.id);

  const campaigns = allowedAdAccountIds.length
    ? await listCampaignDims(supabase, {
        adAccountIds: allowedAdAccountIds,
      })
    : [];

  const adsets = allowedAdAccountIds.length
    ? await listAdsetDims(supabase, {
        adAccountIds: allowedAdAccountIds,
      })
    : [];

  const ads = allowedAdAccountIds.length
    ? await listAdDims(supabase, {
        adAccountIds: allowedAdAccountIds,
      })
    : [];

  return {
    business,
    platforms,
    adAccounts,
    campaigns,
    adsets,
    ads,
  };
}

function buildFilterOptions(context: FilterContext): ReportFilterOptions {
  const platformIntegrationIdByPlatformId = new Map(
    context.platforms.map((platform) => [platform.platformId, platform.id])
  );

  return {
    platforms: context.platforms.map((platform) => ({
      id: platform.id,
      label: platform.label,
      parentId: null,
    })),
    adAccounts: context.adAccounts.map((account) => ({
      id: account.id,
      label: account.name || account.external_account_id,
      parentId: platformIntegrationIdByPlatformId.get(account.platform_id) ?? null,
    })),
    campaigns: context.campaigns.map((campaign) => ({
      id: campaign.external_id,
      label: campaign.name || 'Unnamed campaign',
      parentId: campaign.ad_account_id,
    })),
    adsets: context.adsets.map((adset) => ({
      id: adset.external_id,
      label: adset.name || 'Unnamed ad set',
      parentId: adset.campaign_external_id,
    })),
    ads: context.ads.map((ad) => ({
      id: ad.external_id,
      label: ad.name || 'Unnamed ad',
      parentId: ad.adset_external_id,
    })),
  };
}

function aggregateEntityMetrics(rows: MetricsRow[]): EntityAggregate {
  const metrics = {
    spend: 0,
    reach: 0,
    impressions: 0,
    clicks: 0,
    linkClicks: 0,
    leads: 0,
    messages: 0,
    calls: 0,
    startDate: null as string | null,
    endDate: null as string | null,
    currencyCodes: new Set<string>(),
  };

  for (const row of rows) {
    metrics.spend += row.spend;
    metrics.reach += row.reach;
    metrics.impressions += row.impressions;
    metrics.clicks += row.clicks;
    metrics.linkClicks += row.inline_link_clicks;
    metrics.leads += row.leads;
    metrics.messages += row.messages;
    metrics.calls += row.calls;
    metrics.startDate = metrics.startDate === null || row.day < metrics.startDate ? row.day : metrics.startDate;
    metrics.endDate = metrics.endDate === null || row.day > metrics.endDate ? row.day : metrics.endDate;
    if (row.currency_code) {
      metrics.currencyCodes.add(row.currency_code);
    }
  }

  return metrics;
}

function toBreakdownRow(input: {
  id: string;
  name: string;
  level: ReportBreakdownRow['level'];
  status: string | null;
  primaryContext: string | null;
  secondaryContext: string | null;
  creativeContext?: string | null;
  drilldownLabel?: string | null;
  drilldownHref?: string | null;
  aggregate: EntityAggregate;
}): ReportBreakdownRow {
  const derived = derivePerformanceMetrics({
    spend: input.aggregate.spend,
    reach: input.aggregate.reach,
    impressions: input.aggregate.impressions,
    clicks: input.aggregate.clicks,
    leads: input.aggregate.leads,
    messages: input.aggregate.messages,
    calls: input.aggregate.calls,
  });

  return {
    id: input.id,
    name: input.name,
    level: input.level,
    status: input.status,
    primaryContext: input.primaryContext,
    secondaryContext: input.secondaryContext,
    creativeContext: input.creativeContext ?? null,
    drilldownLabel: input.drilldownLabel ?? null,
    drilldownHref: input.drilldownHref ?? null,
    spend: input.aggregate.spend,
    reach: input.aggregate.reach,
    impressions: input.aggregate.impressions,
    clicks: input.aggregate.clicks,
    linkClicks: input.aggregate.linkClicks,
    leads: input.aggregate.leads,
    messages: input.aggregate.messages,
    calls: input.aggregate.calls,
    conversion: derived.conversion,
    conversionRate: derived.conversion_rate,
    costPerResult: derived.cost_per_result,
    ctr: derived.ctr,
    cpc: derived.cpc,
    cpm: derived.cpm,
    frequency: derived.frequency,
    startDate: input.aggregate.startDate,
    endDate: input.aggregate.endDate,
  };
}

function buildCreativeContext(creative: AdCreativeRow | null | undefined): string | null {
  if (!creative) {
    return null;
  }

  return (
    creative.headline ||
    creative.name ||
    creative.primary_text ||
    creative.description ||
    creative.creative_type ||
    null
  );
}

async function buildAdRows(
  supabase: SupabaseClient,
  input: {
    query: ReportQueryInput;
    context: FilterContext;
    adAccountIds: string[];
    adsetExternalIds?: string[];
    externalIds?: string[];
    includeAdReportLinks?: boolean;
  }
): Promise<ReportBreakdownRow[]> {
  const adsetByExternalId = new Map(
    input.context.adsets.map((adset) => [adset.external_id, adset] satisfies [string, AdsetDimRow])
  );
  const adsetNameById = new Map(
    input.context.adsets.map((adset) => [adset.external_id, adset.name || 'Unnamed ad set'])
  );
  const campaignNameById = new Map(
    input.context.campaigns.map((campaign) => [campaign.external_id, campaign.name || 'Unnamed campaign'])
  );

  const ads = await listAdDims(supabase, {
    adAccountIds: input.adAccountIds,
    adsetExternalIds: input.adsetExternalIds,
    externalIds: input.externalIds,
  });

  if (ads.length === 0) {
    return [];
  }

  const creatives = await listAdCreatives(supabase, {
    platformCreativeIds: ads
      .map((ad) => ad.creative_id)
      .filter((value): value is string => Boolean(value)),
  });
  const creativeById = new Map(
    creatives.map((creative) => [creative.platform_creative_id, creative] satisfies [string, AdCreativeRow])
  );
  const performanceRows = await listDailyRows<AdPerformanceRow>(supabase, {
    table: 'ads_performance_daily',
    idColumn: 'ad_id',
    ids: ads.map((ad) => ad.id),
    dateFrom: input.query.dateFrom,
    dateTo: input.query.dateTo,
    select:
      'ad_id, day, currency_code, spend, reach, impressions, clicks, inline_link_clicks, leads, messages, calls',
  });
  const rowsByAdId = new Map<string, MetricsRow[]>();

  for (const row of performanceRows) {
    const rows = rowsByAdId.get(row.ad_id) ?? [];
    rows.push({
      day: row.day,
      currency_code: row.currency_code,
      spend: row.spend ?? 0,
      reach: row.reach ?? 0,
      impressions: row.impressions ?? 0,
      clicks: row.clicks ?? 0,
      inline_link_clicks: row.inline_link_clicks ?? 0,
      leads: row.leads ?? 0,
      messages: row.messages ?? 0,
      calls: row.calls ?? 0,
    });
    rowsByAdId.set(row.ad_id, rows);
  }

  return ads
    .map((ad) => {
      const parentAdset = adsetByExternalId.get(ad.adset_external_id);
      const campaignExternalId = parentAdset?.campaign_external_id ?? null;

      return toBreakdownRow({
        id: ad.external_id,
        name: ad.name || 'Unnamed ad',
        level: 'ad',
        status: ad.status,
        primaryContext: adsetNameById.get(ad.adset_external_id) ?? null,
        secondaryContext: campaignExternalId ? campaignNameById.get(campaignExternalId) ?? null : null,
        creativeContext: buildCreativeContext(
          ad.creative_id ? creativeById.get(ad.creative_id) : null
        ),
        drilldownLabel: input.includeAdReportLinks ? 'Open ad report' : null,
        drilldownHref:
          input.includeAdReportLinks && campaignExternalId
            ? buildNestedReportHref({
                query: input.query,
                scope: 'ad',
                platformIntegrationId: input.query.platformIntegrationId,
                adAccountIds: input.adAccountIds,
                campaignIds: [campaignExternalId],
                adsetIds: [ad.adset_external_id],
                adIds: [ad.external_id],
              })
            : null,
        aggregate: aggregateEntityMetrics(rowsByAdId.get(ad.id) ?? []),
      });
    })
    .filter((row) => row.spend > 0 || row.impressions > 0 || row.conversion > 0)
    .sort((left, right) => right.spend - left.spend || left.name.localeCompare(right.name));
}

async function buildRankingContext(
  supabase: SupabaseClient,
  input: {
    query: ReportQueryInput;
    context: FilterContext;
    adAccountIds: string[];
  }
): Promise<ReportRankingContext> {
  if (input.query.scope !== 'adset' && input.query.scope !== 'ad') {
    return {
      sameAdsetAds: [],
      topAdAccountAds: [],
    };
  }

  const sameAdsetExternalIds =
    input.query.scope === 'adset'
      ? input.query.adsetIds
      : input.context.ads
          .filter((ad) => input.query.adIds.includes(ad.external_id))
          .map((ad) => ad.adset_external_id)
          .filter(Boolean);

  const sameAdsetAds = sameAdsetExternalIds.length
    ? await buildAdRows(supabase, {
        query: input.query,
        context: input.context,
        adAccountIds: input.adAccountIds,
        adsetExternalIds: Array.from(new Set(sameAdsetExternalIds)),
        includeAdReportLinks: true,
      })
    : [];

  const topAdAccountAds = await buildAdRows(supabase, {
    query: input.query,
    context: input.context,
    adAccountIds: input.adAccountIds,
    includeAdReportLinks: true,
  });

  return {
    sameAdsetAds,
    topAdAccountAds,
  };
}

function buildNestedReportHref(input: {
  query: ReportQueryInput;
  scope: 'campaign' | 'adset' | 'ad';
  platformIntegrationId?: string | null;
  adAccountIds: string[];
  campaignIds?: string[];
  adsetIds?: string[];
  adIds?: string[];
}): string {
  return buildReportUrl({
    scope: input.scope,
    platformIntegrationId: input.platformIntegrationId,
    adAccountIds: input.adAccountIds,
    campaignIds: input.campaignIds,
    adsetIds: input.adsetIds,
    adIds: input.adIds,
    dateFrom: input.query.dateFrom,
    dateTo: input.query.dateTo,
    groupBy: input.query.groupBy,
    compareMode: input.query.compareMode,
  });
}

async function buildTopLevelMetricsRows(
  supabase: SupabaseClient,
  query: ReportQueryInput,
  adAccountIds: string[],
  dateFrom: string,
  dateTo: string
): Promise<MetricsRow[]> {
  if (adAccountIds.length === 0) {
    return [];
  }

  if (query.scope === 'business' || query.scope === 'platform' || query.scope === 'ad_account') {
    return listAdAccountDailyRows(supabase, {
      ids: adAccountIds,
      dateFrom,
      dateTo,
    });
  }

  if (query.scope === 'campaign') {
    const campaigns = await listCampaignDims(supabase, {
      adAccountIds,
      externalIds: query.campaignIds,
    });
    const rows = await listDailyRows<CampaignPerformanceRow>(supabase, {
      table: 'campaigns_performance_daily',
      idColumn: 'campaign_id',
      ids: campaigns.map((campaign) => campaign.id),
      dateFrom,
      dateTo,
      select:
        'campaign_id, day, currency_code, spend, reach, impressions, clicks, inline_link_clicks, leads, messages, calls',
    });

    return rows.map((row) => ({
      day: row.day,
      currency_code: row.currency_code,
      spend: row.spend ?? 0,
      reach: row.reach ?? 0,
      impressions: row.impressions ?? 0,
      clicks: row.clicks ?? 0,
      inline_link_clicks: row.inline_link_clicks ?? 0,
      leads: row.leads ?? 0,
      messages: row.messages ?? 0,
      calls: row.calls ?? 0,
    }));
  }

  if (query.scope === 'adset') {
    const adsets = await listAdsetDims(supabase, {
      adAccountIds,
      externalIds: query.adsetIds,
    });
    const rows = await listDailyRows<AdsetPerformanceRow>(supabase, {
      table: 'adsets_performance_daily',
      idColumn: 'adset_id',
      ids: adsets.map((adset) => adset.id),
      dateFrom,
      dateTo,
      select:
        'adset_id, day, currency_code, spend, reach, impressions, clicks, inline_link_clicks, leads, messages, calls',
    });

    return rows.map((row) => ({
      day: row.day,
      currency_code: row.currency_code,
      spend: row.spend ?? 0,
      reach: row.reach ?? 0,
      impressions: row.impressions ?? 0,
      clicks: row.clicks ?? 0,
      inline_link_clicks: row.inline_link_clicks ?? 0,
      leads: row.leads ?? 0,
      messages: row.messages ?? 0,
      calls: row.calls ?? 0,
    }));
  }

  const ads = await listAdDims(supabase, {
    adAccountIds,
    externalIds: query.adIds,
  });
  const rows = await listDailyRows<AdPerformanceRow>(supabase, {
    table: 'ads_performance_daily',
    idColumn: 'ad_id',
    ids: ads.map((ad) => ad.id),
    dateFrom,
    dateTo,
    select:
      'ad_id, day, currency_code, spend, reach, impressions, clicks, inline_link_clicks, leads, messages, calls',
  });

  return rows.map((row) => ({
    day: row.day,
    currency_code: row.currency_code,
    spend: row.spend ?? 0,
    reach: row.reach ?? 0,
    impressions: row.impressions ?? 0,
    clicks: row.clicks ?? 0,
    inline_link_clicks: row.inline_link_clicks ?? 0,
    leads: row.leads ?? 0,
    messages: row.messages ?? 0,
    calls: row.calls ?? 0,
  }));
}

async function buildCampaignFallbackMetricsRows(
  supabase: SupabaseClient,
  adAccountIds: string[],
  dateFrom: string,
  dateTo: string
): Promise<MetricsRow[]> {
  if (adAccountIds.length === 0) {
    return [];
  }

  const campaigns = await listCampaignDims(supabase, {
    adAccountIds,
  });

  if (campaigns.length === 0) {
    return [];
  }

  const rows = await listDailyRows<CampaignPerformanceRow>(supabase, {
    table: 'campaigns_performance_daily',
    idColumn: 'campaign_id',
    ids: campaigns.map((campaign) => campaign.id),
    dateFrom,
    dateTo,
    select:
      'campaign_id, day, currency_code, spend, reach, impressions, clicks, inline_link_clicks, leads, messages, calls',
  });

  return rows.map((row) => ({
    day: row.day,
    currency_code: row.currency_code,
    spend: row.spend ?? 0,
    reach: row.reach ?? 0,
    impressions: row.impressions ?? 0,
    clicks: row.clicks ?? 0,
    inline_link_clicks: row.inline_link_clicks ?? 0,
    leads: row.leads ?? 0,
    messages: row.messages ?? 0,
    calls: row.calls ?? 0,
  }));
}

async function buildBreakdown(
  supabase: SupabaseClient,
  query: ReportQueryInput,
  context: FilterContext,
  adAccountIds: string[]
): Promise<ReportPayload['breakdown']> {
  const adAccountNameById = new Map(
    context.adAccounts.map((account) => [account.id, account.name || account.external_account_id])
  );
  const campaignNameById = new Map(
    context.campaigns.map((campaign) => [campaign.external_id, campaign.name || 'Unnamed campaign'])
  );
  const adsetNameById = new Map(
    context.adsets.map((adset) => [adset.external_id, adset.name || 'Unnamed ad set'])
  );

  if (query.scope === 'business' || query.scope === 'platform' || query.scope === 'ad_account') {
    const campaigns = await listCampaignDims(supabase, {
      adAccountIds,
    });
    const performanceRows = await listDailyRows<CampaignPerformanceRow>(supabase, {
      table: 'campaigns_performance_daily',
      idColumn: 'campaign_id',
      ids: campaigns.map((campaign) => campaign.id),
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      select:
        'campaign_id, day, currency_code, spend, reach, impressions, clicks, inline_link_clicks, leads, messages, calls',
    });
    const rowsByCampaignId = new Map<string, MetricsRow[]>();

    for (const row of performanceRows) {
      const rows = rowsByCampaignId.get(row.campaign_id) ?? [];
      rows.push({
        day: row.day,
        currency_code: row.currency_code,
        spend: row.spend ?? 0,
        reach: row.reach ?? 0,
        impressions: row.impressions ?? 0,
        clicks: row.clicks ?? 0,
        inline_link_clicks: row.inline_link_clicks ?? 0,
        leads: row.leads ?? 0,
        messages: row.messages ?? 0,
        calls: row.calls ?? 0,
      });
      rowsByCampaignId.set(row.campaign_id, rows);
    }

    const rows = campaigns
      .map((campaign) =>
        toBreakdownRow({
          id: campaign.external_id,
          name: campaign.name || 'Unnamed campaign',
          level: 'campaign',
          status: campaign.status,
          primaryContext: adAccountNameById.get(campaign.ad_account_id) ?? null,
          secondaryContext: campaign.objective,
          drilldownLabel: 'Open campaign report',
          drilldownHref: buildNestedReportHref({
            query,
            scope: 'campaign',
            platformIntegrationId: query.platformIntegrationId,
            adAccountIds: [campaign.ad_account_id],
            campaignIds: [campaign.external_id],
          }),
          aggregate: aggregateEntityMetrics(rowsByCampaignId.get(campaign.id) ?? []),
        })
      )
      .filter((row) => row.spend > 0 || row.impressions > 0 || row.conversion > 0)
      .sort((left, right) => right.spend - left.spend || left.name.localeCompare(right.name));

    return {
      title: 'Campaign breakdown',
      rows,
      chart: rows.slice(0, 8).map((row) => ({
        id: row.id,
        label: row.name,
        spend: row.spend,
        conversion: row.conversion,
        clicks: row.clicks,
      })),
    };
  }

  if (query.scope === 'campaign') {
    const adsets = await listAdsetDims(supabase, {
      adAccountIds,
      campaignExternalIds: query.campaignIds,
    });
    const performanceRows = await listDailyRows<AdsetPerformanceRow>(supabase, {
      table: 'adsets_performance_daily',
      idColumn: 'adset_id',
      ids: adsets.map((adset) => adset.id),
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      select:
        'adset_id, day, currency_code, spend, reach, impressions, clicks, inline_link_clicks, leads, messages, calls',
    });
    const rowsByAdsetId = new Map<string, MetricsRow[]>();

    for (const row of performanceRows) {
      const rows = rowsByAdsetId.get(row.adset_id) ?? [];
      rows.push({
        day: row.day,
        currency_code: row.currency_code,
        spend: row.spend ?? 0,
        reach: row.reach ?? 0,
        impressions: row.impressions ?? 0,
        clicks: row.clicks ?? 0,
        inline_link_clicks: row.inline_link_clicks ?? 0,
        leads: row.leads ?? 0,
        messages: row.messages ?? 0,
        calls: row.calls ?? 0,
      });
      rowsByAdsetId.set(row.adset_id, rows);
    }

    const rows = adsets
      .map((adset) =>
        toBreakdownRow({
          id: adset.external_id,
          name: adset.name || 'Unnamed ad set',
          level: 'adset',
          status: adset.status,
          primaryContext: campaignNameById.get(adset.campaign_external_id) ?? null,
          secondaryContext: adset.optimization_goal,
          drilldownLabel: 'Open ad set report',
          drilldownHref: buildNestedReportHref({
            query,
            scope: 'adset',
            platformIntegrationId: query.platformIntegrationId,
            adAccountIds,
            campaignIds: [adset.campaign_external_id],
            adsetIds: [adset.external_id],
          }),
          aggregate: aggregateEntityMetrics(rowsByAdsetId.get(adset.id) ?? []),
        })
      )
      .filter((row) => row.spend > 0 || row.impressions > 0 || row.conversion > 0)
      .sort((left, right) => right.spend - left.spend || left.name.localeCompare(right.name));

    return {
      title: 'Ad set breakdown',
      rows,
      chart: rows.slice(0, 8).map((row) => ({
        id: row.id,
        label: row.name,
        spend: row.spend,
        conversion: row.conversion,
        clicks: row.clicks,
      })),
    };
  }

  const rows = await buildAdRows(supabase, {
    query,
    context,
    adAccountIds,
    adsetExternalIds: query.scope === 'adset' ? query.adsetIds : undefined,
    externalIds: query.scope === 'ad' ? query.adIds : undefined,
    includeAdReportLinks: query.scope === 'adset',
  });

  return {
    title: query.scope === 'ad' ? 'Selected ads' : 'Ad breakdown',
    rows,
    chart: rows.slice(0, 8).map((row) => ({
      id: row.id,
      label: row.name,
      spend: row.spend,
      conversion: row.conversion,
      clicks: row.clicks,
    })),
  };
}

function resolveTitle(input: {
  query: ReportQueryInput;
  context: FilterContext;
  adAccountIds: string[];
}): { title: string; subtitle: string; scopeLabel: string } {
  if (input.query.scope === 'business') {
    return {
      title: input.context.business.business_name,
      subtitle: 'Business performance report',
      scopeLabel: 'Business',
    };
  }

  if (input.query.scope === 'platform') {
    const platform = input.context.platforms.find(
      (item) => item.id === input.query.platformIntegrationId
    );

    return {
      title: platform?.label ?? input.context.business.business_name,
      subtitle: 'Platform performance report',
      scopeLabel: 'Platform',
    };
  }

  if (input.query.scope === 'ad_account') {
    const accounts = input.context.adAccounts.filter((account) =>
      input.adAccountIds.includes(account.id)
    );

    return {
      title:
        accounts.length === 1
          ? accounts[0]?.name || accounts[0]?.external_account_id || 'Ad account'
          : 'Selected ad accounts',
      subtitle: 'Ad account performance report',
      scopeLabel: 'Ad Account',
    };
  }

  if (input.query.scope === 'campaign') {
    const campaigns = input.context.campaigns.filter((campaign) =>
      input.query.campaignIds.includes(campaign.external_id)
    );

    return {
      title: campaigns.length === 1 ? campaigns[0]?.name || 'Campaign' : 'Selected campaigns',
      subtitle: 'Campaign performance report',
      scopeLabel: 'Campaign',
    };
  }

  if (input.query.scope === 'adset') {
    const adsets = input.context.adsets.filter((adset) =>
      input.query.adsetIds.includes(adset.external_id)
    );

    return {
      title: adsets.length === 1 ? adsets[0]?.name || 'Ad set' : 'Selected ad sets',
      subtitle: 'Ad set performance report',
      scopeLabel: 'Ad Set',
    };
  }

  const ads = input.context.ads.filter((ad) => input.query.adIds.includes(ad.external_id));

  return {
    title: ads.length === 1 ? ads[0]?.name || 'Ad' : 'Selected ads',
    subtitle: 'Ad performance report',
    scopeLabel: 'Ad',
  };
}

function buildFilterSummary(input: {
  query: ReportQueryInput;
  context: FilterContext;
}): Array<{ label: string; value: string }> {
  const selectedPlatform = input.context.platforms.find(
    (item) => item.id === input.query.platformIntegrationId
  );
  const selectedAccounts = input.context.adAccounts
    .filter((item) => input.query.adAccountIds.includes(item.id))
    .map((item) => item.name || item.external_account_id);
  const selectedCampaigns = input.context.campaigns
    .filter((item) => input.query.campaignIds.includes(item.external_id))
    .map((item) => item.name || 'Unnamed campaign');
  const selectedAdsets = input.context.adsets
    .filter((item) => input.query.adsetIds.includes(item.external_id))
    .map((item) => item.name || 'Unnamed ad set');
  const selectedAds = input.context.ads
    .filter((item) => input.query.adIds.includes(item.external_id))
    .map((item) => item.name || 'Unnamed ad');

  return [
    {
      label: 'Date range',
      value: formatDateRange(input.query.dateFrom, input.query.dateTo),
    },
    {
      label: 'Compare',
      value: input.query.compareMode === 'previous_period' ? 'Previous period' : 'None',
    },
    {
      label: 'Grouping',
      value: input.query.groupBy,
    },
    {
      label: 'Platform',
      value: selectedPlatform?.label ?? 'All platforms',
    },
    {
      label: 'Ad accounts',
      value: selectedAccounts.length > 0 ? selectedAccounts.join(', ') : 'All ad accounts',
    },
    {
      label: 'Campaigns',
      value: selectedCampaigns.length > 0 ? selectedCampaigns.join(', ') : 'All campaigns',
    },
    {
      label: 'Ad sets',
      value: selectedAdsets.length > 0 ? selectedAdsets.join(', ') : 'All ad sets',
    },
    {
      label: 'Ads',
      value: selectedAds.length > 0 ? selectedAds.join(', ') : 'All ads',
    },
  ];
}

export async function getReportFilterOptions(query: ReportQueryInput): Promise<ReportFilterOptions> {
  const supabase = await createSupabaseClient();
  const context = await getFilterContext(supabase, query);

  return buildFilterOptions(context);
}

export async function buildReportPayload(query: ReportQueryInput): Promise<ReportPayload> {
  const supabase = await createSupabaseClient();
  const context = await getFilterContext(supabase, query);
  const adAccounts = context.adAccounts.filter((row) =>
    query.adAccountIds.length > 0 ? query.adAccountIds.includes(row.id) : true
  );
  const adAccountIds = adAccounts.map((row) => row.id);
  const shouldFallbackToCampaignFacts =
    query.scope === 'business' || query.scope === 'platform' || query.scope === 'ad_account';

  let currentRows = await buildTopLevelMetricsRows(
    supabase,
    query,
    adAccountIds,
    query.dateFrom,
    query.dateTo
  );
  if (shouldFallbackToCampaignFacts && currentRows.length === 0) {
    // Fall back to campaign daily facts until ad-account rollups are available for older synced data.
    currentRows = await buildCampaignFallbackMetricsRows(
      supabase,
      adAccountIds,
      query.dateFrom,
      query.dateTo
    );
  }

  const previousRange =
    query.compareMode === 'previous_period' ? getPreviousPeriodRange(query) : null;
  let previousRows = previousRange
    ? await buildTopLevelMetricsRows(
        supabase,
        query,
        adAccountIds,
        previousRange.dateFrom,
        previousRange.dateTo
      )
    : [];
  if (shouldFallbackToCampaignFacts && previousRange && previousRows.length === 0) {
    previousRows = await buildCampaignFallbackMetricsRows(
      supabase,
      adAccountIds,
      previousRange.dateFrom,
      previousRange.dateTo
    );
  }

  const summary = sumMetrics(currentRows);
  const previousTotals = previousRows.length > 0 ? sumMetrics(previousRows) : null;
  const currencyCode = resolveCurrencyCode(currentRows);
  const title = resolveTitle({
    query,
    context,
    adAccountIds,
  });
  const filterSummary = buildFilterSummary({ query, context });
  const breakdown = await buildBreakdown(supabase, query, context, adAccountIds);
  const ranking = await buildRankingContext(supabase, {
    query,
    context,
    adAccountIds,
  });
  const generatedAt = new Date().toISOString();

  return {
    query,
    meta: {
      businessName: context.business.business_name,
      title: title.title,
      subtitle: title.subtitle,
      scopeLabel: title.scopeLabel,
      currencyCode,
      generatedAt,
    },
    summary,
    kpis: buildKpis({
      totals: summary,
      previousTotals,
      currencyCode,
    }),
    series: groupSeries(currentRows, query.groupBy),
    comparison: {
      previousDateFrom: previousRange?.dateFrom ?? null,
      previousDateTo: previousRange?.dateTo ?? null,
      previousTotals,
    } satisfies ReportComparisonSummary,
    breakdown,
    ranking,
    export: {
      title: title.title,
      subtitle: title.subtitle,
      generatedAt,
      filterSummary,
    },
  };
}
