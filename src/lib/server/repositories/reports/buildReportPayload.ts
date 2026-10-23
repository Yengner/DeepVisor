import { listReportCreatives, reportCreativePreview } from './creatives';
import 'server-only';
import { ReportScopeError } from '@/lib/server/reports/access';
import { aggregateReportMetrics, sourceUnavailable, buildReportKpis as buildKpis } from '@/lib/shared/reports/metrics';
import { resolveReportDates, previousReportRange as getPreviousPeriodRange } from '@/lib/shared/reports/dates';
import { dailyCoverage } from '@/lib/shared/reports/coverage';
import { loadReportSurfaces } from './surfaces';

import { createSupabaseClient } from '@/lib/server/supabase/server';
import { nonOverlappingHistory } from '@/lib/shared/reports/history';
import { chunkArray } from '@/lib/server/repositories/utils';
import { listActiveTrendFindingViews } from '@/lib/server/intelligence/repositories/trendFindings';
import {
  buildAudienceBreakdowns,
  buildPlatformBreakdowns,
} from '@/lib/server/dashboard/buildPayload';
import { buildReportUrl } from '@/lib/shared';
import type { Database } from '@/lib/shared/types/supabase';
import type {
  ReportActiveDateContext,
  ReportBreakdownRow,
  ReportComparisonSummary,
  ReportFilterOptions,
  ReportMetricTotals,
  ReportPayload,
  ReportQueryInput,
  ReportRankingContext,
  ReportSurfaceContext,
  ReportTimeSeriesPoint,
} from '@/lib/server/reports/types';

type SupabaseClient = Awaited<ReturnType<typeof createSupabaseClient>>;

type MetricsRow = {
  unavailable?: ReportMetricTotals["unavailable"];
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
  unavailable?: ReportMetricTotals["unavailable"];
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
  'id' | 'business_id' | 'platform_id' | 'external_account_id' | 'name' | 'status' | 'currency_code' | 'timezone'
> & {
  platform_integration_id?: string;
  platform_label?: string;
};

type CampaignDimRow = {
  id: string;
  ad_account_id: string;
  external_id: string;
  name: string | null;
  objective: string | null;
  status: string | null;
};

type AdsetDimRow = {
  id: string;
  ad_account_id: string;
  campaign_external_id: string;
  external_id: string;
  name: string | null;
  optimization_goal: string | null;
  status: string | null;
};

type AdDimRow = {
  id: string;
  ad_account_id: string;
  adset_external_id: string;
  external_id: string;
  name: string | null;
  status: string | null;
  creative_id: string | null;
};

type AdCreativeRow = Database['public']['Tables']['ad_creatives']['Row'];

type EntityAggregate = {
  unavailable?: ReportMetricTotals["unavailable"];
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

type EntitySummaryRow = {
  entity_id: string;
  ad_account_id: string;
  entity_level: 'campaign' | 'adset' | 'ad';
  spend: number | string | null;
  reach: number | string | null;
  impressions: number | string | null;
  clicks: number | string | null;
  inline_link_clicks: number | string | null;
  leads: number | string | null;
  messages: number | string | null;
  calls: number | string | null;
  first_day: string | null;
  last_day: string | null;
};

type EntitySummaryDateBoundsRow = {
  first_day: string | null;
  last_day: string | null;
};

type SummaryEntityRow = {
  id: string;
  ad_account_id: string;
  entity_level: 'campaign' | 'adset' | 'ad';
  external_id: string;
  parent_external_id: string | null;
  campaign_id: string | null;
  adset_id: string | null;
  name: string | null;
  objective: string | null;
  optimization_goal: string | null;
  status: string | null;
};

type AccountMonthlyMetricRow = Pick<
  Database['public']['Tables']['ad_account_performance_monthly']['Row'],
  | 'ad_account_id'
  | 'month_start'
  | 'spend'
  | 'reach'
  | 'impressions'
  | 'clicks'
  | 'inline_link_clicks'
  | 'leads'
  | 'messages'
  | 'calls'
>;

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

function isSummaryRangeReport(query: ReportQueryInput): boolean {
  return query.rangeMode === 'max';
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addUtcDays(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return toIsoDate(date);
}

function monthEnd(value: string): string {
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));

  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return value;
  }

  return toIsoDate(new Date(Date.UTC(year, month, 0)));
}

function minDate(current: string | null, candidate: string | null): string | null {
  if (!candidate) {
    return current;
  }

  if (!current || candidate < current) {
    return candidate;
  }

  return current;
}

function maxDate(current: string | null, candidate: string | null): string | null {
  if (!candidate) {
    return current;
  }

  if (!current || candidate > current) {
    return candidate;
  }

  return current;
}

function isLikelyActiveStatus(status: string | null | undefined): boolean {
  const normalized = (status ?? '').trim().toLowerCase();

  if (!normalized) {
    return false;
  }

  if (
    [
      'paused',
      'archived',
      'completed',
      'ended',
      'disabled',
      'inactive',
      'deleted',
      'removed',
      'rejected',
      'disapproved',
      'error',
      'failed',
      'draft',
    ].some((token) => normalized.includes(token))
  ) {
    return false;
  }

  return ['active', 'enabled', 'learning', 'limited', 'pending', 'review', 'running', 'serving'].some(
    (token) => normalized.includes(token)
  );
}

