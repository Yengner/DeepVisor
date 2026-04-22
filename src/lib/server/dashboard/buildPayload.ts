import type {
  AdAccountData,
  AdAccountTimeIncrementPoint,
  PlatformDetails,
} from '@/lib/server/data/types';
import { hasMeaningfulMetrics } from '@/lib/server/data';
import type {
  ReportBreakdownRow,
  ReportMetricTotals,
  ReportPayload,
} from '@/lib/server/reports/types';
import {
  getCurrentUtcMonthDateRange,
  getCurrentUtcWeekDateRange,
  getPreviousUtcWeekDateRange,
  getTrailingUtcDateRange,
} from '@/lib/shared';
import { resolveDashboardState } from './state';
import type {
  DashboardActivityEntityItem,
  DashboardActivityRail,
  DashboardAlert,
  DashboardCampaignPreviewItem,
  DashboardCampaignSnapshotItem,
  DashboardOutcomeMetric,
  DashboardPayload,
  DashboardSummaryCard,
  DashboardTrendPoint,
  DashboardTrendSeries,
  DashboardWindow,
} from './types';

type DailyAccountPoint = {
  date: string;
  spend: number;
  results: number;
  leads: number;
  messages: number;
  clicks: number;
  linkClicks: number;
};

type WindowTotals = {
  spend: number;
  results: number;
  leads: number;
  messages: number;
  clicks: number;
  linkClicks: number;
};

function toDailyPoint(point: AdAccountTimeIncrementPoint): DailyAccountPoint | null {
  const date = point.date_stop ?? point.date_start;
  if (!date) {
    return null;
  }

  return {
    date,
    spend: point.spend,
    results: point.leads + point.messages,
    leads: point.leads,
    messages: point.messages,
    clicks: point.clicks,
    linkClicks: point.link_clicks,
  };
}

function sortDailyPoints(points: AdAccountTimeIncrementPoint[] | undefined): DailyAccountPoint[] {
  return (points ?? [])
    .map(toDailyPoint)
    .filter((point): point is DailyAccountPoint => point !== null)
    .sort((left, right) => left.date.localeCompare(right.date));
}

function sliceTrailing(points: DailyAccountPoint[], size: number): DailyAccountPoint[] {
  if (size <= 0) {
    return [];
  }

  return points.slice(Math.max(0, points.length - size));
}

function slicePrevious(points: DailyAccountPoint[], size: number): DailyAccountPoint[] {
  if (size <= 0) {
    return [];
  }

  return points.slice(Math.max(0, points.length - size * 2), Math.max(0, points.length - size));
}

function sumWindow(points: DailyAccountPoint[]): WindowTotals {
  return points.reduce<WindowTotals>(
    (totals, point) => ({
      spend: totals.spend + point.spend,
      results: totals.results + point.results,
      leads: totals.leads + point.leads,
      messages: totals.messages + point.messages,
      clicks: totals.clicks + point.clicks,
      linkClicks: totals.linkClicks + point.linkClicks,
    }),
    {
      spend: 0,
      results: 0,
      leads: 0,
      messages: 0,
      clicks: 0,
      linkClicks: 0,
    }
  );
}

function totalsFromReportSummary(summary: ReportMetricTotals): WindowTotals {
  return {
    spend: summary.spend,
    results: summary.conversion,
    leads: summary.leads,
    messages: summary.messages,
    clicks: summary.clicks,
    linkClicks: summary.linkClicks,
  };
}

function hasReportMetrics(report: ReportPayload | null | undefined): boolean {
  if (!report) {
    return false;
  }

  return (
    report.summary.spend > 0 ||
    report.summary.impressions > 0 ||
    report.summary.conversion > 0 ||
    report.series.length > 0 ||
    report.breakdown.rows.length > 0
  );
}

function outcomeLabel(metric: DashboardOutcomeMetric): string {
  switch (metric) {
    case 'results':
      return 'Results';
    case 'messages':
      return 'Messages';
    case 'clicks':
      return 'Clicks';
    default:
      return 'Leads';
  }
}

