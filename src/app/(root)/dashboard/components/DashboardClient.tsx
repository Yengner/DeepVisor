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
  IconBulb,
  IconCalendarMonth,
  IconCalendarWeek,
  IconChartBar,
  IconChevronLeft,
  IconChevronRight,
  IconClock,
  IconCurrencyDollar,
  IconFileAnalytics,
  IconLink,
  IconMessageCircle,
  IconRefresh,
  IconSparkles,
  IconTargetArrow,
  IconUsers,
} from '@tabler/icons-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import ReviveCampaignPrompt from '@/components/campaigns/ReviveCampaignPrompt';
import {
  buildCalendarQueuePreviewItems,
  compareCalendarQueuePreviewItems,
  formatRetryDelay,
  type CalendarQueuePreviewItem,
  type CalendarQueueStatus,
} from '@/lib/shared';
import type {
  DashboardAlert,
  DashboardCampaignPreviewItem,
  DashboardPayload,
  DashboardState,
  DashboardSummaryCard,
  DashboardTrendSeries,
  DashboardWindow,
} from '../types';
import classes from './DashboardClient.module.css';

type DashboardClientProps = {
  payload: DashboardPayload;
};

const numberFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
});

const CALENDAR_WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const STATIC_SUMMARY_BY_WINDOW: Record<DashboardWindow, DashboardSummaryCard[]> = {
  '7d': [
    { key: 'spend', label: 'Spend', value: 1840, previousValue: 1620, changePercent: 13.6 },
    { key: 'leads', label: 'Leads', value: 63, previousValue: 48, changePercent: 31.3 },
    { key: 'messages', label: 'Messages', value: 41, previousValue: 45, changePercent: -8.9 },
    { key: 'link_clicks', label: 'Link clicks', value: 982, previousValue: 864, changePercent: 13.7 },
  ],
  '30d': [
    { key: 'spend', label: 'Spend', value: 7420, previousValue: 6810, changePercent: 9 },
    { key: 'leads', label: 'Leads', value: 248, previousValue: 214, changePercent: 15.9 },
    { key: 'messages', label: 'Messages', value: 173, previousValue: 151, changePercent: 14.6 },
    { key: 'link_clicks', label: 'Link clicks', value: 4210, previousValue: 3824, changePercent: 10.1 },
  ],
};

const STATIC_TREND_BY_WINDOW: Record<DashboardWindow, DashboardTrendSeries> = {
  '7d': {
    outcomeMetric: 'leads',
    outcomeLabel: 'Leads',
    points: [
      { label: 'Apr 4', spend: 210, outcome: 7 },
      { label: 'Apr 5', spend: 240, outcome: 9 },
      { label: 'Apr 6', spend: 230, outcome: 8 },
      { label: 'Apr 7', spend: 275, outcome: 11 },
      { label: 'Apr 8', spend: 285, outcome: 10 },
      { label: 'Apr 9', spend: 300, outcome: 12 },
      { label: 'Apr 10', spend: 300, outcome: 6 },
    ],
  },
  '30d': {
    outcomeMetric: 'leads',
    outcomeLabel: 'Leads',
    points: [
      { label: 'Mar 11', spend: 1420, outcome: 39 },
      { label: 'Mar 18', spend: 1600, outcome: 48 },
      { label: 'Mar 25', spend: 1710, outcome: 55 },
      { label: 'Apr 1', spend: 1850, outcome: 63 },
      { label: 'Apr 8', spend: 1840, outcome: 43 },
    ],
  },
};

