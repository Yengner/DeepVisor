import { cache, Suspense } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import DashboardClient, {
  DashboardShellClient,
  FeaturedAdsetSkeleton,
  LiveDeliveryTablesSkeleton,
  SummaryCardsSkeleton,
} from './components/DashboardClient';
import { createAdminClient } from '@/lib/server/supabase/admin';
import {
  listActiveTrendFindings,
  toTrendFindingView,
} from '@/lib/server/intelligence/repositories/trendFindings';
import type { TrendFindingView } from '@/lib/server/intelligence/types';
import {
  buildAudienceBreakdowns,
  buildDashboardLiveWindow,
  buildDashboardPayload,
  buildPlatformBreakdowns,
  type DashboardAdDimension,
  type DashboardAdsetDimension,
  type DashboardBasePayload,
  type DashboardContinuationSignal,
  type DashboardEntitySchedule,
  type DashboardFeaturedAdsetHistory,
  type DashboardSurfaceNotification,
  type DashboardAudienceMetricRow,
  type DashboardCampaignDimension,
  type DashboardLiveWindow,
  type DashboardTrendPoint,
} from '@/lib/server/dashboard';
import { buildReportPayload } from '@/lib/server/repositories/reports/buildReportPayload';
import { chunkArray } from '@/lib/server/repositories/utils';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import { resolveCurrentSelection } from '@/lib/server/actions/app/selection';
import type { Database, Json } from '@/lib/shared/types/supabase';
import type { ReportBreakdownRow, ReportPayload } from '@/lib/server/reports/types';
import type { AdAccountData } from '@/lib/server/data/types';
import {
  getCachedAdAccountData,
  getCachedAdAccountSyncCoverage,
  getCachedBusinessName,
  getCachedPlatformDetails,
} from '@/lib/server/dashboard/cache';
import { upsertNotification } from '@/lib/server/intelligence/repositories/notifications';
import { createServerTimer } from '@/lib/server/timing';

type DashboardEntityRows = {
  campaigns: ReportBreakdownRow[];
  adsets: ReportBreakdownRow[];
  ads: ReportBreakdownRow[];
};

type DashboardHourlyTrendRow = {
  label: string;
  dayKey: string;
  dayOfWeek: number;
  hourOfDay: number;
  spend: number;
  results: number;
  clicks: number;
  inlineLinkClicks: number;
  impressions: number;
  reach: number;
  ctr: number;
  cpc: number;
  cpm: number;
  frequency: number;
  costPerResult: number;
};

type HourlyHistoryResult = {
  points: DashboardHourlyTrendRow[];
  expandedPoints: DashboardHourlyTrendRow[];
  hourlyHistoryStartDate: string | null;
  hourlyHistoryEndDate: string | null;
};

type DashboardTimer = ReturnType<typeof createDashboardTimer>;

const AUDIENCE_BREAKDOWN_TYPES = [
  'publisher_platform',
  'platform_position',
  'impression_device',
  'age_gender',
  'country',
  'region',
  'dma',
] as const;

function formatUtcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addUtcDays(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return formatUtcDate(date);
}

function asJsonRecord(value: Json | unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function firstRawString(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

function parseMetaMoney(value: unknown): number | null {
  if (value == null || value === '') {
    return null;
  }

  const numericValue =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value.trim())
        : Number.NaN;

  if (!Number.isFinite(numericValue)) {
    return null;
  }

  return Number((numericValue / 100).toFixed(2));
}

function formatRawEndDate(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return formatUtcDate(date);
}

function buildDashboardEntitySchedule(raw: Json | null | undefined): DashboardEntitySchedule | null {
  const record = asJsonRecord(raw);
  const startsAt = firstRawString(record, ['start_time', 'created_time']);
  const endsAt = firstRawString(record, ['stop_time', 'end_time']);
  const dailyBudget = parseMetaMoney(record.daily_budget);
  const lifetimeBudget = parseMetaMoney(record.lifetime_budget);
  const budgetRemaining = parseMetaMoney(record.budget_remaining);
  const hasScheduleData =
    Boolean(startsAt) ||
    Boolean(endsAt) ||
    dailyBudget !== null ||
    lifetimeBudget !== null ||
    budgetRemaining !== null;

  if (!hasScheduleData) {
    return null;
  }

  return {
    startsAt,
    endsAt,
    endDate: formatRawEndDate(endsAt),
    budgetType: dailyBudget !== null ? 'daily' : lifetimeBudget !== null ? 'lifetime' : 'unknown',
    budgetAmount: dailyBudget ?? lifetimeBudget,
    budgetRemaining,
  };
}

function daysBetweenUtcDates(fromDate: string, toDate: string): number {
  const from = new Date(`${fromDate}T00:00:00Z`);
  const to = new Date(`${toDate}T00:00:00Z`);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return 0;
  }

  return Math.ceil((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}

export function createDashboardTimer() {
  return createServerTimer('dashboard', { enabledEnvVar: 'DASHBOARD_TIMING' });
}

function latestIsoDate(...values: Array<string | null | undefined>): string | null {
  const dates = values.filter((value): value is string => Boolean(value));

  if (dates.length === 0) {
    return null;
  }

  return dates.sort((left, right) => left.localeCompare(right)).at(-1) ?? null;
}

function earliestIsoDate(...values: Array<string | null | undefined>): string | null {
  const dates = values.filter((value): value is string => Boolean(value));

  if (dates.length === 0) {
    return null;
  }

  return dates.sort((left, right) => left.localeCompare(right))[0] ?? null;
}

function getCurrentUtcDayDateRange(): { dateFrom: string; dateTo: string } {
  const now = new Date();
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const iso = formatUtcDate(date);

  return {
    dateFrom: iso,
    dateTo: iso,
  };
}

function formatDateInTimeZone(date: Date, timeZone: string | null): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timeZone || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = formatter.formatToParts(date);
    const year = parts.find((part) => part.type === 'year')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    const day = parts.find((part) => part.type === 'day')?.value;

    if (year && month && day) {
      return `${year}-${month}-${day}`;
    }
  } catch {
    // Fall through to UTC formatting below if the timezone is invalid.
  }

  return formatUtcDate(date);
}

function getCurrentAdAccountDayDateRange(timeZone: string | null): { dateFrom: string; dateTo: string } {
  const iso = formatDateInTimeZone(new Date(), timeZone);

  return {
    dateFrom: iso,
    dateTo: iso,
  };
}

function hasDeliverySignal(metrics: {
  spend: number;
  impressions: number;
  clicks: number;
  inline_link_clicks: number;
  leads: number;
  messages: number;
  calls?: number;
}): boolean {
  return (
    metrics.spend > 0 ||
    metrics.impressions > 0 ||
    metrics.clicks > 0 ||
    metrics.inline_link_clicks > 0 ||
    metrics.leads > 0 ||
    metrics.messages > 0 ||
    (metrics.calls ?? 0) > 0
  );
}

function getLatestAdAccountDeliveryDay(
  adAccount: AdAccountData,
  coverageEndDate: string | null
): string | null {
  const latestFromDailyMetrics =
    adAccount.daily_metrics
      .filter(hasDeliverySignal)
      .sort((left, right) => left.day.localeCompare(right.day))
      .at(-1)?.day ?? null;

  return latestFromDailyMetrics ?? coverageEndDate;
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0)));
}

