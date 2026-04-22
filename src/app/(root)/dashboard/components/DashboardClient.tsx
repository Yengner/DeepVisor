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
  IconChevronLeft,
  IconChevronRight,
  IconClock,
  IconCurrencyDollar,
  IconLink,
  IconMessageCircle,
  IconRefresh,
  IconSparkles,
  IconTargetArrow,
  IconUsers,
} from '@tabler/icons-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import {
  buildCalendarQueuePreviewItems,
  compareCalendarQueuePreviewItems,
  formatRetryDelay,
  type CalendarQueuePreviewItem,
  type CalendarQueueStatus,
} from '@/lib/shared';
import type {
  DashboardActivityEntityItem,
  DashboardActivityRail,
  DashboardAttentionSignal,
  DashboardAlert,
  DashboardCampaignPreviewItem,
  DashboardPayload,
  DashboardState,
  DashboardSummaryCard,
  DashboardWindow,
} from '../types';
import classes from './DashboardClient.module.css';

type DashboardClientProps = {
  payload: DashboardPayload;
};

type DashboardReadItem = {
  id: string;
  title: string;
  detail: string;
  tone: DashboardAlert['tone'];
  primaryAction?: {
    label: string;
    href: string;
  };
  secondaryAction?: {
    label: string;
    href: string;
  };
};

type StaticQualityTrendPoint = {
  label: string;
  ctr: number;
  cpc: number;
};

type StaticQualityTrend = {
  title: string;
  description: string;
  points: StaticQualityTrendPoint[];
};

const numberFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
});

const CALENDAR_WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const STATIC_SUMMARY_BY_WINDOW: Record<DashboardWindow, DashboardSummaryCard[]> = {
  this_week: [
    { key: 'spend', label: 'Spend', value: 980, previousValue: 860, changePercent: 14 },
    { key: 'results', label: 'Results', value: 56, previousValue: 47, changePercent: 19.1 },
    { key: 'leads', label: 'Leads', value: 34, previousValue: 26, changePercent: 30.8 },
    { key: 'link_clicks', label: 'Link clicks', value: 508, previousValue: 446, changePercent: 13.9 },
  ],
  last_week: [
    { key: 'spend', label: 'Spend', value: 1760, previousValue: 1640, changePercent: 7.3 },
    { key: 'results', label: 'Results', value: 98, previousValue: 91, changePercent: 7.7 },
    { key: 'leads', label: 'Leads', value: 58, previousValue: 51, changePercent: 13.7 },
    { key: 'link_clicks', label: 'Link clicks', value: 934, previousValue: 878, changePercent: 6.4 },
  ],
  last_7d: [
    { key: 'spend', label: 'Spend', value: 1840, previousValue: 1620, changePercent: 13.6 },
    { key: 'results', label: 'Results', value: 104, previousValue: 93, changePercent: 11.8 },
    { key: 'leads', label: 'Leads', value: 63, previousValue: 48, changePercent: 31.3 },
    { key: 'link_clicks', label: 'Link clicks', value: 982, previousValue: 864, changePercent: 13.7 },
  ],
  last_30d: [
    { key: 'spend', label: 'Spend', value: 7420, previousValue: 6810, changePercent: 9 },
    { key: 'results', label: 'Results', value: 421, previousValue: 365, changePercent: 15.3 },
    { key: 'leads', label: 'Leads', value: 248, previousValue: 214, changePercent: 15.9 },
    { key: 'link_clicks', label: 'Link clicks', value: 4210, previousValue: 3824, changePercent: 10.1 },
  ],
  this_month: [
    { key: 'spend', label: 'Spend', value: 5180, previousValue: 4630, changePercent: 11.9 },
    { key: 'results', label: 'Results', value: 302, previousValue: 258, changePercent: 17.1 },
    { key: 'leads', label: 'Leads', value: 176, previousValue: 149, changePercent: 18.1 },
    { key: 'link_clicks', label: 'Link clicks', value: 2910, previousValue: 2604, changePercent: 11.8 },
  ],
};