const STATIC_CAMPAIGN_PREVIEW: DashboardCampaignPreviewItem[] = [
  {
    campaignId: 'demo-local-lead-machine',
    campaignName: 'Local Lead Machine - Search + Social',
    objective: 'LEADS',
    status: 'active',
    spend: 2480,
    primaryOutcomeMetric: 'leads',
    primaryOutcomeLabel: 'Leads',
    primaryOutcomeValue: 96,
    conversionRate: 0.071,
    costPerResult: 25.83,
    ctr: 2.94,
  },
  {
    campaignId: 'demo-retargeting-trust',
    campaignName: 'Retargeting - Trust Builders',
    objective: 'MESSAGES',
    status: 'active',
    spend: 1180,
    primaryOutcomeMetric: 'messages',
    primaryOutcomeLabel: 'Messages',
    primaryOutcomeValue: 58,
    conversionRate: 0.052,
    costPerResult: 20.34,
    ctr: 3.42,
  },
  {
    campaignId: 'demo-spring-offer',
    campaignName: 'Spring Offer - Broad Prospecting',
    objective: 'TRAFFIC',
    status: 'active',
    spend: 2190,
    primaryOutcomeMetric: 'clicks',
    primaryOutcomeLabel: 'Clicks',
    primaryOutcomeValue: 1420,
    conversionRate: 0.014,
    costPerResult: 86.12,
    ctr: 1.18,
  },
  {
    campaignId: 'demo-old-creative',
    campaignName: 'Legacy Creative Test - Static Images',
    objective: 'LEADS',
    status: 'paused',
    spend: 860,
    primaryOutcomeMetric: 'leads',
    primaryOutcomeLabel: 'Leads',
    primaryOutcomeValue: 9,
    conversionRate: 0.008,
    costPerResult: 95.56,
    ctr: 0.74,
  },
];

const STATIC_REPORT_DIGEST = [
  {
    title: 'Weekly performance brief',
    detail: 'Lead volume is up 31% while broad prospecting is starting to soften.',
    href: '/reports?demo=1&compare=previous_period',
    badge: 'Ready',
  },
  {
    title: 'Campaign comparison',
    detail: 'Local Lead Machine is beating Spring Offer on cost per result by 70%.',
    href: '/reports?demo=1&scope=campaign',
    badge: 'Compare',
  },
  {
    title: 'Creative fatigue watch',
    detail: 'Legacy static images are below the account CTR average and should be replaced.',
    href: '/reports?demo=1',
    badge: 'Watch',
  },
];

const STATIC_OPERATING_ACTIONS = [
  {
    title: 'Approve retargeting budget hold',
    detail: 'Keep spend stable until the message campaign confirms another 3-day signal.',
    tone: 'blue' as DashboardAlert['tone'],
    owner: 'Calendar',
  },
  {
    title: 'Refresh broad prospecting creative',
    detail: 'CTR is below target and cost per result is drifting higher than the account average.',
    tone: 'yellow' as DashboardAlert['tone'],
    owner: 'Campaigns',
  },
  {
    title: 'Promote lead machine learning',
    detail: 'Use the strongest campaign as the baseline for next week’s report recommendation.',
    tone: 'teal' as DashboardAlert['tone'],
    owner: 'Reports',
  },
];

const STATIC_PLATFORM_HEALTH = [
  { label: 'Meta account', value: 'Connected', color: 'green' },
  { label: 'Google Ads', value: 'Preview data', color: 'blue' },
  { label: 'TikTok Ads', value: 'Needs auth', color: 'yellow' },
  { label: 'Next sync', value: 'Tonight 12:30 AM', color: 'gray' },
];

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

