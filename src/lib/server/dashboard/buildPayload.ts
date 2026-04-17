import type {
  AdAccountData,
  AdAccountTimeIncrementPoint,
  PlatformDetails,
} from '@/lib/server/data/types';
import { hasMeaningfulMetrics } from '@/lib/server/data';
import { resolveDashboardState } from './state';
import type {
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
  leads: number;
  messages: number;
  clicks: number;
  linkClicks: number;
};

type WindowTotals = {
  spend: number;
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
      leads: totals.leads + point.leads,
      messages: totals.messages + point.messages,
      clicks: totals.clicks + point.clicks,
      linkClicks: totals.linkClicks + point.linkClicks,
    }),
    {
      spend: 0,
      leads: 0,
      messages: 0,
      clicks: 0,
      linkClicks: 0,
    }
  );
}

function outcomeLabel(metric: DashboardOutcomeMetric): string {
  switch (metric) {
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

  if (lastThirtyDays.leads > 0) {
    return 'leads';
  }

  if (lastThirtyDays.messages > 0) {
    return 'messages';
  }

  return 'clicks';
}

function valueForMetric(
  totals: WindowTotals,
  key: DashboardSummaryCard['key'] | DashboardOutcomeMetric
): number {
  switch (key) {
    case 'spend':
      return totals.spend;
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

function buildSummaryCards(points: DailyAccountPoint[], window: DashboardWindow): DashboardSummaryCard[] {
  const size = window === '7d' ? 7 : 30;
  const current = sumWindow(sliceTrailing(points, size));
  const previousPoints = slicePrevious(points, size);
  const previous = previousPoints.length > 0 ? sumWindow(previousPoints) : null;

  const cards: Array<{ key: DashboardSummaryCard['key']; label: string }> = [
    { key: 'spend', label: 'Spend' },
    { key: 'leads', label: 'Leads' },
    { key: 'messages', label: 'Messages' },
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
  if (window === '7d') {
    const recentPoints = sliceTrailing(points, 7);

    return {
      outcomeMetric: primaryOutcomeMetric,
      outcomeLabel: outcomeLabel(primaryOutcomeMetric),
      points: recentPoints.map(
        (point) =>
          ({
            label: formatShortDate(point.date),
            spend: point.spend,
            outcome:
              primaryOutcomeMetric === 'messages'
                ? point.messages
                : primaryOutcomeMetric === 'clicks'
                  ? point.clicks
                  : point.leads,
          }) satisfies DashboardTrendPoint
      ),
    };
  }

  const recentPoints = sliceTrailing(points, 30);
  const weeklyPoints = groupWeekly(recentPoints);

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
          primaryOutcomeMetric === 'messages'
            ? totals.messages
            : primaryOutcomeMetric === 'clicks'
              ? totals.clicks
              : totals.leads,
      } satisfies DashboardTrendPoint;
    }),
  };
}

function buildAlerts(
  state: DashboardPayload['state'],
  points: DailyAccountPoint[],
  lastSyncedAt: string | null,
  primaryOutcomeMetric: DashboardOutcomeMetric
): DashboardAlert[] {
  if (state !== 'ready') {
    return [];
  }

  const alerts: DashboardAlert[] = [];
  const currentSevenDays = sumWindow(sliceTrailing(points, 7));
  const previousSevenDaysPoints = slicePrevious(points, 7);
  const previousSevenDays =
    previousSevenDaysPoints.length > 0 ? sumWindow(previousSevenDaysPoints) : null;

  if (lastSyncedAt) {
    const ageMs = Date.now() - new Date(lastSyncedAt).getTime();
    if (Number.isFinite(ageMs) && ageMs > 24 * 60 * 60 * 1000) {
      alerts.push({
        id: 'sync-stale',
        tone: 'yellow',
        title: 'Data is more than a day old',
        description: 'Refresh this account to make sure you are looking at current performance.',
      });
    }
  }

  if (currentSevenDays.spend === 0) {
    alerts.push({
      id: 'no-activity',
      tone: 'blue',
      title: 'No spend in the last 7 days',
      description: 'This account has no recent delivery. Check if campaigns are paused or budgets stopped.',
    });
  }

  if (previousSevenDays) {
    const outcomeKey =
      primaryOutcomeMetric === 'messages'
        ? 'messages'
        : primaryOutcomeMetric === 'clicks'
          ? 'clicks'
          : 'leads';
    const currentOutcome = valueForMetric(currentSevenDays, outcomeKey);
    const previousOutcome = valueForMetric(previousSevenDays, outcomeKey);

    if (previousOutcome >= 5 && currentOutcome <= previousOutcome * 0.7) {
      alerts.push({
        id: 'outcome-drop',
        tone: 'red',
        title: `${outcomeLabel(primaryOutcomeMetric)} are down this week`,
        description: `Your selected account is producing fewer ${outcomeLabel(
          primaryOutcomeMetric
        ).toLowerCase()} than the previous 7-day period.`,
      });
    }

    if (previousSevenDays.spend >= 100) {
      const spendChange = calculateChangePercent(currentSevenDays.spend, previousSevenDays.spend);

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
      primaryOutcomeMetric === 'messages'
        ? campaign.messages
        : primaryOutcomeMetric === 'clicks'
          ? campaign.clicks
          : campaign.leads,
    conversionRate: campaign.conversionRate,
    costPerResult: campaign.costPerResult,
    ctr: campaign.ctr,
  }));
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
  reviveOpportunity: DashboardPayload['reviveOpportunity'];
}): DashboardPayload {
  const platformConnected = Boolean(input.platform && input.platform.status === 'connected');
  const adAccountHasMetrics = input.adAccount
    ? hasMeaningfulMetrics(input.adAccount.aggregated_metrics)
    : false;

  const state = resolveDashboardState({
    selectedPlatformId: input.selectedPlatformIntegrationId,
    platformConnected,
    selectedAdAccountId: input.selectedAdAccountId,
    adAccountPresent: Boolean(input.adAccount),
    adAccountHasMetrics,
  });

  const dailyPoints = sortDailyPoints(input.adAccount?.time_increment_metrics['1']);
  const primaryOutcomeMetric = resolvePrimaryOutcomeMetric(dailyPoints);
  const lastSyncedAt = input.adAccount?.last_synced ?? input.platform?.lastSyncedAt ?? null;

  return {
    state,
    selection: {
      selectedPlatformIntegrationId: input.selectedPlatformIntegrationId,
      selectedAdAccountId: input.selectedAdAccountId,
    },
    activeWindow: '7d',
    windowOptions: ['7d', '30d'],
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
    alerts: buildAlerts(state, dailyPoints, lastSyncedAt, primaryOutcomeMetric),
    summaryByWindow: {
      '7d': buildSummaryCards(dailyPoints, '7d'),
      '30d': buildSummaryCards(dailyPoints, '30d'),
    },
    trendByWindow: {
      '7d': buildTrendSeries(dailyPoints, '7d', primaryOutcomeMetric),
      '30d': buildTrendSeries(dailyPoints, '30d', primaryOutcomeMetric),
    },
    campaignPreview: buildCampaignPreview(input.campaignSnapshot, primaryOutcomeMetric),
    intelligenceSignals: input.intelligenceSignals,
    calendarQueuePreview: input.calendarQueuePreview,
    syncCoverage: input.syncCoverage,
    reviveOpportunity: input.reviveOpportunity,
    platform: input.platform,
    adAccount: input.adAccount,
  };
}