function resolvePrimaryOutcomeMetric(points: DailyAccountPoint[]): DashboardOutcomeMetric {
  const lastThirtyDays = sumWindow(sliceTrailing(points, 30));

  if (lastThirtyDays.results > 0) {
    return 'results';
  }

  return 'clicks';
}

function resolvePrimaryOutcomeMetricFromReport(
  report: ReportPayload | null | undefined
): DashboardOutcomeMetric | null {
  if (!report) {
    return null;
  }

  if (report.summary.conversion > 0) {
    return 'results';
  }

  if (report.summary.clicks > 0) {
    return 'clicks';
  }

  return null;
}

function valueForMetric(
  totals: WindowTotals,
  key: DashboardSummaryCard['key'] | DashboardOutcomeMetric
): number {
  switch (key) {
    case 'spend':
      return totals.spend;
    case 'results':
      return totals.results;
    case 'messages':
      return totals.messages;
    case 'clicks':
      return totals.clicks;
    case 'link_clicks':
      return totals.linkClicks;
    default:
      return totals.leads;
  }
}

function calculateChangePercent(current: number, previous: number): number | null {
  if (previous <= 0) {
    return null;
  }

  return ((current - previous) / previous) * 100;
}

function getPreviousRange(dateFrom: string, dateTo: string): {
  dateFrom: string;
  dateTo: string;
} {
  const start = new Date(`${dateFrom}T00:00:00.000Z`);
  const end = new Date(`${dateTo}T00:00:00.000Z`);
  const days = Math.max(
    1,
    Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1
  );
  const previousEnd = new Date(start);
  previousEnd.setUTCDate(previousEnd.getUTCDate() - 1);
  const previousStart = new Date(previousEnd);
  previousStart.setUTCDate(previousStart.getUTCDate() - (days - 1));

  return {
    dateFrom: previousStart.toISOString().slice(0, 10),
    dateTo: previousEnd.toISOString().slice(0, 10),
  };
}

function resolveDashboardWindowRange(window: DashboardWindow): {
  dateFrom: string;
  dateTo: string;
} {
  switch (window) {
    case 'this_week':
      return getCurrentUtcWeekDateRange();
    case 'last_week':
      return getPreviousUtcWeekDateRange();
    case 'last_30d':
      return getTrailingUtcDateRange(30);
    case 'this_month':
      return getCurrentUtcMonthDateRange();
    default:
      return getTrailingUtcDateRange(7);
  }
}

function filterPointsByRange(
  points: DailyAccountPoint[],
  range: { dateFrom: string; dateTo: string }
): DailyAccountPoint[] {
  return points.filter((point) => point.date >= range.dateFrom && point.date <= range.dateTo);
}

function buildSummaryCards(points: DailyAccountPoint[], window: DashboardWindow): DashboardSummaryCard[] {
  const currentRange = resolveDashboardWindowRange(window);
  const currentPoints = filterPointsByRange(points, currentRange);
  const previousPoints = filterPointsByRange(points, getPreviousRange(currentRange.dateFrom, currentRange.dateTo));
  const current = sumWindow(currentPoints);
  const previous = previousPoints.length > 0 ? sumWindow(previousPoints) : null;

  const cards: Array<{ key: DashboardSummaryCard['key']; label: string }> = [
    { key: 'spend', label: 'Spend' },
    { key: 'results', label: 'Results' },
    { key: 'leads', label: 'Leads' },
    { key: 'link_clicks', label: 'Link Clicks' },
  ];

  return cards.map((card) => {
    const currentValue = valueForMetric(current, card.key);
    const previousValue = previous ? valueForMetric(previous, card.key) : null;

    return {
      key: card.key,
      label: card.label,
      value: currentValue,
      previousValue,
      changePercent:
        previousValue === null ? null : calculateChangePercent(currentValue, previousValue),
    };
  });
}