function calendarQueueStatusColor(status: CalendarQueueStatus): string {
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

function CalendarWeekPreview({
  days,
  itemsByDay,
  todayKey,
}: {
  days: Date[];
  itemsByDay: Map<string, CalendarQueuePreviewItem[]>;
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
                      borderColor: `var(--mantine-color-${calendarQueueStatusColor(item.status)}-2)`,
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

function CalendarMonthPreview({
  monthStart,
  days,
  itemsByDay,
  todayKey,
}: {
  monthStart: Date;
  days: Date[];
  itemsByDay: Map<string, CalendarQueuePreviewItem[]>;
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
  const [calendarPreviewView, setCalendarPreviewView] = useState<'weekly' | 'monthly'>('weekly');
  const [calendarPreviewCursor, setCalendarPreviewCursor] = useState(() =>
    startOfCalendarDay(new Date())
  );
  const [refreshing, setRefreshing] = useState(false);
  const [refreshFeedback, setRefreshFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [reviveModalOpened, setReviveModalOpened] = useState(false);
  const [revivePromptDismissed, setRevivePromptDismissed] = useState(false);

  const stateMeta = stateContent(payload.state);
  const liveSummaryCards = payload.summaryByWindow[activeWindow];
  const hasLiveSummarySignal = liveSummaryCards.some(
    (card) => card.value > 0 || card.previousValue !== null
  );
  const summaryCards = hasLiveSummarySignal ? liveSummaryCards : STATIC_SUMMARY_BY_WINDOW[activeWindow];
  const liveTrend = payload.trendByWindow[activeWindow];
  const trend = liveTrend.points.length > 0 ? liveTrend : STATIC_TREND_BY_WINDOW[activeWindow];
  const campaignPreview =
    payload.campaignPreview.length > 0 ? payload.campaignPreview : STATIC_CAMPAIGN_PREVIEW;
  const primaryOutcomeCard = pickPrimaryOutcomeCard(summaryCards);
  const spendCard = summaryCards.find((card) => card.key === 'spend') ?? summaryCards[0];
  const strongestCampaign = useMemo(
    () => pickStrongestCampaign(campaignPreview),
    [campaignPreview]
  );
  const watchCampaign = useMemo(
    () => pickWatchCampaign(campaignPreview, strongestCampaign?.campaignId ?? null),
    [campaignPreview, strongestCampaign]
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
  const operatingBrief =
    payload.state === 'ready'
      ? brief
      : `Static operating preview: the selected account view will look like this once live data is available. ${brief}`;
  const trendData = trend.points.map((point) => ({
    label: point.label,
    Spend: Number(point.spend.toFixed(2)),
    [trend.outcomeLabel]: point.outcome,
  }));
  const calendarPreviewItems = useMemo(
    () =>
      buildCalendarQueuePreviewItems(
        payload.viewContext.adAccountName ?? payload.viewContext.platformName
      ).sort(compareCalendarQueuePreviewItems),
    [payload.viewContext.adAccountName, payload.viewContext.platformName]
  );
  const calendarPreviewCounts = useMemo(
    () => ({
      total: calendarPreviewItems.length,
      ready: calendarPreviewItems.filter((item) => item.status === 'ready').length,
      approved: calendarPreviewItems.filter((item) => item.status === 'approved').length,
      draft: calendarPreviewItems.filter((item) => item.status === 'draft').length,
    }),
    [calendarPreviewItems]
  );
  const calendarPreviewTodayKey = useMemo(
    () => toCalendarIsoDay(new Date()),
    []
  );
  const calendarPreviewWeekStart = useMemo(
    () => startOfCalendarWeek(calendarPreviewCursor),
    [calendarPreviewCursor]
  );
  const calendarPreviewWeekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addCalendarDays(calendarPreviewWeekStart, index)),
    [calendarPreviewWeekStart]
  );
  const calendarPreviewWeekKeys = useMemo(
    () => calendarPreviewWeekDays.map((day) => toCalendarIsoDay(day)),
    [calendarPreviewWeekDays]
  );
  const calendarPreviewMonthStart = useMemo(
    () => startOfCalendarMonth(calendarPreviewCursor),
    [calendarPreviewCursor]
  );
  const reviveDismissKey = payload.reviveOpportunity
    ? `revive-prompt:${payload.reviveOpportunity.adAccountId}:${payload.reviveOpportunity.sourceAssessmentDigestHash}`
    : null;
  const syncCoverage = payload.syncCoverage;

  useEffect(() => {
    if (!payload.reviveOpportunity || !reviveDismissKey) {
      setReviveModalOpened(false);
      setRevivePromptDismissed(false);
      return;
    }

    try {
      const isDismissed = window.localStorage.getItem(reviveDismissKey) === '1';
      setRevivePromptDismissed(isDismissed);
      setReviveModalOpened(!isDismissed);
    } catch {
      setRevivePromptDismissed(false);
      setReviveModalOpened(true);
    }
  }, [payload.reviveOpportunity, reviveDismissKey]);

  const dismissReviveModal = () => {
    if (reviveDismissKey) {
      try {
        window.localStorage.setItem(reviveDismissKey, '1');
      } catch {
        // Ignore localStorage failures and keep the session moving.
      }
    }

    setRevivePromptDismissed(true);
    setReviveModalOpened(false);
  };
  const calendarPreviewMonthGridStart = useMemo(
    () => startOfCalendarWeek(calendarPreviewMonthStart),
    [calendarPreviewMonthStart]
  );
  const calendarPreviewMonthDays = useMemo(
    () => Array.from({ length: 35 }, (_, index) => addCalendarDays(calendarPreviewMonthGridStart, index)),
    [calendarPreviewMonthGridStart]
  );
  const calendarPreviewMonthKeys = useMemo(
    () => calendarPreviewMonthDays.map((day) => toCalendarIsoDay(day)),
    [calendarPreviewMonthDays]
  );
  const calendarPreviewWeekItemsByDay = useMemo(() => {
    const grouped = new Map<string, CalendarQueuePreviewItem[]>(
      calendarPreviewWeekKeys.map((day) => [day, []])
    );

    calendarPreviewItems.forEach((item) => {
      const bucket = grouped.get(item.day);

      if (bucket) {
        bucket.push(item);
      }
    });

    grouped.forEach((items) => items.sort(compareCalendarQueuePreviewItems));
    return grouped;
  }, [calendarPreviewItems, calendarPreviewWeekKeys]);
  const calendarPreviewMonthItemsByDay = useMemo(() => {
    const grouped = new Map<string, CalendarQueuePreviewItem[]>(
      calendarPreviewMonthKeys.map((day) => [day, []])
    );

    calendarPreviewItems.forEach((item) => {
      const bucket = grouped.get(item.day);

      if (bucket) {
        bucket.push(item);
      }
    });

    grouped.forEach((items) => items.sort(compareCalendarQueuePreviewItems));
    return grouped;
  }, [calendarPreviewItems, calendarPreviewMonthKeys]);
  const calendarPreviewLabel = useMemo(
    () =>
      calendarPreviewView === 'weekly'
        ? formatCalendarWeekLabel(calendarPreviewWeekDays)
        : formatCalendarMonthLabel(calendarPreviewMonthStart),
    [calendarPreviewMonthStart, calendarPreviewView, calendarPreviewWeekDays]
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

  function shiftCalendarPreview(direction: -1 | 1) {
    setCalendarPreviewCursor((current) =>
      calendarPreviewView === 'weekly'
        ? addCalendarDays(current, direction * 7)
        : addCalendarMonths(current, direction)
    );
  }

  return (
    <Container fluid px={6} py={0} className={`${classes.page} dashboard-page-shell`}>
      <Stack gap="md" className={classes.shell}>
        <Card withBorder radius="xl" p={{ base: 'md', md: 'lg' }} className={classes.topBar}>
          <Group justify="space-between" align="flex-start" gap="md" wrap="wrap">
            <div>
              <Group gap="xs" wrap="wrap">
                <Badge variant="light" className="app-platform-page-badge">
                  Dashboard
                </Badge>
                <Badge color={statusColor(payload.viewContext.platformStatus)} variant="light">
                  {payload.viewContext.platformName ?? 'Demo platform'}
                </Badge>
                <Badge color={statusColor(payload.viewContext.adAccountStatus)} variant="outline">
                  {payload.viewContext.adAccountName ?? 'DeepVisor Demo Account'}
                </Badge>
                {!hasLiveSummarySignal || payload.campaignPreview.length === 0 ? (
                  <Badge color="cyan" variant="outline">
                    Static preview data
                  </Badge>
                ) : null}
              </Group>
              <Title order={2} mt="xs" className={classes.title}>
                Account intelligence dashboard
              </Title>
              <Text size="sm" c="dimmed" mt={4} maw={760}>
                {operatingBrief}
              </Text>
            </div>

            <Group gap="sm" wrap="wrap">
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
              <Button
                onClick={handleRefresh}
                leftSection={<IconRefresh size={16} />}
                loading={refreshing}
                disabled={!payload.viewContext.canRefresh}
                radius="xl"
                className="app-platform-page-action-primary"
              >
                Refresh
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
                href="/calendar"
                radius="xl"
                variant="default"
                className="app-platform-page-action-secondary"
              >
                Calendar
              </Button>
            </Group>
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

        {syncCoverage?.historicalAnalysisPending ? (
          <Alert
            color={syncCoverage.backfillStatus === 'failed' ? 'red' : 'blue'}
            radius="lg"
            icon={<IconSparkles size={16} />}
            title={
              syncCoverage.backfillStatus === 'failed'
                ? 'Full Meta history backfill needs attention'
                : 'Recent data is ready while full history continues'
            }
          >
            <Text size="sm">
              {syncCoverage.coverageStartDate && syncCoverage.coverageEndDate
                ? `Dashboard cards are using synced data from ${syncCoverage.coverageStartDate} through ${syncCoverage.coverageEndDate}.`
                : 'The recent seed sync is available now and the full account history is still processing.'}
            </Text>
            <Text size="sm" mt="sm">
              {syncCoverage.backfillStatus === 'failed'
                ? 'Retry the background backfill job before treating historical reads as complete lifetime context.'
                : 'DeepVisor will keep expanding the history window in the background before it promotes lifetime guidance as complete.'}
            </Text>
          </Alert>
        ) : null}

        {payload.reviveOpportunity && !revivePromptDismissed ? (
          <ReviveCampaignPrompt
            opportunity={payload.reviveOpportunity}
            variant="card"
            onDismiss={dismissReviveModal}
          />
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

        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
          {summaryCards.map((card) => {
            const comparison = comparisonText(card, activeWindow);
            const Icon = cardIcon(card.key);
            const deltaClass =
              card.changePercent == null
                ? classes.deltaNeutral
                : card.changePercent >= 0
                  ? classes.deltaPositive
                  : classes.deltaNegative;

            return (
              <Paper key={card.key} withBorder radius="xl" p="md" className={classes.metricCard}>
                <Group justify="space-between" align="flex-start" gap="md" wrap="nowrap">
                  <div>
                    <Text size="xs" c="dimmed" tt="uppercase" fw={800}>
                      {card.label}
                    </Text>
                    <Text fw={900} size="1.75rem" mt={8} className={classes.metricValue}>
                      {formatCardValue(card, payload.viewContext.currencyCode)}
                    </Text>
                  </div>
                  <ThemeIcon variant="light" color="blue" radius="md">
                    <Icon size={18} />
                  </ThemeIcon>
                </Group>
                <span className={`${classes.deltaPill} ${deltaClass}`}>
                  {card.changePercent == null ? (
                    <IconClock size={13} />
                  ) : card.changePercent >= 0 ? (
                    <IconArrowUpRight size={13} />
                  ) : (
                    <IconArrowDownRight size={13} />
                  )}
                  {comparison.label}
                </span>
              </Paper>
            );
          })}
        </SimpleGrid>

        <Grid gutter="md" align="stretch">
          <Grid.Col span={{ base: 12, xl: 8 }}>
            <Card withBorder radius="xl" p="lg" h="100%" className={classes.panel}>
              <Group justify="space-between" align="flex-start" gap="md" wrap="wrap" className={classes.sectionHeader}>
                <div>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={800}>
                    Performance
                  </Text>
                  <Title order={3}>{trend.outcomeLabel} and spend trend</Title>
                  <Text size="sm" c="dimmed" mt={4}>
                    Fast account pulse for {windowLabel(activeWindow)}.
                  </Text>
                </div>
                <Group gap="xs" wrap="wrap">
                  <Badge variant="light" color="gray" radius="sm">
                    {windowLabel(activeWindow)}
                  </Badge>
                  <Badge variant="light" color="gray" radius="sm">
                    {formatRelativeSync(payload.viewContext.lastSyncedAt)}
                  </Badge>
                </Group>
              </Group>

              {trendData.length > 0 ? (
                <div className={classes.softPanel}>
                  <LineChart
                    h={320}
                    data={trendData}
                    dataKey="label"
                    series={[
                      { name: trend.outcomeLabel, color: 'blue.6' },
                      { name: 'Spend', color: 'teal.6' },
                    ]}
                    curveType="linear"
                    withLegend
                    valueFormatter={(value) => value.toLocaleString()}
                  />
                </div>
              ) : (
                <Stack justify="center" align="center" h={320} gap="xs">
                  <Text fw={700}>No trend data yet</Text>
                  <Text size="sm" c="dimmed" ta="center" maw={360}>
                    Once the selected account has recent synced metrics, this trend becomes the
                    quickest way to see whether performance is strengthening or flattening out.
                  </Text>
                </Stack>
              )}
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 12, xl: 4 }}>
            <Card withBorder radius="xl" p="lg" h="100%" className={classes.panel}>
              <Stack gap="sm" h="100%">
                <Group justify="space-between" align="flex-start" className={classes.sectionHeader}>
                  <div>
                    <Text size="xs" c="dimmed" tt="uppercase" fw={800}>
                      DeepVisor read
                    </Text>
                    <Title order={3}>What needs attention</Title>
                  </div>
                  <ThemeIcon color="blue" variant="light" radius="md">
                    <IconSparkles size={18} />
                  </ThemeIcon>
                </Group>

                {readFirstItems.map((item) => (
                  <div key={item.title} className={classes.insightCard}>
                    <Group gap="sm" align="flex-start" wrap="nowrap">
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
                        <Text fw={800} size="sm">
                          {item.title}
                        </Text>
                        <Text size="sm" c="dimmed" mt={4}>
                          {item.detail}
                        </Text>
                      </div>
                    </Group>
                  </div>
                ))}

                <div className={classes.insightCard}>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={800}>
                    Data status
                  </Text>
                  <Text fw={800} mt={6}>
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
                </div>
              </Stack>
            </Card>
          </Grid.Col>
        </Grid>

        <Grid gutter="md" align="stretch">
          <Grid.Col span={{ base: 12, xl: 7 }}>
            <Card withBorder radius="xl" p="lg" h="100%" className={classes.panel}>
              <Group justify="space-between" align="flex-start" gap="md" wrap="wrap" className={classes.sectionHeader}>
                <div>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={800}>
                    Campaign movers
                  </Text>
                  <Title order={3}>Strong, soft, and worth scanning</Title>
                  <Text size="sm" c="dimmed" mt={4}>
                    Real campaign data appears here first. Static examples keep the dashboard useful during setup.
                  </Text>
                </div>
                <Group gap="xs" wrap="wrap">
                  <Badge color="gray" variant="light" radius="sm">
                    {campaignPreview.length} shown
                  </Badge>
                  {payload.campaignPreview.length === 0 ? (
                    <Badge color="cyan" variant="outline" radius="sm">
                      Static examples
                    </Badge>
                  ) : null}
                </Group>
              </Group>

              <Stack gap="sm">
                {campaignPreview.map((campaign) => (
                  <div key={campaign.campaignId} className={classes.campaignRow}>
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
                              Strongest
                            </Badge>
                          ) : null}
                          {campaign.campaignId === watchCampaign?.campaignId ? (
                            <Badge color="orange" variant="light">
                              Watch
                            </Badge>
                          ) : null}
                        </Group>
                        <Text fw={800}>{campaign.campaignName}</Text>
                        <Text size="sm" c="dimmed" mt={6}>
                          {campaignMetricSummary(campaign, payload.viewContext.currencyCode)}
                        </Text>
                      </div>

                      <Group gap="xl" wrap="wrap">
                        <div>
                          <Text size="xs" c="dimmed" tt="uppercase" fw={800}>
                            Spend
                          </Text>
                          <Text fw={800}>
                            {formatCurrency(campaign.spend, payload.viewContext.currencyCode)}
                          </Text>
                        </div>
                        <div>
                          <Text size="xs" c="dimmed" tt="uppercase" fw={800}>
                            {campaign.primaryOutcomeLabel}
                          </Text>
                          <Text fw={800}>{formatNumber(campaign.primaryOutcomeValue)}</Text>
                        </div>
                        <div>
                          <Text size="xs" c="dimmed" tt="uppercase" fw={800}>
                            Support
                          </Text>
                          <Text fw={800}>
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
                  </div>
                ))}
              </Stack>
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 12, xl: 5 }}>
            <Card withBorder radius="xl" p="lg" h="100%" className={`${classes.panel} ${classes.calendarPanel}`}>
              <Group justify="space-between" align="flex-start" gap="md" wrap="wrap" className={classes.sectionHeader}>
                <div>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={800}>
                    Calendar preview
                  </Text>
                  <Title order={3} mt={4}>
                    Queue this week
                  </Title>
                  <Text size="sm" c="dimmed" mt={4}>
                    Quick look at what DeepVisor wants to approve, modify, or schedule.
                  </Text>
                </div>
                <Badge color="gray" variant="light" radius="sm">
                  {calendarPreviewCounts.total} queued
                </Badge>
              </Group>

              <SimpleGrid cols={3} spacing="xs" mb="md">
                <Paper withBorder radius="md" p="sm">
                  <Text size="10px" c="dimmed" tt="uppercase" fw={700}>
                    Needs approval
                  </Text>
                  <Text fw={800} mt={4}>
                    {calendarPreviewCounts.ready}
                  </Text>
                </Paper>
                <Paper withBorder radius="md" p="sm">
                  <Text size="10px" c="dimmed" tt="uppercase" fw={700}>
                    Drafts
                  </Text>
                  <Text fw={800} mt={4}>
                    {calendarPreviewCounts.draft}
                  </Text>
                </Paper>
                <Paper withBorder radius="md" p="sm">
                  <Text size="10px" c="dimmed" tt="uppercase" fw={700}>
                    Approved
                  </Text>
                  <Text fw={800} mt={4}>
                    {calendarPreviewCounts.approved}
                  </Text>
                </Paper>
              </SimpleGrid>

              <Paper withBorder radius="lg" p="md">
                <Group justify="space-between" align="center" mb="md" wrap="wrap" gap="sm">
                  <SegmentedControl
                    size="xs"
                    radius="xl"
                    value={calendarPreviewView}
                    onChange={(value) => setCalendarPreviewView(value as 'weekly' | 'monthly')}
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
                      onClick={() => shiftCalendarPreview(-1)}
                      aria-label="Previous calendar preview period"
                    >
                      <IconChevronLeft size={16} />
                    </ActionIcon>
                    <Text size="sm" fw={700} miw={132} ta="center">
                      {calendarPreviewLabel}
                    </Text>
                    <ActionIcon
                      variant="light"
                      color="gray"
                      radius="xl"
                      onClick={() => shiftCalendarPreview(1)}
                      aria-label="Next calendar preview period"
                    >
                      <IconChevronRight size={16} />
                    </ActionIcon>
                  </Group>
                </Group>

                {calendarPreviewView === 'weekly' ? (
                  <CalendarWeekPreview
                    days={calendarPreviewWeekDays}
                    itemsByDay={calendarPreviewWeekItemsByDay}
                    todayKey={calendarPreviewTodayKey}
                  />
                ) : (
                  <CalendarMonthPreview
                    monthStart={calendarPreviewMonthStart}
                    days={calendarPreviewMonthDays}
                    itemsByDay={calendarPreviewMonthItemsByDay}
                    todayKey={calendarPreviewTodayKey}
                  />
                )}
              </Paper>

              <Group justify="space-between" align="center" mt="md" gap="sm" wrap="wrap">
                <Text size="sm" c="dimmed" maw={260}>
                  Open the full Calendar view to approve, modify, or schedule what is queued here.
                </Text>
                <Group gap="sm" wrap="wrap">
                  <Button
                    component={Link}
                    href="/calendar"
                    radius="xl"
                    rightSection={<IconArrowUpRight size={14} />}
                    className="app-platform-page-action-primary"
                  >
                    Open calendar
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

        <Grid gutter="md" align="stretch">
          <Grid.Col span={{ base: 12, xl: 4 }}>
            <Card withBorder radius="xl" p="lg" h="100%" className={classes.panel}>
              <Group justify="space-between" align="flex-start" className={classes.sectionHeader}>
                <div>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={800}>
                    Recommended actions
                  </Text>
                  <Title order={3}>Next best moves</Title>
                </div>
                <ThemeIcon color="yellow" variant="light" radius="md">
                  <IconBulb size={18} />
                </ThemeIcon>
              </Group>
              <Stack gap="sm">
                {STATIC_OPERATING_ACTIONS.map((action) => (
                  <div key={action.title} className={classes.actionRow}>
                    <Group justify="space-between" align="flex-start" gap="sm" wrap="nowrap">
                      <div>
                        <Text fw={800}>{action.title}</Text>
                        <Text size="sm" c="dimmed" mt={4}>
                          {action.detail}
                        </Text>
                      </div>
                      <Badge color={alertToneColor(action.tone)} variant="light" radius="sm">
                        {action.owner}
                      </Badge>
                    </Group>
                  </div>
                ))}
              </Stack>
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 12, xl: 4 }}>
            <Card withBorder radius="xl" p="lg" h="100%" className={classes.panel}>
              <Group justify="space-between" align="flex-start" className={classes.sectionHeader}>
                <div>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={800}>
                    Reports
                  </Text>
                  <Title order={3}>Briefs worth opening</Title>
                </div>
                <ThemeIcon color="blue" variant="light" radius="md">
                  <IconFileAnalytics size={18} />
                </ThemeIcon>
              </Group>
              <Stack gap="sm">
                {STATIC_REPORT_DIGEST.map((report) => (
                  <Link key={report.title} href={report.href} style={{ color: 'inherit', textDecoration: 'none' }}>
                    <div className={classes.reportRow}>
                      <Group justify="space-between" align="flex-start" gap="md" wrap="nowrap">
                        <div>
                          <Text fw={800}>{report.title}</Text>
                          <Text size="sm" c="dimmed" mt={4}>
                            {report.detail}
                          </Text>
                        </div>
                        <Badge color="blue" variant="light" radius="sm">
                          {report.badge}
                        </Badge>
                      </Group>
                    </div>
                  </Link>
                ))}
              </Stack>
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 12, xl: 4 }}>
            <Card withBorder radius="xl" p="lg" h="100%" className={classes.panel}>
              <Group justify="space-between" align="flex-start" className={classes.sectionHeader}>
                <div>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={800}>
                    Data health
                  </Text>
                  <Title order={3}>Platform readiness</Title>
                </div>
                <ThemeIcon color="green" variant="light" radius="md">
                  <IconTargetArrow size={18} />
                </ThemeIcon>
              </Group>
              <Stack gap="sm">
                {STATIC_PLATFORM_HEALTH.map((item) => (
                  <div key={item.label} className={classes.healthRow}>
                    <Group justify="space-between" align="center" gap="md">
                      <Text fw={800}>{item.label}</Text>
                      <Badge color={item.color} variant="light" radius="sm">
                        {item.value}
                      </Badge>
                    </Group>
                  </div>
                ))}
              </Stack>
              <Button
                component={Link}
                href="/integration"
                radius="xl"
                variant="default"
                mt="md"
                className="app-platform-page-action-secondary"
              >
                Manage integrations
              </Button>
            </Card>
          </Grid.Col>
        </Grid>
      </Stack>

      {payload.reviveOpportunity && !revivePromptDismissed ? (
        <ReviveCampaignPrompt
          opportunity={payload.reviveOpportunity}
          variant="modal"
          opened={reviveModalOpened}
          onDismiss={dismissReviveModal}
        />
      ) : null}
    </Container>
  );
}