function formatDateRange(dateFrom: string, dateTo: string): string {
  return `${dateFrom} to ${dateTo}`;
}

const sumMetrics = aggregateReportMetrics;

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

    if (!data) throw new ReportScopeError('Reporting platform is not authorized.');
    platformId = data.platform_id;
  }

  let query = supabase
    .from('ad_accounts')
    .select('id, business_id, platform_id, external_account_id, name, status, currency_code, timezone')
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

    for (let from = 0; ; from += 500) {
      const { data, error } = await query.order('id').range(from, from + 499);
      if (error) throw error;
      if (!data) throw new Error('Report dimensions unavailable');
      rows.push(...(data as CampaignDimRow[]));
      if (data.length < 500) break;
    }
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

    for (let from = 0; ; from += 500) {
      const { data, error } = await query.order('id').range(from, from + 499);
      if (error) throw error;
      if (!data) throw new Error('Report dimensions unavailable');
      rows.push(...(data as AdsetDimRow[]));
      if (data.length < 500) break;
    }
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

    for (let from = 0; ; from += 500) {
      const { data, error } = await query.order('id').range(from, from + 499);
      if (error) throw error;
      if (!data) throw new Error('Report dimensions unavailable');
      rows.push(...(data as AdDimRow[]));
      if (data.length < 500) break;
    }
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
    unavailable: sourceUnavailable(row),
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
    unavailable: { ...sourceUnavailable(row), ...row.unavailable },
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