function hasMeaningfulReportRows(rows: ReportBreakdownRow[]): boolean {
  return rows.some((row) => row.spend > 0 || row.impressions > 0 || row.conversion > 0);
}

function emptyDashboardLiveWindow(isMeta: boolean): DashboardLiveWindow {
  return buildDashboardLiveWindow({
    isMeta,
    campaignRows: [],
    adsetRows: [],
    adRows: [],
    campaignDimensions: [],
    adsetDimensions: [],
    adDimensions: [],
  });
}

function emptyFeaturedAdsetHistory(isMeta: boolean): DashboardFeaturedAdsetHistory {
  return {
    adset: null,
    dailyTrend: [],
    hourlyTrend: [],
    hourlyTrendExpanded: [],
    platformBreakdowns: {
      state: isMeta ? 'syncing' : 'unsupported',
      publisherPlatforms: [],
      placements: [],
      impressionDevices: [],
    },
    audienceBreakdowns: {
      state: isMeta ? 'syncing' : 'unsupported',
      ageGender: [],
      geo: [],
    },
    dailyHistoryStartDate: null,
    dailyHistoryEndDate: null,
    hourlyHistoryStartDate: null,
    hourlyHistoryEndDate: null,
    hourlyHistoryDate: null,
    continuationSignal: null,
  };
}

function buildTrendPoints(report: ReportPayload): DashboardTrendPoint[] {
  return report.series.map((point) => ({
    label: point.label,
    dayKey: null,
    dayOfWeek: null,
    hourOfDay: null,
    spend: point.spend,
    results: point.leads + point.messages + point.calls,
    clicks: point.clicks,
    inlineLinkClicks: point.linkClicks,
    impressions: point.impressions,
    reach: point.reach,
    ctr: point.ctr,
    cpc: point.cpc,
    cpm: point.cpm,
    frequency: point.frequency,
    costPerResult:
      point.leads + point.messages + point.calls > 0
        ? Number((point.spend / (point.leads + point.messages + point.calls)).toFixed(2))
        : 0,
  }));
}

function formatHourLabel(hour: number): string {
  if (!Number.isFinite(hour) || hour < 0 || hour > 23) {
    return 'Unknown';
  }

  const suffix = hour >= 12 ? 'PM' : 'AM';
  const normalizedHour = hour % 12 || 12;
  return `${normalizedHour} ${suffix}`;
}

function formatCompactHourLabel(hour: number): string {
  if (!Number.isFinite(hour) || hour < 0 || hour > 23) {
    return 'Unknown';
  }

  const suffix = hour >= 12 ? 'P' : 'A';
  const normalizedHour = hour % 12 || 12;
  return `${normalizedHour}${suffix}`;
}