function buildSummaryCardsFromTotals(input: {
  current: WindowTotals;
  previous: WindowTotals | null;
}): DashboardSummaryCard[] {
  const cards: Array<{ key: DashboardSummaryCard['key']; label: string }> = [
    { key: 'spend', label: 'Spend' },
    { key: 'results', label: 'Results' },
    { key: 'leads', label: 'Leads' },
    { key: 'link_clicks', label: 'Link Clicks' },
  ];

  return cards.map((card) => {
    const currentValue = valueForMetric(input.current, card.key);
    const previousValue = input.previous ? valueForMetric(input.previous, card.key) : null;

    return {
      key: card.key,
      label: card.label,
      value: currentValue,
      previousValue,
      changePercent:
        previousValue === null ? null : calculateChangePercent(currentValue, previousValue),
    };
  });
}

function buildSummaryCardsFromReport(report: ReportPayload): DashboardSummaryCard[] {
  return buildSummaryCardsFromTotals({
    current: totalsFromReportSummary(report.summary),
    previous: report.comparison.previousTotals
      ? totalsFromReportSummary(report.comparison.previousTotals)
      : null,
  });
}

function formatShortDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function groupWeekly(points: DailyAccountPoint[]): DailyAccountPoint[][] {
  const groups: DailyAccountPoint[][] = [];

  for (let index = 0; index < points.length; index += 7) {
    groups.push(points.slice(index, index + 7));
  }

  return groups;
}

function buildTrendSeries(
  points: DailyAccountPoint[],
  window: DashboardWindow,
  primaryOutcomeMetric: DashboardOutcomeMetric
): DashboardTrendSeries {
  const currentRange = resolveDashboardWindowRange(window);
  const currentPoints = filterPointsByRange(points, currentRange);

  if (window !== 'last_30d') {
    const recentPoints = currentPoints;

    return {
      outcomeMetric: primaryOutcomeMetric,
      outcomeLabel: outcomeLabel(primaryOutcomeMetric),
      points: recentPoints.map(
        (point) =>
          ({
            label: formatShortDate(point.date),
            spend: point.spend,
            outcome:
              primaryOutcomeMetric === 'results'
                ? point.results
                : primaryOutcomeMetric === 'messages'
                ? point.messages
                : primaryOutcomeMetric === 'clicks'
                  ? point.clicks
                  : point.leads,
          }) satisfies DashboardTrendPoint
      ),
    };
  }

  const weeklyPoints = groupWeekly(currentPoints);

  return {
    outcomeMetric: primaryOutcomeMetric,
    outcomeLabel: outcomeLabel(primaryOutcomeMetric),
    points: weeklyPoints.map((group) => {
      const totals = sumWindow(group);
      const startDate = group[0]?.date;
      const endDate = group[group.length - 1]?.date;

      return {
        label:
          startDate && endDate
            ? `${formatShortDate(startDate)}-${formatShortDate(endDate)}`
            : startDate
              ? formatShortDate(startDate)
              : 'Recent',
        spend: totals.spend,
        outcome:
          primaryOutcomeMetric === 'results'
            ? totals.results
            : primaryOutcomeMetric === 'messages'
            ? totals.messages
            : primaryOutcomeMetric === 'clicks'
              ? totals.clicks
              : totals.leads,
      } satisfies DashboardTrendPoint;
    }),
  };
}

function buildTrendSeriesFromReport(
  report: ReportPayload,
  primaryOutcomeMetric: DashboardOutcomeMetric
): DashboardTrendSeries {
  return {
    outcomeMetric: primaryOutcomeMetric,
    outcomeLabel: outcomeLabel(primaryOutcomeMetric),
    points: report.series.map((point) => ({
      label: point.label,
      spend: point.spend,
      outcome:
        primaryOutcomeMetric === 'results'
          ? point.conversion
          : primaryOutcomeMetric === 'messages'
            ? point.messages
            : primaryOutcomeMetric === 'clicks'
              ? point.clicks
              : point.leads,
    })),
  };
}

