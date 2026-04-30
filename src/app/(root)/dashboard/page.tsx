import type { SupabaseClient } from '@supabase/supabase-js';
import DashboardClient from './components/DashboardClient';
import { createAdminClient } from '@/lib/server/supabase/admin';
import { createServerClient } from '@/lib/server/supabase/server';
import { getAdAccountData, getPlatformDetails } from '@/lib/server/data';
import { getAdAccountSyncCoverage } from '@/lib/server/repositories/ad_accounts/syncState';
import {
  buildAudienceBreakdowns,
  buildDashboardLiveWindow,
  buildDashboardPayload,
  buildPlatformBreakdowns,
  type DashboardAdDimension,
  type DashboardAdsetDimension,
  type DashboardFeaturedAdsetHistory,
  type DashboardAudienceMetricRow,
  type DashboardCampaignDimension,
  type DashboardTrendPoint,
} from '@/lib/server/dashboard';
import { buildReportPayload } from '@/lib/server/repositories/reports/buildReportPayload';
import { chunkArray } from '@/lib/server/repositories/utils';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import { resolveCurrentSelection } from '@/lib/server/actions/app/selection';
import type { Database } from '@/lib/shared/types/supabase';
import type { ReportBreakdownRow, ReportPayload } from '@/lib/server/reports/types';
import type { AdAccountData } from '@/lib/server/data/types';

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
    Database['public']['Tables']['meta_hourly_performance']['Row'],
    | 'day'
    | 'hour_of_day'
    | 'spend'
    | 'impressions'
    | 'clicks'
    | 'inline_link_clicks'
    | 'ctr'
    | 'cpc'
    | 'cpm'
  >;

  const fetchRows = async (entityLevel: 'adset' | 'ad'): Promise<HourlySelectRow[]> => {
    const { data, error } = await input.supabase
      .from('meta_hourly_performance')
      .select(
        'day, hour_of_day, spend, impressions, clicks, inline_link_clicks, ctr, cpc, cpm'
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

  const adsetRows = await fetchRows('adset');
  const sourceRows = adsetRows.length > 0 ? adsetRows : await fetchRows('ad');

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
      impressions: number;
      clicks: number;
      inlineLinkClicks: number;
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
      impressions: 0,
      clicks: 0,
      inlineLinkClicks: 0,
    };

    current.spend += row.spend ?? 0;
    current.impressions += row.impressions ?? 0;
    current.clicks += row.clicks ?? 0;
    current.inlineLinkClicks += row.inline_link_clicks ?? 0;
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
      impressions: number;
      clicks: number;
      inlineLinkClicks: number;
    },
    label: string
  ): DashboardHourlyTrendRow => {
    const ctr = row.impressions > 0 ? (row.clicks / row.impressions) * 100 : 0;
    const cpc = row.clicks > 0 ? row.spend / row.clicks : 0;
    const cpm = row.impressions > 0 ? (row.spend / row.impressions) * 1000 : 0;

    return {
      label,
      dayKey: row.day,
      dayOfWeek: new Date(`${row.day}T00:00:00Z`).getUTCDay() === 0
        ? 6
        : new Date(`${row.day}T00:00:00Z`).getUTCDay() - 1,
      hourOfDay: row.hour,
      spend: Number(row.spend.toFixed(2)),
      results: 0,
      clicks: row.clicks,
      inlineLinkClicks: row.inlineLinkClicks,
      impressions: row.impressions,
      reach: 0,
      ctr: Number(ctr.toFixed(2)),
      cpc: Number(cpc.toFixed(2)),
      cpm: Number(cpm.toFixed(2)),
      frequency: 0,
      costPerResult: 0,
    };
  };

  const latestDayRows =
    hourlyHistoryEndDate ? orderedRows.filter((row) => row.day === hourlyHistoryEndDate) : [];
  const expandedRows: Array<{
    day: string;
    hour: number;
    spend: number;
    impressions: number;
    clicks: number;
    inlineLinkClicks: number;
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
            impressions: 0,
            clicks: 0,
            inlineLinkClicks: 0,
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

  const adsetReport = await buildReportPayload({
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
  });

  const adsetIds = uniqueStrings(adsetReport.breakdown.rows.map((row) => row.id));
  const adReport =
    adsetIds.length > 0
      ? await buildReportPayload({
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
        })
      : null;

  return {
    campaigns: input.campaignRows,
    adsets: adsetReport.breakdown.rows,
    ads: adReport?.breakdown.rows ?? [],
  };
}

