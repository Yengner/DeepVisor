import 'server-only';

import { createSupabaseClient } from '@/lib/server/supabase/server';
import { derivePerformanceMetrics } from '@/lib/server/repositories/campaigns/normalizers';
import { chunkArray } from '@/lib/server/repositories/utils';
import {
  buildAudienceBreakdowns,
  buildPlatformBreakdowns,
} from '@/lib/server/dashboard/buildPayload';
import { buildReportUrl } from '@/lib/shared';
import type { Database } from '@/lib/shared/types/supabase';
import type {
  DashboardAudienceMetricRow,
  DashboardTrendPoint,
} from '@/lib/server/dashboard/types';
import type {
  ReportActiveDateContext,
  ReportBreakdownRow,
  ReportComparisonSummary,
  ReportFilterOptions,
  ReportKpi,
  ReportMetricTotals,
  ReportPayload,
  ReportQueryInput,
  ReportRankingContext,
  ReportSurfaceContext,
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

type ReportEntityDailyViewRow =
  Database['public']['Views']['report_entity_daily_v']['Row'];

type ReportEntityDailyRow = MetricsRow & {
  business_id: string;
  platform_id: string;
  ad_account_id: string;
  entity_level: 'campaign' | 'adset' | 'ad';
  entity_id: string;
  entity_external_id: string;
  campaign_id: string | null;
  campaign_external_id: string | null;
  adset_id: string | null;
  adset_external_id: string | null;
  ad_id: string | null;
  ad_external_id: string | null;
  entity_name: string | null;
  campaign_name: string | null;
  adset_name: string | null;
  ad_name: string | null;
  objective: string | null;
  status: string | null;
};

type ReportMetricRpcRow = {
  day: string;
  currency_code: string | null;
  spend: number | string | null;
  reach: number | string | null;
  impressions: number | string | null;
  clicks: number | string | null;
  inline_link_clicks: number | string | null;
  leads: number | string | null;
  messages: number | string | null;
  calls: number | string | null;
};

type ReportBreakdownRpcRow = {
  entity_level: ReportBreakdownRow['level'];
  entity_id: string;
  entity_external_id: string;
  ad_account_id: string;
  campaign_external_id: string | null;
  adset_external_id: string | null;
  entity_name: string | null;
  campaign_name: string | null;
  adset_name: string | null;
  objective: string | null;
  status: string | null;
  currency_code: string | null;
  start_date: string | null;
  end_date: string | null;
  spend: number | string | null;
  reach: number | string | null;
  impressions: number | string | null;
  clicks: number | string | null;
  inline_link_clicks: number | string | null;
  leads: number | string | null;
  messages: number | string | null;
  calls: number | string | null;
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

type ReportPlatformOption = {
  id: string;
  platformId: string;
  label: string;
  status: string;
  key: string | null;
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

type AdsetDimRow = Pick<
  Database['public']['Tables']['adset_dims']['Row'],
  'id' | 'ad_account_id' | 'campaign_external_id' | 'external_id' | 'name' | 'optimization_goal' | 'status'
>;

type AdDimRow = Pick<
  Database['public']['Tables']['ad_dims']['Row'],
  'id' | 'ad_account_id' | 'adset_external_id' | 'external_id' | 'name' | 'status' | 'creative_id'
>;

type AdCreativeRow = Pick<
  Database['public']['Tables']['ad_creatives']['Row'],
  'id' | 'platform_creative_id' | 'name' | 'headline' | 'primary_text' | 'description' | 'creative_type'
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

type ActivityMetricsRow = {
  id: string;
  day: string;
  spend: number;
  impressions: number;
  clicks: number;
  linkClicks: number;
  leads: number;
  messages: number;
  calls: number;
};

type FilterContext = {
  business: BusinessProfileRow;
  platforms: ReportPlatformOption[];
  adAccounts: AdAccountRow[];
  campaigns: CampaignDimRow[];
  adsets: AdsetDimRow[];
  ads: AdDimRow[];
};

type BuildReportPayloadOptions = {
  includeMetrics?: boolean;
  includeBreakdown?: boolean;
  includeRanking?: boolean;
  includeActiveDates?: boolean;
  includeSurface?: boolean;
};

const REPORT_AUDIENCE_BREAKDOWN_TYPES = [
  'publisher_platform',
  'platform_position',
  'age_gender',
  'country',
  'region',
  'impression_device',
  'dma',
] as const;

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

function emptyReportRankingContext(): ReportRankingContext {
  return {
    topAdAccountCampaigns: [],
    sameCampaignAdsets: [],
    topAdAccountAdsets: [],
    sameAdsetAds: [],
    topAdAccountAds: [],
  };
}

function emptyReportBreakdown(title = 'Breakdown'): ReportPayload['breakdown'] {
  return {
    title,
    rows: [],
    chart: [],
  };
}

function emptyReportSurfaceContext(isMeta: boolean): ReportSurfaceContext {
  return {
    isMeta,
    platformBreakdowns: buildPlatformBreakdowns({
      isMeta,
      hasLiveDelivery: false,
      audienceRows: [],
    }),
    audienceBreakdowns: buildAudienceBreakdowns({
      isMeta,
      hasLiveDelivery: false,
      audienceRows: [],
    }),
    hourlyTrendExpanded: [],
  };
}

function hasActivityOnDay(row: ActivityMetricsRow): boolean {
  return (
    row.spend > 0 ||
    row.impressions > 0 ||
    row.clicks > 0 ||
    row.linkClicks > 0 ||
    row.leads > 0 ||
    row.messages > 0 ||
    row.calls > 0
  );
}

function buildActiveDateLabel(input: {
  scope: ReportActiveDateContext['scope'];
  totalEntities: number;
}): { label: string; entityLabel: string } {
  if (input.scope === 'campaign') {
    return {
      label:
        input.totalEntities === 1
          ? 'Serving dates for this campaign'
          : 'Serving dates for selected campaigns',
      entityLabel: input.totalEntities === 1 ? 'campaign' : 'campaigns',
    };
  }

  if (input.scope === 'adset') {
    return {
      label:
        input.totalEntities === 1
          ? 'Serving dates for this ad set'
          : 'Serving dates for selected ad sets',
      entityLabel: input.totalEntities === 1 ? 'ad set' : 'ad sets',
    };
  }

  return {
    label: input.totalEntities === 1 ? 'Serving dates for this ad' : 'Serving dates for selected ads',
    entityLabel: input.totalEntities === 1 ? 'ad' : 'ads',
  };
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
      key: platform?.key ?? null,
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

const REPORT_ENTITY_DAILY_SELECT = [
  'business_id',
  'platform_id',
  'ad_account_id',
  'entity_level',
  'entity_id',
  'entity_external_id',
  'campaign_id',
  'campaign_external_id',
  'adset_id',
  'adset_external_id',
  'ad_id',
  'ad_external_id',
  'entity_name',
  'campaign_name',
  'adset_name',
  'ad_name',
  'objective',
  'status',
  'day',
  'currency_code',
  'spend',
  'reach',
  'impressions',
  'clicks',
  'inline_link_clicks',
  'leads',
  'messages',
  'calls',
].join(', ');

function optionalChunks(values: string[] | undefined, size = 200): Array<string[] | null> {
  return values && values.length > 0 ? chunkArray(values, size) : [null];
}

function toNumber(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function normalizeReportEntityDailyRow(row: ReportEntityDailyViewRow): ReportEntityDailyRow {
  return {
    business_id: row.business_id ?? '',
    platform_id: row.platform_id ?? '',
    ad_account_id: row.ad_account_id ?? '',
    entity_level:
      row.entity_level === 'ad' || row.entity_level === 'adset' ? row.entity_level : 'campaign',
    entity_id: row.entity_id ?? '',
    entity_external_id: row.entity_external_id ?? '',
    campaign_id: row.campaign_id ?? null,
    campaign_external_id: row.campaign_external_id ?? null,
    adset_id: row.adset_id ?? null,
    adset_external_id: row.adset_external_id ?? null,
    ad_id: row.ad_id ?? null,
    ad_external_id: row.ad_external_id ?? null,
    entity_name: row.entity_name ?? null,
    campaign_name: row.campaign_name ?? null,
    adset_name: row.adset_name ?? null,
    ad_name: row.ad_name ?? null,
    objective: row.objective ?? null,
    status: row.status ?? null,
    day: row.day ?? '',
    currency_code: row.currency_code ?? null,
    spend: toNumber(row.spend),
    reach: toNumber(row.reach),
    impressions: toNumber(row.impressions),
    clicks: toNumber(row.clicks),
    inline_link_clicks: toNumber(row.inline_link_clicks),
    leads: toNumber(row.leads),
    messages: toNumber(row.messages),
    calls: toNumber(row.calls),
  };
}

function normalizeReportMetricRpcRow(row: ReportMetricRpcRow): MetricsRow {
  return {
    day: row.day,
    currency_code: row.currency_code ?? null,
    spend: toNumber(row.spend),
    reach: toNumber(row.reach),
    impressions: toNumber(row.impressions),
    clicks: toNumber(row.clicks),
    inline_link_clicks: toNumber(row.inline_link_clicks),
    leads: toNumber(row.leads),
    messages: toNumber(row.messages),
    calls: toNumber(row.calls),
  };
}

function aggregateFromBreakdownRow(row: ReportBreakdownRpcRow): EntityAggregate {
  return {
    spend: toNumber(row.spend),
    reach: toNumber(row.reach),
    impressions: toNumber(row.impressions),
    clicks: toNumber(row.clicks),
    linkClicks: toNumber(row.inline_link_clicks),
    leads: toNumber(row.leads),
    messages: toNumber(row.messages),
    calls: toNumber(row.calls),
    startDate: row.start_date,
    endDate: row.end_date,
    currencyCodes: new Set(row.currency_code ? [row.currency_code] : []),
  };
}

function buildReportRpcArgs(input: {
  entityLevel: ReportEntityDailyRow['entity_level'];
  adAccountIds: string[];
  dateFrom: string;
  dateTo: string;
  entityExternalIds?: string[];
  campaignExternalIds?: string[];
  adsetExternalIds?: string[];
}) {
  return {
    p_ad_account_ids: input.adAccountIds,
    p_entity_level: input.entityLevel,
    p_date_from: input.dateFrom,
    p_date_to: input.dateTo,
    p_entity_external_ids: input.entityExternalIds?.length ? input.entityExternalIds : null,
    p_campaign_external_ids: input.campaignExternalIds?.length
      ? input.campaignExternalIds
      : null,
    p_adset_external_ids: input.adsetExternalIds?.length ? input.adsetExternalIds : null,
  };
}

async function listReportMetricRows(
  supabase: SupabaseClient,
  input: {
    entityLevel: ReportEntityDailyRow['entity_level'];
    adAccountIds: string[];
    dateFrom: string;
    dateTo: string;
    entityExternalIds?: string[];
  }
): Promise<MetricsRow[]> {
  if (input.adAccountIds.length === 0) {
    return [];
  }

  const rows: MetricsRow[] = [];
  const entityExternalChunks = optionalChunks(input.entityExternalIds);

  for (const adAccountIdsChunk of chunkArray(input.adAccountIds, 100)) {
    for (const entityExternalIdsChunk of entityExternalChunks) {
      let page = 0;
      const pageSize = 1000;

      while (true) {
        const { data, error } = await (supabase as any)
          .rpc(
            'get_report_metric_rows',
            buildReportRpcArgs({
              ...input,
              adAccountIds: adAccountIdsChunk,
              entityExternalIds: entityExternalIdsChunk ?? undefined,
            })
          )
          .range(page * pageSize, page * pageSize + pageSize - 1);

        if (error) {
          throw error;
        }

        const pageRows = (data ?? []) as ReportMetricRpcRow[];
        rows.push(...pageRows.map(normalizeReportMetricRpcRow));

        if (pageRows.length < pageSize) {
          break;
        }

        page += 1;
      }
    }
  }

  return rows;
}

async function listReportBreakdownRows(
  supabase: SupabaseClient,
  input: {
    entityLevel: ReportEntityDailyRow['entity_level'];
    adAccountIds: string[];
    dateFrom: string;
    dateTo: string;
    entityExternalIds?: string[];
    campaignExternalIds?: string[];
    adsetExternalIds?: string[];
  }
): Promise<ReportBreakdownRpcRow[]> {
  if (input.adAccountIds.length === 0) {
    return [];
  }

  const rows: ReportBreakdownRpcRow[] = [];
  const entityExternalChunks = optionalChunks(input.entityExternalIds);
  const campaignExternalChunks = optionalChunks(input.campaignExternalIds);
  const adsetExternalChunks = optionalChunks(input.adsetExternalIds);

  for (const adAccountIdsChunk of chunkArray(input.adAccountIds, 100)) {
    for (const entityExternalIdsChunk of entityExternalChunks) {
      for (const campaignExternalIdsChunk of campaignExternalChunks) {
        for (const adsetExternalIdsChunk of adsetExternalChunks) {
          let page = 0;
          const pageSize = 1000;

          while (true) {
            const { data, error } = await (supabase as any)
              .rpc(
                'get_report_breakdown_rows',
                buildReportRpcArgs({
                  ...input,
                  adAccountIds: adAccountIdsChunk,
                  entityExternalIds: entityExternalIdsChunk ?? undefined,
                  campaignExternalIds: campaignExternalIdsChunk ?? undefined,
                  adsetExternalIds: adsetExternalIdsChunk ?? undefined,
                })
              )
              .range(page * pageSize, page * pageSize + pageSize - 1);

            if (error) {
              throw error;
            }

            const pageRows = (data ?? []) as ReportBreakdownRpcRow[];
            rows.push(...pageRows);

            if (pageRows.length < pageSize) {
              break;
            }

            page += 1;
          }
        }
      }
    }
  }

  return rows;
}

async function listReportEntityDailyRows(
  supabase: SupabaseClient,
  input: {
    entityLevel: ReportEntityDailyRow['entity_level'];
    adAccountIds: string[];
    dateFrom?: string;
    dateTo?: string;
    entityExternalIds?: string[];
    campaignExternalIds?: string[];
    adsetExternalIds?: string[];
    adExternalIds?: string[];
  }
): Promise<ReportEntityDailyRow[]> {
  if (input.adAccountIds.length === 0) {
    return [];
  }

  const rows: ReportEntityDailyRow[] = [];
  const entityExternalChunks = optionalChunks(input.entityExternalIds);
  const campaignExternalChunks = optionalChunks(input.campaignExternalIds);
  const adsetExternalChunks = optionalChunks(input.adsetExternalIds);
  const adExternalChunks = optionalChunks(input.adExternalIds);

  for (const adAccountIdsChunk of chunkArray(input.adAccountIds, 100)) {
    for (const entityExternalIdsChunk of entityExternalChunks) {
      for (const campaignExternalIdsChunk of campaignExternalChunks) {
        for (const adsetExternalIdsChunk of adsetExternalChunks) {
          for (const adExternalIdsChunk of adExternalChunks) {
            let page = 0;
            const pageSize = 1000;

            while (true) {
              let query = supabase
                .from('report_entity_daily_v')
                .select(REPORT_ENTITY_DAILY_SELECT)
                .eq('entity_level', input.entityLevel)
                .in('ad_account_id', adAccountIdsChunk)
                .order('day', { ascending: true })
                .order('entity_external_id', { ascending: true });

              if (input.dateFrom) {
                query = query.gte('day', input.dateFrom);
              }

              if (input.dateTo) {
                query = query.lte('day', input.dateTo);
              }

              if (entityExternalIdsChunk) {
                query = query.in('entity_external_id', entityExternalIdsChunk);
              }

              if (campaignExternalIdsChunk) {
                query = query.in('campaign_external_id', campaignExternalIdsChunk);
              }

              if (adsetExternalIdsChunk) {
                query = query.in('adset_external_id', adsetExternalIdsChunk);
              }

              if (adExternalIdsChunk) {
                query = query.in('ad_external_id', adExternalIdsChunk);
              }

              const from = page * pageSize;
              const to = from + pageSize - 1;
              const { data, error } = await query.range(from, to);

              if (error) {
                throw error;
              }

              const pageRows = (data ?? []) as unknown as ReportEntityDailyViewRow[];
              rows.push(...pageRows.map(normalizeReportEntityDailyRow));

              if (pageRows.length < pageSize) {
                break;
              }

              page += 1;
            }
          }
        }
      }
    }
  }

  return rows;
}

async function getFilterContext(
  supabase: SupabaseClient,
  query: ReportQueryInput
): Promise<FilterContext> {
  const [business, platforms, adAccounts] = await Promise.all([
    getBusinessProfile(supabase, query.businessId),
    getPlatforms(supabase, query.businessId),
    getAdAccounts(supabase, {
      businessId: query.businessId,
      platformIntegrationId: query.platformIntegrationId,
    }),
  ]);
  const allowedAdAccountIds =
    query.adAccountIds.length > 0
      ? adAccounts.filter((row) => query.adAccountIds.includes(row.id)).map((row) => row.id)
      : adAccounts.map((row) => row.id);

  const [campaigns, adsets, ads] = allowedAdAccountIds.length
    ? await Promise.all([
        listCampaignDims(supabase, {
          adAccountIds: allowedAdAccountIds,
        }),
        listAdsetDims(supabase, {
          adAccountIds: allowedAdAccountIds,
        }),
        listAdDims(supabase, {
          adAccountIds: allowedAdAccountIds,
        }),
      ])
    : [[], [], []];

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

async function buildCampaignRows(
  supabase: SupabaseClient,
  input: {
    query: ReportQueryInput;
    context: FilterContext;
    adAccountIds: string[];
    externalIds?: string[];
    includeCampaignReportLinks?: boolean;
  }
): Promise<ReportBreakdownRow[]> {
  const adAccountNameById = new Map(
    input.context.adAccounts.map((account) => [account.id, account.name || account.external_account_id])
  );
  const rows = await listReportBreakdownRows(supabase, {
    entityLevel: 'campaign',
    adAccountIds: input.adAccountIds,
    dateFrom: input.query.dateFrom,
    dateTo: input.query.dateTo,
    entityExternalIds: input.externalIds,
  });

  if (rows.length === 0) {
    return [];
  }

  return rows
    .map((row) => {
      return toBreakdownRow({
        id: row.entity_external_id,
        name: row.entity_name || 'Unnamed campaign',
        level: 'campaign',
        status: row.status,
        primaryContext: adAccountNameById.get(row.ad_account_id) ?? null,
        secondaryContext: row.objective,
        drilldownLabel: input.includeCampaignReportLinks ? 'Open' : null,
        drilldownHref: input.includeCampaignReportLinks
          ? buildNestedReportHref({
              query: input.query,
              scope: 'campaign',
              platformIntegrationId: input.query.platformIntegrationId,
              adAccountIds: [row.ad_account_id],
              campaignIds: [row.entity_external_id],
            })
          : null,
        aggregate: aggregateFromBreakdownRow(row),
      });
    })
    .filter((row) => row.spend > 0 || row.impressions > 0 || row.conversion > 0)
    .sort((left, right) => right.spend - left.spend || left.name.localeCompare(right.name));
}

async function buildAdsetRows(
  supabase: SupabaseClient,
  input: {
    query: ReportQueryInput;
    context: FilterContext;
    adAccountIds: string[];
    campaignExternalIds?: string[];
    externalIds?: string[];
    includeAdsetReportLinks?: boolean;
  }
): Promise<ReportBreakdownRow[]> {
  const campaignNameById = new Map(
    input.context.campaigns.map((campaign) => [campaign.external_id, campaign.name || 'Unnamed campaign'])
  );
  const rows = await listReportBreakdownRows(supabase, {
    entityLevel: 'adset',
    adAccountIds: input.adAccountIds,
    dateFrom: input.query.dateFrom,
    dateTo: input.query.dateTo,
    campaignExternalIds: input.campaignExternalIds,
    entityExternalIds: input.externalIds,
  });

  if (rows.length === 0) {
    return [];
  }

  return rows
    .map((row) => {
      const campaignExternalId = row.campaign_external_id;

      return toBreakdownRow({
        id: row.entity_external_id,
        name: row.entity_name || 'Unnamed ad set',
        level: 'adset',
        status: row.status,
        primaryContext:
          row.campaign_name ??
          (campaignExternalId ? campaignNameById.get(campaignExternalId) ?? null : null),
        secondaryContext: row.objective,
        drilldownLabel: input.includeAdsetReportLinks ? 'Open' : null,
        drilldownHref: input.includeAdsetReportLinks
          ? buildNestedReportHref({
              query: input.query,
              scope: 'adset',
              platformIntegrationId: input.query.platformIntegrationId,
              adAccountIds: [row.ad_account_id],
              campaignIds: campaignExternalId ? [campaignExternalId] : [],
              adsetIds: [row.entity_external_id],
            })
          : null,
        aggregate: aggregateFromBreakdownRow(row),
      });
    })
    .filter((row) => row.spend > 0 || row.impressions > 0 || row.conversion > 0)
    .sort((left, right) => right.spend - left.spend || left.name.localeCompare(right.name));
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

  const rows = await listReportBreakdownRows(supabase, {
    entityLevel: 'ad',
    adAccountIds: input.adAccountIds,
    dateFrom: input.query.dateFrom,
    dateTo: input.query.dateTo,
    adsetExternalIds: input.adsetExternalIds,
    entityExternalIds: input.externalIds,
  });

  if (rows.length === 0) {
    return [];
  }

  const ads = await listAdDims(supabase, {
    adAccountIds: input.adAccountIds,
    externalIds: Array.from(new Set(rows.map((row) => row.entity_external_id))),
  });
  const adDimByExternalId = new Map(
    ads.map((ad) => [ad.external_id, ad] satisfies [string, AdDimRow])
  );
  const creatives = await listAdCreatives(supabase, {
    platformCreativeIds: ads
      .map((ad) => ad.creative_id)
      .filter((value): value is string => Boolean(value)),
  });
  const creativeById = new Map(
    creatives.map((creative) => [creative.platform_creative_id, creative] satisfies [string, AdCreativeRow])
  );

  return rows
    .map((row) => {
      const ad = adDimByExternalId.get(row.entity_external_id);
      const adsetExternalId = row.adset_external_id ?? ad?.adset_external_id ?? null;
      const parentAdset = adsetExternalId ? adsetByExternalId.get(adsetExternalId) : null;
      const campaignExternalId =
        row.campaign_external_id ?? parentAdset?.campaign_external_id ?? null;

      return toBreakdownRow({
        id: row.entity_external_id,
        name: row.entity_name || ad?.name || 'Unnamed ad',
        level: 'ad',
        status: row.status ?? ad?.status ?? null,
        primaryContext:
          row.adset_name ??
          (adsetExternalId ? adsetNameById.get(adsetExternalId) ?? null : null),
        secondaryContext:
          row.campaign_name ??
          (campaignExternalId ? campaignNameById.get(campaignExternalId) ?? null : null),
        creativeContext: buildCreativeContext(
          ad?.creative_id ? creativeById.get(ad.creative_id) : null
        ),
        drilldownLabel: input.includeAdReportLinks ? 'Open' : null,
        drilldownHref:
          input.includeAdReportLinks && campaignExternalId && adsetExternalId
            ? buildNestedReportHref({
                query: input.query,
                scope: 'ad',
                platformIntegrationId: input.query.platformIntegrationId,
                adAccountIds: [row.ad_account_id],
                campaignIds: [campaignExternalId],
                adsetIds: [adsetExternalId],
                adIds: [row.entity_external_id],
              })
            : null,
        aggregate: aggregateFromBreakdownRow(row),
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
  if (input.adAccountIds.length === 0) {
    return emptyReportRankingContext();
  }

  const selectedCampaignExternalIds = new Set(input.query.campaignIds);
  const selectedAdsetExternalIds = new Set(input.query.adsetIds);

  if (input.query.scope === 'adset') {
    for (const adset of input.context.adsets) {
      if (input.query.adsetIds.includes(adset.external_id)) {
        selectedCampaignExternalIds.add(adset.campaign_external_id);
      }
    }
  }

  if (input.query.scope === 'ad') {
    for (const ad of input.context.ads) {
      if (input.query.adIds.includes(ad.external_id)) {
        selectedAdsetExternalIds.add(ad.adset_external_id);
      }
    }

    for (const adset of input.context.adsets) {
      if (selectedAdsetExternalIds.has(adset.external_id)) {
        selectedCampaignExternalIds.add(adset.campaign_external_id);
      }
    }
  }

  const isTopLevelReport =
    input.query.scope === 'business' ||
    input.query.scope === 'platform' ||
    input.query.scope === 'ad_account';
  const shouldBuildCampaignRankings =
    isTopLevelReport ||
    input.query.scope === 'campaign' ||
    input.query.scope === 'adset' ||
    input.query.scope === 'ad';
  const shouldBuildAdsetRankings =
    isTopLevelReport ||
    input.query.scope === 'campaign' ||
    input.query.scope === 'adset' ||
    input.query.scope === 'ad';
  const shouldBuildAdRankings =
    isTopLevelReport || input.query.scope === 'adset' || input.query.scope === 'ad';

  const [topAdAccountCampaigns, sameCampaignAdsets, topAdAccountAdsets] = await Promise.all([
    shouldBuildCampaignRankings
      ? buildCampaignRows(supabase, {
          query: input.query,
          context: input.context,
          adAccountIds: input.adAccountIds,
          includeCampaignReportLinks: true,
        })
      : Promise.resolve([]),
    shouldBuildAdsetRankings && selectedCampaignExternalIds.size > 0
      ? buildAdsetRows(supabase, {
          query: input.query,
          context: input.context,
          adAccountIds: input.adAccountIds,
          campaignExternalIds: Array.from(selectedCampaignExternalIds),
          includeAdsetReportLinks: true,
        })
      : Promise.resolve([]),
    shouldBuildAdsetRankings
      ? buildAdsetRows(supabase, {
          query: input.query,
          context: input.context,
          adAccountIds: input.adAccountIds,
          includeAdsetReportLinks: true,
        })
      : Promise.resolve([]),
  ]);

  if (!shouldBuildAdRankings) {
    return {
      topAdAccountCampaigns,
      sameCampaignAdsets,
      topAdAccountAdsets,
      sameAdsetAds: [],
      topAdAccountAds: [],
    };
  }

  const sameAdsetExternalIds =
    input.query.scope === 'adset'
      ? Array.from(selectedAdsetExternalIds)
      : input.context.ads
          .filter((ad) => input.query.adIds.includes(ad.external_id))
          .map((ad) => ad.adset_external_id)
          .filter(Boolean);

  const [sameAdsetAds, topAdAccountAds] = await Promise.all([
    sameAdsetExternalIds.length
      ? buildAdRows(supabase, {
          query: input.query,
          context: input.context,
          adAccountIds: input.adAccountIds,
          adsetExternalIds: Array.from(new Set(sameAdsetExternalIds)),
          includeAdReportLinks: true,
        })
      : Promise.resolve([]),
    buildAdRows(supabase, {
      query: input.query,
      context: input.context,
      adAccountIds: input.adAccountIds,
      includeAdReportLinks: true,
    }),
  ]);

  return {
    topAdAccountCampaigns,
    sameCampaignAdsets,
    topAdAccountAdsets,
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

  const entityLevel =
    query.scope === 'ad'
      ? 'ad'
      : query.scope === 'adset'
        ? 'adset'
        : 'campaign';
  return listReportMetricRows(supabase, {
    entityLevel,
    adAccountIds,
    dateFrom,
    dateTo,
    entityExternalIds:
      query.scope === 'campaign'
        ? query.campaignIds
        : query.scope === 'adset'
          ? query.adsetIds
          : query.scope === 'ad'
            ? query.adIds
            : undefined,
  });
}

async function buildBreakdown(
  supabase: SupabaseClient,
  query: ReportQueryInput,
  context: FilterContext,
  adAccountIds: string[]
): Promise<ReportPayload['breakdown']> {
  if (query.scope === 'business' || query.scope === 'platform' || query.scope === 'ad_account') {
    const rows = await buildCampaignRows(supabase, {
      query,
      context,
      adAccountIds,
      includeCampaignReportLinks: true,
    });

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
    const rows = await buildAdsetRows(supabase, {
      query,
      context,
      adAccountIds,
      campaignExternalIds: query.campaignIds,
      includeAdsetReportLinks: true,
    });

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

async function buildActiveDateContext(
  supabase: SupabaseClient,
  query: ReportQueryInput,
  adAccountIds: string[]
): Promise<ReportActiveDateContext | null> {
  const isCampaignLevelScope =
    query.scope === 'business' ||
    query.scope === 'platform' ||
    query.scope === 'ad_account' ||
    query.scope === 'campaign';

  if (!isCampaignLevelScope && query.scope !== 'adset' && query.scope !== 'ad') {
    return null;
  }

  if (query.scope === 'campaign' && query.campaignIds.length === 0) {
    return null;
  }

  if (query.scope === 'adset' && query.adsetIds.length === 0) {
    return null;
  }

  if (query.scope === 'ad' && query.adIds.length === 0) {
    return null;
  }

  let rows: ActivityMetricsRow[] = [];
  let totalEntities = 0;

  if (isCampaignLevelScope) {
    const campaigns = await listCampaignDims(supabase, {
      adAccountIds,
      externalIds: query.scope === 'campaign' ? query.campaignIds : undefined,
    });
    totalEntities = campaigns.length;

    if (campaigns.length === 0) {
      return null;
    }

    const performanceRows = await listReportEntityDailyRows(supabase, {
      entityLevel: 'campaign',
      adAccountIds,
      entityExternalIds: query.scope === 'campaign' ? query.campaignIds : undefined,
    });

    rows = performanceRows.map((row) => ({
      id: row.entity_id,
      day: row.day,
      spend: row.spend,
      impressions: row.impressions,
      clicks: row.clicks,
      linkClicks: row.inline_link_clicks,
      leads: row.leads,
      messages: row.messages,
      calls: row.calls,
    }));
  }

  if (query.scope === 'adset') {
    const adsets = await listAdsetDims(supabase, {
      adAccountIds,
      externalIds: query.adsetIds,
    });
    totalEntities = adsets.length;

    if (adsets.length === 0) {
      return null;
    }

    const performanceRows = await listReportEntityDailyRows(supabase, {
      entityLevel: 'adset',
      adAccountIds,
      entityExternalIds: query.adsetIds,
    });

    rows = performanceRows.map((row) => ({
      id: row.entity_id,
      day: row.day,
      spend: row.spend,
      impressions: row.impressions,
      clicks: row.clicks,
      linkClicks: row.inline_link_clicks,
      leads: row.leads,
      messages: row.messages,
      calls: row.calls,
    }));
  }

  if (query.scope === 'ad') {
    const ads = await listAdDims(supabase, {
      adAccountIds,
      externalIds: query.adIds,
    });
    totalEntities = ads.length;

    if (ads.length === 0) {
      return null;
    }

    const performanceRows = await listReportEntityDailyRows(supabase, {
      entityLevel: 'ad',
      adAccountIds,
      entityExternalIds: query.adIds,
    });

    rows = performanceRows.map((row) => ({
      id: row.entity_id,
      day: row.day,
      spend: row.spend,
      impressions: row.impressions,
      clicks: row.clicks,
      linkClicks: row.inline_link_clicks,
      leads: row.leads,
      messages: row.messages,
      calls: row.calls,
    }));
  }

  const activeDateMap = new Map<string, Set<string>>();

  for (const row of rows) {
    if (!hasActivityOnDay(row)) {
      continue;
    }

    const current = activeDateMap.get(row.day) ?? new Set<string>();
    current.add(row.id);
    activeDateMap.set(row.day, current);
  }

  const days = Array.from(activeDateMap.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, entityIds]) => ({
      date,
      activeEntityCount: entityIds.size,
    }));

  if (days.length === 0) {
    return null;
  }

  const activeDateScope: ReportActiveDateContext['scope'] = isCampaignLevelScope
    ? 'campaign'
    : query.scope === 'adset'
      ? 'adset'
      : 'ad';

  const labels = buildActiveDateLabel({
    scope: activeDateScope,
    totalEntities,
  });

  return {
    scope: activeDateScope,
    label: labels.label,
    entityLabel: labels.entityLabel,
    totalEntities,
    totalActiveDays: days.length,
    startDate: days[0]?.date ?? null,
    endDate: days.at(-1)?.date ?? null,
    days,
  };
}

function isMetaAdAccount(context: FilterContext, account: AdAccountRow): boolean {
  return context.platforms.some(
    (platform) => platform.platformId === account.platform_id && platform.key === 'meta'
  );
}

function resolveSurfaceEntityIds(input: {
  query: ReportQueryInput;
  context: FilterContext;
  adAccountIds: string[];
}): {
  adsetInternalIds: string[];
  adInternalIds: string[];
  adScopeOnly: boolean;
} {
  const allowedAdAccounts = new Set(input.adAccountIds);
  const campaignExternalIds = new Set(input.query.campaignIds);
  const adsetExternalIds = new Set(input.query.adsetIds);
  const adExternalIds = new Set(input.query.adIds);

  const selectedAds =
    input.query.scope === 'ad'
      ? input.context.ads.filter(
          (ad) => allowedAdAccounts.has(ad.ad_account_id) && adExternalIds.has(ad.external_id)
        )
      : [];

  const selectedAdsetExternalIds =
    input.query.scope === 'ad'
      ? new Set(selectedAds.map((ad) => ad.adset_external_id))
      : adsetExternalIds;

  const adsets = input.context.adsets.filter((adset) => {
    if (!allowedAdAccounts.has(adset.ad_account_id)) {
      return false;
    }

    if (input.query.scope === 'campaign') {
      return campaignExternalIds.has(adset.campaign_external_id);
    }

    if (input.query.scope === 'adset' || input.query.scope === 'ad') {
      return selectedAdsetExternalIds.has(adset.external_id);
    }

    return true;
  });

  return {
    adsetInternalIds: Array.from(new Set(adsets.map((adset) => adset.id))),
    adInternalIds: Array.from(new Set(selectedAds.map((ad) => ad.id))),
    adScopeOnly: input.query.scope === 'ad',
  };
}

async function listReportAudienceRows(
  supabase: SupabaseClient,
  input: {
    adsetInternalIds: string[];
    adInternalIds: string[];
    adScopeOnly: boolean;
    dateFrom: string;
    dateTo: string;
  }
): Promise<DashboardAudienceMetricRow[]> {
  if (input.adsetInternalIds.length === 0) {
    return [];
  }

  type AudienceBreakdownSelectRow = Pick<
    Database['public']['Tables']['meta_audience_breakdowns_daily']['Row'],
    | 'entity_level'
    | 'adset_id'
    | 'ad_id'
    | 'breakdown_type'
    | 'dimension_1_key'
    | 'dimension_1_value'
    | 'dimension_2_key'
    | 'dimension_2_value'
    | 'publisher_platform'
    | 'platform_position'
    | 'impression_device'
    | 'spend'
    | 'impressions'
    | 'clicks'
    | 'leads'
    | 'messages'
    | 'calls'
  >;

  const rows: AudienceBreakdownSelectRow[] = [];
  const selectedAdIds = new Set(input.adInternalIds);

  for (const chunk of chunkArray(input.adsetInternalIds, 200)) {
    let query = supabase
      .from('meta_audience_breakdowns_daily')
      .select(
        'entity_level, adset_id, ad_id, breakdown_type, dimension_1_key, dimension_1_value, dimension_2_key, dimension_2_value, publisher_platform, platform_position, impression_device, spend, impressions, clicks, leads, messages, calls'
      )
      .gte('day', input.dateFrom)
      .lte('day', input.dateTo)
      .in('adset_id', chunk)
      .in('breakdown_type', [...REPORT_AUDIENCE_BREAKDOWN_TYPES]);

    if (input.adScopeOnly) {
      query = query.eq('entity_level', 'ad');
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    rows.push(...((data ?? []) as AudienceBreakdownSelectRow[]));
  }

  return rows
    .filter((row) => {
      if (!input.adScopeOnly) {
        return true;
      }

      return Boolean(row.ad_id && selectedAdIds.has(row.ad_id));
    })
    .map((row) => ({
      entityLevel: (row.entity_level === 'ad' ? 'ad' : 'adset') as 'ad' | 'adset',
      adsetInternalId: row.adset_id,
      adInternalId: row.ad_id,
      breakdownType: row.breakdown_type,
      dimension1Key: row.dimension_1_key,
      dimension1Value: row.dimension_1_value,
      dimension2Key: row.dimension_2_key,
      dimension2Value: row.dimension_2_value,
      publisherPlatform: row.publisher_platform,
      platformPosition: row.platform_position,
      impressionDevice: row.impression_device,
      spend: row.spend ?? 0,
      impressions: row.impressions ?? 0,
      clicks: row.clicks ?? 0,
      leads: row.leads ?? 0,
      messages: row.messages ?? 0,
      calls: row.calls ?? 0,
    }))
    .filter(
      (row) =>
        row.dimension1Value.trim().length > 0 &&
        (row.spend > 0 ||
          row.impressions > 0 ||
          row.clicks > 0 ||
          row.leads > 0 ||
          row.messages > 0 ||
          row.calls > 0)
    );
}

async function listReportHourlyTrendRows(
  supabase: SupabaseClient,
  input: {
    adsetInternalIds: string[];
    adInternalIds: string[];
    adScopeOnly: boolean;
    dateFrom: string;
    dateTo: string;
  }
): Promise<DashboardTrendPoint[]> {
  if (input.adsetInternalIds.length === 0) {
    return [];
  }

  type HourlySelectRow = Pick<
    Database['public']['Tables']['meta_hourly_performance']['Row'],
    | 'day'
    | 'hour_of_day'
    | 'entity_level'
    | 'ad_id'
    | 'spend'
    | 'reach'
    | 'impressions'
    | 'clicks'
    | 'inline_link_clicks'
    | 'leads'
    | 'messages'
    | 'calls'
  >;

  const selectedAdIds = new Set(input.adInternalIds);
  const fetchRows = async (entityLevel: 'adset' | 'ad') => {
    const rows: HourlySelectRow[] = [];

    for (const chunk of chunkArray(input.adsetInternalIds, 200)) {
      const { data, error } = await supabase
        .from('meta_hourly_performance')
        .select(
          'day, hour_of_day, entity_level, ad_id, spend, reach, impressions, clicks, inline_link_clicks, leads, messages, calls'
        )
        .gte('day', input.dateFrom)
        .lte('day', input.dateTo)
        .eq('time_basis', 'advertiser')
        .eq('entity_level', entityLevel)
        .in('adset_id', chunk)
        .order('day', { ascending: true })
        .order('hour_of_day', { ascending: true });

      if (error) {
        throw error;
      }

      rows.push(...((data ?? []) as HourlySelectRow[]));
    }

    return rows;
  };

  const primaryRows = await fetchRows(input.adScopeOnly ? 'ad' : 'adset');
  const rows = !input.adScopeOnly && primaryRows.length === 0 ? await fetchRows('ad') : primaryRows;

  const scopedRows = input.adScopeOnly
    ? rows.filter((row) => Boolean(row.ad_id && selectedAdIds.has(row.ad_id)))
    : rows;
  const aggregated = new Map<
    string,
    {
      day: string;
      hour: number;
      spend: number;
      reach: number;
      impressions: number;
      clicks: number;
      inlineLinkClicks: number;
      leads: number;
      messages: number;
      calls: number;
    }
  >();

  for (const row of scopedRows) {
    const day = row.day;
    const hour = row.hour_of_day ?? -1;

    if (!day || hour < 0 || hour > 23) {
      continue;
    }

    const key = `${day}:${hour}`;
    const current = aggregated.get(key) ?? {
      day,
      hour,
      spend: 0,
      reach: 0,
      impressions: 0,
      clicks: 0,
      inlineLinkClicks: 0,
      leads: 0,
      messages: 0,
      calls: 0,
    };

    current.spend += row.spend ?? 0;
    current.reach += row.reach ?? 0;
    current.impressions += row.impressions ?? 0;
    current.clicks += row.clicks ?? 0;
    current.inlineLinkClicks += row.inline_link_clicks ?? 0;
    current.leads += row.leads ?? 0;
    current.messages += row.messages ?? 0;
    current.calls += row.calls ?? 0;
    aggregated.set(key, current);
  }

  return Array.from(aggregated.values())
    .sort((left, right) => left.day.localeCompare(right.day) || left.hour - right.hour)
    .map((row) => {
      const results = row.leads + row.messages + row.calls;
      const ctr = row.impressions > 0 ? (row.clicks / row.impressions) * 100 : 0;
      const cpc = row.clicks > 0 ? row.spend / row.clicks : 0;
      const cpm = row.impressions > 0 ? (row.spend / row.impressions) * 1000 : 0;
      const day = new Date(`${row.day}T00:00:00Z`);
      const utcDay = Number.isNaN(day.getTime()) ? null : day.getUTCDay();

      return {
        label: `${row.day} · ${row.hour}`,
        dayKey: row.day,
        dayOfWeek: utcDay == null ? null : utcDay === 0 ? 6 : utcDay - 1,
        hourOfDay: row.hour,
        spend: Number(row.spend.toFixed(2)),
        results,
        clicks: row.clicks,
        inlineLinkClicks: row.inlineLinkClicks,
        impressions: row.impressions,
        reach: row.reach,
        ctr: Number(ctr.toFixed(2)),
        cpc: Number(cpc.toFixed(2)),
        cpm: Number(cpm.toFixed(2)),
        frequency: 0,
        costPerResult: results > 0 ? Number((row.spend / results).toFixed(2)) : 0,
      } satisfies DashboardTrendPoint;
    });
}

async function buildSurfaceContext(
  supabase: SupabaseClient,
  input: {
    query: ReportQueryInput;
    context: FilterContext;
    adAccounts: AdAccountRow[];
    hasReportDelivery: boolean;
  }
): Promise<ReportSurfaceContext> {
  const metaAdAccountIds = input.adAccounts
    .filter((account) => isMetaAdAccount(input.context, account))
    .map((account) => account.id);
  const isMeta = metaAdAccountIds.length > 0;

  if (!isMeta) {
    return {
      isMeta: false,
      platformBreakdowns: buildPlatformBreakdowns({
        isMeta: false,
        hasLiveDelivery: false,
        audienceRows: [],
      }),
      audienceBreakdowns: buildAudienceBreakdowns({
        isMeta: false,
        hasLiveDelivery: false,
        audienceRows: [],
      }),
      hourlyTrendExpanded: [],
    };
  }

  const entityIds = resolveSurfaceEntityIds({
    query: input.query,
    context: input.context,
    adAccountIds: metaAdAccountIds,
  });

  const [audienceRows, hourlyTrendExpanded] = await Promise.all([
    listReportAudienceRows(supabase, {
      ...entityIds,
      dateFrom: input.query.dateFrom,
      dateTo: input.query.dateTo,
    }),
    listReportHourlyTrendRows(supabase, {
      ...entityIds,
      dateFrom: input.query.dateFrom,
      dateTo: input.query.dateTo,
    }),
  ]);

  return {
    isMeta: true,
    platformBreakdowns: buildPlatformBreakdowns({
      isMeta: true,
      hasLiveDelivery: input.hasReportDelivery,
      audienceRows,
    }),
    audienceBreakdowns: buildAudienceBreakdowns({
      isMeta: true,
      hasLiveDelivery: input.hasReportDelivery,
      audienceRows,
    }),
    hourlyTrendExpanded,
  };
}

export async function getReportFilterOptions(query: ReportQueryInput): Promise<ReportFilterOptions> {
  const supabase = await createSupabaseClient();
  const context = await getFilterContext(supabase, query);

  return buildFilterOptions(context);
}

export async function buildReportPayload(
  query: ReportQueryInput,
  supabaseOverride?: SupabaseClient | null,
  options: BuildReportPayloadOptions = {}
): Promise<ReportPayload> {
  const supabase = supabaseOverride ?? (await createSupabaseClient());
  const includeMetrics = options.includeMetrics ?? true;
  const includeBreakdown = options.includeBreakdown ?? true;
  const includeRanking = options.includeRanking ?? true;
  const includeActiveDates = options.includeActiveDates ?? true;
  const includeSurface = options.includeSurface ?? true;
  const context = await getFilterContext(supabase, query);
  const adAccounts = context.adAccounts.filter((row) =>
    query.adAccountIds.length > 0 ? query.adAccountIds.includes(row.id) : true
  );
  const adAccountIds = adAccounts.map((row) => row.id);
  const previousRange =
    query.compareMode === 'previous_period' ? getPreviousPeriodRange(query) : null;
  const currentRowsPromise = includeMetrics
    ? buildTopLevelMetricsRows(supabase, query, adAccountIds, query.dateFrom, query.dateTo)
    : Promise.resolve([]);
  const previousRowsPromise =
    includeMetrics && previousRange
      ? buildTopLevelMetricsRows(
          supabase,
          query,
          adAccountIds,
          previousRange.dateFrom,
          previousRange.dateTo
        )
      : Promise.resolve([]);
  const breakdownPromise = includeBreakdown
    ? buildBreakdown(supabase, query, context, adAccountIds)
    : Promise.resolve(emptyReportBreakdown());
  const rankingPromise = includeRanking
    ? buildRankingContext(supabase, {
        query,
        context,
        adAccountIds,
      })
    : Promise.resolve(emptyReportRankingContext());
  const activeDatesPromise = includeActiveDates
    ? buildActiveDateContext(supabase, query, adAccountIds)
    : Promise.resolve(null);

  const [currentRows, previousRows, breakdown, ranking, activeDates] = await Promise.all([
    currentRowsPromise,
    previousRowsPromise,
    breakdownPromise,
    rankingPromise,
    activeDatesPromise,
  ]);

  const summary = sumMetrics(currentRows);
  const previousTotals = previousRows.length > 0 ? sumMetrics(previousRows) : null;
  const currencyCode = resolveCurrencyCode(currentRows);
  const title = resolveTitle({
    query,
    context,
    adAccountIds,
  });
  const filterSummary = buildFilterSummary({ query, context });
  const isMetaSurface = adAccounts.some((account) => isMetaAdAccount(context, account));
  const surface = includeSurface
    ? await buildSurfaceContext(supabase, {
        query,
        context,
        adAccounts,
        hasReportDelivery:
          summary.spend > 0 ||
          summary.impressions > 0 ||
          summary.clicks > 0 ||
          summary.conversion > 0,
      })
    : emptyReportSurfaceContext(isMetaSurface);
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
    activeDates,
    surface,
    export: {
      title: title.title,
      subtitle: title.subtitle,
      generatedAt,
      filterSummary,
    },
  };
}