function buildAlertsFromWindowTotals(input: {
  state: DashboardPayload['state'];
  current: WindowTotals;
  previous: WindowTotals | null;
  lastSyncedAt: string | null;
  primaryOutcomeMetric: DashboardOutcomeMetric;
}): DashboardAlert[] {
  if (input.state !== 'ready') {
    return [];
  }

  const alerts: DashboardAlert[] = [];

  if (input.lastSyncedAt) {
    const ageMs = Date.now() - new Date(input.lastSyncedAt).getTime();
    if (Number.isFinite(ageMs) && ageMs > 24 * 60 * 60 * 1000) {
      alerts.push({
        id: 'sync-stale',
        tone: 'yellow',
        title: 'Data is more than a day old',
        description: 'Refresh this account to make sure you are looking at current performance.',
      });
    }
  }

  if (input.current.spend === 0) {
    alerts.push({
      id: 'no-activity',
      tone: 'blue',
      title: 'No spend in the last 7 days',
      description: 'This account has no recent delivery. Check if campaigns are paused or budgets stopped.',
    });
  }

  if (input.previous) {
    const outcomeKey =
      input.primaryOutcomeMetric === 'results'
        ? 'results'
        : input.primaryOutcomeMetric === 'messages'
          ? 'messages'
          : input.primaryOutcomeMetric === 'clicks'
            ? 'clicks'
            : 'leads';
    const currentOutcome = valueForMetric(input.current, outcomeKey);
    const previousOutcome = valueForMetric(input.previous, outcomeKey);

    if (previousOutcome >= 5 && currentOutcome <= previousOutcome * 0.7) {
      alerts.push({
        id: 'outcome-drop',
        tone: 'red',
        title: `${outcomeLabel(input.primaryOutcomeMetric)} are down this week`,
        description: `Your selected account is producing fewer ${outcomeLabel(
          input.primaryOutcomeMetric
        ).toLowerCase()} than the previous 7-day period.`,
      });
    }

    if (input.previous.spend >= 100) {
      const spendChange = calculateChangePercent(input.current.spend, input.previous.spend);

      if (spendChange !== null && Math.abs(spendChange) >= 30) {
        alerts.push({
          id: 'spend-change',
          tone: spendChange > 0 ? 'yellow' : 'teal',
          title:
            spendChange > 0
              ? 'Spend jumped this week'
              : 'Spend fell sharply this week',
          description: `Spend changed ${Math.abs(Math.round(spendChange))}% compared with the previous 7 days.`,
        });
      }
    }
  }

  return alerts.slice(0, 3);
}

function buildAlerts(
  state: DashboardPayload['state'],
  points: DailyAccountPoint[],
  lastSyncedAt: string | null,
  primaryOutcomeMetric: DashboardOutcomeMetric
): DashboardAlert[] {
  const currentSevenDays = sumWindow(sliceTrailing(points, 7));
  const previousSevenDaysPoints = slicePrevious(points, 7);
  const previousSevenDays =
    previousSevenDaysPoints.length > 0 ? sumWindow(previousSevenDaysPoints) : null;

  return buildAlertsFromWindowTotals({
    state,
    current: currentSevenDays,
    previous: previousSevenDays,
    lastSyncedAt,
    primaryOutcomeMetric,
  });
}

function buildCampaignPreview(
  campaigns: DashboardCampaignSnapshotItem[],
  primaryOutcomeMetric: DashboardOutcomeMetric
): DashboardCampaignPreviewItem[] {
  return campaigns.slice(0, 3).map((campaign) => ({
    campaignId: campaign.campaignId,
    campaignName: campaign.campaignName,
    objective: campaign.objective,
    status: campaign.status,
    spend: campaign.spend,
    primaryOutcomeMetric,
    primaryOutcomeLabel: outcomeLabel(primaryOutcomeMetric),
    primaryOutcomeValue:
      primaryOutcomeMetric === 'results'
        ? campaign.conversion
        : primaryOutcomeMetric === 'messages'
        ? campaign.messages
        : primaryOutcomeMetric === 'clicks'
          ? campaign.clicks
          : campaign.leads,
    conversionRate: campaign.conversionRate,
    costPerResult: campaign.costPerResult,
    ctr: campaign.ctr,
  }));
}