function formatReadableDate(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function formatHourlyPointLabel(day: string, hour: number): string {
  const readableDay = formatReadableDate(day) ?? day;
  return `${readableDay} · ${formatCompactHourLabel(hour)}`;
}

async function getFeaturedAdsetHourlyHistory(input: {
  supabase: SupabaseClient<Database>;
  adAccountId: string;
  adsetInternalId: string;
}): Promise<HourlyHistoryResult> {
  type HourlySelectRow = Pick<
    Database['public']['Views']['meta_hourly_performance']['Row'],
    | 'day'
    | 'hour_of_day'
    | 'spend'
    | 'reach'
    | 'impressions'
    | 'clicks'
    | 'inline_link_clicks'
    | 'leads'
    | 'messages'
    | 'calls'
    | 'ctr'
    | 'cpc'
    | 'cpm'
  >;

  const fetchRows = async (entityLevel: 'adset' | 'ad'): Promise<HourlySelectRow[]> => {
    const { data, error } = await input.supabase
      .from('meta_hourly_performance')
      .select(
        'day, hour_of_day, spend, reach, impressions, clicks, inline_link_clicks, leads, messages, calls, ctr, cpc, cpm'
      )
      .eq('ad_account_id', input.adAccountId)
      .eq('adset_id', input.adsetInternalId)
      .eq('entity_level', entityLevel)
      .order('day', { ascending: true })
      .order('hour_of_day', { ascending: true });

    if (error) {
      throw error;
    }

    return data ?? [];
  };

  const [adsetRows, adRows] = await Promise.all([
    fetchRows('adset'),
    fetchRows('ad'),
  ]);
  const sourceRows = adsetRows.length > 0 ? adsetRows : adRows;

  if (sourceRows.length === 0) {
    return {
      points: [],
      expandedPoints: [],
      hourlyHistoryStartDate: null,
      hourlyHistoryEndDate: null,
    };
  }

  const aggregatedRows = new Map<
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

  for (const row of sourceRows) {
    const day = row.day;
    const hour = row.hour_of_day ?? -1;
    if (!day || hour < 0 || hour > 23) {
      continue;
    }

    const key = `${day}:${hour}`;
    const current = aggregatedRows.get(key) ?? {
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
    aggregatedRows.set(key, current);
  }

  const orderedRows = Array.from(aggregatedRows.values()).sort(
    (left, right) => left.day.localeCompare(right.day) || left.hour - right.hour
  );
  const hourlyHistoryStartDate = orderedRows[0]?.day ?? null;
  const hourlyHistoryEndDate = orderedRows.at(-1)?.day ?? null;

  const toTrendPoint = (
    row: {
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
    },
    label: string
  ): DashboardHourlyTrendRow => {
    const ctr = row.impressions > 0 ? (row.clicks / row.impressions) * 100 : 0;
    const cpc = row.clicks > 0 ? row.spend / row.clicks : 0;
    const cpm = row.impressions > 0 ? (row.spend / row.impressions) * 1000 : 0;
    const results = row.leads + row.messages + row.calls;

    return {
      label,
      dayKey: row.day,
      dayOfWeek: new Date(`${row.day}T00:00:00Z`).getUTCDay() === 0
        ? 6
        : new Date(`${row.day}T00:00:00Z`).getUTCDay() - 1,
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
    };
  };

  const latestDayRows =
    hourlyHistoryEndDate ? orderedRows.filter((row) => row.day === hourlyHistoryEndDate) : [];
  const expandedRows: Array<{
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
  }> = [];

  if (hourlyHistoryStartDate && hourlyHistoryEndDate) {
    let cursor = hourlyHistoryStartDate;

    while (cursor <= hourlyHistoryEndDate) {
      for (let hour = 0; hour < 24; hour += 1) {
        const key = `${cursor}:${hour}`;
        const existing = aggregatedRows.get(key);

        expandedRows.push(
          existing ?? {
            day: cursor,
            hour,
            spend: 0,
            reach: 0,
            impressions: 0,
            clicks: 0,
            inlineLinkClicks: 0,
            leads: 0,
            messages: 0,
            calls: 0,
          }
        );
      }

      cursor = addUtcDays(cursor, 1);
    }
  }

  return {
    points: latestDayRows.map((row) => toTrendPoint(row, formatHourLabel(row.hour))),
    expandedPoints: expandedRows.map((row) =>
      toTrendPoint(row, formatHourlyPointLabel(row.day, row.hour))
    ),
    hourlyHistoryStartDate,
    hourlyHistoryEndDate,
  };
}

async function buildDashboardEntityRowsForWindow(input: {
  businessId: string;
  platformIntegrationId: string;
  adAccountId: string;
  dateFrom: string;
  dateTo: string;
  groupBy: 'day' | 'week';
  supabase: SupabaseClient<Database>;
  campaignRows: ReportBreakdownRow[];
}): Promise<DashboardEntityRows> {
  const campaignIds = uniqueStrings(input.campaignRows.map((row) => row.id));

  if (campaignIds.length === 0) {
    return {
      campaigns: [],
      adsets: [],
      ads: [],
    };
  }

  const dashboardBreakdownOptions = {
    includeMetrics: false,
    includeBreakdown: true,
    includeRanking: false,
    includeActiveDates: false,
    includeSurface: false,
  };
  const adsetReport = await buildReportPayload(
    {
      businessId: input.businessId,
      scope: 'campaign',
      platformIntegrationId: input.platformIntegrationId,
      adAccountIds: [input.adAccountId],
      campaignIds,
      adsetIds: [],
      adIds: [],
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      groupBy: input.groupBy,
      compareMode: 'none',
    },
    input.supabase,
    dashboardBreakdownOptions
  );

  const adsetIds = uniqueStrings(adsetReport.breakdown.rows.map((row) => row.id));
  const adReport =
    adsetIds.length > 0
      ? await buildReportPayload(
          {
            businessId: input.businessId,
            scope: 'adset',
            platformIntegrationId: input.platformIntegrationId,
            adAccountIds: [input.adAccountId],
            campaignIds: [],
            adsetIds,
            adIds: [],
            dateFrom: input.dateFrom,
            dateTo: input.dateTo,
            groupBy: input.groupBy,
            compareMode: 'none',
          },
          input.supabase,
          dashboardBreakdownOptions
        )
      : null;

  return {
    campaigns: input.campaignRows,
    adsets: adsetReport.breakdown.rows,
    ads: adReport?.breakdown.rows ?? [],
  };
}

async function buildDashboardAccountSummarySnapshot(input: {
  label: string;
  businessId: string;
  platformIntegrationId: string;
  adAccountId: string;
  dateFrom: string;
  dateTo: string;
  groupBy: 'day' | 'week';
  supabase: SupabaseClient<Database>;
  timer: DashboardTimer;
}): Promise<ReportPayload> {
  return input.timer.measure(
    `${input.label}: account report`,
    () =>
      buildReportPayload(
        {
          businessId: input.businessId,
          scope: 'ad_account',
          platformIntegrationId: input.platformIntegrationId,
          adAccountIds: [input.adAccountId],
          campaignIds: [],
          adsetIds: [],
          adIds: [],
          dateFrom: input.dateFrom,
          dateTo: input.dateTo,
          groupBy: input.groupBy,
          compareMode: 'none',
        },
        input.supabase,
        {
          includeBreakdown: true,
          includeRanking: false,
          includeActiveDates: false,
          includeSurface: false,
        }
      )
  );
}

async function buildDashboardFullLiveWindowSnapshot(input: {
  label: string;
  businessId: string;
  platformIntegrationId: string;
  adAccountId: string;
  dateFrom: string;
  dateTo: string;
  groupBy: 'day' | 'week';
  windowMode?: 'live' | 'historical';
  supabase: SupabaseClient<Database>;
  isMeta: boolean;
  timer: DashboardTimer;
}): Promise<{
  report: ReportPayload;
  liveWindow: ReturnType<typeof buildDashboardLiveWindow>;
}> {
  const report = await buildDashboardAccountSummarySnapshot(input);

  const entityRows = await input.timer.measure(
    `${input.label}: child entity rows`,
    () =>
      buildDashboardEntityRowsForWindow({
        businessId: input.businessId,
        platformIntegrationId: input.platformIntegrationId,
        adAccountId: input.adAccountId,
        dateFrom: input.dateFrom,
        dateTo: input.dateTo,
        groupBy: input.groupBy,
        supabase: input.supabase,
        campaignRows: report.breakdown.rows,
      })
  );

  const campaignExternalIds = uniqueStrings(entityRows.campaigns.map((row) => row.id));
  const adsetExternalIds = uniqueStrings(entityRows.adsets.map((row) => row.id));
  const adExternalIds = uniqueStrings(entityRows.ads.map((row) => row.id));

  const [campaignDimensions, adsetDimensions, adDimensions] = await input.timer.measure(
    `${input.label}: dimensions`,
    () =>
      Promise.all([
        listDashboardCampaignDimensions(input.supabase, input.adAccountId, campaignExternalIds),
        listDashboardAdsetDimensions(input.supabase, input.adAccountId, adsetExternalIds),
        listDashboardAdDimensions(input.supabase, input.adAccountId, adExternalIds),
      ])
  );

  const baseLiveWindow = input.timer.measureSync(`${input.label}: build base live window`, () =>
    buildDashboardLiveWindow({
      isMeta: input.isMeta,
      windowMode: input.windowMode,
      campaignRows: entityRows.campaigns,
      adsetRows: entityRows.adsets,
      adRows: entityRows.ads,
      campaignDimensions,
      adsetDimensions,
      adDimensions,
    })
  );

  const audienceRows =
    input.isMeta && baseLiveWindow.adsets.length > 0
      ? await input.timer.measure(
          `${input.label}: audience rows`,
          () =>
            listDashboardAudienceRows(input.supabase, {
              adAccountId: input.adAccountId,
              adsetInternalIds: uniqueStrings(
                baseLiveWindow.adsets
                  .map((adset) => adset.internalId ?? '')
                  .filter(Boolean)
              ),
              dateFrom: input.dateFrom,
              dateTo: input.dateTo,
            })
        )
      : [];

  return {
    report,
    liveWindow: input.timer.measureSync(`${input.label}: build final live window`, () =>
      buildDashboardLiveWindow({
        isMeta: input.isMeta,
        windowMode: input.windowMode,
        campaignRows: entityRows.campaigns,
        adsetRows: entityRows.adsets,
        adRows: entityRows.ads,
        campaignDimensions,
        adsetDimensions,
        adDimensions,
        audienceRows,
      })
    ),
  };
}

async function getFeaturedAdsetHistoryStartDate(
  supabase: SupabaseClient<Database>,
  adsetInternalId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('report_entity_daily_v')
    .select('day')
    .eq('entity_level', 'adset')
    .eq('entity_id', adsetInternalId)
    .or('spend.gt.0,impressions.gt.0')
    .order('day', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.day ?? null;
}

async function getAdAccountReportEntityDateBounds(
  supabase: SupabaseClient<Database>,
  adAccountId: string
): Promise<{ startDate: string | null; endDate: string | null }> {
  const deliveryFilter =
    'spend.gt.0,impressions.gt.0,clicks.gt.0,inline_link_clicks.gt.0,leads.gt.0,messages.gt.0,calls.gt.0';

  const [startResult, endResult] = await Promise.all([
    supabase
      .from('report_entity_daily_v')
      .select('day')
      .eq('ad_account_id', adAccountId)
      .eq('entity_level', 'campaign')
      .or(deliveryFilter)
      .order('day', { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('report_entity_daily_v')
      .select('day')
      .eq('ad_account_id', adAccountId)
      .eq('entity_level', 'campaign')
      .or(deliveryFilter)
      .order('day', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (startResult.error) {
    throw startResult.error;
  }

  if (endResult.error) {
    throw endResult.error;
  }

  return {
    startDate: startResult.data?.day ?? null,
    endDate: endResult.data?.day ?? null,
  };
}

async function listDashboardCampaignDimensions(
  supabase: SupabaseClient<Database>,
  adAccountId: string,
  externalIds: string[]
): Promise<DashboardCampaignDimension[]> {
  if (externalIds.length === 0) {
    return [];
  }

  const rows: Array<{
    id: string;
    external_id: string;
    name: string | null;
    objective: string | null;
    status: string | null;
    raw: Json | null;
  }> = [];

  for (const chunk of chunkArray(externalIds, 200)) {
    const { data, error } = await supabase
      .from('campaign_dims')
      .select('id, external_id, name, objective, status, raw')
      .eq('ad_account_id', adAccountId)
      .in('external_id', chunk);

    if (error) {
      throw error;
    }

    rows.push(...((data ?? []) as typeof rows));
  }

  return rows.map((row) => ({
    internalId: row.id,
    externalId: row.external_id,
    name: row.name,
    objective: row.objective,
    status: row.status,
    schedule: buildDashboardEntitySchedule(row.raw),
  }));
}

async function listDashboardAdsetDimensions(
  supabase: SupabaseClient<Database>,
  adAccountId: string,
  externalIds: string[]
): Promise<DashboardAdsetDimension[]> {
  if (externalIds.length === 0) {
    return [];
  }

  const rows: Array<{
    id: string;
    external_id: string;
    campaign_external_id: string;
    name: string | null;
    optimization_goal: string | null;
    status: string | null;
    raw: Json | null;
  }> = [];

  for (const chunk of chunkArray(externalIds, 200)) {
    const { data, error } = await supabase
      .from('adset_dims')
      .select('id, external_id, campaign_external_id, name, optimization_goal, status, raw')
      .eq('ad_account_id', adAccountId)
      .in('external_id', chunk);

    if (error) {
      throw error;
    }

    rows.push(...((data ?? []) as typeof rows));
  }

  return rows.map((row) => ({
    internalId: row.id,
    externalId: row.external_id,
    campaignExternalId: row.campaign_external_id,
    name: row.name,
    optimizationGoal: row.optimization_goal,
    status: row.status,
    schedule: buildDashboardEntitySchedule(row.raw),
  }));
}

async function listDashboardAdDimensions(
  supabase: SupabaseClient<Database>,
  adAccountId: string,
  externalIds: string[]
): Promise<DashboardAdDimension[]> {
  if (externalIds.length === 0) {
    return [];
  }

  const rows: Array<{
    id: string;
    external_id: string;
    adset_external_id: string;
    name: string | null;
    status: string | null;
    raw: Json | null;
  }> = [];

  for (const chunk of chunkArray(externalIds, 200)) {
    const { data, error } = await supabase
      .from('ad_dims')
      .select('id, external_id, adset_external_id, name, status, raw')
      .eq('ad_account_id', adAccountId)
      .in('external_id', chunk);

    if (error) {
      throw error;
    }

    rows.push(...((data ?? []) as typeof rows));
  }

  return rows.map((row) => ({
    internalId: row.id,
    externalId: row.external_id,
    adsetExternalId: row.adset_external_id,
    name: row.name,
    status: row.status,
    schedule: buildDashboardEntitySchedule(row.raw),
  }));
}

async function listDashboardAudienceRows(
  supabase: SupabaseClient<Database>,
  input: {
    adAccountId: string;
    adsetInternalIds: string[];
    dateFrom: string;
    dateTo: string;
  }
): Promise<DashboardAudienceMetricRow[]> {
  if (input.adsetInternalIds.length === 0) {
    return [];
  }

  type AudienceBreakdownSelectRow = Pick<
    Database['public']['Views']['meta_audience_breakdowns_daily']['Row'],
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

  for (const chunk of chunkArray(input.adsetInternalIds, 200)) {
    const { data, error } = await supabase
      .from('meta_audience_breakdowns_daily')
      .select(
        'entity_level, adset_id, ad_id, breakdown_type, dimension_1_key, dimension_1_value, dimension_2_key, dimension_2_value, publisher_platform, platform_position, impression_device, spend, impressions, clicks, leads, messages, calls'
      )
      .eq('ad_account_id', input.adAccountId)
      .in('adset_id', chunk)
      .in('breakdown_type', [...AUDIENCE_BREAKDOWN_TYPES]);

    if (error) {
      throw error;
    }

    rows.push(...(data ?? []));
  }

  return rows
    .map((row) => ({
      entityLevel: (row.entity_level === 'ad' ? 'ad' : 'adset') as 'ad' | 'adset',
      adsetInternalId: row.adset_id,
      adInternalId: row.ad_id,
      breakdownType: row.breakdown_type ?? '',
      dimension1Key: row.dimension_1_key ?? '',
      dimension1Value: row.dimension_1_value ?? '',
      dimension2Key: row.dimension_2_key ?? '',
      dimension2Value: row.dimension_2_value ?? '',
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
        (row.spend > 0 || row.impressions > 0 || row.clicks > 0 || row.leads > 0 || row.messages > 0)
    );
}

type DashboardBaseResult = {
  userId: string;
  businessId: string;
  businessName: string;
  selectedPlatformId: string | null;
  selectedAdAccountId: string | null;
  platform: DashboardBasePayload['platform'];
  adAccount: AdAccountData | null;
  syncCoverage: DashboardBasePayload['syncCoverage'];
  isMeta: boolean;
  platformConnected: boolean;
  basePayload: DashboardBasePayload;
};

type DashboardSectionProps = DashboardBaseResult;

function reportHasMetrics(report: ReportPayload): boolean {
  return (
    report.summary.spend > 0 ||
    report.summary.impressions > 0 ||
    report.summary.conversion > 0 ||
    hasMeaningfulReportRows(report.breakdown.rows)
  );
}

function buildSectionPayload(
  base: DashboardSectionProps,
  input: {
    hasReportMetrics?: boolean;
    liveToday?: DashboardLiveWindow | null;
    liveLifetime?: DashboardLiveWindow | null;
    featuredAdsetHistory?: DashboardFeaturedAdsetHistory | null;
    activeFindings?: TrendFindingView[];
    dashboardNotifications?: DashboardSurfaceNotification[];
  } = {}
) {
  return buildDashboardPayload({
    businessName: base.businessName,
    selectedPlatformIntegrationId: base.selectedPlatformId,
    selectedAdAccountId: base.selectedAdAccountId,
    platform: base.platform,
    adAccount: base.adAccount,
    syncCoverage: base.syncCoverage,
    hasReportMetrics: input.hasReportMetrics ?? Boolean(base.adAccount),
    liveToday: input.liveToday,
    liveLifetime: input.liveLifetime,
    featuredAdsetHistory: input.featuredAdsetHistory,
    activeFindings: input.activeFindings,
    dashboardNotifications: input.dashboardNotifications,
  });
}

async function getDashboardBasePayload(input: {
  userId: string;
  businessId: string;
  fallbackBusinessName: string;
}): Promise<DashboardBaseResult> {
  const timer = createDashboardTimer();
  const [selection, cachedBusinessName] = await Promise.all([
    timer.measure('current selection', () => resolveCurrentSelection(input.businessId)),
    timer.measure('cached business name', () =>
      getCachedBusinessName(input.userId, input.businessId)
    ),
  ]);
  const { selectedPlatformId, selectedAdAccountId } = selection;
  const businessName = cachedBusinessName || input.fallbackBusinessName || 'Your business';

  const [platform, selectedAdAccount] = await Promise.all([
    selectedPlatformId
      ? timer.measure('cached platform details', () =>
          getCachedPlatformDetails(input.userId, selectedPlatformId, input.businessId)
        )
      : Promise.resolve(null),
    selectedPlatformId && selectedAdAccountId
      ? timer.measure('cached ad account data', () =>
          getCachedAdAccountData(
            input.userId,
            selectedAdAccountId,
            selectedPlatformId,
            input.businessId
          )
        )
      : Promise.resolve(null),
  ]);
  const platformConnected = Boolean(platform && platform.status === 'connected');
  const adAccount = platformConnected ? selectedAdAccount : null;
  const syncCoverage =
    adAccount?.id
      ? await timer.measure('cached sync coverage', () =>
          getCachedAdAccountSyncCoverage(input.userId, input.businessId, adAccount.id)
        )
      : null;
  const isMeta = platform?.vendor === 'meta';
  const payload = timer.measureSync('build base dashboard payload', () =>
    buildDashboardPayload({
      businessName,
      selectedPlatformIntegrationId: selectedPlatformId,
      selectedAdAccountId,
      platform,
      adAccount,
      syncCoverage,
      hasReportMetrics: Boolean(adAccount),
    })
  );

  timer.finish('dashboard base payload total');

  return {
    userId: input.userId,
    businessId: input.businessId,
    businessName,
    selectedPlatformId,
    selectedAdAccountId,
    platform,
    adAccount,
    syncCoverage,
    isMeta,
    platformConnected,
    basePayload: {
      state: payload.state,
      selection: payload.selection,
      viewContext: payload.viewContext,
      syncCoverage,
      platform,
      adAccount,
      isMeta,
      platformConnected,
      dashboardNotifications: [],
    },
  };
}

const getTodaySnapshot = cache(
  async (
    businessId: string,
    selectedPlatformId: string,
    adAccountId: string,
    dateFrom: string,
    dateTo: string,
    isMeta: boolean
  ) => {
    const timer = createDashboardTimer();
    const snapshot = await buildDashboardFullLiveWindowSnapshot({
      label: 'today snapshot',
      businessId,
      platformIntegrationId: selectedPlatformId,
      adAccountId,
      dateFrom,
      dateTo,
      groupBy: 'day',
      supabase: timer.measureSync('create admin client: today snapshot', createAdminClient),
      isMeta,
      timer,
    });
    timer.finish('today snapshot total');
    return snapshot;
  }
);

const getReportEntityDateBoundsForAccount = cache(async (adAccountId: string) => {
  const timer = createDashboardTimer();
  const bounds = await timer.measure('report entity date bounds', () =>
    getAdAccountReportEntityDateBounds(
      timer.measureSync('create admin client: report bounds', createAdminClient),
      adAccountId
    )
  );
  timer.finish('report entity date bounds total');
  return bounds;
});

const getLifetimeSnapshot = cache(
  async (
    businessId: string,
    selectedPlatformId: string,
    adAccountId: string,
    accountDayTo: string,
    isMeta: boolean,
    coverageStartDate: string | null,
    coverageEndDate: string | null,
    latestDeliveryDay: string | null
  ) => {
    const timer = createDashboardTimer();
    const reportEntityDateBounds = await getReportEntityDateBoundsForAccount(adAccountId);
    const lifetimeStartDate = earliestIsoDate(coverageStartDate, reportEntityDateBounds.startDate);
    const lifetimeEndDate =
      latestIsoDate(
        coverageEndDate,
        latestDeliveryDay,
        reportEntityDateBounds.endDate,
        accountDayTo
      ) ?? accountDayTo;

    if (!lifetimeStartDate || !lifetimeEndDate) {
      timer.finish('lifetime snapshot skipped');
      return null;
    }

    const snapshot = await buildDashboardFullLiveWindowSnapshot({
      label: 'lifetime snapshot',
      businessId,
      platformIntegrationId: selectedPlatformId,
      adAccountId,
      dateFrom: lifetimeStartDate,
      dateTo: lifetimeEndDate,
      groupBy: 'week',
      windowMode: 'historical',
      supabase: timer.measureSync('create admin client: lifetime snapshot', createAdminClient),
      isMeta,
      timer,
    });
    timer.finish('lifetime snapshot total');
    return snapshot;
  }
);

const getFallbackSnapshot = cache(
  async (
    businessId: string,
    selectedPlatformId: string,
    adAccountId: string,
    latestDeliveryDay: string,
    isMeta: boolean
  ) => {
    const timer = createDashboardTimer();
    const snapshot = await buildDashboardFullLiveWindowSnapshot({
      label: 'fallback snapshot',
      businessId,
      platformIntegrationId: selectedPlatformId,
      adAccountId,
      dateFrom: latestDeliveryDay,
      dateTo: latestDeliveryDay,
      groupBy: 'day',
      supabase: timer.measureSync('create admin client: fallback snapshot', createAdminClient),
      isMeta,
      timer,
    });
    timer.finish('fallback snapshot total');
    return snapshot;
  }
);

const getActiveDashboardFindings = cache(async (businessId: string, adAccountId: string) => {
  const timer = createDashboardTimer();
  const findings = await timer.measure('active findings', () =>
    listActiveTrendFindings(createAdminClient() as any, {
      businessId,
      adAccountId,
    })
  );
  timer.finish('active findings total');
  return findings.map(toTrendFindingView);
});

function buildContinuationSignalForFeaturedAdset(input: {
  featuredAdset: DashboardLiveWindow['adsets'][number] | null;
  currentDate: string;
}): DashboardContinuationSignal | null {
  const adset = input.featuredAdset;

  if (!adset) {
    return null;
  }

  const candidates: Array<{
    entityLevel: DashboardContinuationSignal['entityLevel'];
    entityId: string;
    entityName: string;
    parentName: string | null;
    schedule: DashboardEntitySchedule | null;
    priority: number;
  }> = [
    {
      entityLevel: 'campaign' as const,
      entityId: adset.campaignId ?? '',
      entityName: adset.campaignName ?? 'Active campaign',
      parentName: null,
      schedule: adset.campaignSchedule,
      priority: 0,
    },
    {
      entityLevel: 'adset' as const,
      entityId: adset.id,
      entityName: adset.name,
      parentName: adset.campaignName,
      schedule: adset.schedule,
      priority: 1,
    },
  ].filter((candidate) => candidate.entityId.length > 0);

  const endingCandidates = candidates
    .filter(
      (candidate) =>
        Boolean(candidate.schedule?.endsAt) && Boolean(candidate.schedule?.endDate)
    )
    .sort((left, right) => {
      const leftEnd = left.schedule?.endDate ?? '';
      const rightEnd = right.schedule?.endDate ?? '';
      return leftEnd.localeCompare(rightEnd) || left.priority - right.priority;
    });

  const selected = endingCandidates[0];

  if (!selected?.schedule?.endsAt || !selected.schedule.endDate) {
    return null;
  }

  return {
    entityLevel: selected.entityLevel,
    entityId: selected.entityId,
    entityName: selected.entityName,
    parentName: selected.parentName,
    endsAt: selected.schedule.endsAt,
    endDate: selected.schedule.endDate,
    daysUntilEnd: daysBetweenUtcDates(input.currentDate, selected.schedule.endDate),
    budgetType: selected.schedule.budgetType,
    budgetAmount: selected.schedule.budgetAmount,
    budgetRemaining: selected.schedule.budgetRemaining,
  };
}

function formatContinuationNotificationLevel(
  level: DashboardContinuationSignal['entityLevel']
): string {
  if (level === 'adset') {
    return 'Ad set';
  }

  if (level === 'ad') {
    return 'Ad';
  }

  return 'Campaign';
}

function formatContinuationNotificationTiming(daysUntilEnd: number): string {
  if (daysUntilEnd < 0) {
    return 'ended';
  }

  if (daysUntilEnd === 0) {
    return 'ends today';
  }

  if (daysUntilEnd === 1) {
    return 'ends tomorrow';
  }

  return `ends in ${daysUntilEnd} days`;
}

async function upsertDashboardBannerNotification(input: {
  businessId: string;
  userId: string;
  dedupeKey: string;
  type: DashboardSurfaceNotification['type'];
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  payload: Record<string, unknown>;
}): Promise<DashboardSurfaceNotification | null> {
  try {
    const notification = await upsertNotification(createAdminClient() as any, {
      businessId: input.businessId,
      userId: input.userId,
      sourceType: 'dashboard_banner',
      sourceId: null,
      dedupeKey: input.dedupeKey,
      severity: input.severity,
      type: input.type,
      title: input.title,
      message: input.message,
      link: '/dashboard',
      surface: 'dashboard_banner',
      payload: input.payload,
    });

    return {
      id: notification.id,
      type: input.type,
      read: notification.read,
      title: notification.title,
      message: notification.message,
    };
  } catch (error) {
    console.error('Failed to upsert dashboard banner notification:', error);
    return null;
  }
}

async function buildDashboardBannerNotifications(input: {
  businessId: string;
  userId: string;
  adAccountId: string;
  accountDay: string;
  hasLiveDelivery: boolean;
  continuationSignal: DashboardContinuationSignal | null;
}): Promise<DashboardSurfaceNotification[]> {
  const tasks: Array<Promise<DashboardSurfaceNotification | null>> = [];

  if (!input.hasLiveDelivery) {
    tasks.push(
      upsertDashboardBannerNotification({
        businessId: input.businessId,
        userId: input.userId,
        dedupeKey: `dashboard:no-live-delivery:${input.businessId}:${input.adAccountId}:${input.accountDay}`,
        type: 'no_live_delivery',
        severity: 'info',
        title: 'No live delivery today',
        message:
          'No live delivery was found today. This dashboard only shows campaigns, ad sets, and ads that are active and actually serving right now.',
        payload: {
          adAccountId: input.adAccountId,
          accountDay: input.accountDay,
        },
      })
    );
  }

  if (input.continuationSignal) {
    const signal = input.continuationSignal;
    const levelLabel = formatContinuationNotificationLevel(signal.entityLevel);
    const timing = formatContinuationNotificationTiming(signal.daysUntilEnd);
    const readableEndDate = formatReadableDate(signal.endDate) ?? signal.endDate;

    tasks.push(
      upsertDashboardBannerNotification({
        businessId: input.businessId,
        userId: input.userId,
        dedupeKey: `dashboard:campaign-ending:${input.businessId}:${input.adAccountId}:${signal.entityLevel}:${signal.entityId}:${signal.endDate}`,
        type: 'campaign_ending',
        severity: signal.daysUntilEnd <= 1 ? 'warning' : 'info',
        title: `${levelLabel} ${timing} on ${readableEndDate}`,
        message: signal.parentName
          ? `${signal.entityName} | ${signal.parentName}`
          : signal.entityName,
        payload: {
          adAccountId: input.adAccountId,
          entityLevel: signal.entityLevel,
          entityId: signal.entityId,
          entityName: signal.entityName,
          parentName: signal.parentName,
          endDate: signal.endDate,
          daysUntilEnd: signal.daysUntilEnd,
        },
      })
    );
  }

  const notifications = await Promise.all(tasks);
  return notifications.filter(
    (notification): notification is DashboardSurfaceNotification => Boolean(notification)
  );
}

async function buildFeaturedAdsetHistory(input: {
  businessId: string;
  selectedPlatformId: string;
  adAccountId: string;
  accountDateFrom: string;
  accountDateTo: string;
  isMeta: boolean;
  featuredAdset: DashboardLiveWindow['adsets'][number] | null;
}): Promise<DashboardFeaturedAdsetHistory> {
  const timer = createDashboardTimer();
  const empty = emptyFeaturedAdsetHistory(input.isMeta);

  if (!input.featuredAdset?.internalId) {
    timer.finish('featured adset history skipped');
    return empty;
  }

  const supabase = timer.measureSync('create admin client: featured history', createAdminClient);
  const featuredAdsetInternalId = input.featuredAdset.internalId;
  const historyStartDate =
    (await timer.measure('featured history start date', () =>
      getFeaturedAdsetHistoryStartDate(supabase, featuredAdsetInternalId)
    )) ?? input.accountDateFrom;
  const historyEndDate = input.accountDateTo;

  const [historyReport, featuredAudienceRows, featuredHourlyHistory] = await Promise.all([
    timer.measure('featured history report', () =>
      buildReportPayload(
        {
          businessId: input.businessId,
          scope: 'adset',
          platformIntegrationId: input.selectedPlatformId,
          adAccountIds: [input.adAccountId],
          campaignIds: [],
          adsetIds: [input.featuredAdset!.id],
          adIds: [],
          dateFrom: historyStartDate,
          dateTo: historyEndDate,
          groupBy: 'day',
          compareMode: 'none',
        },
        supabase,
        {
          includeBreakdown: false,
          includeRanking: false,
          includeActiveDates: false,
          includeSurface: false,
        }
      )
    ),
    input.isMeta
      ? timer.measure('featured audience rows', () =>
          listDashboardAudienceRows(supabase, {
            adAccountId: input.adAccountId,
            adsetInternalIds: [featuredAdsetInternalId],
            dateFrom: historyStartDate,
            dateTo: historyEndDate,
          })
        )
      : Promise.resolve([]),
    timer.measure('featured hourly history', () =>
      getFeaturedAdsetHourlyHistory({
        supabase,
        adAccountId: input.adAccountId,
        adsetInternalId: featuredAdsetInternalId,
      })
    ),
  ]);

  timer.finish('featured adset history total');
  return {
    adset: input.featuredAdset,
    dailyTrend: buildTrendPoints(historyReport),
    hourlyTrend: featuredHourlyHistory.points,
    hourlyTrendExpanded: featuredHourlyHistory.expandedPoints,
    platformBreakdowns: buildPlatformBreakdowns({
      isMeta: input.isMeta,
      hasLiveDelivery: true,
      audienceRows: featuredAudienceRows,
    }),
    audienceBreakdowns: buildAudienceBreakdowns({
      isMeta: input.isMeta,
      hasLiveDelivery: true,
      audienceRows: featuredAudienceRows,
    }),
    dailyHistoryStartDate: historyStartDate,
    dailyHistoryEndDate: historyEndDate,
    hourlyHistoryStartDate: featuredHourlyHistory.hourlyHistoryStartDate,
    hourlyHistoryEndDate: featuredHourlyHistory.hourlyHistoryEndDate,
    hourlyHistoryDate: featuredHourlyHistory.hourlyHistoryEndDate,
    continuationSignal: buildContinuationSignalForFeaturedAdset({
      featuredAdset: input.featuredAdset,
      currentDate: input.accountDateTo,
    }),
  };
}

async function TodaySnapshotSection(base: DashboardSectionProps) {
  if (!base.adAccount?.id || !base.platformConnected || !base.selectedPlatformId) {
    const payload = buildSectionPayload(base);
    return (
      <DashboardClient
        payload={payload}
        variant="analytics"
        sections={{ featuredHistory: false, summaryCards: true, liveDeliveryTables: false }}
      />
    );
  }

  try {
    const accountDayRange = getCurrentAdAccountDayDateRange(base.adAccount.timezone);
    const todaySnapshot = await getTodaySnapshot(
      base.businessId,
      base.selectedPlatformId,
      base.adAccount.id,
      accountDayRange.dateFrom,
      accountDayRange.dateTo,
      base.isMeta
    );
    const latestDeliveryDay = getLatestAdAccountDeliveryDay(
      base.adAccount,
      base.syncCoverage?.coverageEndDate ?? null
    );
    const lifetimeSnapshot =
      !todaySnapshot.liveWindow.hasLiveDelivery
        ? await getLifetimeSnapshot(
            base.businessId,
            base.selectedPlatformId,
            base.adAccount.id,
            accountDayRange.dateTo,
            base.isMeta,
            base.syncCoverage?.coverageStartDate ?? null,
            base.syncCoverage?.coverageEndDate ?? null,
            latestDeliveryDay
          )
        : null;
    const payload = buildSectionPayload(base, {
      hasReportMetrics:
        reportHasMetrics(todaySnapshot.report) ||
        (lifetimeSnapshot ? reportHasMetrics(lifetimeSnapshot.report) : false),
      liveToday: todaySnapshot.liveWindow,
      liveLifetime: lifetimeSnapshot?.liveWindow ?? null,
    });

    return (
      <DashboardClient
        payload={payload}
        variant="analytics"
        sections={{ featuredHistory: false, summaryCards: true, liveDeliveryTables: false }}
      />
    );
  } catch (error) {
    console.error('Failed to fetch today dashboard snapshot:', error);
    const payload = buildSectionPayload(base);
    return (
      <DashboardClient
        payload={payload}
        variant="analytics"
        sections={{ featuredHistory: false, summaryCards: true, liveDeliveryTables: false }}
      />
    );
  }
}

function selectFeaturedAdsetForDashboard(input: {
  todayLiveWindow: DashboardLiveWindow;
  liveLifetime: DashboardLiveWindow;
  fallbackLiveWindow: DashboardLiveWindow | null;
}): DashboardLiveWindow['adsets'][number] | null {
  return (
    input.todayLiveWindow.comparisons.adsets[0] ??
    input.todayLiveWindow.adsets[0] ??
    input.liveLifetime.comparisons.adsets[0] ??
    input.liveLifetime.adsets[0] ??
    input.fallbackLiveWindow?.comparisons.adsets[0] ??
    input.fallbackLiveWindow?.adsets[0] ??
    null
  );
}

async function DashboardNotificationsSection(base: DashboardSectionProps) {
  if (!base.adAccount?.id || !base.platformConnected || !base.selectedPlatformId) {
    return null;
  }

  try {
    const accountDayRange = getCurrentAdAccountDayDateRange(base.adAccount.timezone);
    const latestDeliveryDay = getLatestAdAccountDeliveryDay(
      base.adAccount,
      base.syncCoverage?.coverageEndDate ?? null
    );
    const [todaySnapshot, lifetimeSnapshot] = await Promise.all([
      getTodaySnapshot(
        base.businessId,
        base.selectedPlatformId,
        base.adAccount.id,
        accountDayRange.dateFrom,
        accountDayRange.dateTo,
        base.isMeta
      ),
      getLifetimeSnapshot(
        base.businessId,
        base.selectedPlatformId,
        base.adAccount.id,
        accountDayRange.dateTo,
        base.isMeta,
        base.syncCoverage?.coverageStartDate ?? null,
        base.syncCoverage?.coverageEndDate ?? null,
        latestDeliveryDay
      ),
    ]);
    const fallbackSnapshot =
      !todaySnapshot.liveWindow.hasLiveDelivery &&
      latestDeliveryDay &&
      latestDeliveryDay !== accountDayRange.dateFrom
        ? await getFallbackSnapshot(
            base.businessId,
            base.selectedPlatformId,
            base.adAccount.id,
            latestDeliveryDay,
            base.isMeta
          )
        : null;
    const liveLifetime = lifetimeSnapshot?.liveWindow ?? emptyDashboardLiveWindow(base.isMeta);
    const fallbackLiveWindow =
      fallbackSnapshot?.liveWindow.hasLiveDelivery ? fallbackSnapshot.liveWindow : null;
    const featuredAdset = selectFeaturedAdsetForDashboard({
      todayLiveWindow: todaySnapshot.liveWindow,
      liveLifetime,
      fallbackLiveWindow,
    });
    const continuationSignal = buildContinuationSignalForFeaturedAdset({
      featuredAdset,
      currentDate: accountDayRange.dateTo,
    });
    const dashboardNotifications = await buildDashboardBannerNotifications({
      businessId: base.businessId,
      userId: base.userId,
      adAccountId: base.adAccount.id,
      accountDay: accountDayRange.dateTo,
      hasLiveDelivery: todaySnapshot.liveWindow.hasLiveDelivery,
      continuationSignal,
    });

    if (dashboardNotifications.length === 0) {
      return null;
    }

    const featuredAdsetHistory = {
      ...emptyFeaturedAdsetHistory(base.isMeta),
      adset: featuredAdset,
      continuationSignal,
    };
    const payload = buildSectionPayload(base, {
      liveToday: todaySnapshot.liveWindow,
      liveLifetime,
      featuredAdsetHistory,
      dashboardNotifications,
    });

    return (
      <DashboardClient
        payload={payload}
        variant="analytics"
        sections={{
          featuredHistory: false,
          summaryCards: false,
          liveDeliveryTables: false,
          noLiveDeliveryAlert: true,
          dashboardNotifications: true,
        }}
      />
    );
  } catch (error) {
    console.error('Failed to fetch dashboard notifications:', error);
    return null;
  }
}

async function FeaturedAdsetHistorySection(base: DashboardSectionProps) {
  if (!base.adAccount?.id || !base.platformConnected || !base.selectedPlatformId) {
    const payload = buildSectionPayload(base, {
      featuredAdsetHistory: emptyFeaturedAdsetHistory(base.isMeta),
    });
    return (
      <DashboardClient
        payload={payload}
        variant="analytics"
        sections={{
          featuredHistory: true,
          summaryCards: false,
          liveDeliveryTables: false,
          noLiveDeliveryAlert: false,
        }}
      />
    );
  }

  try {
    const accountDayRange = getCurrentAdAccountDayDateRange(base.adAccount.timezone);
    const latestDeliveryDay = getLatestAdAccountDeliveryDay(
      base.adAccount,
      base.syncCoverage?.coverageEndDate ?? null
    );
    const [todaySnapshot, lifetimeSnapshot, activeFindings] = await Promise.all([
      getTodaySnapshot(
        base.businessId,
        base.selectedPlatformId,
        base.adAccount.id,
        accountDayRange.dateFrom,
        accountDayRange.dateTo,
        base.isMeta
      ),
      getLifetimeSnapshot(
        base.businessId,
        base.selectedPlatformId,
        base.adAccount.id,
        accountDayRange.dateTo,
        base.isMeta,
        base.syncCoverage?.coverageStartDate ?? null,
        base.syncCoverage?.coverageEndDate ?? null,
        latestDeliveryDay
      ),
      getActiveDashboardFindings(base.businessId, base.adAccount.id),
    ]);
    const fallbackSnapshot =
      !todaySnapshot.liveWindow.hasLiveDelivery &&
      latestDeliveryDay &&
      latestDeliveryDay !== accountDayRange.dateFrom
        ? await getFallbackSnapshot(
            base.businessId,
            base.selectedPlatformId,
            base.adAccount.id,
            latestDeliveryDay,
            base.isMeta
          )
        : null;
    const liveLifetime = lifetimeSnapshot?.liveWindow ?? emptyDashboardLiveWindow(base.isMeta);
    const fallbackLiveWindow =
      fallbackSnapshot?.liveWindow.hasLiveDelivery ? fallbackSnapshot.liveWindow : null;
    const featuredAdset = selectFeaturedAdsetForDashboard({
      todayLiveWindow: todaySnapshot.liveWindow,
      liveLifetime,
      fallbackLiveWindow,
    });
    const featuredAdsetHistory = await buildFeaturedAdsetHistory({
      businessId: base.businessId,
      selectedPlatformId: base.selectedPlatformId,
      adAccountId: base.adAccount.id,
      accountDateFrom: accountDayRange.dateFrom,
      accountDateTo: accountDayRange.dateTo,
      isMeta: base.isMeta,
      featuredAdset,
    });
    const dashboardNotifications = await buildDashboardBannerNotifications({
      businessId: base.businessId,
      userId: base.userId,
      adAccountId: base.adAccount.id,
      accountDay: accountDayRange.dateTo,
      hasLiveDelivery: todaySnapshot.liveWindow.hasLiveDelivery,
      continuationSignal: featuredAdsetHistory.continuationSignal,
    });
    const payload = buildSectionPayload(base, {
      hasReportMetrics:
        reportHasMetrics(todaySnapshot.report) ||
        (lifetimeSnapshot ? reportHasMetrics(lifetimeSnapshot.report) : false) ||
        (fallbackSnapshot ? reportHasMetrics(fallbackSnapshot.report) : false),
      liveToday: todaySnapshot.liveWindow,
      liveLifetime,
      featuredAdsetHistory,
      activeFindings,
      dashboardNotifications,
    });

    return (
      <DashboardClient
        payload={payload}
        variant="analytics"
        sections={{
          featuredHistory: true,
          summaryCards: false,
          liveDeliveryTables: false,
          noLiveDeliveryAlert: false,
          dashboardNotifications: false,
        }}
      />
    );
  } catch (error) {
    console.error('Failed to fetch featured dashboard history:', error);
    const payload = buildSectionPayload(base, {
      featuredAdsetHistory: emptyFeaturedAdsetHistory(base.isMeta),
    });
    return (
      <DashboardClient
        payload={payload}
        variant="analytics"
        sections={{
          featuredHistory: true,
          summaryCards: false,
          liveDeliveryTables: false,
          noLiveDeliveryAlert: false,
        }}
      />
    );
  }
}

async function LiveDeliveryTablesSection(base: DashboardSectionProps) {
  if (!base.adAccount?.id || !base.platformConnected || !base.selectedPlatformId) {
    return null;
  }

  try {
    const accountDayRange = getCurrentAdAccountDayDateRange(base.adAccount.timezone);
    const latestDeliveryDay = getLatestAdAccountDeliveryDay(
      base.adAccount,
      base.syncCoverage?.coverageEndDate ?? null
    );
    const [todaySnapshot, lifetimeSnapshot] = await Promise.all([
      getTodaySnapshot(
        base.businessId,
        base.selectedPlatformId,
        base.adAccount.id,
        accountDayRange.dateFrom,
        accountDayRange.dateTo,
        base.isMeta
      ),
      getLifetimeSnapshot(
        base.businessId,
        base.selectedPlatformId,
        base.adAccount.id,
        accountDayRange.dateTo,
        base.isMeta,
        base.syncCoverage?.coverageStartDate ?? null,
        base.syncCoverage?.coverageEndDate ?? null,
        latestDeliveryDay
      ),
    ]);
    const liveLifetime = lifetimeSnapshot?.liveWindow ?? emptyDashboardLiveWindow(base.isMeta);
    const payload = buildSectionPayload(base, {
      hasReportMetrics:
        reportHasMetrics(todaySnapshot.report) ||
        (lifetimeSnapshot ? reportHasMetrics(lifetimeSnapshot.report) : false),
      liveToday: todaySnapshot.liveWindow,
      liveLifetime,
    });

    return (
      <DashboardClient
        payload={payload}
        variant="analytics"
        sections={{
          featuredHistory: false,
          summaryCards: false,
          liveDeliveryTables: true,
          noLiveDeliveryAlert: false,
        }}
      />
    );
  } catch (error) {
    console.error('Failed to fetch live dashboard tables:', error);
    const payload = buildSectionPayload(base);
    return (
      <DashboardClient
        payload={payload}
        variant="analytics"
        sections={{
          featuredHistory: false,
          summaryCards: false,
          liveDeliveryTables: true,
          noLiveDeliveryAlert: false,
        }}
      />
    );
  }
}

export default async function MainDashboardPage() {
  const timer = createDashboardTimer();
  const { user, businessId } = await timer.measure('required app context', getRequiredAppContext);
  const fallbackBusinessName = `${user.first_name} ${user.last_name}`.trim() || 'Your business';
  const base = await timer.measure('dashboard base payload', () =>
    getDashboardBasePayload({
      userId: user.id,
      businessId,
      fallbackBusinessName,
    })
  );
  timer.finish('dashboard initial shell total');

  return (
    <DashboardShellClient
      basePayload={base.basePayload}
      below={
        <Suspense key="live-delivery-tables" fallback={<LiveDeliveryTablesSkeleton />}>
          <LiveDeliveryTablesSection {...base} />
        </Suspense>
      }
    >
      <Suspense key="dashboard-notifications" fallback={null}>
        <DashboardNotificationsSection {...base} />
      </Suspense>
      <Suspense key="today-summary-cards" fallback={<SummaryCardsSkeleton />}>
        <TodaySnapshotSection {...base} />
      </Suspense>
      <Suspense key="featured-adset-history" fallback={<FeaturedAdsetSkeleton />}>
        <FeaturedAdsetHistorySection {...base} />
      </Suspense>
    </DashboardShellClient>
  );
}