async function listSummaryEntities(
  supabase: SupabaseClient,
  input: {
    entityLevel: ReportBreakdownRow['level'];
    adAccountIds: string[];
    entityExternalIds?: string[];
    campaignExternalIds?: string[];
    adsetExternalIds?: string[];
  }
): Promise<SummaryEntityRow[]> {
  const rows: SummaryEntityRow[] = [];
  const entityExternalChunks = optionalChunks(input.entityExternalIds);
  const campaignExternalChunks = optionalChunks(input.campaignExternalIds);
  const adsetExternalChunks = optionalChunks(input.adsetExternalIds);
  const client = supabase as any;

  for (const adAccountIdsChunk of chunkArray(input.adAccountIds, 100)) {
    for (const entityExternalIdsChunk of entityExternalChunks) {
      for (const campaignExternalIdsChunk of campaignExternalChunks) {
        for (const adsetExternalIdsChunk of adsetExternalChunks) {
          let page = 0;
          const pageSize = 1000;

          while (true) {
            let query = client
              .from('ad_entities')
              .select(
                'id, ad_account_id, entity_level, external_id, parent_external_id, campaign_id, adset_id, name, objective, optimization_goal, status'
              )
              .eq('entity_level', input.entityLevel)
              .in('ad_account_id', adAccountIdsChunk)
              .order('name', { ascending: true });

            if (entityExternalIdsChunk) {
              query = query.in('external_id', entityExternalIdsChunk);
            }

            if (campaignExternalIdsChunk && input.entityLevel === 'adset') {
              query = query.in('parent_external_id', campaignExternalIdsChunk);
            }

            if (adsetExternalIdsChunk && input.entityLevel === 'ad') {
              query = query.in('parent_external_id', adsetExternalIdsChunk);
            }

            const { data, error } = await query.range(
              page * pageSize,
              page * pageSize + pageSize - 1
            );

            if (error) {
              throw error;
            }

            const pageRows = (data ?? []) as SummaryEntityRow[];
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

async function listEntitySummaryRows(
  supabase: SupabaseClient,
  entityIds: string[]
): Promise<EntitySummaryRow[]> {
  if (entityIds.length === 0) {
    return [];
  }

  const rows: EntitySummaryRow[] = [];
  const client = supabase as any;

  for (const entityIdsChunk of chunkArray(entityIds, 200)) {
    const { data, error } = await client
      .from('ad_entity_performance_summary')
      .select(
        'entity_id, ad_account_id, entity_level, spend, reach, impressions, clicks, inline_link_clicks, leads, messages, calls, first_day, last_day'
      )
      .in('entity_id', entityIdsChunk);

    if (error) {
      throw error;
    }

    rows.push(...((data ?? []) as EntitySummaryRow[]));
  }

  return rows;
}

async function listParentSummaryEntities(
  supabase: SupabaseClient,
  entityIds: string[]
): Promise<Map<string, SummaryEntityRow>> {
  const parentById = new Map<string, SummaryEntityRow>();
  const ids = Array.from(new Set(entityIds.filter(Boolean)));

  if (ids.length === 0) {
    return parentById;
  }

  const client = supabase as any;

  for (const idsChunk of chunkArray(ids, 200)) {
    const { data, error } = await client
      .from('ad_entities')
      .select(
        'id, ad_account_id, entity_level, external_id, parent_external_id, campaign_id, adset_id, name, objective, optimization_goal, status'
      )
      .in('id', idsChunk);

    if (error) {
      throw error;
    }

    for (const row of (data ?? []) as SummaryEntityRow[]) {
      parentById.set(row.id, row);
    }
  }

  return parentById;
}

async function listSummaryBreakdownRows(
  supabase: SupabaseClient,
  input: {
    entityLevel: ReportBreakdownRow['level'];
    adAccountIds: string[];
    entityExternalIds?: string[];
    campaignExternalIds?: string[];
    adsetExternalIds?: string[];
    currencyCodeByAdAccountId: Map<string, string | null>;
  }
): Promise<ReportBreakdownRpcRow[]> {
  const entities = await listSummaryEntities(supabase, input);

  if (entities.length === 0) {
    return [];
  }

  const [summaries, parentById] = await Promise.all([
    listEntitySummaryRows(
      supabase,
      entities.map((entity) => entity.id)
    ),
    listParentSummaryEntities(
      supabase,
      entities.flatMap((entity) => [entity.campaign_id, entity.adset_id]).filter(Boolean) as string[]
    ),
  ]);
  const summaryByEntityId = new Map(summaries.map((summary) => [summary.entity_id, summary]));

  return entities.map((entity) => {
    const summary = summaryByEntityId.get(entity.id);
    const campaign = entity.campaign_id ? parentById.get(entity.campaign_id) ?? null : null;
    const adset = entity.adset_id ? parentById.get(entity.adset_id) ?? null : null;
    const campaignExternalId =
      entity.entity_level === 'campaign'
        ? entity.external_id
        : campaign?.external_id ?? null;
    const adsetExternalId =
      entity.entity_level === 'adset'
        ? entity.external_id
        : adset?.external_id ?? null;

    return {
      unavailable: sourceUnavailable(summary ?? {}),
      entity_level: entity.entity_level,
      entity_id: entity.id,
      entity_external_id: entity.external_id,
      ad_account_id: entity.ad_account_id,
      campaign_external_id: campaignExternalId,
      adset_external_id: adsetExternalId,
      entity_name: entity.name,
      campaign_name:
        entity.entity_level === 'campaign'
          ? entity.name
          : campaign?.name ?? null,
      adset_name:
        entity.entity_level === 'adset'
          ? entity.name
          : adset?.name ?? null,
      objective: entity.objective ?? campaign?.objective ?? null,
      status: entity.status,
      currency_code: input.currencyCodeByAdAccountId.get(entity.ad_account_id) ?? null,
      start_date: summary?.first_day ?? null,
      end_date: summary?.last_day ?? null,
      spend: summary?.spend ?? 0,
      reach: summary?.reach ?? 0,
      impressions: summary?.impressions ?? 0,
      clicks: summary?.clicks ?? 0,
      inline_link_clicks: summary?.inline_link_clicks ?? 0,
      leads: summary?.leads ?? 0,
      messages: summary?.messages ?? 0,
      calls: summary?.calls ?? 0,
    } satisfies ReportBreakdownRpcRow;
  });
}

async function getAdAccountSummaryDateBounds(
  supabase: SupabaseClient,
  adAccountIds: string[]
): Promise<{ dateFrom: string | null; dateTo: string | null }> {
  let dateFrom: string | null = null;
  let dateTo: string | null = null;

  if (adAccountIds.length === 0) {
    return { dateFrom, dateTo };
  }

  const client = supabase as any;

  for (const adAccountIdsChunk of chunkArray(adAccountIds, 100)) {
    let page = 0;
    const pageSize = 1000;

    while (true) {
      const { data, error } = await client
        .from('ad_entity_performance_summary')
        .select('first_day, last_day')
        .in('ad_account_id', adAccountIdsChunk)
        .range(page * pageSize, page * pageSize + pageSize - 1);

      if (error) {
        throw error;
      }

      const rows = (data ?? []) as EntitySummaryDateBoundsRow[];

      for (const row of rows) {
        dateFrom = minDate(dateFrom, row.first_day);
        dateTo = maxDate(dateTo, row.last_day);
      }

      if (rows.length < pageSize) {
        break;
      }

      page += 1;
    }
  }

  return { dateFrom, dateTo };
}

async function buildAdAccountSummaryMetricRows(
  supabase: SupabaseClient,
  input: {
    context: FilterContext;
    adAccountIds: string[];
    fallbackDay: string;
  }
): Promise<MetricsRow[]> {
  const currencyCodeByAdAccountId = new Map(
    input.context.adAccounts.map((account) => [account.id, account.currency_code])
  );
  let rows = await listSummaryBreakdownRows(supabase, {
    entityLevel: 'campaign',
    adAccountIds: input.adAccountIds,
    currencyCodeByAdAccountId,
  });

  if (rows.length === 0) {
    rows = await listSummaryBreakdownRows(supabase, {
      entityLevel: 'adset',
      adAccountIds: input.adAccountIds,
      currencyCodeByAdAccountId,
    });
  }

  if (rows.length === 0) {
    rows = await listSummaryBreakdownRows(supabase, {
      entityLevel: 'ad',
      adAccountIds: input.adAccountIds,
      currencyCodeByAdAccountId,
    });
  }

  return rows.map((row) => ({
    unavailable: row.unavailable,
    day: row.end_date ?? row.start_date ?? input.fallbackDay,
    currency_code: row.currency_code ?? null,
    spend: toNumber(row.spend),
    reach: toNumber(row.reach),
    impressions: toNumber(row.impressions),
    clicks: toNumber(row.clicks),
    inline_link_clicks: toNumber(row.inline_link_clicks),
    leads: toNumber(row.leads),
    messages: toNumber(row.messages),
    calls: toNumber(row.calls),
  }));
}

function getSummaryMetricEntityLevel(query: ReportQueryInput): ReportBreakdownRow['level'] {
  if (query.scope === 'ad') {
    return 'ad';
  }

  if (query.scope === 'adset') {
    return 'adset';
  }

  return 'campaign';
}

function getSummaryMetricFilters(query: ReportQueryInput): {
  entityExternalIds?: string[];
  campaignExternalIds?: string[];
  adsetExternalIds?: string[];
} {
  if (query.scope === 'campaign') {
    return {
      entityExternalIds: query.campaignIds,
    };
  }

  if (query.scope === 'adset') {
    return {
      entityExternalIds: query.adsetIds,
      campaignExternalIds: query.campaignIds,
    };
  }

  if (query.scope === 'ad') {
    return {
      entityExternalIds: query.adIds,
      adsetExternalIds: query.adsetIds,
    };
  }

  return {};
}

async function buildSummaryMetricRows(
  supabase: SupabaseClient,
  input: {
    query: ReportQueryInput;
    context: FilterContext;
    adAccountIds: string[];
    fallbackDay: string;
  }
): Promise<MetricsRow[]> {
  const currencyCodeByAdAccountId = new Map(
    input.context.adAccounts.map((account) => [account.id, account.currency_code])
  );
  const rows = await listSummaryBreakdownRows(supabase, {
    entityLevel: getSummaryMetricEntityLevel(input.query),
    adAccountIds: input.adAccountIds,
    ...getSummaryMetricFilters(input.query),
    currencyCodeByAdAccountId,
  });

  return rows.map((row) => ({
    unavailable: row.unavailable,
    day: row.end_date ?? row.start_date ?? input.fallbackDay,
    currency_code: row.currency_code ?? null,
    spend: toNumber(row.spend),
    reach: toNumber(row.reach),
    impressions: toNumber(row.impressions),
    clicks: toNumber(row.clicks),
    inline_link_clicks: toNumber(row.inline_link_clicks),
    leads: toNumber(row.leads),
    messages: toNumber(row.messages),
    calls: toNumber(row.calls),
  }));
}

async function getReportSummaryDateBounds(
  supabase: SupabaseClient,
  input: {
    query: ReportQueryInput;
    context: FilterContext;
    adAccountIds: string[];
  }
): Promise<{ dateFrom: string | null; dateTo: string | null }> {
  if (input.query.scope === 'business' || input.query.scope === 'platform' || input.query.scope === 'ad_account') {
    return getAdAccountSummaryDateBounds(supabase, input.adAccountIds);
  }

  const currencyCodeByAdAccountId = new Map(
    input.context.adAccounts.map((account) => [account.id, account.currency_code])
  );
  const rows = await listSummaryBreakdownRows(supabase, {
    entityLevel: getSummaryMetricEntityLevel(input.query),
    adAccountIds: input.adAccountIds,
    ...getSummaryMetricFilters(input.query),
    currencyCodeByAdAccountId,
  });

  if (rows.length === 0) {
    return getAdAccountSummaryDateBounds(supabase, input.adAccountIds);
  }

  return rows.reduce(
    (bounds, row) => ({
      dateFrom: minDate(bounds.dateFrom, row.start_date),
      dateTo: maxDate(bounds.dateTo, row.end_date),
    }),
    { dateFrom: null, dateTo: null } as { dateFrom: string | null; dateTo: string | null }
  );
}

async function listAdAccountMonthlyMetricRows(
  supabase: SupabaseClient,
  input: {
    context: FilterContext;
    adAccountIds: string[];
  }
): Promise<MetricsRow[]> {
  if (input.adAccountIds.length === 0) {
    return [];
  }

  const rows: AccountMonthlyMetricRow[] = [];
  const client = supabase as any;

  for (const adAccountIdsChunk of chunkArray(input.adAccountIds, 100)) {
    let page = 0;
    const pageSize = 1000;

    while (true) {
      const { data, error } = await client
        .from('ad_account_performance_monthly')
        .select(
          'ad_account_id, month_start, spend, reach, impressions, clicks, inline_link_clicks, leads, messages, calls'
        )
        .in('ad_account_id', adAccountIdsChunk)
        .order('month_start', { ascending: true })
        .range(page * pageSize, page * pageSize + pageSize - 1);

      if (error) {
        throw error;
      }

      const pageRows = (data ?? []) as AccountMonthlyMetricRow[];
      rows.push(...pageRows);

      if (pageRows.length < pageSize) {
        break;
      }

      page += 1;
    }
  }

  const currencyCodeByAdAccountId = new Map(
    input.context.adAccounts.map((account) => [account.id, account.currency_code])
  );

  return rows.map((row) => ({
    unavailable: sourceUnavailable(row),
    day: row.month_start,
    currency_code: currencyCodeByAdAccountId.get(row.ad_account_id) ?? null,
    spend: toNumber(row.spend),
    reach: toNumber(row.reach),
    impressions: toNumber(row.impressions),
    clicks: toNumber(row.clicks),
    inline_link_clicks: toNumber(row.inline_link_clicks),
    leads: toNumber(row.leads),
    messages: toNumber(row.messages),
    calls: toNumber(row.calls),
  }));
}

async function buildAdAccountFullHistoryMetricRows(
  supabase: SupabaseClient,
  input: {
    query: ReportQueryInput;
    context: FilterContext;
    adAccountIds: string[];
    warnings: string[];
  }
): Promise<MetricsRow[]> {
  const [monthlyRows, dailyRows] = await Promise.all([
    listAdAccountMonthlyMetricRows(supabase, {
      context: input.context,
      adAccountIds: input.adAccountIds,
    }),
    listReportMetricRows(supabase, {
      entityLevel: 'campaign',
      adAccountIds: input.adAccountIds,
      dateFrom: input.query.dateFrom,
      dateTo: input.query.dateTo,
    }),
  ]);
  const combined = nonOverlappingHistory(monthlyRows, dailyRows);
  input.warnings.push(...combined.warnings);
  const rows = combined.rows;

  if (rows.length > 0) {
    return rows;
  }

  return [];
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

async function listRecentlyActiveEntityExternalIds(
  supabase: SupabaseClient,
  input: {
    adAccountIds: string[];
    entityLevel: ReportEntityDailyRow['entity_level'];
    sinceDay: string;
  }
): Promise<Set<string>> {
  const ids = new Set<string>();

  if (input.adAccountIds.length === 0) {
    return ids;
  }

  const deliveryFilter =
    'spend.gt.0,impressions.gt.0,clicks.gt.0,inline_link_clicks.gt.0,leads.gt.0,messages.gt.0,calls.gt.0';

  for (const adAccountIdsChunk of chunkArray(input.adAccountIds, 100)) {
    let page = 0;
    const pageSize = 1000;

    while (true) {
      const { data, error } = await supabase
        .from('report_entity_daily_v')
        .select('entity_external_id')
        .eq('entity_level', input.entityLevel)
        .in('ad_account_id', adAccountIdsChunk)
        .gte('day', input.sinceDay)
        .or(deliveryFilter)
        .range(page * pageSize, page * pageSize + pageSize - 1);

      if (error) {
        throw error;
      }

      const pageRows = (data ?? []) as Array<{ entity_external_id: string | null }>;

      for (const row of pageRows) {
        if (row.entity_external_id) {
          ids.add(row.entity_external_id);
        }
      }

      if (pageRows.length < pageSize) {
        break;
      }

      page += 1;
    }
  }

  return ids;
}

function keepActiveRecentOrSelected(
  row: { external_id: string; status: string | null },
  selectedExternalIds: Set<string>,
  recentExternalIds: Set<string>
): boolean {
  return (
    selectedExternalIds.has(row.external_id) ||
    recentExternalIds.has(row.external_id) ||
    isLikelyActiveStatus(row.status)
  );
}

async function getFilterContext(
  supabase: SupabaseClient,
  query: ReportQueryInput,
  options: {
    entityMode?: 'active_recent' | 'all';
  } = {}
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

  if (query.adAccountIds.some(id => !allowedAdAccountIds.includes(id))) throw new ReportScopeError('Reporting account is not authorized.');
  const selectedCampaigns = campaigns.filter(row => query.campaignIds.includes(row.external_id));
  const selectedAdsets = adsets.filter(row => query.adsetIds.includes(row.external_id));
  const selectedAds = ads.filter(row => query.adIds.includes(row.external_id));
  for (const [requested, found] of [[query.campaignIds, selectedCampaigns], [query.adsetIds, selectedAdsets], [query.adIds, selectedAds]] as const) {
    if (requested.some(id => !found.some(row => row.external_id === id))) throw new ReportScopeError('Reporting entity is not authorized.');
  }
  if (selectedAdsets.some(row => query.campaignIds.length && !query.campaignIds.includes(row.campaign_external_id)) ||
      selectedAds.some(row => (query.adsetIds.length && !query.adsetIds.includes(row.adset_external_id)) ||
        (query.campaignIds.length && !adsets.some(parent => parent.ad_account_id === row.ad_account_id && parent.external_id === row.adset_external_id && query.campaignIds.includes(parent.campaign_external_id))))) {
    throw new ReportScopeError('Reporting hierarchy does not match the selected parents.');
  }
  if (options.entityMode !== 'active_recent') {
    return {
      business,
      platforms,
      adAccounts,
      campaigns,
      adsets,
      ads,
    };
  }

  const recentSinceDay = addUtcDays(toIsoDate(new Date()), -29);
  const [recentCampaignExternalIds, recentAdsetExternalIds, recentAdExternalIds] =
    allowedAdAccountIds.length
      ? await Promise.all([
          listRecentlyActiveEntityExternalIds(supabase, {
            adAccountIds: allowedAdAccountIds,
            entityLevel: 'campaign',
            sinceDay: recentSinceDay,
          }),
          listRecentlyActiveEntityExternalIds(supabase, {
            adAccountIds: allowedAdAccountIds,
            entityLevel: 'adset',
            sinceDay: recentSinceDay,
          }),
          listRecentlyActiveEntityExternalIds(supabase, {
            adAccountIds: allowedAdAccountIds,
            entityLevel: 'ad',
            sinceDay: recentSinceDay,
          }),
        ])
      : [new Set<string>(), new Set<string>(), new Set<string>()];
  const selectedCampaignExternalIds = new Set(query.campaignIds);
  const selectedAdsetExternalIds = new Set(query.adsetIds);
  const selectedAdExternalIds = new Set(query.adIds);
  const filteredAds = ads.filter((ad) =>
    keepActiveRecentOrSelected(ad, selectedAdExternalIds, recentAdExternalIds)
  );
  const adsetExternalIdsNeededByAds = new Set(filteredAds.map((ad) => ad.adset_external_id));
  const filteredAdsets = adsets.filter(
    (adset) =>
      adsetExternalIdsNeededByAds.has(adset.external_id) ||
      keepActiveRecentOrSelected(adset, selectedAdsetExternalIds, recentAdsetExternalIds)
  );
  const campaignExternalIdsNeededByAdsets = new Set(
    filteredAdsets.map((adset) => adset.campaign_external_id)
  );
  const filteredCampaigns = campaigns.filter(
    (campaign) =>
      campaignExternalIdsNeededByAdsets.has(campaign.external_id) ||
      keepActiveRecentOrSelected(campaign, selectedCampaignExternalIds, recentCampaignExternalIds)
  );

  return {
    business,
    platforms,
    adAccounts,
    campaigns: filteredCampaigns,
    adsets: filteredAdsets,
    ads: filteredAds,
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
  creativePreview?: ReportBreakdownRow['creativePreview'];
  drilldownLabel?: string | null;
  drilldownHref?: string | null;
  aggregate: EntityAggregate;
}): ReportBreakdownRow {
  const metrics = aggregateReportMetrics([{
    ...input.aggregate,
    inline_link_clicks: input.aggregate.linkClicks,
    currency_code: input.aggregate.currencyCodes.size === 1 ? [...input.aggregate.currencyCodes][0] : null,
  }]);

  return {
    id: input.id,
    name: input.name,
    level: input.level,
    status: input.status,
    primaryContext: input.primaryContext,
    secondaryContext: input.secondaryContext,
    creativeContext: input.creativeContext ?? null,
    creativePreview: input.creativePreview ?? null,
    drilldownLabel: input.drilldownLabel ?? null,
    drilldownHref: input.drilldownHref ?? null,
    ...metrics,
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
    useLifetimeSummary?: boolean;
  }
): Promise<ReportBreakdownRow[]> {
  const adAccountNameById = new Map(
    input.context.adAccounts.map((account) => [account.id, account.name || account.external_account_id])
  );
  const currencyCodeByAdAccountId = new Map(
    input.context.adAccounts.map((account) => [account.id, account.currency_code])
  );
  const rows = input.useLifetimeSummary
    ? await listSummaryBreakdownRows(supabase, {
        entityLevel: 'campaign',
        adAccountIds: input.adAccountIds,
        entityExternalIds: input.externalIds,
        currencyCodeByAdAccountId,
      })
    : await listReportBreakdownRows(supabase, {
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
    useLifetimeSummary?: boolean;
  }
): Promise<ReportBreakdownRow[]> {
  const campaignNameById = new Map(
    input.context.campaigns.map((campaign) => [campaign.external_id, campaign.name || 'Unnamed campaign'])
  );
  const currencyCodeByAdAccountId = new Map(
    input.context.adAccounts.map((account) => [account.id, account.currency_code])
  );
  const rows = input.useLifetimeSummary
    ? await listSummaryBreakdownRows(supabase, {
        entityLevel: 'adset',
        adAccountIds: input.adAccountIds,
        campaignExternalIds: input.campaignExternalIds,
        entityExternalIds: input.externalIds,
        currencyCodeByAdAccountId,
      })
    : await listReportBreakdownRows(supabase, {
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
    useLifetimeSummary?: boolean;
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

  const currencyCodeByAdAccountId = new Map(
    input.context.adAccounts.map((account) => [account.id, account.currency_code])
  );
  const rows = input.useLifetimeSummary
    ? await listSummaryBreakdownRows(supabase, {
        entityLevel: 'ad',
        adAccountIds: input.adAccountIds,
        adsetExternalIds: input.adsetExternalIds,
        entityExternalIds: input.externalIds,
        currencyCodeByAdAccountId,
      })
    : await listReportBreakdownRows(supabase, {
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
  const creatives = await listReportCreatives(supabase, {
    businessId: input.query.businessId,
    adAccountIds: input.adAccountIds,
    platformCreativeIds: ads
      .map((ad) => ad.creative_id)
      .filter((value): value is string => Boolean(value)),
  });
  const creativeById = new Map(
    creatives.map((creative) => [`${creative.ad_account_id}:${creative.platform_creative_id}`, creative] satisfies [string, AdCreativeRow])
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
          ad?.creative_id ? creativeById.get(`${row.ad_account_id}:${ad.creative_id}`) : null
        ),
        creativePreview: reportCreativePreview(ad?.creative_id ? creativeById.get(`${row.ad_account_id}:${ad.creative_id}`) : undefined),
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
  const useLifetimeSummary = isSummaryRangeReport(input.query);
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
          useLifetimeSummary,
        })
      : Promise.resolve([]),
    shouldBuildAdsetRankings && selectedCampaignExternalIds.size > 0
      ? buildAdsetRows(supabase, {
          query: input.query,
          context: input.context,
          adAccountIds: input.adAccountIds,
          campaignExternalIds: Array.from(selectedCampaignExternalIds),
          includeAdsetReportLinks: true,
          useLifetimeSummary,
        })
      : Promise.resolve([]),
    shouldBuildAdsetRankings
      ? buildAdsetRows(supabase, {
          query: input.query,
          context: input.context,
          adAccountIds: input.adAccountIds,
          includeAdsetReportLinks: true,
          useLifetimeSummary,
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
          useLifetimeSummary,
        })
      : Promise.resolve([]),
    buildAdRows(supabase, {
      query: input.query,
      context: input.context,
      adAccountIds: input.adAccountIds,
      includeAdReportLinks: true,
      useLifetimeSummary,
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
    rangeMode: input.query.rangeMode,
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
      useLifetimeSummary: isSummaryRangeReport(query),
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
      useLifetimeSummary: isSummaryRangeReport(query),
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
    useLifetimeSummary: isSummaryRangeReport(query),
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
  const isSummaryRange = isSummaryRangeReport(input.query);
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
      label: 'Range',
      value: isSummaryRange
        ? `Max summary (${formatDateRange(input.query.dateFrom, input.query.dateTo)})`
        : formatDateRange(input.query.dateFrom, input.query.dateTo),
    },
    {
      label: 'Compare',
      value:
        !isSummaryRange && input.query.compareMode === 'previous_period'
          ? 'Previous period'
          : 'None',
    },
    {
      label: 'Grouping',
      value: isSummaryRange ? 'Summary' : input.query.groupBy,
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

async function buildSurfaceContext(
  supabase: SupabaseClient,
  input: { query: ReportQueryInput; context: FilterContext; adAccounts: AdAccountRow[]; hasReportDelivery: boolean }
): Promise<ReportSurfaceContext> {
  const adAccountIds = input.adAccounts.filter(account => isMetaAdAccount(input.context, account)).map(account => account.id);
  return loadReportSurfaces(supabase, {
    ...resolveSurfaceEntityIds({ query: input.query, context: input.context, adAccountIds }),
    isMeta: adAccountIds.length > 0,
    dateFrom: input.query.dateFrom,
    dateTo: input.query.dateTo,
    timezone: resolveReportDates(input.query, input.adAccounts.map(row => row.timezone)).timezone,
  });
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
  const useSummaryMode = isSummaryRangeReport(query);
  const context = await getFilterContext(supabase, query, {
    entityMode: 'all',
  });
  const adAccounts = context.adAccounts.filter((row) =>
    query.adAccountIds.length > 0 ? query.adAccountIds.includes(row.id) : true
  );
  const dateContext = resolveReportDates(query, adAccounts.map(row => row.timezone));
  query = { ...dateContext.query, presetDays: undefined };
  const adAccountIds = adAccounts.map((row) => row.id);
  const summaryBounds = useSummaryMode
    ? await getReportSummaryDateBounds(supabase, {
        query,
        context,
        adAccountIds,
      })
    : { dateFrom: null, dateTo: null };
  const effectiveQuery: ReportQueryInput =
    useSummaryMode
      ? {
          ...query,
          dateFrom: summaryBounds.dateFrom ?? query.dateFrom,
          dateTo: summaryBounds.dateTo ?? query.dateTo,
          groupBy: 'month',
          compareMode: 'none',
          rangeMode: 'max',
        }
      : query;
  const summaryRowsPromise =
    includeMetrics && isSummaryRangeReport(effectiveQuery)
      ? effectiveQuery.scope === 'ad_account'
        ? buildAdAccountSummaryMetricRows(supabase, {
            context,
            adAccountIds,
            fallbackDay: effectiveQuery.dateTo,
          })
        : buildSummaryMetricRows(supabase, {
            query: effectiveQuery,
            context,
            adAccountIds,
            fallbackDay: effectiveQuery.dateTo,
          })
      : Promise.resolve<MetricsRow[] | null>(null);
  const previousRange =
    effectiveQuery.compareMode === 'previous_period' ? getPreviousPeriodRange(effectiveQuery) : null;
  const warnings: string[] = [];
  const currentRowsPromise = includeMetrics
    ? isSummaryRangeReport(effectiveQuery)
      ? summaryRowsPromise.then(() =>
          effectiveQuery.scope === 'ad_account'
            ? buildAdAccountFullHistoryMetricRows(supabase, {
                query: effectiveQuery,
                context,
                adAccountIds,
                warnings,
              })
            : []
        )
      : buildTopLevelMetricsRows(
          supabase,
          effectiveQuery,
          adAccountIds,
          effectiveQuery.dateFrom,
          effectiveQuery.dateTo
        )
    : Promise.resolve([]);
  const previousRowsPromise =
    includeMetrics && previousRange
      ? buildTopLevelMetricsRows(
          supabase,
          effectiveQuery,
          adAccountIds,
          previousRange.dateFrom,
          previousRange.dateTo
        )
      : Promise.resolve([]);
  const breakdownPromise = includeBreakdown
    ? buildBreakdown(supabase, effectiveQuery, context, adAccountIds)
    : Promise.resolve(emptyReportBreakdown());
  const rankingPromise = includeRanking
    ? buildRankingContext(supabase, {
        query: effectiveQuery,
        context,
        adAccountIds,
      })
    : Promise.resolve(emptyReportRankingContext());
  const activeDatesPromise = includeActiveDates && effectiveQuery.scope !== 'ad_account'
    && effectiveQuery.rangeMode !== 'max'
    ? buildActiveDateContext(supabase, effectiveQuery, adAccountIds)
    : Promise.resolve(null);
  const findingsPromise =
    adAccountIds.length === 1
      ? listActiveTrendFindingViews(supabase as any, {
          businessId: effectiveQuery.businessId,
          adAccountId: adAccountIds[0],
          dateFrom: effectiveQuery.rangeMode === 'max' ? null : effectiveQuery.dateFrom,
          dateTo: effectiveQuery.rangeMode === 'max' ? null : effectiveQuery.dateTo,
        })
      : Promise.resolve([]);

  const [currentRows, previousRows, breakdown, ranking, activeDates, summaryMetricRows, findings] = await Promise.all([
    currentRowsPromise,
    previousRowsPromise,
    breakdownPromise,
    rankingPromise,
    activeDatesPromise,
    summaryRowsPromise,
    findingsPromise,
  ]);

  const summaryRows = summaryMetricRows && summaryMetricRows.length > 0 ? summaryMetricRows : currentRows;
  const summary = sumMetrics(summaryRows);
  const coverage = dailyCoverage(currentRows.map(row => row.day), effectiveQuery.dateFrom, effectiveQuery.dateTo);
  const previousCoverage = previousRange ? dailyCoverage(previousRows.map(row => row.day), previousRange.dateFrom, previousRange.dateTo) : undefined;
  const comparisonDisabledReason = dateContext.comparisonDisabledReason ??
    (previousRange && (coverage.state !== 'available' || previousCoverage?.state !== 'available')
      ? 'Comparison unavailable: both periods require observed daily coverage.' : null);
  const previousTotals = !comparisonDisabledReason && previousRows.length > 0 ? sumMetrics(previousRows) : null;
  const currencyCode = resolveCurrencyCode(summaryRows);
  const title = resolveTitle({
    query: effectiveQuery,
    context,
    adAccountIds,
  });
  const filterSummary = buildFilterSummary({ query: effectiveQuery, context });
  const isMetaSurface = adAccounts.some((account) => isMetaAdAccount(context, account));
  const surface = includeSurface
    ? await buildSurfaceContext(supabase, {
        query: effectiveQuery,
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
    query: effectiveQuery,
    meta: {
      businessName: context.business.business_name,
      title: title.title,
      subtitle: title.subtitle,
      scopeLabel: title.scopeLabel,
      currencyCode,
      generatedAt,
      timezone: dateContext.timezone,
      today: dateContext.today,
      partialDay: dateContext.partialDay,
      comparisonDisabledReason,
      warnings,
      coverage: useSummaryMode ? { state: 'unknown', basis: 'period', dateFrom: null, dateTo: null } : coverage,
    },
    summary,
    kpis: buildKpis({
      totals: summary,
      previousTotals,
      currencyCode,
    }),
    series: groupSeries(currentRows, effectiveQuery.groupBy),
    comparison: {
      previousDateFrom: previousRange?.dateFrom ?? null,
      previousDateTo: previousRange?.dateTo ?? null,
      previousTotals,
      previousSeries: previousTotals ? groupSeries(previousRows, effectiveQuery.groupBy) : [],
      disabledReason: comparisonDisabledReason,
      coverage: previousCoverage,
    } satisfies ReportComparisonSummary,
    findings,
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