function buildCampaignPreviewFromReportRows(
  rows: ReportBreakdownRow[],
  primaryOutcomeMetric: DashboardOutcomeMetric
): DashboardCampaignPreviewItem[] {
  return rows.slice(0, 3).map((campaign) => ({
    campaignId: campaign.id,
    campaignName: campaign.name,
    objective: campaign.secondaryContext,
    status: campaign.status ?? 'unknown',
    spend: campaign.spend,
    primaryOutcomeMetric,
    primaryOutcomeLabel: outcomeLabel(primaryOutcomeMetric),
    primaryOutcomeValue:
      primaryOutcomeMetric === 'results'
        ? campaign.conversion
        : primaryOutcomeMetric === 'messages'
          ? campaign.messages
          : primaryOutcomeMetric === 'clicks'
            ? campaign.clicks
            : campaign.leads,
    conversionRate: campaign.conversionRate,
    costPerResult: campaign.costPerResult,
    ctr: campaign.ctr,
  }));
}

function isLikelyActiveStatus(status: string | null | undefined): boolean {
  const normalized = (status ?? '').trim().toLowerCase();

  if (!normalized) {
    return false;
  }

  const inactiveTokens = [
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
  ];

  if (inactiveTokens.some((token) => normalized.includes(token))) {
    return false;
  }

  const activeTokens = [
    'active',
    'enabled',
    'learning',
    'limited',
    'pending',
    'review',
    'running',
    'serving',
  ];

  return activeTokens.some((token) => normalized.includes(token));
}

function activityEntityScore(row: ReportBreakdownRow): number {
  return row.spend * 100 + row.conversion * 80 + row.clicks * 2 - row.costPerResult * 10;
}

function sortActivityRows(rows: ReportBreakdownRow[]): ReportBreakdownRow[] {
  return [...rows].sort((left, right) => {
    const scoreDifference = activityEntityScore(right) - activityEntityScore(left);
    if (scoreDifference !== 0) {
      return scoreDifference;
    }

    return left.name.localeCompare(right.name);
  });
}

function limitActivityRows(rows: ReportBreakdownRow[], limit: number): ReportBreakdownRow[] {
  const activeRows = rows.filter((row) => isLikelyActiveStatus(row.status));
  const source = activeRows.length > 0 ? activeRows : rows;
  return sortActivityRows(source).slice(0, limit);
}

function isLikelyTestEntity(name: string): boolean {
  return /\b(test|testing|experiment|split|trial)\b/i.test(name);
}

function toActivityEntity(row: ReportBreakdownRow): DashboardActivityEntityItem {
  return {
    id: row.id,
    name: row.name,
    level: row.level,
    status: row.status ?? 'unknown',
    primaryContext: row.primaryContext,
    secondaryContext: row.secondaryContext,
    spend: row.spend,
    results: row.conversion,
    clicks: row.clicks,
    ctr: row.ctr,
    costPerResult: row.costPerResult,
  };
}

function emptyActivityRail(): DashboardActivityRail {
  return {
    tests: [],
    campaigns: [],
    adsets: [],
    ads: [],
  };
}

