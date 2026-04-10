'use client';

import '@mantine/charts/styles.css';

import { LineChart } from '@mantine/charts';
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Container,
  Grid,
  Group,
  Paper,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconArrowDownRight,
  IconArrowUpRight,
  IconCalendarMonth,
  IconCalendarWeek,
  IconChartBar,
  IconChevronLeft,
  IconChevronRight,
  IconClock,
  IconCurrencyDollar,
  IconLink,
  IconMessageCircle,
  IconRefresh,
  IconTargetArrow,
  IconUsers,
} from '@tabler/icons-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import {
  buildAgencyQueuePreviewItems,
  compareAgencyQueuePreviewItems,
  formatRetryDelay,
  type AgencyQueuePreviewItem,
  type AgencyQueueStatus,
} from '@/lib/shared';
import type {
  DashboardAlert,
  DashboardCampaignPreviewItem,
  DashboardPayload,
  DashboardState,
  DashboardSummaryCard,
  DashboardWindow,
} from '../types';

type DashboardClientProps = {
  payload: DashboardPayload;
};

const numberFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
});

const CALENDAR_WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function startOfCalendarDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function toCalendarIsoDay(date: Date): string {
  return startOfCalendarDay(date).toISOString().slice(0, 10);
}

function addCalendarDays(base: Date, days: number): Date {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}

function addCalendarMonths(base: Date, months: number): Date {
  const next = startOfCalendarDay(base);
  next.setDate(1);
  next.setMonth(next.getMonth() + months);
  return next;
}

function startOfCalendarWeek(date: Date): Date {
  return addCalendarDays(startOfCalendarDay(date), -startOfCalendarDay(date).getDay());
}

function startOfCalendarMonth(date: Date): Date {
  const next = startOfCalendarDay(date);
  next.setDate(1);
  return next;
}

function isSameCalendarMonth(left: Date, right: Date): boolean {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth();
}