async function buildDashboardLiveWindowSnapshot(input: {
  businessId: string;
  platformIntegrationId: string;
  adAccountId: string;
  dateFrom: string;
  dateTo: string;
  groupBy: 'day' | 'week';
  supabase: SupabaseClient<Database>;
  isMeta: boolean;
}): Promise<{
  report: ReportPayload;
  liveWindow: ReturnType<typeof buildDashboardLiveWindow>;
}> {
  const report = await buildReportPayload({
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
  });

  const entityRows = await buildDashboardEntityRowsForWindow({
    businessId: input.businessId,
    platformIntegrationId: input.platformIntegrationId,
    adAccountId: input.adAccountId,
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
    groupBy: input.groupBy,
    campaignRows: report.breakdown.rows,
  });

  const campaignExternalIds = uniqueStrings(entityRows.campaigns.map((row) => row.id));
  const adsetExternalIds = uniqueStrings(entityRows.adsets.map((row) => row.id));
  const adExternalIds = uniqueStrings(entityRows.ads.map((row) => row.id));

  const [campaignDimensions, adsetDimensions, adDimensions] = await Promise.all([
    listDashboardCampaignDimensions(input.supabase, input.adAccountId, campaignExternalIds),
    listDashboardAdsetDimensions(input.supabase, input.adAccountId, adsetExternalIds),
    listDashboardAdDimensions(input.supabase, input.adAccountId, adExternalIds),
  ]);

  const baseLiveWindow = buildDashboardLiveWindow({
    isMeta: input.isMeta,
    campaignRows: entityRows.campaigns,
    adsetRows: entityRows.adsets,
    adRows: entityRows.ads,
    campaignDimensions,
    adsetDimensions,
    adDimensions,
  });

  const audienceRows =
    input.isMeta && baseLiveWindow.adsets.length > 0
      ? await listDashboardAudienceRows(input.supabase, {
          adAccountId: input.adAccountId,
          adsetInternalIds: uniqueStrings(
            baseLiveWindow.adsets
              .map((adset) => adset.internalId ?? '')
              .filter(Boolean)
          ),
          dateFrom: input.dateFrom,
          dateTo: input.dateTo,
        })
      : [];

  return {
    report,
    liveWindow: buildDashboardLiveWindow({
      isMeta: input.isMeta,
      campaignRows: entityRows.campaigns,
      adsetRows: entityRows.adsets,
      adRows: entityRows.ads,
      campaignDimensions,
      adsetDimensions,
      adDimensions,
      audienceRows,
    }),
  };
}