const STATIC_QUALITY_TREND_BY_WINDOW: Record<DashboardWindow, StaticQualityTrend> = {
  this_week: {
    title: 'Traffic quality and click cost',
    description:
      'Static preview for now. CTR and cost per click read much more clearly here for a mixed account view.',
    points: [
      { label: 'Apr 20', ctr: 2.31, cpc: 0.84 },
      { label: 'Apr 21', ctr: 2.44, cpc: 0.79 },
      { label: 'Apr 22', ctr: 2.58, cpc: 0.73 },
      { label: 'Apr 23', ctr: 2.67, cpc: 0.68 },
    ],
  },
  last_week: {
    title: 'Traffic quality and click cost',
    description:
      'Static preview for now. CTR and cost per click read much more clearly here for a mixed account view.',
    points: [
      { label: 'Apr 13', ctr: 2.02, cpc: 0.98 },
      { label: 'Apr 14', ctr: 2.12, cpc: 0.93 },
      { label: 'Apr 15', ctr: 2.08, cpc: 0.96 },
      { label: 'Apr 16', ctr: 2.26, cpc: 0.89 },
      { label: 'Apr 17', ctr: 2.38, cpc: 0.82 },
      { label: 'Apr 18', ctr: 2.42, cpc: 0.80 },
      { label: 'Apr 19', ctr: 2.29, cpc: 0.85 },
    ],
  },
  last_7d: {
    title: 'Traffic quality and click cost',
    description:
      'Static preview for now. CTR and cost per click read much more clearly here for a mixed account view.',
    points: [
      { label: 'Apr 4', ctr: 2.18, cpc: 0.94 },
      { label: 'Apr 5', ctr: 2.27, cpc: 0.90 },
      { label: 'Apr 6', ctr: 2.24, cpc: 0.92 },
      { label: 'Apr 7', ctr: 2.48, cpc: 0.83 },
      { label: 'Apr 8', ctr: 2.57, cpc: 0.77 },
      { label: 'Apr 9', ctr: 2.71, cpc: 0.71 },
      { label: 'Apr 10', ctr: 2.63, cpc: 0.74 },
    ],
  },
  last_30d: {
    title: 'Traffic quality and click cost',
    description:
      'Static preview for now. CTR and cost per click read much more clearly here for a mixed account view.',
    points: [
      { label: 'Mar 11', ctr: 1.84, cpc: 1.14 },
      { label: 'Mar 18', ctr: 2.03, cpc: 1.02 },
      { label: 'Mar 25', ctr: 2.19, cpc: 0.94 },
      { label: 'Apr 1', ctr: 2.34, cpc: 0.86 },
      { label: 'Apr 8', ctr: 2.52, cpc: 0.78 },
    ],
  },
  this_month: {
    title: 'Traffic quality and click cost',
    description:
      'Static preview for now. CTR and cost per click read much more clearly here for a mixed account view.',
    points: [
      { label: 'Apr 1', ctr: 2.06, cpc: 1.00 },
      { label: 'Apr 5', ctr: 2.18, cpc: 0.95 },
      { label: 'Apr 9', ctr: 2.29, cpc: 0.89 },
      { label: 'Apr 13', ctr: 2.41, cpc: 0.83 },
      { label: 'Apr 17', ctr: 2.56, cpc: 0.76 },
      { label: 'Apr 21', ctr: 2.69, cpc: 0.70 },
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
    primaryOutcomeMetric: 'results',
    primaryOutcomeLabel: 'Results',
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
    primaryOutcomeMetric: 'results',
    primaryOutcomeLabel: 'Results',
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

function formatRate(value: number): string {
  return `${value.toFixed(2)}%`;
}

function formatTrendValue(value: number, currencyCode: string | null): string {
  if (value <= 1.5) {
    return formatCurrency(value, currencyCode, 2);
  }

  return formatRate(value);
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

function windowOptionLabel(window: DashboardWindow): string {
  switch (window) {
    case 'this_week':
      return 'This week';
    case 'last_week':
      return 'Last week';
    case 'last_30d':
      return 'Last 30D';
    case 'this_month':
      return 'This month';
    default:
      return 'Last 7 days';
  }
}

function windowLabel(window: DashboardWindow): string {
  switch (window) {
    case 'this_week':
      return 'this week';
    case 'last_week':
      return 'last week';
    case 'last_30d':
      return 'last 30 days';
    case 'this_month':
      return 'this month';
    default:
      return 'last 7 days';
  }
}

function previousWindowLabel(window: DashboardWindow): string {
  switch (window) {
    case 'this_week':
    case 'this_month':
      return 'previous comparable period';
    case 'last_week':
      return 'week before';
    case 'last_30d':
      return 'previous 30 days';
    default:
      return 'previous 7 days';
  }
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
    case 'results':
      return IconTargetArrow;
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
    cards.find((card) => card.key === 'results' && card.value > 0) ||
    cards.find((card) => card.key === 'leads' && card.value > 0) ||
    cards.find((card) => card.key === 'messages' && card.value > 0) ||
    cards.find((card) => card.key === 'link_clicks' && card.value > 0) ||
    cards.find((card) => card.key === 'results') ||
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

function formatQueueDayLabel(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function queueStatusLabel(status: CalendarQueueStatus): string {
  switch (status) {
    case 'approved':
      return 'Approved';
    case 'ready':
      return 'Needs approval';
    default:
      return 'Draft';
  }
}

function queueFollowUpCount(item: CalendarQueuePreviewItem): number {
  return item.children?.length ?? item.childBlueprints?.length ?? 0;
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

function hasLiveDelivery(activityRail: DashboardActivityRail): boolean {
  return (
    activityRail.tests.length > 0 ||
    activityRail.campaigns.length > 0 ||
    activityRail.adsets.length > 0 ||
    activityRail.ads.length > 0
  );
}

function buildCreateAdHref(input: {
  strongestCampaign: DashboardCampaignPreviewItem | null;
  activityRail: DashboardActivityRail;
}): string {
  const campaignId =
    input.strongestCampaign?.campaignId ?? input.activityRail.campaigns[0]?.id ?? null;
  const adSetId = input.activityRail.adsets[0]?.id ?? null;

  if (campaignId && adSetId) {
    return `/campaigns/create?scope=ad&campaign_id=${encodeURIComponent(campaignId)}&adset_id=${encodeURIComponent(adSetId)}`;
  }

  if (campaignId) {
    return `/campaigns/create?scope=ad&campaign_id=${encodeURIComponent(campaignId)}`;
  }

  return '/campaigns/create?scope=ad';
}

function buildReadFirstItems(input: {
  payload: DashboardPayload;
  activityRail: DashboardActivityRail;
  strongestCampaign: DashboardCampaignPreviewItem | null;
  watchCampaign: DashboardCampaignPreviewItem | null;
  featuredQueueItem: CalendarQueuePreviewItem | null;
}): DashboardReadItem[] {
  if (input.payload.state !== 'ready') {
    return [
      {
        id: 'connect-account',
        title: stateContent(input.payload.state).title,
        detail:
          'DeepVisor should eventually tell the owner exactly what to schedule next or what to launch next. Connect and select one ad account first so this panel can behave like an operator, not a placeholder.',
        tone: 'blue',
        primaryAction: {
          label: 'Manage integrations',
          href: '/integration',
        },
      },
    ];
  }

  const createAdHref = buildCreateAdHref({
    strongestCampaign: input.strongestCampaign,
    activityRail: input.activityRail,
  });
  const calendarHref = '/calendar';
  const strongestName = input.strongestCampaign?.campaignName ?? 'the favored historical campaign';
  const watchName = input.watchCampaign?.campaignName ?? 'the weaker current campaign';
  const queueTone =
    input.featuredQueueItem?.status === 'approved'
      ? 'teal'
      : input.featuredQueueItem?.status === 'ready'
        ? 'yellow'
        : 'blue';
  const queueScheduleText = input.featuredQueueItem
    ? ` Scheduled ${formatQueueDayLabel(input.featuredQueueItem.day)} · ${input.featuredQueueItem.time}.`
    : '';

  if (!hasLiveDelivery(input.activityRail)) {
    return [
      {
        id: input.featuredQueueItem?.id ?? 'no-live-delivery',
        title: input.featuredQueueItem?.title ?? 'Put the favored campaign back live',
        detail:
          input.featuredQueueItem?.description
            ? `${input.featuredQueueItem.description} Use ${strongestName} as the relaunch base, put that favored campaign back live from the calendar, and either reuse the old winning creative or add one new creative into the same ad set.${queueScheduleText}`
            : `There is nothing live to compare right now. Put ${strongestName} back on the calendar as the favored relaunch, and either reuse the old winning creative or add one fresh creative inside the same ad set.${queueScheduleText}`,
        tone: queueTone,
        primaryAction: {
          label: 'Open calendar',
          href: calendarHref,
        },
        secondaryAction: {
          label: 'Create ad',
          href: createAdHref,
        },
      },
      {
        id: 'queue-report-followup',
        title: 'Add the report follow-up',
        detail:
          'Add a report check 3 to 7 days after the relaunch so the campaign is judged on CTR and CPC against the prior winner instead of on spend alone.',
        tone: 'blue',
        primaryAction: {
          label: 'Open calendar',
          href: calendarHref,
        },
      },
    ];
  }

  const strongestSummary = input.strongestCampaign
    ? campaignMetricSummary(
        input.strongestCampaign,
        input.payload.viewContext.currencyCode
      )
    : 'the cleanest current CTR and CPC signal';

  return [
    {
      id: input.featuredQueueItem?.id ?? 'launch-into-winner',
      title: input.featuredQueueItem?.title ?? 'Use the current winner as the control',
      detail: input.featuredQueueItem?.description
        ? `${input.featuredQueueItem.description} ${strongestName} is the favored benchmark right now with ${strongestSummary}. Put that winner on the calendar, then either add one new creative inside the same ad set or reuse the old winner if it still matches the offer.${queueScheduleText}`
        : `${strongestName} is the favored benchmark right now with ${strongestSummary}. Put that winner on the calendar, then either add one new creative inside the same ad set or reuse the old winning creative if it still matches the offer.${queueScheduleText}`,
      tone: queueTone,
      primaryAction: {
        label: 'Open calendar',
        href: calendarHref,
      },
      secondaryAction: {
        label: 'Create ad',
        href: createAdHref,
      },
    },
    {
      id: 'schedule-compare-report',
      title: 'Add the compare-back report',
      detail: `Schedule a short review comparing ${watchName} against ${strongestName}. The goal is to decide whether the new ad is actually beating the current baseline on CTR and CPC before budgets move.`,
      tone: 'blue',
      primaryAction: {
        label: 'Open calendar',
        href: calendarHref,
      },
    },
  ];
}

function signalSeverityTone(
  severity: DashboardAttentionSignal['severity']
): DashboardAlert['tone'] {
  switch (severity) {
    case 'critical':
      return 'red';
    case 'warning':
      return 'yellow';
    default:
      return 'blue';
  }
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

function activityLevelLabel(level: DashboardActivityEntityItem['level']): string {
  switch (level) {
    case 'campaign':
      return 'Campaign';
    case 'adset':
      return 'Ad set';
    default:
      return 'Ad';
  }
}

function activitySectionLabel(key: keyof DashboardActivityRail): string {
  switch (key) {
    case 'tests':
      return 'Tests currently live';
    case 'campaigns':
      return 'Active campaigns';
    case 'adsets':
      return 'Active ad sets';
    default:
      return 'Active ads';
  }
}

function activitySupportLabel(item: DashboardActivityEntityItem): string {
  return item.results > 0 ? 'Cost / result' : 'CTR';
}

function activitySupportValue(
  item: DashboardActivityEntityItem,
  currencyCode: string | null
): string {
  if (item.results > 0) {
    return formatCurrency(item.costPerResult, currencyCode, 2);
  }

  return `${item.ctr.toFixed(2)}%`;
}

function CalendarAgendaPreview({
  days,
  itemsByDay,
  todayKey,
  monthStart,
}: {
  days: Date[];
  itemsByDay: Map<string, CalendarQueuePreviewItem[]>;
  todayKey: string;
  monthStart?: Date;
}) {
  return (
    <Stack gap="sm" className={classes.calendarAgenda}>
      {days.map((day) => {
        const dayKey = toCalendarIsoDay(day);
        const items = itemsByDay.get(dayKey) ?? [];
        const visibleItems = items.slice(0, 3);
        const remainingCount = items.length - visibleItems.length;
        const isToday = dayKey === todayKey;
        const inCurrentMonth = monthStart ? isSameCalendarMonth(day, monthStart) : true;

        return (
          <Paper
            key={dayKey}
            withBorder
            radius="lg"
            p="sm"
            className={classes.calendarAgendaRow}
            style={{
              opacity: inCurrentMonth ? 1 : 0.5,
              background: isToday ? 'var(--platform-accent-soft)' : 'rgba(255,255,255,0.9)',
              borderColor: isToday ? 'var(--platform-border-strong)' : 'var(--platform-card-border)',
            }}
          >
            <div className={classes.calendarAgendaDate}>
              <Text size="10px" c="dimmed" tt="uppercase" fw={800}>
                {CALENDAR_WEEKDAY_LABELS[day.getDay()]}
              </Text>
              <Text fw={900} className={classes.calendarAgendaDateValue}>
                {day.getDate()}
              </Text>
              <Text size="10px" c="dimmed">
                {day.toLocaleDateString('en-US', { month: 'short' })}
              </Text>
            </div>

            <div className={classes.calendarAgendaBody}>
              <Group justify="space-between" align="center" mb={visibleItems.length > 0 ? 6 : 0}>
                <Text size="sm" fw={700}>
                  {items.length > 0 ? `${items.length} queued` : 'Open'}
                </Text>
                {items.length > 0 ? (
                  <Badge size="xs" color="gray" variant="light">
                    {formatQueueDayLabel(dayKey)}
                  </Badge>
                ) : null}
              </Group>

              <Stack gap={6}>
                {visibleItems.length > 0 ? (
                  visibleItems.map((item) => (
                    <div key={item.id} className={classes.queueMiniRow}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Text size="sm" fw={700} lineClamp={2}>
                          {item.title}
                        </Text>
                        <Text size="xs" c="dimmed" mt={2}>
                          {item.time}
                          {queueFollowUpCount(item) > 0
                            ? ` · ${queueFollowUpCount(item)} follow-up item${queueFollowUpCount(item) === 1 ? '' : 's'}`
                            : ''}
                        </Text>
                      </div>
                      <Badge
                        color={calendarQueueStatusColor(item.status)}
                        variant="light"
                        radius="sm"
                      >
                        {queueStatusLabel(item.status)}
                      </Badge>
                    </div>
                  ))
                ) : (
                  <Text size="sm" c="dimmed">
                    No queued work on this day yet.
                  </Text>
                )}

                {remainingCount > 0 ? (
                  <Text size="xs" c="dimmed" fw={700}>
                    +{remainingCount} more queued
                  </Text>
                ) : null}
              </Stack>
            </div>
          </Paper>
        );
      })}
    </Stack>
  );
}

function ActivityRow({
  item,
  currencyCode,
}: {
  item: DashboardActivityEntityItem;
  currencyCode: string | null;
}) {
  return (
    <Paper withBorder radius="lg" p="md" className={classes.activityRow}>
      <Group justify="space-between" align="flex-start" gap="md" wrap="wrap">
        <div style={{ flex: 1, minWidth: 220 }}>
          <Group gap="xs" wrap="wrap" mb={6}>
            <Badge color={statusColor(item.status)} variant="light">
              {formatStatusLabel(item.status)}
            </Badge>
            <Badge color="gray" variant="outline">
              {activityLevelLabel(item.level)}
            </Badge>
          </Group>
          <Text fw={800}>{item.name}</Text>
          {item.primaryContext || item.secondaryContext ? (
            <Text size="sm" c="dimmed" mt={6}>
              {[item.primaryContext, item.secondaryContext].filter(Boolean).join(' · ')}
            </Text>
          ) : null}
        </div>

        <div className={classes.activityMetrics}>
          <div>
            <Text size="10px" c="dimmed" tt="uppercase" fw={800}>
              Spend
            </Text>
            <Text fw={800}>{formatCurrency(item.spend, currencyCode)}</Text>
          </div>
          <div>
            <Text size="10px" c="dimmed" tt="uppercase" fw={800}>
              Results
            </Text>
            <Text fw={800}>{formatNumber(item.results)}</Text>
          </div>
          <div>
            <Text size="10px" c="dimmed" tt="uppercase" fw={800}>
              {activitySupportLabel(item)}
            </Text>
            <Text fw={800}>{activitySupportValue(item, currencyCode)}</Text>
          </div>
        </div>
      </Group>
    </Paper>
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

  const stateMeta = stateContent(payload.state);
  const liveSummaryCards = payload.summaryByWindow[activeWindow];
  const hasLiveSummarySignal = liveSummaryCards.some(
    (card) => card.value > 0 || card.previousValue !== null
  );
  const summaryCards = hasLiveSummarySignal ? liveSummaryCards : STATIC_SUMMARY_BY_WINDOW[activeWindow];
  const trend = STATIC_QUALITY_TREND_BY_WINDOW[activeWindow];
  const campaignPreview =
    payload.campaignPreview.length > 0 ? payload.campaignPreview : STATIC_CAMPAIGN_PREVIEW;
  const activityRail = payload.activityByWindow[activeWindow];
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
    CTR: Number(point.ctr.toFixed(2)),
    CPC: Number(point.cpc.toFixed(2)),
  }));
  const latestTrendPoint = trend.points[trend.points.length - 1] ?? null;
  const calendarPreviewItems = useMemo(
    () => {
      if (payload.calendarQueuePreview.length > 0) {
        return [...payload.calendarQueuePreview].sort(compareCalendarQueuePreviewItems);
      }

      if (payload.state === 'ready') {
        return [];
      }

      return buildCalendarQueuePreviewItems(
        payload.viewContext.adAccountName ?? payload.viewContext.platformName
      ).sort(compareCalendarQueuePreviewItems);
    },
    [
      payload.calendarQueuePreview,
      payload.state,
      payload.viewContext.adAccountName,
      payload.viewContext.platformName,
    ]
  );
  const featuredQueueItem = useMemo(
    () =>
      calendarPreviewItems.find(
        (item) =>
          item.isParent ||
          Boolean(item.workflowKey) ||
          (item.childBlueprints?.length ?? 0) > 0 ||
          (item.children?.length ?? 0) > 0
      ) ??
      calendarPreviewItems[0] ??
      null,
    [calendarPreviewItems]
  );
  const readFirstItems = useMemo(
    () =>
      buildReadFirstItems({
        payload,
        activityRail,
        strongestCampaign,
        watchCampaign,
        featuredQueueItem,
      }),
    [payload, activityRail, strongestCampaign, watchCampaign, featuredQueueItem]
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
  const queuePriorityItems = useMemo(
    () =>
      (featuredQueueItem
        ? calendarPreviewItems.filter((item) => item.id !== featuredQueueItem.id)
        : calendarPreviewItems
      ).slice(0, 4),
    [calendarPreviewItems, featuredQueueItem]
  );
  const hasFeaturedQueueOnly =
    Boolean(featuredQueueItem) && calendarPreviewItems.length > 0 && queuePriorityItems.length === 0;
  const calendarPreviewTodayKey = useMemo(() => toCalendarIsoDay(new Date()), []);
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
  const syncCoverage = payload.syncCoverage;
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
  const hasLiveActivity =
    activityRail.tests.length > 0 ||
    activityRail.campaigns.length > 0 ||
    activityRail.adsets.length > 0 ||
    activityRail.ads.length > 0;

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
            color={syncCoverage.activeJobStatus === 'failed' ? 'red' : 'blue'}
            radius="lg"
            icon={<IconSparkles size={16} />}
            title={
              syncCoverage.activeJobStatus === 'failed'
                ? 'Meta history sync needs attention'
                : 'Recent data is ready while full history continues'
            }
          >
            <Text size="sm">
              {syncCoverage.coverageStartDate && syncCoverage.coverageEndDate
                ? `Dashboard cards are using synced data from ${syncCoverage.coverageStartDate} through ${syncCoverage.coverageEndDate}.`
                : 'DeepVisor is still filling the first historical sync for this account.'}
            </Text>
            <Text size="sm" mt="sm">
              {syncCoverage.activeJobStatus === 'failed'
                ? 'Retry the background sync job before treating historical reads as complete lifetime context.'
                : 'DeepVisor will keep expanding the history window in the background before it promotes lifetime guidance as complete.'}
            </Text>
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

        <Grid gutter="md" align="stretch">
          <Grid.Col span={{ base: 12, xl: 8 }}>
            <Card withBorder radius="xl" p="lg" h="100%" className={`${classes.panel} ${classes.performancePanel}`}>
              <Stack gap="lg">
                <Group
                  justify="space-between"
                  align="flex-start"
                  gap="md"
                  wrap="wrap"
                  className={classes.surfaceToolbar}
                >
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
                    <Text fw={900} size="1.65rem" mt="sm" className={classes.metricValue}>
                      {payload.viewContext.adAccountName ?? 'Selected ad account'}
                    </Text>
                    <Text size="sm" c="dimmed" mt={6} maw={760}>
                      Performance, queue, and live delivery for {windowLabel(activeWindow)}.
                    </Text>
                  </div>

                  <Group gap="sm" wrap="wrap">
                    <div className={classes.windowControlWrap}>
                      <SegmentedControl
                        size="xs"
                        radius="xl"
                        value={activeWindow}
                        onChange={(value) => setActiveWindow(value as DashboardWindow)}
                        data={payload.windowOptions.map((window) => ({
                          label: windowOptionLabel(window),
                          value: window,
                        }))}
                      />
                    </div>
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

                {trendData.length > 0 ? (
                  <div className={classes.softPanel}>
                    <Group justify="space-between" align="flex-start" mb="md" gap="sm" wrap="wrap">
                      <div>
                        <Text size="xs" c="dimmed" tt="uppercase" fw={800}>
                          {trend.title}
                        </Text>
                        <Text size="sm" c="dimmed" mt={6} maw={640}>
                          {trend.description}
                        </Text>
                      </div>
                      <Group gap="xs" wrap="wrap">
                        <Badge color="cyan" variant="outline" radius="sm">
                          Static chart
                        </Badge>
                        {latestTrendPoint ? (
                          <>
                            <Badge color="blue" variant="light" radius="sm">
                              CTR {formatRate(latestTrendPoint.ctr)}
                            </Badge>
                            <Badge color="teal" variant="light" radius="sm">
                              CPC {formatCurrency(latestTrendPoint.cpc, payload.viewContext.currencyCode, 2)}
                            </Badge>
                          </>
                        ) : null}
                      </Group>
                    </Group>
                    <LineChart
                      h={340}
                      data={trendData}
                      dataKey="label"
                      series={[
                        { name: 'CTR', color: 'blue.6' },
                        { name: 'CPC', color: 'teal.6' },
                      ]}
                      curveType="linear"
                      withLegend
                      valueFormatter={(value) => formatTrendValue(value, payload.viewContext.currencyCode)}
                    />
                  </div>
                ) : (
                  <Stack justify="center" align="center" h={340} gap="xs">
                    <Text fw={700}>No trend data yet</Text>
                    <Text size="sm" c="dimmed" ta="center" maw={360}>
                      Once the selected account has recent synced metrics, this trend becomes the
                      quickest way to see whether performance is strengthening or flattening out.
                    </Text>
                  </Stack>
                )}
              </Stack>
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
                    
                  </div>
                  <ThemeIcon color="blue" variant="light" radius="md">
                    <IconSparkles size={18} />
                  </ThemeIcon>
                </Group>

                <div className={classes.insightCard}>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={800}>
                    Account read
                  </Text>
                  <Text size="sm" c="dimmed" mt={6}>
                    {operatingBrief}
                  </Text>
                </div>

                {readFirstItems.map((item) => (
                  <div key={item.id} className={classes.insightCard}>
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
                        {item.primaryAction || item.secondaryAction ? (
                          <Group gap="xs" mt="sm" wrap="wrap">
                            {item.primaryAction ? (
                              <Button
                                component={Link}
                                href={item.primaryAction.href}
                                size="xs"
                                radius="xl"
                                className="app-platform-page-action-primary"
                              >
                                {item.primaryAction.label}
                              </Button>
                            ) : null}
                            {item.secondaryAction ? (
                              <Button
                                component={Link}
                                href={item.secondaryAction.href}
                                size="xs"
                                radius="xl"
                                variant="default"
                                className="app-platform-page-action-secondary"
                              >
                                {item.secondaryAction.label}
                              </Button>
                            ) : null}
                          </Group>
                        ) : null}
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
          <Grid.Col span={{ base: 12, xl: 6 }}>
            <Card withBorder radius="xl" p="lg" h="100%" className={`${classes.panel} ${classes.calendarPanel}`}>
              <Stack gap="md" h="100%">
                <Group justify="space-between" align="flex-start" gap="md" wrap="wrap" className={classes.sectionHeader}>
                  <div>
                    <Text size="xs" c="dimmed" tt="uppercase" fw={800}>
                      Calendar queue
                    </Text>
                    <Title order={3} mt={4}>
                      What DeepVisor wants to move next
                    </Title>
                    <Text size="sm" c="dimmed" mt={4}>
                      The queue is shown as a vertical operating agenda so it reads like the work stack for this account instead of a horizontal mini-calendar.
                    </Text>
                  </div>
                  <Badge color="gray" variant="light" radius="sm">
                    {calendarPreviewCounts.total} queued
                  </Badge>
                </Group>

                <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="xs">
                  <Paper withBorder radius="md" p="sm" className={classes.queueStatCard}>
                    <Text size="10px" c="dimmed" tt="uppercase" fw={700}>
                      Needs approval
                    </Text>
                    <Text fw={800} mt={4}>
                      {calendarPreviewCounts.ready}
                    </Text>
                  </Paper>
                  <Paper withBorder radius="md" p="sm" className={classes.queueStatCard}>
                    <Text size="10px" c="dimmed" tt="uppercase" fw={700}>
                      Drafts
                    </Text>
                    <Text fw={800} mt={4}>
                      {calendarPreviewCounts.draft}
                    </Text>
                  </Paper>
                  <Paper withBorder radius="md" p="sm" className={classes.queueStatCard}>
                    <Text size="10px" c="dimmed" tt="uppercase" fw={700}>
                      Approved
                    </Text>
                    <Text fw={800} mt={4}>
                      {calendarPreviewCounts.approved}
                    </Text>
                  </Paper>
                  <Paper withBorder radius="md" p="sm" className={classes.queueStatCard}>
                    <Text size="10px" c="dimmed" tt="uppercase" fw={700}>
                      Follow-ups
                    </Text>
                    <Text fw={800} mt={4}>
                      {calendarPreviewItems.reduce(
                        (total, item) => total + queueFollowUpCount(item),
                        0
                      )}
                    </Text>
                  </Paper>
                </SimpleGrid>

                <Paper withBorder radius="lg" p="md" className={classes.softPanel}>
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
                    <CalendarAgendaPreview
                      days={calendarPreviewWeekDays}
                      itemsByDay={calendarPreviewWeekItemsByDay}
                      todayKey={calendarPreviewTodayKey}
                    />
                  ) : (
                    <CalendarAgendaPreview
                      days={calendarPreviewMonthDays}
                      itemsByDay={calendarPreviewMonthItemsByDay}
                      todayKey={calendarPreviewTodayKey}
                      monthStart={calendarPreviewMonthStart}
                    />
                  )}
                </Paper>

                <Stack gap="sm">
                  <Group justify="space-between" align="center" wrap="wrap">
                    <Text fw={800}>Next up</Text>
                    <Button
                      component={Link}
                      href="/calendar"
                      radius="xl"
                      size="xs"
                      rightSection={<IconArrowUpRight size={14} />}
                      className="app-platform-page-action-primary"
                    >
                      Open calendar
                    </Button>
                  </Group>

                  {queuePriorityItems.length > 0 ? (
                    queuePriorityItems.slice(0, 3).map((item) => (
                      <Paper key={item.id} withBorder radius="lg" p="md" className={classes.queueHighlightRow}>
                        <Group justify="space-between" align="flex-start" gap="sm" wrap="nowrap">
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <Group gap="xs" wrap="wrap" mb={6}>
                              <Badge
                                color={calendarQueueStatusColor(item.status)}
                                variant="light"
                                radius="sm"
                              >
                                {queueStatusLabel(item.status)}
                              </Badge>
                              {item.isParent || item.workflowKey ? (
                                <Badge color="violet" variant="outline" radius="sm">
                                  Workflow
                                </Badge>
                              ) : null}
                            </Group>
                            <Text fw={800} lineClamp={2}>
                              {item.title}
                            </Text>
                            <Text size="sm" c="dimmed" mt={4} lineClamp={2}>
                              {item.description}
                            </Text>
                            <Text size="xs" c="dimmed" mt={6}>
                              {formatQueueDayLabel(item.day)} · {item.time}
                            </Text>
                          </div>
                        </Group>
                      </Paper>
                    ))
                  ) : hasFeaturedQueueOnly ? (
                    <Paper withBorder radius="lg" p="md" className={classes.queueSidebarPanel}>
                      <Text fw={800}>Featured workflow is surfaced in DeepVisor read</Text>
                      <Text size="sm" c="dimmed" mt={6}>
                        The primary relaunch recommendation is shown in the right-hand read panel so the action and the report follow-up stay together.
                      </Text>
                    </Paper>
                  ) : (
                    <Paper withBorder radius="lg" p="md" className={classes.queueSidebarPanel}>
                      <Text fw={800}>Queue is clear</Text>
                      <Text size="sm" c="dimmed" mt={6}>
                        New workflow items will show up here as signals and recommendations are generated for this account.
                      </Text>
                    </Paper>
                  )}
                </Stack>
              </Stack>
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 12, xl: 6 }}>
            <Card withBorder radius="xl" p="lg" h="100%" className={classes.panel}>
              <Stack gap="md" h="100%">
                <Group justify="space-between" align="flex-start" gap="md" wrap="wrap" className={classes.sectionHeader}>
                  <div>
                    <Text size="xs" c="dimmed" tt="uppercase" fw={800}>
                      Live activity
                    </Text>
                    <Title order={3} mt={4}>
                      What is active right now
                    </Title>
                    <Text size="sm" c="dimmed" mt={4}>
                      If active tests are live, they surface first. Otherwise this rail shows the active campaigns, ad sets, and ads carrying delivery in the selected window.
                    </Text>
                  </div>
                  <Badge color="gray" variant="light" radius="sm">
                    {windowOptionLabel(activeWindow)}
                  </Badge>
                </Group>

                {activityRail.tests.length > 0 ? (
                  <div className={classes.activitySection}>
                    <Group justify="space-between" align="center" mb="sm" wrap="wrap">
                      <Text fw={800}>{activitySectionLabel('tests')}</Text>
                      <Badge color="violet" variant="light" radius="sm">
                        {activityRail.tests.length} live
                      </Badge>
                    </Group>
                    <Stack gap="sm">
                      {activityRail.tests.map((item) => (
                        <ActivityRow
                          key={`${item.level}:${item.id}`}
                          item={item}
                          currencyCode={payload.viewContext.currencyCode}
                        />
                      ))}
                    </Stack>
                  </div>
                ) : null}

                {(['campaigns', 'adsets', 'ads'] as const).map((sectionKey) => {
                  const sectionItems = activityRail[sectionKey];

                  return (
                    <div key={sectionKey} className={classes.activitySection}>
                      <Group justify="space-between" align="center" mb="sm" wrap="wrap">
                        <Text fw={800}>{activitySectionLabel(sectionKey)}</Text>
                        <Badge color="gray" variant="light" radius="sm">
                          {sectionItems.length}
                        </Badge>
                      </Group>

                      {sectionItems.length > 0 ? (
                        <Stack gap="sm">
                          {sectionItems.map((item) => (
                            <ActivityRow
                              key={`${item.level}:${item.id}`}
                              item={item}
                              currencyCode={payload.viewContext.currencyCode}
                            />
                          ))}
                        </Stack>
                      ) : (
                        <Paper withBorder radius="lg" p="md" className={classes.queueSidebarPanel}>
                          <Text size="sm" c="dimmed">
                            {sectionKey === 'campaigns'
                              ? 'No active campaign delivery was detected in this window yet.'
                              : sectionKey === 'adsets'
                                ? 'No active ad sets were detected in this window yet.'
                                : 'No active ads were detected in this window yet.'}
                          </Text>
                        </Paper>
                      )}
                    </div>
                  );
                })}

                {!hasLiveActivity ? (
                  <Paper withBorder radius="lg" p="md" className={classes.queueSidebarPanel}>
                    <Text fw={800}>Live activity will appear here after delivery starts</Text>
                    <Text size="sm" c="dimmed" mt={6}>
                      Once the selected account has active delivery in the chosen window, this panel will break it down into tests, campaigns, ad sets, and ads with spend and result context.
                    </Text>
                  </Paper>
                ) : null}
              </Stack>
            </Card>
          </Grid.Col>
        </Grid>
      </Stack>
    </Container>
  );
}