function buildActivityRail(input?: {
  campaigns?: ReportBreakdownRow[];
  adsets?: ReportBreakdownRow[];
  ads?: ReportBreakdownRow[];
}): DashboardActivityRail {
  if (!input) {
    return emptyActivityRail();
  }

  const tests = sortActivityRows(
    [
      ...(input.campaigns ?? []),
      ...(input.adsets ?? []),
      ...(input.ads ?? []),
    ].filter((row) => isLikelyActiveStatus(row.status) && isLikelyTestEntity(row.name))
  )
    .slice(0, 4)
    .map(toActivityEntity);

  return {
    tests,
    campaigns: limitActivityRows(input.campaigns ?? [], 4).map(toActivityEntity),
    adsets: limitActivityRows(input.adsets ?? [], 4).map(toActivityEntity),
    ads: limitActivityRows(input.ads ?? [], 4).map(toActivityEntity),
  };
}

export function buildDashboardPayload(input: {
  businessName: string;
  selectedPlatformIntegrationId: string | null;
  selectedAdAccountId: string | null;
  platform: PlatformDetails | null;
  adAccount: AdAccountData | null;
  campaignSnapshot: DashboardCampaignSnapshotItem[];
  intelligenceSignals: DashboardPayload['intelligenceSignals'];
  calendarQueuePreview: DashboardPayload['calendarQueuePreview'];
  syncCoverage: DashboardPayload['syncCoverage'];
  activityRowsByWindow?: Partial<
    Record<
      DashboardWindow,
      {
        campaigns: ReportBreakdownRow[];
        adsets: ReportBreakdownRow[];
        ads: ReportBreakdownRow[];
      }
    >
  >;
  reportByWindow?: Partial<Record<DashboardWindow, ReportPayload | null>>;
}): DashboardPayload {
  const platformConnected = Boolean(input.platform && input.platform.status === 'connected');
  const windowOptions: DashboardWindow[] = [
    'this_week',
    'last_week',
    'last_7d',
    'last_30d',
    'this_month',
  ];
  const reportThisWeek = input.reportByWindow?.['this_week'] ?? null;
  const reportLastWeek = input.reportByWindow?.['last_week'] ?? null;
  const reportLastSeven = input.reportByWindow?.['last_7d'] ?? null;
  const reportLastThirty = input.reportByWindow?.['last_30d'] ?? null;
  const reportThisMonth = input.reportByWindow?.['this_month'] ?? null;
  const reportHasMetrics = windowOptions.some((window) =>
    hasReportMetrics(input.reportByWindow?.[window] ?? null)
  );
  const adAccountHasMetrics = input.adAccount
    ? hasMeaningfulMetrics(input.adAccount.aggregated_metrics)
    : false;

  const state = resolveDashboardState({
    selectedPlatformId: input.selectedPlatformIntegrationId,
    platformConnected,
    selectedAdAccountId: input.selectedAdAccountId,
    adAccountPresent: Boolean(input.adAccount),
    adAccountHasMetrics: reportHasMetrics || adAccountHasMetrics,
  });

  const dailyPoints = sortDailyPoints(input.adAccount?.time_increment_metrics['1']);
  const primaryOutcomeMetric =
    resolvePrimaryOutcomeMetricFromReport(reportLastThirty ?? reportLastSeven ?? reportThisMonth) ??
    resolvePrimaryOutcomeMetric(dailyPoints);
  const lastSyncedAt = input.adAccount?.last_synced ?? input.platform?.lastSyncedAt ?? null;

  return {
    state,
    selection: {
      selectedPlatformIntegrationId: input.selectedPlatformIntegrationId,
      selectedAdAccountId: input.selectedAdAccountId,
    },
    viewContext: {
      businessName: input.businessName,
      platformName: input.platform?.displayName ?? null,
      platformStatus: input.platform?.status ?? null,
      adAccountName: input.adAccount?.name ?? null,
      adAccountStatus: input.adAccount?.account_status ?? null,
      lastSyncedAt,
      currencyCode: input.adAccount?.currency_code ?? null,
      platformError: input.platform?.lastError ?? null,
      canRefresh: platformConnected,
    },
    activeWindow: 'last_7d',
    windowOptions,
    alerts:
      reportLastSeven && hasReportMetrics(reportLastSeven)
        ? buildAlertsFromWindowTotals({
            state,
            current: totalsFromReportSummary(reportLastSeven.summary),
            previous: reportLastSeven.comparison.previousTotals
              ? totalsFromReportSummary(reportLastSeven.comparison.previousTotals)
              : null,
            lastSyncedAt,
            primaryOutcomeMetric,
          })
        : buildAlerts(state, dailyPoints, lastSyncedAt, primaryOutcomeMetric),
    summaryByWindow: {
      this_week:
        reportThisWeek && hasReportMetrics(reportThisWeek)
          ? buildSummaryCardsFromReport(reportThisWeek)
          : buildSummaryCards(dailyPoints, 'this_week'),
      last_week:
        reportLastWeek && hasReportMetrics(reportLastWeek)
          ? buildSummaryCardsFromReport(reportLastWeek)
          : buildSummaryCards(dailyPoints, 'last_week'),
      last_7d:
        reportLastSeven && hasReportMetrics(reportLastSeven)
          ? buildSummaryCardsFromReport(reportLastSeven)
          : buildSummaryCards(dailyPoints, 'last_7d'),
      last_30d:
        reportLastThirty && hasReportMetrics(reportLastThirty)
          ? buildSummaryCardsFromReport(reportLastThirty)
          : buildSummaryCards(dailyPoints, 'last_30d'),
      this_month:
        reportThisMonth && hasReportMetrics(reportThisMonth)
          ? buildSummaryCardsFromReport(reportThisMonth)
          : buildSummaryCards(dailyPoints, 'this_month'),
    },
    trendByWindow: {
      this_week:
        reportThisWeek && reportThisWeek.series.length > 0
          ? buildTrendSeriesFromReport(reportThisWeek, primaryOutcomeMetric)
          : buildTrendSeries(dailyPoints, 'this_week', primaryOutcomeMetric),
      last_week:
        reportLastWeek && reportLastWeek.series.length > 0
          ? buildTrendSeriesFromReport(reportLastWeek, primaryOutcomeMetric)
          : buildTrendSeries(dailyPoints, 'last_week', primaryOutcomeMetric),
      last_7d:
        reportLastSeven && reportLastSeven.series.length > 0
          ? buildTrendSeriesFromReport(reportLastSeven, primaryOutcomeMetric)
          : buildTrendSeries(dailyPoints, 'last_7d', primaryOutcomeMetric),
      last_30d:
        reportLastThirty && reportLastThirty.series.length > 0
          ? buildTrendSeriesFromReport(reportLastThirty, primaryOutcomeMetric)
          : buildTrendSeries(dailyPoints, 'last_30d', primaryOutcomeMetric),
      this_month:
        reportThisMonth && reportThisMonth.series.length > 0
          ? buildTrendSeriesFromReport(reportThisMonth, primaryOutcomeMetric)
          : buildTrendSeries(dailyPoints, 'this_month', primaryOutcomeMetric),
    },
    campaignPreview:
      reportLastThirty && reportLastThirty.breakdown.rows.length > 0
        ? buildCampaignPreviewFromReportRows(
            reportLastThirty.breakdown.rows,
            primaryOutcomeMetric
          )
        : buildCampaignPreview(input.campaignSnapshot, primaryOutcomeMetric),
    activityByWindow: {
      this_week: buildActivityRail(input.activityRowsByWindow?.['this_week']),
      last_week: buildActivityRail(input.activityRowsByWindow?.['last_week']),
      last_7d: buildActivityRail(input.activityRowsByWindow?.['last_7d']),
      last_30d: buildActivityRail(input.activityRowsByWindow?.['last_30d']),
      this_month: buildActivityRail(input.activityRowsByWindow?.['this_month']),
    },
    intelligenceSignals: input.intelligenceSignals,
    calendarQueuePreview: input.calendarQueuePreview,
    syncCoverage: input.syncCoverage,
    platform: input.platform,
    adAccount: input.adAccount,
  };
}