async function getFeaturedAdsetHistoryStartDate(
  supabase: SupabaseClient<Database>,
  adsetInternalId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('adsets_performance_daily')
    .select('day')
    .eq('adset_id', adsetInternalId)
    .or('spend.gt.0,impressions.gt.0')
    .order('day', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.day ?? null;
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
  }> = [];

  for (const chunk of chunkArray(externalIds, 200)) {
    const { data, error } = await supabase
      .from('campaign_dims')
      .select('id, external_id, name, objective, status')
      .eq('ad_account_id', adAccountId)
      .in('external_id', chunk);

    if (error) {
      throw error;
    }

    rows.push(...(data ?? []));
  }

  return rows.map((row) => ({
    internalId: row.id,
    externalId: row.external_id,
    name: row.name,
    objective: row.objective,
    status: row.status,
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
  }> = [];

  for (const chunk of chunkArray(externalIds, 200)) {
    const { data, error } = await supabase
      .from('adset_dims')
      .select('id, external_id, campaign_external_id, name, optimization_goal, status')
      .eq('ad_account_id', adAccountId)
      .in('external_id', chunk);

    if (error) {
      throw error;
    }

    rows.push(...(data ?? []));
  }

  return rows.map((row) => ({
    internalId: row.id,
    externalId: row.external_id,
    campaignExternalId: row.campaign_external_id,
    name: row.name,
    optimizationGoal: row.optimization_goal,
    status: row.status,
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
  }> = [];

  for (const chunk of chunkArray(externalIds, 200)) {
    const { data, error } = await supabase
      .from('ad_dims')
      .select('id, external_id, adset_external_id, name, status')
      .eq('ad_account_id', adAccountId)
      .in('external_id', chunk);

    if (error) {
      throw error;
    }

    rows.push(...(data ?? []));
  }

  return rows.map((row) => ({
    internalId: row.id,
    externalId: row.external_id,
    adsetExternalId: row.adset_external_id,
    name: row.name,
    status: row.status,
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

  for (const chunk of chunkArray(input.adsetInternalIds, 200)) {
    const { data, error } = await supabase
      .from('meta_audience_breakdowns_daily')
      .select(
        'entity_level, adset_id, ad_id, breakdown_type, dimension_1_key, dimension_1_value, dimension_2_key, dimension_2_value, publisher_platform, platform_position, impression_device, spend, impressions, clicks, leads, messages, calls'
      )
      .eq('ad_account_id', input.adAccountId)
      .gte('day', input.dateFrom)
      .lte('day', input.dateTo)
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
        (row.spend > 0 || row.impressions > 0 || row.clicks > 0 || row.leads > 0 || row.messages > 0)
    );
}

export default async function MainDashboardPage() {
  const supabase = await createServerClient();
  const adminSupabase = createAdminClient();
  const { user, businessId } = await getRequiredAppContext();
  const { selectedPlatformId, selectedAdAccountId } = await resolveCurrentSelection(businessId);

  const businessProfileResult = await supabase
    .from('business_profiles')
    .select('business_name')
    .eq('id', businessId)
    .maybeSingle();

  const businessName =
    businessProfileResult.data?.business_name ||
    `${user.first_name} ${user.last_name}`.trim() ||
    'My Business';

  const platform = selectedPlatformId
    ? await getPlatformDetails(selectedPlatformId, businessId)
    : null;

  const platformConnected = Boolean(platform && platform.status === 'connected');
  const adAccount =
    selectedPlatformId && selectedAdAccountId && platformConnected
      ? await getAdAccountData(selectedAdAccountId, selectedPlatformId, businessId)
      : null;

  let syncCoverage = null;
  let hasReportMetrics = false;
  const isMeta = platform?.vendor === 'meta';
  let liveToday = buildDashboardLiveWindow({
    isMeta,
    campaignRows: [],
    adsetRows: [],
    adRows: [],
    campaignDimensions: [],
    adsetDimensions: [],
    adDimensions: [],
  });
  let featuredAdsetHistory: DashboardFeaturedAdsetHistory = {
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
  };

  if (adAccount?.id && platformConnected && selectedPlatformId) {
    try {
      const coverage = await getAdAccountSyncCoverage(adminSupabase, adAccount.id);
      syncCoverage = coverage;

      const accountDayRange = getCurrentAdAccountDayDateRange(adAccount.timezone);
      const latestDeliveryDay = getLatestAdAccountDeliveryDay(adAccount, coverage?.coverageEndDate ?? null);

      const todaySnapshot = await buildDashboardLiveWindowSnapshot({
        businessId,
        platformIntegrationId: selectedPlatformId,
        adAccountId: adAccount.id,
        dateFrom: accountDayRange.dateFrom,
        dateTo: accountDayRange.dateTo,
        groupBy: 'day',
        supabase: adminSupabase,
        isMeta,
      });

      hasReportMetrics =
        todaySnapshot.report.summary.spend > 0 ||
        todaySnapshot.report.summary.impressions > 0 ||
        todaySnapshot.report.summary.conversion > 0 ||
        hasMeaningfulReportRows(todaySnapshot.report.breakdown.rows);

      liveToday = todaySnapshot.liveWindow;

      if (
        !liveToday.hasLiveDelivery &&
        latestDeliveryDay &&
        latestDeliveryDay !== accountDayRange.dateFrom
      ) {
        const fallbackSnapshot = await buildDashboardLiveWindowSnapshot({
          businessId,
          platformIntegrationId: selectedPlatformId,
          adAccountId: adAccount.id,
          dateFrom: latestDeliveryDay,
          dateTo: latestDeliveryDay,
          groupBy: 'day',
          supabase: adminSupabase,
          isMeta,
        });

        hasReportMetrics =
          hasReportMetrics ||
          fallbackSnapshot.report.summary.spend > 0 ||
          fallbackSnapshot.report.summary.impressions > 0 ||
          fallbackSnapshot.report.summary.conversion > 0 ||
          hasMeaningfulReportRows(fallbackSnapshot.report.breakdown.rows);

        if (fallbackSnapshot.liveWindow.hasLiveDelivery) {
          liveToday = fallbackSnapshot.liveWindow;
        }
      }

      const featuredAdset = liveToday.comparisons.adsets[0] ?? liveToday.adsets[0] ?? null;

      if (featuredAdset?.internalId) {
        const historyStartDate =
          (await getFeaturedAdsetHistoryStartDate(adminSupabase, featuredAdset.internalId)) ??
          accountDayRange.dateFrom;
        const historyEndDate = accountDayRange.dateTo;

        const historyReport = await buildReportPayload({
          businessId,
          scope: 'adset',
          platformIntegrationId: selectedPlatformId,
          adAccountIds: [adAccount.id],
          campaignIds: [],
          adsetIds: [featuredAdset.id],
          adIds: [],
          dateFrom: historyStartDate,
          dateTo: historyEndDate,
          groupBy: 'day',
          compareMode: 'none',
        });

        const featuredAudienceRows =
          isMeta && featuredAdset.internalId
            ? await listDashboardAudienceRows(adminSupabase, {
                adAccountId: adAccount.id,
                adsetInternalIds: [featuredAdset.internalId],
                dateFrom: historyStartDate,
                dateTo: historyEndDate,
              })
            : [];
        const featuredHourlyHistory =
          featuredAdset.internalId
            ? await getFeaturedAdsetHourlyHistory({
                supabase: adminSupabase,
                adAccountId: adAccount.id,
                adsetInternalId: featuredAdset.internalId,
              })
            : {
                points: [],
                expandedPoints: [],
                hourlyHistoryStartDate: null,
                hourlyHistoryEndDate: null,
              };

        featuredAdsetHistory = {
          adset: featuredAdset,
          dailyTrend: buildTrendPoints(historyReport),
          hourlyTrend: featuredHourlyHistory.points,
          hourlyTrendExpanded: featuredHourlyHistory.expandedPoints,
          platformBreakdowns: buildPlatformBreakdowns({
            isMeta,
            hasLiveDelivery: true,
            audienceRows: featuredAudienceRows,
          }),
          audienceBreakdowns: buildAudienceBreakdowns({
            isMeta,
            hasLiveDelivery: true,
            audienceRows: featuredAudienceRows,
          }),
          dailyHistoryStartDate: historyStartDate,
          dailyHistoryEndDate: historyEndDate,
          hourlyHistoryStartDate: featuredHourlyHistory.hourlyHistoryStartDate,
          hourlyHistoryEndDate: featuredHourlyHistory.hourlyHistoryEndDate,
          hourlyHistoryDate: featuredHourlyHistory.hourlyHistoryEndDate,
        };
      }
    } catch (error) {
      console.error('Failed to fetch live dashboard snapshot:', error);
    }
  }

  const payload = buildDashboardPayload({
    businessName,
    selectedPlatformIntegrationId: selectedPlatformId,
    selectedAdAccountId,
    platform,
    adAccount,
    syncCoverage,
    hasReportMetrics,
    liveToday,
    featuredAdsetHistory,
  });

  return <DashboardClient payload={payload} />;
}