function formatCalendarMonthLabel(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

function formatCalendarWeekLabel(days: Date[]): string {
  const start = days[0];
  const end = days[days.length - 1];

  if (start.getMonth() === end.getMonth()) {
    return `${start.toLocaleDateString('en-US', { month: 'short' })} ${start.getDate()}-${end.getDate()}`;
  }

  return `${start.toLocaleDateString('en-US', { month: 'short' })} ${start.getDate()}-${end.toLocaleDateString('en-US', { month: 'short' })} ${end.getDate()}`;
}

function agencyQueueStatusColor(status: AgencyQueueStatus): string {
  switch (status) {
    case 'approved':
      return 'green';
    case 'ready':
      return 'blue';
    default:
      return 'gray';
  }
}

function formatCurrency(value: number, currencyCode: string | null, digits = 0): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode || 'USD',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatNumber(value: number): string {
  return numberFormatter.format(Number.isFinite(value) ? value : 0);
}

function formatPercent(value: number): string {
  return `${Math.abs(value).toFixed(Math.abs(value) >= 10 ? 0 : 1)}%`;
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return 'Not synced yet';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Not synced yet';
  }

  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatRelativeSync(value: string | null): string {
  if (!value) {
    return 'Waiting for first sync';
  }

  const date = new Date(value);
  const ageMs = Date.now() - date.getTime();

  if (!Number.isFinite(ageMs) || ageMs < 0) {
    return 'Recently synced';
  }

  const hours = Math.round(ageMs / (60 * 60 * 1000));
  if (hours < 1) {
    return 'Synced within the last hour';
  }

  if (hours < 24) {
    return `Synced ${hours}h ago`;
  }

  const days = Math.round(hours / 24);
  return `Synced ${days}d ago`;
}

function formatStatusLabel(value: string | null | undefined): string {
  if (!value) {
    return 'Not connected';
  }

  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function statusColor(status: string | null | undefined): string {
  switch (status) {
    case 'connected':
    case 'active':
      return 'green';
    case 'error':
      return 'red';
    case 'needs_reauth':
      return 'yellow';
    default:
      return 'gray';
  }
}

function alertToneColor(tone: DashboardAlert['tone']): string {
  switch (tone) {
    case 'red':
      return 'red';
    case 'yellow':
      return 'yellow';
    case 'blue':
      return 'blue';
    default:
      return 'teal';
  }
}

function stateContent(state: DashboardState): {
  color: 'blue' | 'orange' | 'yellow' | 'teal';
  title: string;
  description: string;
} {
  switch (state) {
    case 'no_platform_selected':
      return {
        color: 'blue',
        title: 'Connect a platform to start the dashboard',
        description:
          'This page is designed around one selected ad account. Connect a platform first, then choose the account you want this dashboard to watch.',
      };
    case 'platform_not_found_or_not_connected':
      return {
        color: 'orange',
        title: 'This platform connection needs attention',
        description:
          'The saved platform is disconnected or unavailable. Reconnect it from Integrations before treating this dashboard as current.',
      };
    case 'no_ad_account_selected':
      return {
        color: 'yellow',
        title: 'Choose an ad account to make this dashboard useful',
        description:
          'The dashboard is intentionally narrow. Once one ad account is selected, this page becomes a clear daily read instead of a mixed overview.',
      };
    case 'ad_account_selected_no_metrics':
      return {
        color: 'teal',
        title: 'This account is selected, but performance data is still sparse',
        description:
          'Keep the account selected and refresh again after the next sync cycle. The trend and campaign surfaces will fill in once metrics arrive.',
      };
    default:
      return {
        color: 'teal',
        title: 'Dashboard ready',
        description: 'Your selected ad account is loaded and ready for a simple operating read.',
      };
  }
}

function windowLabel(window: DashboardWindow): string {
  return window === '7d' ? 'last 7 days' : 'last 30 days';
}

function previousWindowLabel(window: DashboardWindow): string {
  return window === '7d' ? 'previous 7 days' : 'previous 30 days';
}

function comparisonText(card: DashboardSummaryCard, window: DashboardWindow): {
  label: string;
  color: string;
} {
  if (card.previousValue === null || card.changePercent === null) {
    return {
      label: `No comparison yet against the ${previousWindowLabel(window)}`,
      color: 'var(--mantine-color-gray-6)',
    };
  }

  if (Math.abs(card.changePercent) < 0.5) {
    return {
      label: `Holding steady vs the ${previousWindowLabel(window)}`,
      color: 'var(--mantine-color-gray-7)',
    };
  }

  if (card.changePercent > 0) {
    return {
      label: `Up ${formatPercent(card.changePercent)} vs the ${previousWindowLabel(window)}`,
      color: 'var(--mantine-color-green-7)',
    };
  }

  return {
    label: `Down ${formatPercent(card.changePercent)} vs the ${previousWindowLabel(window)}`,
    color: 'var(--mantine-color-red-7)',
  };
}

function cardIcon(key: DashboardSummaryCard['key']) {
  switch (key) {
    case 'spend':
      return IconCurrencyDollar;
    case 'messages':
      return IconMessageCircle;
    case 'link_clicks':
      return IconLink;
    default:
      return IconUsers;
  }
}

function formatCardValue(card: DashboardSummaryCard, currencyCode: string | null): string {
  if (card.key === 'spend') {
    return formatCurrency(card.value, currencyCode);
  }

  return formatNumber(card.value);
}

function pickPrimaryOutcomeCard(cards: DashboardSummaryCard[]): DashboardSummaryCard {
  return (
    cards.find((card) => card.key === 'leads' && card.value > 0) ||
    cards.find((card) => card.key === 'messages' && card.value > 0) ||
    cards.find((card) => card.key === 'link_clicks' && card.value > 0) ||
    cards.find((card) => card.key === 'leads') ||
    cards[0]
  );
}

function campaignStrengthScore(campaign: DashboardCampaignPreviewItem): number {
  return campaign.primaryOutcomeValue * 100 + campaign.ctr * 15 - campaign.costPerResult * 2;
}

function campaignWatchScore(campaign: DashboardCampaignPreviewItem): number {
  return (
    (campaign.primaryOutcomeValue === 0 ? campaign.spend * 5 : 0) +
    campaign.costPerResult * 4 +
    campaign.spend -
    campaign.primaryOutcomeValue * 12 -
    campaign.ctr * 20
  );
}

function pickStrongestCampaign(
  campaigns: DashboardCampaignPreviewItem[]
): DashboardCampaignPreviewItem | null {
  return [...campaigns].sort((left, right) => campaignStrengthScore(right) - campaignStrengthScore(left))[0] ?? null;
}

function pickWatchCampaign(
  campaigns: DashboardCampaignPreviewItem[],
  strongestCampaignId: string | null
): DashboardCampaignPreviewItem | null {
  const filtered = campaigns.filter((campaign) => campaign.campaignId !== strongestCampaignId);
  return [...filtered].sort((left, right) => campaignWatchScore(right) - campaignWatchScore(left))[0] ?? null;
}

function campaignMetricSummary(
  campaign: DashboardCampaignPreviewItem,
  currencyCode: string | null
): string {
  if (campaign.primaryOutcomeMetric !== 'clicks' && campaign.primaryOutcomeValue > 0) {
    return `${formatNumber(campaign.primaryOutcomeValue)} ${campaign.primaryOutcomeLabel.toLowerCase()} at ${formatCurrency(
      campaign.costPerResult,
      currencyCode,
      2
    )} per result`;
  }

  return `${formatNumber(campaign.primaryOutcomeValue)} ${campaign.primaryOutcomeLabel.toLowerCase()} with ${campaign.ctr.toFixed(2)}% CTR`;
}

function buildDashboardBrief(input: {
  payload: DashboardPayload;
  activeWindow: DashboardWindow;
  spendCard: DashboardSummaryCard;
  primaryOutcomeCard: DashboardSummaryCard;
  strongestCampaign: DashboardCampaignPreviewItem | null;
  stateMeta: ReturnType<typeof stateContent>;
}): string {
  if (input.payload.state !== 'ready') {
    return input.stateMeta.description;
  }

  const accountName = input.payload.viewContext.adAccountName || 'your selected ad account';
  const spendText = formatCardValue(input.spendCard, input.payload.viewContext.currencyCode);
  const outcomeText = `${formatCardValue(
    input.primaryOutcomeCard,
    input.payload.viewContext.currencyCode
  )} ${input.primaryOutcomeCard.label.toLowerCase()}`;
  const outcomeComparison = comparisonText(input.primaryOutcomeCard, input.activeWindow).label;

  return [
    `In the ${windowLabel(input.activeWindow)}, ${accountName} spent ${spendText} and produced ${outcomeText}.`,
    `${outcomeComparison}.`,
    input.strongestCampaign
      ? `${input.strongestCampaign.campaignName} is currently the strongest visible campaign in this account.`
      : 'Campaign-level visibility will appear here as soon as campaign data is available.',
  ].join(' ');
}

function buildReadFirstItems(input: {
  payload: DashboardPayload;
  activeWindow: DashboardWindow;
  strongestCampaign: DashboardCampaignPreviewItem | null;
  watchCampaign: DashboardCampaignPreviewItem | null;
  primaryOutcomeCard: DashboardSummaryCard;
  spendCard: DashboardSummaryCard;
}): Array<{ title: string; detail: string; tone: DashboardAlert['tone'] }> {
  if (input.payload.state !== 'ready') {
    return [
      {
        title: stateContent(input.payload.state).title,
        detail: stateContent(input.payload.state).description,
        tone: 'blue',
      },
    ];
  }

  if (input.payload.alerts.length > 0) {
    return input.payload.alerts.map((alert) => ({
      title: alert.title,
      detail: alert.description,
      tone: alert.tone,
    }));
  }

  const items: Array<{ title: string; detail: string; tone: DashboardAlert['tone'] }> = [
    {
      title: 'Outcome movement',
      detail: comparisonText(input.primaryOutcomeCard, input.activeWindow).label,
      tone:
        input.primaryOutcomeCard.changePercent !== null &&
        input.primaryOutcomeCard.changePercent < 0
          ? 'yellow'
          : 'teal',
    },
    {
      title: 'Spend movement',
      detail: comparisonText(input.spendCard, input.activeWindow).label,
      tone:
        input.spendCard.changePercent !== null && input.spendCard.changePercent > 25
          ? 'yellow'
          : 'blue',
    },
  ];

  if (input.strongestCampaign) {
    items.push({
      title: 'Strongest campaign',
      detail: `${input.strongestCampaign.campaignName} is carrying the clearest result signal right now.`,
      tone: 'teal',
    });
  }

  if (input.watchCampaign) {
    items.push({
      title: 'Watch this campaign',
      detail: `${input.watchCampaign.campaignName} is the softest spot in the visible campaign set.`,
      tone: 'yellow',
    });
  }

  return items.slice(0, 3);
}

function DashboardSignalCard({
  label,
  value,
  detail,
  color,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  color: string;
  icon: typeof IconCurrencyDollar;
}) {
  return (
    <Paper withBorder radius="md" p="md">
      <Group justify="space-between" align="flex-start" mb="sm">
        <div>
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            {label}
          </Text>
          <Text fw={800} mt={6}>
            {value}
          </Text>
        </div>
        <ThemeIcon variant="light" color={color} radius="md">
          <Icon size={16} />
        </ThemeIcon>
      </Group>
      <Text size="sm" c="dimmed">
        {detail}
      </Text>
    </Paper>
  );
}

function AgencyWeekPreview({
  days,
  itemsByDay,
  todayKey,
}: {
  days: Date[];
  itemsByDay: Map<string, AgencyQueuePreviewItem[]>;
  todayKey: string;
}) {
  return (
    <SimpleGrid cols={{ base: 1, sm: 2, lg: 7 }} spacing="xs">
      {days.map((day) => {
        const dayKey = toCalendarIsoDay(day);
        const items = itemsByDay.get(dayKey) ?? [];
        const visibleItems = items.slice(0, 2);
        const remainingCount = items.length - visibleItems.length;
        const isToday = dayKey === todayKey;

        return (
          <Paper
            key={dayKey}
            withBorder
            radius="md"
            p="xs"
            style={{
              minHeight: 170,
              background: isToday ? 'var(--platform-accent-soft)' : 'rgba(255,255,255,0.82)',
              borderColor: isToday ? 'var(--platform-border-strong)' : 'var(--platform-card-border)',
            }}
          >
            <Group justify="space-between" align="flex-start" mb="xs">
              <div>
                <Text size="10px" c="dimmed" tt="uppercase" fw={700}>
                  {CALENDAR_WEEKDAY_LABELS[day.getDay()]}
                </Text>
                <Text fw={800} size="sm">
                  {day.getDate()}
                </Text>
              </div>
              {items.length > 0 ? (
                <Badge size="xs" color="gray" variant="light">
                  {items.length}
                </Badge>
              ) : null}
            </Group>

            <Stack gap={6}>
              {visibleItems.length > 0 ? (
                visibleItems.map((item) => (
                  <Paper
                    key={item.id}
                    withBorder
                    radius="sm"
                    p={6}
                    style={{
                      background: '#fff',
                      borderColor: `var(--mantine-color-${agencyQueueStatusColor(item.status)}-2)`,
                    }}
                  >
                    <Text size="xs" fw={700} lineClamp={2}>
                      {item.title}
                    </Text>
                    <Text size="10px" c="dimmed" mt={2}>
                      {item.time}
                    </Text>
                  </Paper>
                ))
              ) : (
                <Text size="xs" c="dimmed">
                  Open
                </Text>
              )}

              {remainingCount > 0 ? (
                <Text size="xs" c="dimmed" fw={600}>
                  +{remainingCount} more
                </Text>
              ) : null}
            </Stack>
          </Paper>
        );
      })}
    </SimpleGrid>
  );
}

function AgencyMonthPreview({
  monthStart,
  days,
  itemsByDay,
  todayKey,
}: {
  monthStart: Date;
  days: Date[];
  itemsByDay: Map<string, AgencyQueuePreviewItem[]>;
  todayKey: string;
}) {
  return (
    <Stack gap={6}>
      <SimpleGrid cols={7} spacing={6}>
        {CALENDAR_WEEKDAY_LABELS.map((label) => (
          <Text key={label} size="10px" c="dimmed" tt="uppercase" fw={700} ta="center">
            {label.slice(0, 1)}
          </Text>
        ))}
      </SimpleGrid>

      <SimpleGrid cols={7} spacing={6}>
        {days.map((day) => {
          const dayKey = toCalendarIsoDay(day);
          const items = itemsByDay.get(dayKey) ?? [];
          const inCurrentMonth = isSameCalendarMonth(day, monthStart);
          const isToday = dayKey === todayKey;

          return (
            <Paper
              key={dayKey}
              withBorder
              radius="sm"
              p={6}
              style={{
                minHeight: 82,
                opacity: inCurrentMonth ? 1 : 0.45,
                background: isToday ? 'var(--platform-accent-soft)' : 'rgba(255,255,255,0.82)',
                borderColor: isToday ? 'var(--platform-border-strong)' : 'var(--platform-card-border)',
              }}
            >
              <Group justify="space-between" align="center" mb={4}>
                <Text size="xs" fw={700}>
                  {day.getDate()}
                </Text>
                {items.length > 0 ? (
                  <Badge size="xs" color="gray" variant="light">
                    {items.length}
                  </Badge>
                ) : null}
              </Group>

              {items.length > 0 ? (
                <>
                  <Text size="10px" fw={700} lineClamp={2}>
                    {items[0]?.title}
                  </Text>
                  {items.length > 1 ? (
                    <Text size="10px" c="dimmed" mt={2}>
                      +{items.length - 1} more
                    </Text>
                  ) : null}
                </>
              ) : inCurrentMonth ? (
                <Text size="10px" c="dimmed">
                  Open
                </Text>
              ) : null}
            </Paper>
          );
        })}
      </SimpleGrid>
    </Stack>
  );
}

export default function DashboardClient({ payload }: DashboardClientProps) {
  const router = useRouter();
  const [activeWindow, setActiveWindow] = useState<DashboardWindow>(payload.activeWindow);
  const [agencyPreviewView, setAgencyPreviewView] = useState<'weekly' | 'monthly'>('weekly');
  const [agencyPreviewCursor, setAgencyPreviewCursor] = useState(() =>
    startOfCalendarDay(new Date())
  );
  const [refreshing, setRefreshing] = useState(false);
  const [refreshFeedback, setRefreshFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const stateMeta = stateContent(payload.state);
  const summaryCards = payload.summaryByWindow[activeWindow];
  const trend = payload.trendByWindow[activeWindow];
  const primaryOutcomeCard = pickPrimaryOutcomeCard(summaryCards);
  const spendCard = summaryCards.find((card) => card.key === 'spend') ?? summaryCards[0];
  const strongestCampaign = useMemo(
    () => pickStrongestCampaign(payload.campaignPreview),
    [payload.campaignPreview]
  );
  const watchCampaign = useMemo(
    () => pickWatchCampaign(payload.campaignPreview, strongestCampaign?.campaignId ?? null),
    [payload.campaignPreview, strongestCampaign]
  );
  const readFirstItems = useMemo(
    () =>
      buildReadFirstItems({
        payload,
        activeWindow,
        strongestCampaign,
        watchCampaign,
        primaryOutcomeCard,
        spendCard,
      }),
    [payload, activeWindow, strongestCampaign, watchCampaign, primaryOutcomeCard, spendCard]
  );
  const brief = buildDashboardBrief({
    payload,
    activeWindow,
    spendCard,
    primaryOutcomeCard,
    strongestCampaign,
    stateMeta,
  });
  const trendData = trend.points.map((point) => ({
    label: point.label,
    [trend.outcomeLabel]: point.outcome,
  }));
  const agencyPreviewItems = useMemo(
    () =>
      buildAgencyQueuePreviewItems(
        payload.viewContext.adAccountName ?? payload.viewContext.platformName
      ).sort(compareAgencyQueuePreviewItems),
    [payload.viewContext.adAccountName, payload.viewContext.platformName]
  );
  const agencyPreviewCounts = useMemo(
    () => ({
      total: agencyPreviewItems.length,
      ready: agencyPreviewItems.filter((item) => item.status === 'ready').length,
      approved: agencyPreviewItems.filter((item) => item.status === 'approved').length,
      draft: agencyPreviewItems.filter((item) => item.status === 'draft').length,
    }),
    [agencyPreviewItems]
  );
  const agencyPreviewTodayKey = useMemo(
    () => toCalendarIsoDay(new Date()),
    []
  );
  const agencyPreviewWeekStart = useMemo(
    () => startOfCalendarWeek(agencyPreviewCursor),
    [agencyPreviewCursor]
  );
  const agencyPreviewWeekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addCalendarDays(agencyPreviewWeekStart, index)),
    [agencyPreviewWeekStart]
  );
  const agencyPreviewWeekKeys = useMemo(
    () => agencyPreviewWeekDays.map((day) => toCalendarIsoDay(day)),
    [agencyPreviewWeekDays]
  );
  const agencyPreviewMonthStart = useMemo(
    () => startOfCalendarMonth(agencyPreviewCursor),
    [agencyPreviewCursor]
  );
  const agencyPreviewMonthGridStart = useMemo(
    () => startOfCalendarWeek(agencyPreviewMonthStart),
    [agencyPreviewMonthStart]
  );
  const agencyPreviewMonthDays = useMemo(
    () => Array.from({ length: 35 }, (_, index) => addCalendarDays(agencyPreviewMonthGridStart, index)),
    [agencyPreviewMonthGridStart]
  );
  const agencyPreviewMonthKeys = useMemo(
    () => agencyPreviewMonthDays.map((day) => toCalendarIsoDay(day)),
    [agencyPreviewMonthDays]
  );
  const agencyPreviewWeekItemsByDay = useMemo(() => {
    const grouped = new Map<string, AgencyQueuePreviewItem[]>(
      agencyPreviewWeekKeys.map((day) => [day, []])
    );

    agencyPreviewItems.forEach((item) => {
      const bucket = grouped.get(item.day);

      if (bucket) {
        bucket.push(item);
      }
    });

    grouped.forEach((items) => items.sort(compareAgencyQueuePreviewItems));
    return grouped;
  }, [agencyPreviewItems, agencyPreviewWeekKeys]);
  const agencyPreviewMonthItemsByDay = useMemo(() => {
    const grouped = new Map<string, AgencyQueuePreviewItem[]>(
      agencyPreviewMonthKeys.map((day) => [day, []])
    );

    agencyPreviewItems.forEach((item) => {
      const bucket = grouped.get(item.day);

      if (bucket) {
        bucket.push(item);
      }
    });

    grouped.forEach((items) => items.sort(compareAgencyQueuePreviewItems));
    return grouped;
  }, [agencyPreviewItems, agencyPreviewMonthKeys]);
  const agencyPreviewLabel = useMemo(
    () =>
      agencyPreviewView === 'weekly'
        ? formatCalendarWeekLabel(agencyPreviewWeekDays)
        : formatCalendarMonthLabel(agencyPreviewMonthStart),
    [agencyPreviewMonthStart, agencyPreviewView, agencyPreviewWeekDays]
  );

  async function handleRefresh() {
    setRefreshing(true);
    setRefreshFeedback(null);

    try {
      const response = await fetch('/api/sync/refresh', { method: 'POST' });
      const result = (await response.json()) as {
        success?: boolean;
        refreshedCount?: number;
        failedCount?: number;
        message?: string;
        retryAfterMs?: number;
      };

      if (!response.ok || !result.success) {
        if (response.status === 429) {
          throw new Error(result.message || formatRetryDelay(result.retryAfterMs));
        }

        throw new Error(result.message || 'Refresh failed');
      }

      router.refresh();
      setRefreshFeedback({
        type: 'success',
        message: `Sync completed: ${result.refreshedCount ?? 0} updated, ${result.failedCount ?? 0} failed.`,
      });
    } catch (error) {
      setRefreshFeedback({
        type: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Sync failed. Check the integration status and try again.',
      });
    } finally {
      setRefreshing(false);
    }
  }

  function shiftAgencyPreview(direction: -1 | 1) {
    setAgencyPreviewCursor((current) =>
      agencyPreviewView === 'weekly'
        ? addCalendarDays(current, direction * 7)
        : addCalendarMonths(current, direction)
    );
  }

  return (
    <Container size="xl" py={{ base: 'md', md: 'xl' }}>
      <Stack gap="lg">
        <Card
          withBorder
          radius="lg"
          p={{ base: 'lg', md: 'xl' }}
          className="app-platform-page-hero"
        >
          <Group justify="space-between" align="flex-start" gap="xl" wrap="wrap">
            <Stack gap="sm" maw={700}>
              <Group gap="xs" wrap="wrap">
                <Badge variant="light" className="app-platform-page-badge">
                  Dashboard
                </Badge>
                <Badge color={statusColor(payload.viewContext.platformStatus)} variant="light">
                  {payload.viewContext.platformName ?? 'No platform selected'}
                </Badge>
                <Badge color="cyan" variant="outline">
                  {payload.viewContext.adAccountName ?? 'No ad account selected'}
                </Badge>
              </Group>

              <div>
                <Text size="sm" fw={600} className="app-platform-page-kicker">
                  {payload.viewContext.businessName}
                </Text>
                <Title order={2} mt={4} className="app-platform-page-title">
                  Daily operating view for one account
                </Title>
                <Text size="md" maw={620} mt="xs" className="app-platform-page-copy">
                  Keep the dashboard narrow: current account context, performance movement,
                  visible campaign leaders, and the next obvious place to go.
                </Text>
              </div>

              <Group gap="xs" wrap="wrap">
                <Badge color={statusColor(payload.viewContext.platformStatus)} variant="outline">
                  Platform {formatStatusLabel(payload.viewContext.platformStatus)}
                </Badge>
                <Badge color={statusColor(payload.viewContext.adAccountStatus)} variant="outline">
                  Account {formatStatusLabel(payload.viewContext.adAccountStatus)}
                </Badge>
                <Badge color="gray" variant="outline">
                  {formatRelativeSync(payload.viewContext.lastSyncedAt)}
                </Badge>
              </Group>
            </Stack>

            <Paper
              radius="lg"
              p="md"
              className="app-platform-page-hero-panel"
              style={{ minWidth: 320 }}
            >
              <Stack gap="sm">
                <Group justify="space-between" align="center">
                  <Group gap={8}>
                    <ThemeIcon variant="light" color="blue" radius="xl">
                      <IconClock size={16} />
                    </ThemeIcon>
                    <div>
                      <Text size="xs" tt="uppercase" fw={700} className="app-platform-page-subtle">
                        Last synced
                      </Text>
                      <Text size="sm" className="app-platform-page-title">
                        {formatDateTime(payload.viewContext.lastSyncedAt)}
                      </Text>
                    </div>
                  </Group>
                  <SegmentedControl
                    size="sm"
                    radius="xl"
                    value={activeWindow}
                    onChange={(value) => setActiveWindow(value as DashboardWindow)}
                    data={payload.windowOptions.map((window) => ({
                      label: window === '7d' ? '7D' : '30D',
                      value: window,
                    }))}
                  />
                </Group>

                <Group gap="sm" wrap="wrap">
                  <Button
                    onClick={handleRefresh}
                    leftSection={<IconRefresh size={16} />}
                    loading={refreshing}
                    disabled={!payload.viewContext.canRefresh}
                    variant="filled"
                    radius="xl"
                    className="app-platform-page-action-primary"
                  >
                    Refresh data
                  </Button>
                  <Button
                    component={Link}
                    href="/reports"
                    variant="default"
                    radius="xl"
                    className="app-platform-page-action-secondary"
                  >
                    Open reports
                  </Button>
                  <Button
                    component={Link}
                    href="/agency"
                    variant="default"
                    radius="xl"
                    className="app-platform-page-action-secondary"
                  >
                    Open agency
                  </Button>
                </Group>
              </Stack>
            </Paper>
          </Group>
        </Card>

        {refreshFeedback ? (
          <Alert
            color={refreshFeedback.type === 'success' ? 'green' : 'red'}
            icon={<IconRefresh size={16} />}
            radius="lg"
          >
            {refreshFeedback.message}
          </Alert>
        ) : null}

        {payload.state !== 'ready' ? (
          <Alert
            color={stateMeta.color}
            radius="lg"
            icon={<IconAlertCircle size={16} />}
            title={stateMeta.title}
          >
            <Text size="sm">{stateMeta.description}</Text>
            {payload.viewContext.platformError ? (
              <Text size="sm" mt="sm">
                {payload.viewContext.platformError}
              </Text>
            ) : null}
            <Group gap="sm" mt="md">
              <Button component={Link} href="/integration" size="xs" radius="xl" variant="light">
                Manage integrations
              </Button>
              {payload.viewContext.canRefresh ? (
                <Button
                  size="xs"
                  radius="xl"
                  variant="subtle"
                  onClick={handleRefresh}
                  loading={refreshing}
                >
                  Refresh again
                </Button>
              ) : null}
            </Group>
          </Alert>
        ) : null}

        <Card withBorder radius="lg" p="xl">
          <Grid gutter="lg" align="stretch">
            <Grid.Col span={{ base: 12, xl: 7 }}>
              <Stack gap="sm">
                <div>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                    Snapshot
                  </Text>
                  <Text fw={800} size="xl" mt={4}>
                    What matters right now
                  </Text>
                </div>
                <Text size="lg" lh={1.6}>
                  {brief}
                </Text>
                <Group gap="xs" wrap="wrap">
                  <Badge variant="light" color="gray" radius="sm">
                    Viewing {windowLabel(activeWindow)}
                  </Badge>
                  <Badge variant="light" color="gray" radius="sm">
                    {formatRelativeSync(payload.viewContext.lastSyncedAt)}
                  </Badge>
                  <Badge
                    variant="light"
                    color={statusColor(payload.viewContext.adAccountStatus)}
                    radius="sm"
                  >
                    {formatStatusLabel(payload.viewContext.adAccountStatus)}
                  </Badge>
                </Group>
              </Stack>
            </Grid.Col>

            <Grid.Col span={{ base: 12, xl: 5 }}>
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                <DashboardSignalCard
                  label="Spend"
                  value={formatCardValue(spendCard, payload.viewContext.currencyCode)}
                  detail={comparisonText(spendCard, activeWindow).label}
                  color="blue"
                  icon={IconCurrencyDollar}
                />
                <DashboardSignalCard
                  label={primaryOutcomeCard.label}
                  value={formatCardValue(primaryOutcomeCard, payload.viewContext.currencyCode)}
                  detail={comparisonText(primaryOutcomeCard, activeWindow).label}
                  color="teal"
                  icon={cardIcon(primaryOutcomeCard.key)}
                />
                <DashboardSignalCard
                  label="Strongest campaign"
                  value={strongestCampaign ? strongestCampaign.campaignName : 'No campaign signal yet'}
                  detail={
                    strongestCampaign
                      ? campaignMetricSummary(strongestCampaign, payload.viewContext.currencyCode)
                      : 'Campaign-level signal appears here as soon as the current account has campaign data.'
                  }
                  color="grape"
                  icon={IconChartBar}
                />
                <DashboardSignalCard
                  label="Attention now"
                  value={
                    payload.alerts[0]?.title ||
                    watchCampaign?.campaignName ||
                    'No urgent issues'
                  }
                  detail={
                    payload.alerts[0]?.description ||
                    (watchCampaign
                      ? `${watchCampaign.campaignName} is the softest spot in the visible campaign set.`
                      : 'The account looks stable enough to stay focused on the main trend and campaign list.')
                  }
                  color={payload.alerts[0] ? alertToneColor(payload.alerts[0].tone) : 'orange'}
                  icon={payload.alerts[0] ? IconAlertCircle : IconTargetArrow}
                />
              </SimpleGrid>
            </Grid.Col>
          </Grid>
        </Card>

        <Card withBorder radius="lg" p="xl">
          <Grid gutter="lg" align="stretch">
            <Grid.Col span={{ base: 12, xl: 8 }}>
              <Paper withBorder radius="md" p="md" h="100%">
                <Group justify="space-between" align="flex-start" mb="sm">
                  <div>
                    <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                      Trend
                    </Text>
                    <Text fw={700}>{trend.outcomeLabel} over time</Text>
                  </div>
                  <Badge variant="light" color="gray" radius="sm">
                    {windowLabel(activeWindow)}
                  </Badge>
                </Group>

                {trendData.length > 0 ? (
                  <LineChart
                    h={320}
                    data={trendData}
                    dataKey="label"
                    series={[{ name: trend.outcomeLabel, color: 'blue.6' }]}
                    curveType="linear"
                    withLegend={false}
                    valueFormatter={(value) => value.toLocaleString()}
                  />
                ) : (
                  <Stack justify="center" align="center" h={320} gap="xs">
                    <Text fw={700}>No trend data yet</Text>
                    <Text size="sm" c="dimmed" ta="center" maw={360}>
                      Once the selected account has recent synced metrics, this trend becomes the
                      quickest way to see whether performance is strengthening or flattening out.
                    </Text>
                  </Stack>
                )}
              </Paper>
            </Grid.Col>

            <Grid.Col span={{ base: 12, xl: 4 }}>
              <Stack gap="sm" h="100%">
                <Paper withBorder radius="md" p="md">
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                    Read first
                  </Text>
                  <Stack gap="sm" mt="sm">
                    {readFirstItems.map((item) => (
                      <Paper key={item.title} withBorder radius="md" p="sm">
                        <Group gap="xs" align="flex-start" wrap="nowrap">
                          <ThemeIcon
                            variant="light"
                            color={alertToneColor(item.tone)}
                            radius="md"
                            size="md"
                          >
                            {item.tone === 'red' ? (
                              <IconArrowDownRight size={14} />
                            ) : (
                              <IconArrowUpRight size={14} />
                            )}
                          </ThemeIcon>
                          <div>
                            <Text fw={700} size="sm">
                              {item.title}
                            </Text>
                            <Text size="sm" c="dimmed" mt={4}>
                              {item.detail}
                            </Text>
                          </div>
                        </Group>
                      </Paper>
                    ))}
                  </Stack>
                </Paper>

                <Paper withBorder radius="md" p="md">
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                    Data status
                  </Text>
                  <Text fw={700} mt={6}>
                    {formatRelativeSync(payload.viewContext.lastSyncedAt)}
                  </Text>
                  <Text size="sm" c="dimmed" mt={6}>
                    Platform: {formatStatusLabel(payload.viewContext.platformStatus)}. Account:{' '}
                    {formatStatusLabel(payload.viewContext.adAccountStatus)}.
                  </Text>
                  {payload.viewContext.platformError ? (
                    <Text size="sm" c="dimmed" mt={6}>
                      {payload.viewContext.platformError}
                    </Text>
                  ) : null}
                </Paper>
              </Stack>
            </Grid.Col>
          </Grid>
        </Card>

        <Grid gutter="lg" align="stretch">
          <Grid.Col span={{ base: 12, xl: 7 }}>
            <Card withBorder radius="lg" p="xl" h="100%">
              <Group justify="space-between" align="flex-start" mb="md" wrap="wrap">
                <div>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                    Campaigns
                  </Text>
                  <Title order={3}>Visible campaign movers</Title>
                  <Text size="sm" c="dimmed" mt={4}>
                    Keep this tight. The dashboard shows only the few campaigns worth scanning
                    before you jump into Reports for a deeper explanation.
                  </Text>
                </div>
                <Badge color="gray" variant="light" size="lg">
                  {payload.campaignPreview.length} shown
                </Badge>
              </Group>

              <Stack gap="sm">
                {payload.campaignPreview.length > 0 ? (
                  payload.campaignPreview.map((campaign) => (
                    <Paper key={campaign.campaignId} withBorder radius="md" p="md">
                      <Group justify="space-between" align="flex-start" gap="md" wrap="wrap">
                        <div style={{ flex: 1, minWidth: 240 }}>
                          <Group gap="xs" mb={6} wrap="wrap">
                            <Badge color={statusColor(campaign.status)} variant="light">
                              {formatStatusLabel(campaign.status)}
                            </Badge>
                            {campaign.objective ? (
                              <Badge color="gray" variant="outline">
                                {campaign.objective}
                              </Badge>
                            ) : null}
                            {campaign.campaignId === strongestCampaign?.campaignId ? (
                              <Badge color="teal" variant="light">
                                Strongest visible
                              </Badge>
                            ) : null}
                            {campaign.campaignId === watchCampaign?.campaignId ? (
                              <Badge color="orange" variant="light">
                                Watch
                              </Badge>
                            ) : null}
                          </Group>
                          <Text fw={700}>{campaign.campaignName}</Text>
                          <Text size="sm" c="dimmed" mt={6}>
                            {campaignMetricSummary(campaign, payload.viewContext.currencyCode)}
                          </Text>
                        </div>

                        <Group gap="xl" wrap="wrap">
                          <div>
                            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                              Spend
                            </Text>
                            <Text fw={700}>
                              {formatCurrency(campaign.spend, payload.viewContext.currencyCode)}
                            </Text>
                          </div>
                          <div>
                            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                              {campaign.primaryOutcomeLabel}
                            </Text>
                            <Text fw={700}>{formatNumber(campaign.primaryOutcomeValue)}</Text>
                          </div>
                          <div>
                            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                              Support
                            </Text>
                            <Text fw={700}>
                              {campaign.primaryOutcomeMetric !== 'clicks' &&
                              campaign.primaryOutcomeValue > 0
                                ? formatCurrency(
                                    campaign.costPerResult,
                                    payload.viewContext.currencyCode,
                                    2
                                  )
                                : `${campaign.ctr.toFixed(2)}%`}
                            </Text>
                          </div>
                        </Group>
                      </Group>
                    </Paper>
                  ))
                ) : (
                  <Paper withBorder radius="md" p="lg">
                    <Text fw={700}>Campaign-level data is not ready yet</Text>
                    <Text size="sm" c="dimmed" mt={6}>
                      Once campaign performance is available for this account, the dashboard will
                      surface the strongest visible campaign and the one that needs the most review.
                    </Text>
                  </Paper>
                )}
              </Stack>
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 12, xl: 5 }}>
            <Card withBorder radius="lg" p="xl" h="100%">
              <Group justify="space-between" align="flex-start" mb="md" wrap="wrap">
                <div>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                    Agency preview
                  </Text>
                  <Title order={3} mt={4}>
                    Compact planning calendar
                  </Title>
                  <Text size="sm" c="dimmed" mt={4}>
                    Small look at the same queue shape DeepVisor wants to move into Agency for the
                    current account context.
                  </Text>
                </div>
                <Badge color="gray" variant="light" size="lg">
                  {agencyPreviewCounts.total} queued
                </Badge>
              </Group>

              <SimpleGrid cols={3} spacing="xs" mb="md">
                <Paper withBorder radius="md" p="sm">
                  <Text size="10px" c="dimmed" tt="uppercase" fw={700}>
                    Needs approval
                  </Text>
                  <Text fw={800} mt={4}>
                    {agencyPreviewCounts.ready}
                  </Text>
                </Paper>
                <Paper withBorder radius="md" p="sm">
                  <Text size="10px" c="dimmed" tt="uppercase" fw={700}>
                    Drafts
                  </Text>
                  <Text fw={800} mt={4}>
                    {agencyPreviewCounts.draft}
                  </Text>
                </Paper>
                <Paper withBorder radius="md" p="sm">
                  <Text size="10px" c="dimmed" tt="uppercase" fw={700}>
                    Approved
                  </Text>
                  <Text fw={800} mt={4}>
                    {agencyPreviewCounts.approved}
                  </Text>
                </Paper>
              </SimpleGrid>

              <Paper withBorder radius="md" p="md">
                <Group justify="space-between" align="center" mb="md" wrap="wrap" gap="sm">
                  <SegmentedControl
                    size="xs"
                    radius="xl"
                    value={agencyPreviewView}
                    onChange={(value) => setAgencyPreviewView(value as 'weekly' | 'monthly')}
                    data={[
                      {
                        label: (
                          <Group gap={4} wrap="nowrap">
                            <IconCalendarWeek size={14} />
                            <span>Week</span>
                          </Group>
                        ),
                        value: 'weekly',
                      },
                      {
                        label: (
                          <Group gap={4} wrap="nowrap">
                            <IconCalendarMonth size={14} />
                            <span>Month</span>
                          </Group>
                        ),
                        value: 'monthly',
                      },
                    ]}
                  />

                  <Group gap={6} wrap="nowrap">
                    <ActionIcon
                      variant="light"
                      color="gray"
                      radius="xl"
                      onClick={() => shiftAgencyPreview(-1)}
                      aria-label="Previous agency preview period"
                    >
                      <IconChevronLeft size={16} />
                    </ActionIcon>
                    <Text size="sm" fw={700} miw={132} ta="center">
                      {agencyPreviewLabel}
                    </Text>
                    <ActionIcon
                      variant="light"
                      color="gray"
                      radius="xl"
                      onClick={() => shiftAgencyPreview(1)}
                      aria-label="Next agency preview period"
                    >
                      <IconChevronRight size={16} />
                    </ActionIcon>
                  </Group>
                </Group>

                {agencyPreviewView === 'weekly' ? (
                  <AgencyWeekPreview
                    days={agencyPreviewWeekDays}
                    itemsByDay={agencyPreviewWeekItemsByDay}
                    todayKey={agencyPreviewTodayKey}
                  />
                ) : (
                  <AgencyMonthPreview
                    monthStart={agencyPreviewMonthStart}
                    days={agencyPreviewMonthDays}
                    itemsByDay={agencyPreviewMonthItemsByDay}
                    todayKey={agencyPreviewTodayKey}
                  />
                )}
              </Paper>

              <Group justify="space-between" align="center" mt="md" gap="sm" wrap="wrap">
                <Text size="sm" c="dimmed" maw={260}>
                  Open the full Agency view to approve, modify, or schedule what is queued here.
                </Text>
                <Group gap="sm" wrap="wrap">
                  <Button
                    component={Link}
                    href="/agency"
                    radius="xl"
                    rightSection={<IconArrowUpRight size={14} />}
                    className="app-platform-page-action-primary"
                  >
                    Open agency
                  </Button>
                  <Button
                    component={Link}
                    href="/reports"
                    radius="xl"
                    variant="default"
                    className="app-platform-page-action-secondary"
                  >
                    Reports
                  </Button>
                  <Button
                    component={Link}
                    href="/integration"
                    radius="xl"
                    variant="default"
                    className="app-platform-page-action-secondary"
                  >
                    Integrations
                  </Button>
                </Group>
              </Group>
            </Card>
          </Grid.Col>
        </Grid>
      </Stack>
    </Container>
  );
}
