'use client';

import '@mantine/charts/styles.css';
import '@mantine/dates/styles.css';

import { BarChart, ChartTooltip, LineChart } from '@mantine/charts';
import { DatePicker } from '@mantine/dates';
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Container,
  Grid,
  Group,
  Indicator,
  Modal,
  NumberInput,
  Paper,
  Popover,
  ScrollArea,
  SegmentedControl,
  SimpleGrid,
  Skeleton,
  Stack,
  Table,
  Text,
  ThemeIcon,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import {
  IconAlertCircle,
  IconArrowDownRight,
  IconArrowUpRight,
  IconChartBar,
  IconChartLine,
  IconClock,
  IconCurrencyDollar,
  IconLink,
  IconRefresh,
  IconTargetArrow,
  IconUsers,
  IconX,
} from '@tabler/icons-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ReferenceDot } from 'recharts';
import { Fragment, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildReportUrl,
  CHART_METRIC_COLORS,
  formatChartDateLabel,
  formatRetryDelay,
} from '@/lib/shared';
import type {
  DashboardLiveAdItem,
  DashboardLiveAdsetItem,
  DashboardLiveCampaignContainer,
  DashboardBasePayload,
  DashboardContinuationSignal,
  DashboardEntitySchedule,
  DashboardPayload,
  DashboardSurfaceNotification,
  DashboardAudienceSlice,
  DashboardPlatformSlice,
  DashboardState,
  DashboardTrendPoint,
} from '../types';
import classes from './DashboardClient.module.css';

type DashboardClientProps = {
  payload: DashboardPayload;
  variant?: 'full' | 'analytics';
  sections?: {
    featuredHistory?: boolean;
    summaryCards?: boolean;
    liveDeliveryTables?: boolean;
    noLiveDeliveryAlert?: boolean;
    dashboardNotifications?: boolean;
  };
};

type DashboardShellClientProps = {
  basePayload: DashboardBasePayload;
  children: ReactNode;
  below?: ReactNode;
};

type TrendMode = 'delivery' | 'efficiency' | 'combined';
type HistoryGranularity = 'day' | 'hourly';
type HourlyRangeMode = 'today' | 'expanded';
type DeliveryWindowMode = 'today' | 'lifetime';
type SurfacePanelMode = 'platform' | 'device' | 'geo' | 'times';
type TrendSignalType =
  | 'crossover_up'
  | 'crossover_down'
  | 'delivery_drop_vs_efficiency'
  | 'efficiency_drop_vs_delivery'
  | 'sustained_divergence';
type TrendSignalSeverity = 'info' | 'warning' | 'critical';
type TrendSignalConfidence = 'low' | 'high';
type AudienceChartType = 'default' | 'stacked';
type BreakdownMetric = 'results' | 'clicks' | 'spend';
type AudienceChartSeries = {
  name: string;
  color: string;
};

type AudienceChartConfig = {
  data: Record<string, string | number>[];
  title: string;
  formatter: (value: number) => string;
  type: AudienceChartType;
  series: AudienceChartSeries[];
};

type SimpleBarChartConfig = {
  data: Record<string, string | number>[];
  title: string;
  formatter: (value: number) => string;
  color: string;
};

type PlacementVisualRow = {
  key: string;
  label: string;
  value: number;
  valueLabel: string;
  detailLabel: string;
  fillPercent: number;
  imageSrc: string;
  imageAlt: string;
};

type MultiSeriesBarChartConfig = {
  data: Record<string, string | number>[];
  title: string;
  formatter: (value: number) => string;
  series: AudienceChartSeries[];
  withLegend: boolean;
};

type TrendChartConfig = {
  data: Record<string, string | number | null>[];
  series: {
    name: string;
    color: string;
    strokeDasharray?: string | number;
  }[];
  title: string;
  description: string;
  formatter: (value: number) => string;
};

type TrendPointIndicator = {
  key: string;
  x: string;
  y: number;
  color: string;
  label: string;
  detail: string;
};

type SummaryDelta = {
  direction: 'up' | 'down';
  label: string;
  suffix?: string;
};

type DataSummary = {
  eyebrow: string;
  label: string;
  value: string;
  detail?: string;
  color?: string;
};

type CombinedTrendPoint = {
  label: string;
  displayLabel: string;
  deliveryIndex: number;
  efficiencyIndex: number;
};

type TrendSignal = {
  type: TrendSignalType;
  dateLabel: string;
  severity: TrendSignalSeverity;
  confidence: TrendSignalConfidence;
  title: string;
  markerLabel: string;
  description: string;
  deliveryIndex: number;
  efficiencyIndex: number;
  gap: number;
};

type StateTileDefinition = {
  code: string;
  name: string;
  col: number;
  row: number;
};

type RegionStateTile = {
  code: string;
  name: string;
  col: number;
  row: number;
  value: number;
  valueLabel: string;
  intensity: number;
  isActive: boolean;
};

type RegionStateMapConfig = {
  title: string;
  states: RegionStateTile[];
  activeStates: RegionStateTile[];
};

type HeatmapCell = {
  key: string;
  dayLabel: string;
  dayOfWeek: number;
  hourOfDay: number;
  metricAverage: number;
  metricTotal: number;
  results: number;
  clicks: number;
  linkClicks: number;
  spend: number;
  ctr: number;
  impressions: number;
  intensity: number;
};

type HeatmapRow = {
  dayLabel: string;
  dayOfWeek: number;
  cells: HeatmapCell[];
};

type HourlyHeatmapConfig = {
  title: string;
  metricLabel: string;
  summarySlotLabel: string;
  summaryDayLabel: string;
  summaryHourLabel: string;
  rows: HeatmapRow[];
  hourLabels: string[];
};

const numberFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
});

const AGE_BUCKET_ORDER = ['13-17', '18-24', '25-34', '35-44', '45-54', '55-64', '65+'] as const;
const FEATURED_HISTORY_CHART_HEIGHT = 500;
const DELIVERY_SURFACE_CHART_HEIGHT = 260;
const AUDIENCE_BREAKDOWN_CHART_HEIGHT = 180;
const DIVERGENCE_THRESHOLD = 10;
const MAJOR_DIVERGENCE_THRESHOLD = 15;
const HOURLY_SIGNAL_MIN_IMPRESSIONS = 100;
const HOURLY_SIGNAL_MIN_CLICKS = 3;
const HOURLY_SIGNAL_MIN_SPEND = 5;
const SCALE_PRESSURE_MIN_CONSECUTIVE_POINTS = 3;
const SCALE_PRESSURE_MIN_DELIVERY_DELTA = 5;
const SCALE_PRESSURE_MIN_EFFICIENCY_DELTA = 5;
const SCALE_PRESSURE_DAILY_MIN_IMPRESSIONS = 750;
const SCALE_PRESSURE_DAILY_MIN_CLICKS = 10;
const SCALE_PRESSURE_DAILY_MIN_SPEND = 35;
const SCALE_PRESSURE_HOURLY_MIN_IMPRESSIONS = 150;
const SCALE_PRESSURE_HOURLY_MIN_CLICKS = 3;
const SCALE_PRESSURE_HOURLY_MIN_SPEND = 10;
const EXPANDED_HOURLY_POINT_WIDTH = 28;
const EXPANDED_HOURLY_MIN_WIDTH = 1400;
const FEATURED_HISTORY_COLORS = CHART_METRIC_COLORS;

const US_STATE_TILES: StateTileDefinition[] = [
  { code: 'WA', name: 'Washington', col: 1, row: 1 },
  { code: 'OR', name: 'Oregon', col: 1, row: 2 },
  { code: 'CA', name: 'California', col: 1, row: 3 },
  { code: 'AK', name: 'Alaska', col: 1, row: 6 },
  { code: 'HI', name: 'Hawaii', col: 2, row: 7 },
  { code: 'ID', name: 'Idaho', col: 2, row: 2 },
  { code: 'NV', name: 'Nevada', col: 2, row: 3 },
  { code: 'AZ', name: 'Arizona', col: 2, row: 4 },
  { code: 'MT', name: 'Montana', col: 3, row: 1 },
  { code: 'WY', name: 'Wyoming', col: 3, row: 2 },
  { code: 'UT', name: 'Utah', col: 3, row: 3 },
  { code: 'NM', name: 'New Mexico', col: 3, row: 4 },
  { code: 'ND', name: 'North Dakota', col: 4, row: 1 },
  { code: 'SD', name: 'South Dakota', col: 4, row: 2 },
  { code: 'CO', name: 'Colorado', col: 4, row: 3 },
  { code: 'MN', name: 'Minnesota', col: 5, row: 1 },
  { code: 'NE', name: 'Nebraska', col: 5, row: 2 },
  { code: 'KS', name: 'Kansas', col: 5, row: 3 },
  { code: 'OK', name: 'Oklahoma', col: 5, row: 4 },
  { code: 'TX', name: 'Texas', col: 5, row: 5 },
  { code: 'LA', name: 'Louisiana', col: 6, row: 5 },
  { code: 'WI', name: 'Wisconsin', col: 6, row: 1 },
  { code: 'IA', name: 'Iowa', col: 6, row: 2 },
  { code: 'MO', name: 'Missouri', col: 6, row: 3 },
  { code: 'AR', name: 'Arkansas', col: 6, row: 4 },
  { code: 'MS', name: 'Mississippi', col: 7, row: 5 },
  { code: 'MI', name: 'Michigan', col: 7, row: 1 },
  { code: 'IL', name: 'Illinois', col: 7, row: 2 },
  { code: 'KY', name: 'Kentucky', col: 7, row: 3 },
  { code: 'TN', name: 'Tennessee', col: 7, row: 4 },
  { code: 'AL', name: 'Alabama', col: 8, row: 5 },
  { code: 'IN', name: 'Indiana', col: 8, row: 2 },
  { code: 'OH', name: 'Ohio', col: 9, row: 2 },
  { code: 'WV', name: 'West Virginia', col: 8, row: 3 },
  { code: 'GA', name: 'Georgia', col: 9, row: 5 },
  { code: 'FL', name: 'Florida', col: 10, row: 6 },
  { code: 'PA', name: 'Pennsylvania', col: 10, row: 2 },
  { code: 'VA', name: 'Virginia', col: 9, row: 3 },
  { code: 'NC', name: 'North Carolina', col: 9, row: 4 },
  { code: 'SC', name: 'South Carolina', col: 10, row: 5 },
  { code: 'NY', name: 'New York', col: 10, row: 1 },
  { code: 'NJ', name: 'New Jersey', col: 11, row: 2 },
  { code: 'MD', name: 'Maryland', col: 10, row: 3 },
  { code: 'DE', name: 'Delaware', col: 11, row: 3 },
  { code: 'VT', name: 'Vermont', col: 11, row: 1 },
  { code: 'NH', name: 'New Hampshire', col: 12, row: 1 },
  { code: 'MA', name: 'Massachusetts', col: 12, row: 2 },
  { code: 'CT', name: 'Connecticut', col: 12, row: 3 },
  { code: 'RI', name: 'Rhode Island', col: 13, row: 2 },
  { code: 'ME', name: 'Maine', col: 13, row: 1 },
  { code: 'DC', name: 'District of Columbia', col: 10, row: 4 },
];

const HEATMAP_DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

const STATE_NAME_TO_CODE: Record<string, string> = {
  alabama: 'AL',
  alaska: 'AK',
  arizona: 'AZ',
  arkansas: 'AR',
  california: 'CA',
  colorado: 'CO',
  connecticut: 'CT',
  delaware: 'DE',
  florida: 'FL',
  georgia: 'GA',
  hawaii: 'HI',
  idaho: 'ID',
  illinois: 'IL',
  indiana: 'IN',
  iowa: 'IA',
  kansas: 'KS',
  kentucky: 'KY',
  louisiana: 'LA',
  maine: 'ME',
  maryland: 'MD',
  massachusetts: 'MA',
  michigan: 'MI',
  minnesota: 'MN',
  mississippi: 'MS',
  missouri: 'MO',
  montana: 'MT',
  nebraska: 'NE',
  nevada: 'NV',
  'new hampshire': 'NH',
  'new jersey': 'NJ',
  'new mexico': 'NM',
  'new york': 'NY',
  'north carolina': 'NC',
  'north dakota': 'ND',
  ohio: 'OH',
  oklahoma: 'OK',
  oregon: 'OR',
  pennsylvania: 'PA',
  'rhode island': 'RI',
  'south carolina': 'SC',
  'south dakota': 'SD',
  tennessee: 'TN',
  texas: 'TX',
  utah: 'UT',
  vermont: 'VT',
  virginia: 'VA',
  washington: 'WA',
  'west virginia': 'WV',
  wisconsin: 'WI',
  wyoming: 'WY',
  'district of columbia': 'DC',
};

function formatCurrency(value: number, currencyCode: string | null, digits?: number): string {
  const resolvedDigits =
    typeof digits === 'number'
      ? digits
      : Math.abs(value) > 0 && Math.abs(value) < 100
        ? 2
        : 0;

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode || 'USD',
    minimumFractionDigits: resolvedDigits,
    maximumFractionDigits: resolvedDigits,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatCompactCurrency(value: number, currencyCode: string | null): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode || 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatNumber(value: number): string {
  return numberFormatter.format(Number.isFinite(value) ? value : 0);
}

function formatRate(value: number): string {
  return `${(Number.isFinite(value) ? value : 0).toFixed(2)}%`;
}

function formatDecimal(value: number): string {
  return (Number.isFinite(value) ? value : 0).toFixed(2);
}

function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(Number.isFinite(value) ? value : 0);
}

function buildSummaryDelta(
  current: number,
  previous: number,
  formatter: (value: number) => string
): SummaryDelta | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || current === previous) {
    return null;
  }

  const delta = current - previous;

  return {
    direction: delta > 0 ? 'up' : 'down',
    label: formatter(Math.abs(delta)),
  };
}

function formatStatusLabel(value: string | null | undefined): string {
  if (!value) {
    return 'Unknown';
  }

  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function statusColor(status: string | null | undefined): string {
  const normalized = (status ?? '').trim().toLowerCase();

  if (
    normalized.includes('paused') ||
    normalized.includes('inactive') ||
    normalized.includes('disabled') ||
    normalized.includes('error') ||
    normalized.includes('failed')
  ) {
    return 'red';
  }

  if (
    normalized.includes('active') ||
    normalized.includes('serving') ||
    normalized.includes('running') ||
    normalized.includes('connected')
  ) {
    return 'green';
  }

  if (
    normalized.includes('review') ||
    normalized.includes('pending') ||
    normalized.includes('learning')
  ) {
    return 'yellow';
  }

  return 'gray';
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

function formatDateSpan(start: string | null, end: string | null): string | null {
  const startLabel = formatReadableDate(start);
  const endLabel = formatReadableDate(end);

  if (startLabel && endLabel) {
    return start === end ? startLabel : `${startLabel} through ${endLabel}`;
  }

  return startLabel ?? endLabel ?? null;
}

function addDaysToIsoDate(value: string, days: number): string | null {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function daysBetweenIsoDates(fromDate: string, toDate: string): number {
  const from = new Date(`${fromDate}T00:00:00Z`);
  const to = new Date(`${toDate}T00:00:00Z`);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return 0;
  }

  return Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}

function getDateDayNumber(value: string): number {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? 0 : date.getUTCDate();
}

function clampExtensionDays(value: number): number {
  if (!Number.isFinite(value)) {
    return 14;
  }

  return Math.min(365, Math.max(1, Math.round(value)));
}

function getTrendPointDateKey(point: DashboardTrendPoint): string | null {
  return point.dayKey ?? point.label.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? null;
}

function hasActiveDeliveryPoint(point: DashboardTrendPoint): boolean {
  return (
    point.spend > 0 ||
    point.impressions > 0 ||
    point.clicks > 0 ||
    point.inlineLinkClicks > 0 ||
    point.results > 0
  );
}

function toUtcIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function todayUtcIsoDate(): string {
  return toUtcIsoDate(new Date());
}

function normalizeReportDate(value: string | null | undefined): string | null {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  const isoDate = trimmed.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? null;

  if (isoDate) {
    return isoDate;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : toUtcIsoDate(parsed);
}

function resolveReportDateRange(schedules: Array<DashboardEntitySchedule | null | undefined>): {
  dateFrom: string | null;
  dateTo: string;
} {
  const dateFrom =
    schedules
      .map((schedule) => normalizeReportDate(schedule?.startsAt))
      .find((value): value is string => Boolean(value)) ?? null;
  const endDate =
    schedules
      .map((schedule) => schedule?.endDate ?? normalizeReportDate(schedule?.endsAt))
      .find((value): value is string => Boolean(value)) ?? null;
  const today = todayUtcIsoDate();

  return {
    dateFrom,
    dateTo: endDate && endDate <= today ? endDate : today,
  };
}

function buildDashboardEntityReportHref(input: {
  scope: 'campaign' | 'adset' | 'ad';
  platformIntegrationId: string | null;
  adAccountId: string | null;
  campaignId?: string | null;
  adsetId?: string | null;
  adId?: string | null;
  schedules: Array<DashboardEntitySchedule | null | undefined>;
}): string {
  const range = resolveReportDateRange(input.schedules);

  return buildReportUrl({
    scope: input.scope,
    platformIntegrationId: input.platformIntegrationId,
    adAccountIds: input.adAccountId ? [input.adAccountId] : [],
    campaignIds: input.campaignId ? [input.campaignId] : [],
    adsetIds: input.adsetId ? [input.adsetId] : [],
    adIds: input.adId ? [input.adId] : [],
    dateFrom: range.dateFrom,
    dateTo: range.dateTo,
    compareMode: 'none',
  });
}

function buildDashboardAccountReportHref(payload: DashboardBasePayload | DashboardPayload): string {
  const today = todayUtcIsoDate();
  const dateTo = payload.syncCoverage?.coverageStartDate ?? today;
  const adAccountId = payload.adAccount?.id ?? payload.selection.selectedAdAccountId;
  const platformIntegrationId =
    payload.platform?.id ?? payload.selection.selectedPlatformIntegrationId;

  return buildReportUrl({
    scope: adAccountId ? 'ad_account' : platformIntegrationId ? 'platform' : 'business',
    platformIntegrationId,
    adAccountIds: adAccountId ? [adAccountId] : [],
    dateFrom: payload.syncCoverage?.coverageStartDate ?? null,
    dateTo: dateTo <= today ? dateTo : today,
    compareMode: 'none',
  });
}

function formatContinuationEntityLevel(level: DashboardContinuationSignal['entityLevel']): string {
  switch (level) {
    case 'campaign':
      return 'Campaign';
    case 'adset':
      return 'Ad set';
    case 'ad':
      return 'Ad';
    default:
      return 'Campaign';
  }
}

function formatContinuationDays(daysUntilEnd: number): string {
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

function formatContinuationBudgetType(
  budgetType: DashboardContinuationSignal['budgetType']
): string {
  switch (budgetType) {
    case 'daily':
      return 'Daily budget';
    case 'lifetime':
      return 'Lifetime budget';
    default:
      return 'Budget';
  }
}

function formatContinuationBudget(
  signal: DashboardContinuationSignal,
  currencyCode: string | null
): string | null {
  if (signal.budgetAmount == null) {
    return null;
  }

  return `${formatContinuationBudgetType(signal.budgetType)} ${formatCurrency(
    signal.budgetAmount,
    currencyCode,
    2
  )}`;
}

function formatShortNumericDate(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleDateString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function formatTrendLabel(value: string, granularity: HistoryGranularity): string {
  return granularity === 'day' ? formatChartDateLabel(value) : value.trim();
}

function formatHourShortLabel(hour: number): string {
  if (!Number.isFinite(hour) || hour < 0 || hour > 23) {
    return '—';
  }

  const suffix = hour >= 12 ? 'P' : 'A';
  const normalizedHour = hour % 12 || 12;
  return `${normalizedHour}${suffix}`;
}

function formatHourLongLabel(hour: number): string {
  if (!Number.isFinite(hour) || hour < 0 || hour > 23) {
    return 'Unknown';
  }

  const suffix = hour >= 12 ? 'PM' : 'AM';
  const normalizedHour = hour % 12 || 12;
  return `${normalizedHour}${suffix}`;
}

function shouldRenderHeatmapHourLabel(hour: number): boolean {
  return hour === 0 || hour === 4 || hour === 8 || hour === 12 || hour === 16 || hour === 20;
}

function buildHourlyHeatmap(
  points: DashboardPayload['featuredAdsetHistory']['hourlyTrendExpanded']
): HourlyHeatmapConfig | null {
  const hourlyPoints = points
    .filter(
      (point) =>
        point.dayKey &&
        point.dayOfWeek != null &&
        point.dayOfWeek >= 0 &&
        point.dayOfWeek <= 6 &&
        point.hourOfDay != null &&
        point.hourOfDay >= 0 &&
        point.hourOfDay <= 23
    )
    .map((point) => ({
      ...point,
      dayOfWeek: point.dayOfWeek as number,
      hourOfDay: point.hourOfDay as number,
    }));

  if (hourlyPoints.length === 0) {
    return null;
  }

  const prefersResults = hourlyPoints.some((point) => point.results > 0);
  const prefersLinkClicks = !prefersResults && hourlyPoints.some((point) => point.inlineLinkClicks > 0);
  const metricLabel = prefersResults ? 'Results' : prefersLinkClicks ? 'Link clicks' : 'Clicks';
  const aggregates = new Map<
    string,
    {
      dayOfWeek: number;
      hourOfDay: number;
      impressions: number;
      results: number;
      clicks: number;
      linkClicks: number;
      spend: number;
      occurrences: number;
    }
  >();

  for (const point of hourlyPoints) {
    const key = `${point.dayOfWeek}:${point.hourOfDay}`;
    const current = aggregates.get(key) ?? {
      dayOfWeek: point.dayOfWeek,
      hourOfDay: point.hourOfDay,
      impressions: 0,
      results: 0,
      clicks: 0,
      linkClicks: 0,
      spend: 0,
      occurrences: 0,
    };

    current.impressions += point.impressions;
    current.results += point.results;
    current.clicks += point.clicks;
    current.linkClicks += point.inlineLinkClicks;
    current.spend += point.spend;
    current.occurrences += 1;
    aggregates.set(key, current);
  }

  const cells = Array.from(aggregates.values()).map((aggregate) => {
    const metricTotal = prefersResults
      ? aggregate.results
      : prefersLinkClicks
        ? aggregate.linkClicks
        : aggregate.clicks;
    const metricAverage = aggregate.occurrences > 0 ? metricTotal / aggregate.occurrences : 0;
    const ctr = aggregate.impressions > 0 ? (aggregate.clicks / aggregate.impressions) * 100 : 0;

    return {
      key: `${aggregate.dayOfWeek}:${aggregate.hourOfDay}`,
      dayLabel: HEATMAP_DAY_LABELS[aggregate.dayOfWeek] ?? '—',
      dayOfWeek: aggregate.dayOfWeek,
      hourOfDay: aggregate.hourOfDay,
      metricAverage,
      metricTotal,
      results: aggregate.results,
      clicks: aggregate.clicks,
      linkClicks: aggregate.linkClicks,
      spend: aggregate.spend,
      ctr,
      impressions: aggregate.impressions,
      intensity: 0,
    } satisfies HeatmapCell;
  });

  const maxAverage = cells.reduce((max, cell) => Math.max(max, cell.metricAverage), 0);
  const normalizedCells = cells.map((cell) => ({
    ...cell,
    intensity: maxAverage > 0 ? Math.min(1, Math.sqrt(cell.metricAverage / maxAverage)) : 0,
  }));

  const rows: HeatmapRow[] = HEATMAP_DAY_LABELS.map((label, dayOfWeek) => ({
    dayLabel: label,
    dayOfWeek,
    cells: Array.from({ length: 24 }, (_, hourOfDay) => {
      const cell = normalizedCells.find(
        (candidate) =>
          candidate.dayOfWeek === dayOfWeek && candidate.hourOfDay === hourOfDay
      );

      return (
        cell ?? {
          key: `${dayOfWeek}:${hourOfDay}`,
          dayLabel: label,
          dayOfWeek,
          hourOfDay,
          metricAverage: 0,
          metricTotal: 0,
          results: 0,
          clicks: 0,
          linkClicks: 0,
          spend: 0,
          ctr: 0,
          impressions: 0,
          intensity: 0,
        }
      );
    }),
  }));

  const bestCell = normalizedCells.sort(
    (left, right) =>
      right.metricAverage - left.metricAverage ||
      right.ctr - left.ctr ||
      right.spend - left.spend
  )[0];

  if (!bestCell) {
    return null;
  }

  const bestDay = rows
    .map((row) => ({
      dayLabel: row.dayLabel,
      metricAverage: row.cells.reduce((sum, cell) => sum + cell.metricAverage, 0),
    }))
    .sort((left, right) => right.metricAverage - left.metricAverage)[0];

  const hourTotals = Array.from({ length: 24 }, (_, hourOfDay) => ({
    hourOfDay,
    metricAverage: rows.reduce((sum, row) => sum + row.cells[hourOfDay].metricAverage, 0),
  }));
  const bestHour = hourTotals.sort((left, right) => right.metricAverage - left.metricAverage)[0];

  return {
    title: `Best recurring ${metricLabel.toLowerCase()} times`,
    metricLabel,
    summarySlotLabel: `${bestCell.dayLabel} · ${formatHourLongLabel(bestCell.hourOfDay)}`,
    summaryDayLabel: bestDay?.dayLabel ?? '—',
    summaryHourLabel: bestHour ? formatHourLongLabel(bestHour.hourOfDay) : '—',
    rows,
    hourLabels: Array.from({ length: 24 }, (_, hourOfDay) =>
      shouldRenderHeatmapHourLabel(hourOfDay) ? formatHourShortLabel(hourOfDay) : ''
    ),
  };
}

function formatAxisShortDate(value: string): string {
  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  }

  return value.replace(/,\s*\d{4}$/, '').trim();
}

function formatExpandedHourlyAxisLabel(value: string): string {
  const [rawDate, rawHourToken] = value.split('·').map((part) => part.trim());

  if (!rawDate || !rawHourToken) {
    return value;
  }

  if (rawHourToken === '12A') {
    return `${formatAxisShortDate(rawDate)}, 12AM`;
  }

  if (rawHourToken === '12P') {
    return `${formatAxisShortDate(rawDate)}, 12PM`;
  }

  return '';
}

function isExpandedHourlyAnchor(value: string): boolean {
  const [, rawHourToken] = value.split('·').map((part) => part.trim());
  return rawHourToken === '12A' || rawHourToken === '12P';
}

function normalizeTrendSeries(values: number[]): number[] {
  const baseline = values.find((value) => value > 0) ?? 0;

  if (baseline <= 0) {
    return values.map(() => 0);
  }

  return values.map((value) => Number(((value / baseline) * 100).toFixed(1)));
}

function isTrendPointLater(candidate: DashboardTrendPoint, current: DashboardTrendPoint): boolean {
  if (candidate.dayKey && current.dayKey) {
    if (candidate.dayKey !== current.dayKey) {
      return candidate.dayKey > current.dayKey;
    }

    return (candidate.hourOfDay ?? -1) > (current.hourOfDay ?? -1);
  }

  return candidate.label > current.label;
}

function getLatestTrendPointPair(points: DashboardTrendPoint[]): {
  latest: DashboardTrendPoint;
  previous: DashboardTrendPoint | null;
} | null {
  const sortedPoints = points
    .filter((point) => point.dayKey || point.label)
    .slice()
    .sort((left, right) => {
      if (isTrendPointLater(left, right)) {
        return 1;
      }

      if (isTrendPointLater(right, left)) {
        return -1;
      }

      return 0;
    });

  const latest = sortedPoints.at(-1);

  if (!latest) {
    return null;
  }

  return {
    latest,
    previous: sortedPoints.at(-2) ?? null,
  };
}

function pickMaxTrendPoint(
  points: DashboardTrendPoint[],
  key: keyof DashboardTrendPoint
): DashboardTrendPoint | null {
  let best: DashboardTrendPoint | null = null;

  for (const point of points) {
    const value = Number(point[key]);

    if (!Number.isFinite(value) || value <= 0) {
      continue;
    }

    if (!best) {
      best = point;
      continue;
    }

    const bestValue = Number(best[key]);

    if (value > bestValue || (value === bestValue && isTrendPointLater(point, best))) {
      best = point;
    }
  }

  return best;
}

function buildCombinedTrendSeries(input: {
  granularity: HistoryGranularity;
  trendPoints: DashboardPayload['featuredAdsetHistory']['dailyTrend'];
}): CombinedTrendPoint[] {
  const deliveryValues =
    input.granularity === 'hourly'
      ? input.trendPoints.map(
        (point) =>
          point.spend * 0.3 +
          point.results * 0.35 +
          point.clicks * 0.2 +
          point.inlineLinkClicks * 0.15
      )
      : input.trendPoints.map(
        (point) => point.spend * 0.35 + point.results * 0.4 + point.clicks * 0.25
      );
  const efficiencyValues =
    input.granularity === 'hourly'
      ? input.trendPoints.map((point) => {
        const ctrScore = point.ctr;
        const cpcScore = point.cpc > 0 ? 100 / point.cpc : 0;
        const cpmScore = point.cpm > 0 ? 100 / point.cpm : 0;

        return ctrScore * 0.4 + cpcScore * 0.35 + cpmScore * 0.25;
      })
      : input.trendPoints.map((point) => {
        const ctrScore = point.ctr;
        const cpcScore = point.cpc > 0 ? 100 / point.cpc : 0;
        const frequencyPenalty = point.frequency > 0 ? 100 / point.frequency : 0;

        return ctrScore * 0.45 + cpcScore * 0.35 + frequencyPenalty * 0.2;
      });

  const normalizedDelivery = normalizeTrendSeries(deliveryValues);
  const normalizedEfficiency = normalizeTrendSeries(efficiencyValues);

  return input.trendPoints.map((point, index) => ({
    label: point.label,
    displayLabel: formatTrendLabel(point.label, input.granularity),
    deliveryIndex: normalizedDelivery[index] ?? 0,
    efficiencyIndex: normalizedEfficiency[index] ?? 0,
  }));
}

function signalSeverityColor(severity: TrendSignalSeverity): string {
  switch (severity) {
    case 'critical':
      return 'red';
    case 'warning':
      return 'yellow';
    default:
      return 'blue';
  }
}

function isLowConfidenceHourlyEfficiencyPoint(
  point: DashboardPayload['featuredAdsetHistory']['dailyTrend'][number]
): boolean {
  return (
    point.impressions < HOURLY_SIGNAL_MIN_IMPRESSIONS &&
    point.clicks < HOURLY_SIGNAL_MIN_CLICKS &&
    point.spend < HOURLY_SIGNAL_MIN_SPEND
  );
}

function hasMinimumScalePressureVolume(
  point: DashboardPayload['featuredAdsetHistory']['dailyTrend'][number],
  granularity: HistoryGranularity
): boolean {
  if (granularity === 'hourly') {
    return (
      point.impressions >= SCALE_PRESSURE_HOURLY_MIN_IMPRESSIONS &&
      (point.clicks >= SCALE_PRESSURE_HOURLY_MIN_CLICKS ||
        point.spend >= SCALE_PRESSURE_HOURLY_MIN_SPEND)
    );
  }

  return (
    point.impressions >= SCALE_PRESSURE_DAILY_MIN_IMPRESSIONS &&
    (point.clicks >= SCALE_PRESSURE_DAILY_MIN_CLICKS ||
      point.spend >= SCALE_PRESSURE_DAILY_MIN_SPEND)
  );
}

function countConsecutiveScalePressurePoints(
  combinedPoints: CombinedTrendPoint[],
  startIndex: number
): number {
  let streak = 0;

  for (let index = startIndex; index >= 0; index -= 1) {
    const point = combinedPoints[index];
    const gap = point.deliveryIndex - point.efficiencyIndex;

    if (gap < MAJOR_DIVERGENCE_THRESHOLD) {
      break;
    }

    streak += 1;
  }

  return streak;
}

function detectTrendSignals(input: {
  granularity: HistoryGranularity;
  trendPoints: DashboardPayload['featuredAdsetHistory']['dailyTrend'];
}): TrendSignal[] {
  const combinedPoints = buildCombinedTrendSeries(input);

  if (combinedPoints.length < 2) {
    return [];
  }

  const signals: TrendSignal[] = [];

  for (let index = 1; index < combinedPoints.length; index += 1) {
    const previous = combinedPoints[index - 1];
    const current = combinedPoints[index];
    const currentPoint = input.trendPoints[index];
    const previousPoint = input.trendPoints[index - 1];
    const previousGap = Math.abs(previous.deliveryIndex - previous.efficiencyIndex);
    const gap = Math.abs(current.deliveryIndex - current.efficiencyIndex);
    const majorGap = gap >= MAJOR_DIVERGENCE_THRESHOLD;
    const lowConfidenceEfficiency =
      input.granularity === 'hourly' && isLowConfidenceHourlyEfficiencyPoint(currentPoint);
    const deliveryDelta = current.deliveryIndex - previous.deliveryIndex;
    const efficiencyDecline = previous.efficiencyIndex - current.efficiencyIndex;
    const scalePressureVolumeQualified =
      hasMinimumScalePressureVolume(currentPoint, input.granularity) &&
      hasMinimumScalePressureVolume(previousPoint, input.granularity);
    const scalePressureStreak = countConsecutiveScalePressurePoints(combinedPoints, index);

    if (
      previous.efficiencyIndex < previous.deliveryIndex &&
      current.efficiencyIndex >= current.deliveryIndex
    ) {
      signals.push({
        type: 'crossover_up',
        dateLabel: current.displayLabel,
        severity: 'info',
        confidence: lowConfidenceEfficiency ? 'low' : 'high',
        title: lowConfidenceEfficiency
          ? 'Promising efficiency, limited delivery'
          : 'Efficiency crossed above delivery',
        markerLabel: lowConfidenceEfficiency ? 'Low-confidence spike' : 'Efficiency lead',
        description: lowConfidenceEfficiency
          ? 'Efficiency moved above delivery on a very small hourly sample, so this hour is interesting but not strong enough to treat as a real optimization signal yet.'
          : 'Efficiency moved above delivery, which can mean the ad set is holding up on quality while volume pressure shifts.',
        deliveryIndex: current.deliveryIndex,
        efficiencyIndex: current.efficiencyIndex,
        gap,
      });
    }

    if (
      previous.deliveryIndex < previous.efficiencyIndex &&
      current.deliveryIndex >= current.efficiencyIndex
    ) {
      signals.push({
        type: 'crossover_down',
        dateLabel: current.displayLabel,
        severity: 'info',
        confidence: 'high',
        title: 'Delivery crossed above efficiency',
        markerLabel: 'Delivery regained lead',
        description:
          'Delivery moved above efficiency, which can mean volume recovered faster than efficiency at this point.',
        deliveryIndex: current.deliveryIndex,
        efficiencyIndex: current.efficiencyIndex,
        gap,
      });
    }

    if (
      current.deliveryIndex < previous.deliveryIndex &&
      current.efficiencyIndex >= previous.efficiencyIndex &&
      gap >= DIVERGENCE_THRESHOLD
    ) {
      signals.push({
        type: 'delivery_drop_vs_efficiency',
        dateLabel: current.displayLabel,
        severity: lowConfidenceEfficiency ? 'info' : majorGap ? 'critical' : 'warning',
        confidence: lowConfidenceEfficiency ? 'low' : 'high',
        title: lowConfidenceEfficiency
          ? 'Efficient but low-confidence'
          : 'Delivery weakened while efficiency held up',
        markerLabel: lowConfidenceEfficiency ? 'Low-confidence spike' : 'Volume softened',
        description: lowConfidenceEfficiency
          ? 'This hour looks efficient, but the delivery sample is too small to treat it as a strong signal yet.'
          : 'Ad set may be losing volume momentum while remaining relatively efficient.',
        deliveryIndex: current.deliveryIndex,
        efficiencyIndex: current.efficiencyIndex,
        gap,
      });
    }

    if (
      current.efficiencyIndex < previous.efficiencyIndex &&
      current.deliveryIndex >= previous.deliveryIndex &&
      gap >= MAJOR_DIVERGENCE_THRESHOLD &&
      deliveryDelta >= SCALE_PRESSURE_MIN_DELIVERY_DELTA &&
      efficiencyDecline >= SCALE_PRESSURE_MIN_EFFICIENCY_DELTA &&
      scalePressureVolumeQualified
    ) {
      signals.push({
        type: 'efficiency_drop_vs_delivery',
        dateLabel: current.displayLabel,
        severity: majorGap ? 'critical' : 'warning',
        confidence: 'high',
        title: 'Volume is rising faster than efficiency',
        markerLabel: 'Efficiency slipped',
        description:
          'Ad set is scaling, but efficiency may be weakening as delivery continues to rise.',
        deliveryIndex: current.deliveryIndex,
        efficiencyIndex: current.efficiencyIndex,
        gap,
      });
    }

    if (gap >= DIVERGENCE_THRESHOLD && previousGap >= DIVERGENCE_THRESHOLD) {
      const earlierGap =
        index >= 2
          ? Math.abs(
            combinedPoints[index - 2].deliveryIndex - combinedPoints[index - 2].efficiencyIndex
          )
          : 0;
      const efficiencyLeading = current.efficiencyIndex > current.deliveryIndex;
      const isFirstSustainedPoint = efficiencyLeading
        ? index === 1 || earlierGap < DIVERGENCE_THRESHOLD
        : scalePressureStreak >= SCALE_PRESSURE_MIN_CONSECUTIVE_POINTS &&
        (index === SCALE_PRESSURE_MIN_CONSECUTIVE_POINTS - 1 ||
          combinedPoints[index - 1].deliveryIndex - combinedPoints[index - 1].efficiencyIndex <
          MAJOR_DIVERGENCE_THRESHOLD);

      if (isFirstSustainedPoint) {
        if (!efficiencyLeading && !scalePressureVolumeQualified) {
          continue;
        }

        signals.push({
          type: 'sustained_divergence',
          dateLabel: current.displayLabel,
          severity:
            efficiencyLeading && lowConfidenceEfficiency
              ? 'info'
              : majorGap
                ? 'critical'
                : 'warning',
          confidence: efficiencyLeading && lowConfidenceEfficiency ? 'low' : 'high',
          title: efficiencyLeading
            ? lowConfidenceEfficiency
              ? 'Low-volume efficiency spike'
              : 'Efficiency is outpacing delivery'
            : 'Scaling may be slowing',
          markerLabel: efficiencyLeading
            ? lowConfidenceEfficiency
              ? 'Low-confidence spike'
              : 'Efficiency lead'
            : 'Scale pressure',
          description: efficiencyLeading
            ? lowConfidenceEfficiency
              ? 'Efficiency stayed ahead of delivery, but only on very limited hourly volume. Treat this as promising, not conclusive.'
              : 'Efficiency stayed meaningfully ahead of delivery for multiple points in a row.'
            : 'Delivery stayed materially ahead of efficiency for multiple points in a row.',
          deliveryIndex: current.deliveryIndex,
          efficiencyIndex: current.efficiencyIndex,
          gap,
        });
      }
    }
  }

  return signals;
}

function selectPrimaryTrendSignal(signals: TrendSignal[]): TrendSignal | null {
  if (signals.length === 0) {
    return null;
  }

  const severityRank: Record<TrendSignalSeverity, number> = {
    info: 1,
    warning: 2,
    critical: 3,
  };

  return signals.reduce<TrendSignal | null>((currentBest, candidate) => {
    if (!currentBest) {
      return candidate;
    }

    const candidateRank = severityRank[candidate.severity];
    const currentRank = severityRank[currentBest.severity];

    if (candidateRank !== currentRank) {
      return candidateRank > currentRank ? candidate : currentBest;
    }

    if (candidate.gap !== currentBest.gap) {
      return candidate.gap > currentBest.gap ? candidate : currentBest;
    }

    return candidate;
  }, null);
}

function renderTrendTooltip(input: {
  label: string | undefined;
  payload: Array<{ name?: string; value?: number | string | null; color?: string }> | undefined;
  series: TrendChartConfig['series'];
  formatter: (value: number) => string;
  signal: TrendSignal | null;
  indicators: TrendPointIndicator[];
  continuationSignal: DashboardContinuationSignal | null;
  continuationLabel: string | null;
  currencyCode: string | null;
}) {
  if (!input.label) {
    return null;
  }

  const showContinuationTooltip =
    Boolean(input.continuationSignal) && input.label === input.continuationLabel;

  if ((!input.payload || input.payload.length === 0) && !showContinuationTooltip) {
    return null;
  }

  const colorBySeriesName = new Map(input.series.map((series) => [series.name, series.color]));

  return (
    <Paper withBorder radius="md" p="sm" shadow="sm" className={classes.historyTooltipCard}>
      <Stack gap={8}>
        <Text size="sm" fw={700}>
          {input.label}
        </Text>

        {input.payload && input.payload.length > 0 ? (
          <Stack gap={6}>
            {input.payload.map((item) => {
              const color = item.color || colorBySeriesName.get(item.name ?? '') || 'gray.6';
              const value =
                typeof item.value === 'number'
                  ? input.formatter(item.value)
                  : String(item.value ?? '—');

              return (
                <Group key={`${item.name ?? 'value'}:${value}`} justify="space-between" gap="md" wrap="nowrap">
                  <Group gap="xs" wrap="nowrap">
                    <div
                      aria-hidden="true"
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 999,
                        backgroundColor: color,
                        flexShrink: 0,
                      }}
                    />
                    <Text size="sm" fw={600}>
                      {item.name ?? 'Value'}
                    </Text>
                  </Group>
                  <Text size="sm" fw={700}>
                    {value}
                  </Text>
                </Group>
              );
            })}
          </Stack>
        ) : null}

        {input.signal ? (
          <Paper withBorder radius="md" p="xs" className={classes.historyTooltipSignal}>
            <Badge color={signalSeverityColor(input.signal.severity)} variant="filled" size="xs">
              {input.signal.title}
            </Badge>
            {input.signal.confidence === 'low' ? (
              <Text size="xs" mt={6} fw={700} className={classes.historyTooltipCopy}>
                Low-confidence hourly read
              </Text>
            ) : null}
            <Text size="xs" mt={6} className={classes.historyTooltipCopy}>
              {input.signal.description}
            </Text>
            <Text size="xs" mt={4} fw={700} className={classes.historyTooltipCopy}>
              Gap {formatDecimal(input.signal.gap)} idx
            </Text>
          </Paper>
        ) : null}

        {showContinuationTooltip && input.continuationSignal ? (
          <Paper withBorder radius="md" p="xs" className={classes.historyTooltipSignal}>
            <Stack gap={4}>
              <Badge color="orange" variant="filled" size="xs">
                {formatContinuationEntityLevel(input.continuationSignal.entityLevel)} ends
              </Badge>
              <Text size="xs" fw={800} className={classes.historyTooltipCopy}>
                {formatReadableDate(input.continuationSignal.endDate) ??
                  input.continuationSignal.endDate}
              </Text>
              <Text size="xs" className={classes.historyTooltipCopy}>
                {formatContinuationDays(input.continuationSignal.daysUntilEnd)}.
                {' '}
                Review whether to extend the schedule and budget before this delivery window closes.
              </Text>
              {formatContinuationBudget(input.continuationSignal, input.currencyCode) ? (
                <Text size="xs" fw={700} className={classes.historyTooltipCopy}>
                  {formatContinuationBudget(input.continuationSignal, input.currencyCode)}
                </Text>
              ) : null}
            </Stack>
          </Paper>
        ) : null}

        {input.indicators.length > 0 ? (
          <Paper withBorder radius="md" p="xs" className={classes.historyTooltipSignal}>
            <Stack gap={6}>
              {input.indicators.map((indicator) => (
                <Group key={indicator.key} gap={6} wrap="nowrap" align="flex-start">
                  <div
                    aria-hidden="true"
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 999,
                      backgroundColor: indicator.color,
                      flexShrink: 0,
                      marginTop: 4,
                    }}
                  />
                  <div>
                    <Text size="xs" fw={800} className={classes.historyTooltipCopy}>
                      {indicator.label}
                    </Text>
                    <Text size="xs" className={classes.historyTooltipCopy}>
                      {indicator.detail}
                    </Text>
                  </div>
                </Group>
              ))}
            </Stack>
          </Paper>
        ) : null}
      </Stack>
    </Paper>
  );
}

function renderFilteredBarTooltip(input: {
  label: string | number | undefined;
  payload:
  | Array<{
    name?: string;
    value?: number | string | null;
    color?: string;
  }>
  | undefined;
  series: Array<{ name: string; color?: string }>;
  formatter: (value: number) => string;
}) {
  if (!input.payload || input.payload.length === 0) {
    return null;
  }

  const filteredPayload = input.payload.filter((item) => {
    const value =
      typeof item.value === 'number'
        ? item.value
        : typeof item.value === 'string'
          ? Number(item.value)
          : null;

    return value != null && Number.isFinite(value) && value > 0;
  });

  if (filteredPayload.length === 0) {
    return null;
  }

  return (
    <ChartTooltip
      label={typeof input.label === 'number' ? String(input.label) : input.label}
      payload={filteredPayload}
      series={input.series}
      valueFormatter={input.formatter}
    />
  );
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
          'This page is intentionally account-specific. Connect a platform first, then choose the ad account you want this dashboard to watch.',
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
          'The dashboard only becomes meaningful when it is tied to one selected ad account and one platform connection.',
      };
    case 'ad_account_selected_no_metrics':
      return {
        color: 'teal',
        title: 'This account is selected, but performance data is still sparse',
        description:
          'Keep the account selected and refresh again after the next sync cycle. The performance graphs and live delivery rows will fill in once metrics arrive.',
      };
    default:
      return {
        color: 'teal',
        title: 'Dashboard ready',
        description: 'Your selected ad account is ready for a daily operating read.',
      };
  }
}

function SummaryCard({
  label,
  value,
  detail,
  delta,
  icon: Icon,
}: {
  label: string;
  value: ReactNode;
  detail?: string | null;
  delta?: SummaryDelta | null;
  icon: typeof IconUsers;
}) {
  const isTextValue = typeof value === 'string' || typeof value === 'number';
  const DeltaIcon = delta?.direction === 'down' ? IconArrowDownRight : IconArrowUpRight;

  return (
    <Paper withBorder radius="xl" p="md" className={classes.metricCard}>
      <Group
        justify="space-between"
        align="flex-start"
        gap="md"
        wrap="nowrap"
        className={classes.summaryMetricGroup}
      >
        <div className={classes.summaryMetricBody}>
          <Text size="xs" c="dimmed" tt="uppercase" fw={800} className={classes.summaryLabel}>
            {label}
          </Text>
          {isTextValue ? (
            <Text fw={900} mt={8} className={`${classes.metricValue} ${classes.summaryValue}`}>
              {value}
            </Text>
          ) : (
            <div className={classes.summaryCustomValue}>{value}</div>
          )}
          {detail ? (
            <Text size="sm" c="dimmed" mt={8}>
              {detail}
            </Text>
          ) : null}
          {delta ? (
            <Badge
              mt={8}
              size="sm"
              radius="xl"
              variant="light"
              color={delta.direction === 'up' ? 'teal' : 'red'}
              leftSection={<DeltaIcon size={12} />}
              className={classes.summaryDelta}
            >
              {delta.direction === 'up' ? '+' : '-'}
              {delta.label} {delta.suffix ?? 'today'}
            </Badge>
          ) : null}
        </div>
        <ThemeIcon variant="light" color="blue" radius="md" className={classes.summaryMetricIcon}>
          <Icon size={18} />
        </ThemeIcon>
      </Group>
    </Paper>
  );
}

function DataSummaryBox({
  summary,
}: {
  summary: DataSummary | null;
}) {
  if (!summary) {
    return null;
  }

  return (
    <Paper withBorder radius="lg" p="sm" className={classes.dataSummaryBox}>
      <Group justify="space-between" gap="sm" wrap="nowrap">
        <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
          <span
            className={classes.dataSummaryDot}
            style={{ backgroundColor: summary.color ?? '#2563eb' }}
          />
          <div className={classes.dataSummaryText}>
            <Text size="xs" fw={800} className={classes.dataSummaryLabel}>
              {summary.label}
            </Text>
            {summary.detail ? (
              <Text size="11px" c="dimmed" className={classes.dataSummaryDetail}>
                {summary.detail}
              </Text>
            ) : null}
          </div>
        </Group>
        <div className={classes.dataSummaryValueWrap}>
          <Text size="10px" c="dimmed" tt="uppercase" fw={800}>
            {summary.eyebrow}
          </Text>
          <Text size="sm" fw={900} className={classes.dataSummaryValue}>
            {summary.value}
          </Text>
        </div>
      </Group>
    </Paper>
  );
}

function ComparisonMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <Text size="10px" c="dimmed" tt="uppercase" fw={800}>
        {label}
      </Text>
      <Text fw={800}>{value}</Text>
    </div>
  );
}

function ServingPlatformLogos({ labels }: { labels: string[] }) {
  return (
    <div className={classes.servingPlatformRow} aria-label={labels.join(', ')}>
      {labels.slice(0, 4).map((label) => {
        const { imageSrc, imageAlt } = resolvePlacementImage(label);

        return (
          <div key={label} className={classes.servingPlatformLogo} title={label}>
            <Image
              src={imageSrc}
              alt={imageAlt}
              width={26}
              height={26}
              className={classes.servingPlatformImage}
            />
          </div>
        );
      })}
    </div>
  );
}

function LiveDeliverySectionHeader({
  title,
}: {
  title: string;
}) {
  return (
    <div className={classes.liveTableHeader}>
      <Text size="11px" c="dimmed" tt="uppercase" fw={800}>
        {title}
      </Text>
    </div>
  );
}

function TableStatusBadge({ status }: { status: string | null | undefined }) {
  return (
    <Badge color={statusColor(status)} variant="light" radius="sm">
      {formatStatusLabel(status)}
    </Badge>
  );
}

function CampaignLiveRow({
  campaign,
  currencyCode,
  reportHref,
}: {
  campaign: DashboardLiveCampaignContainer;
  currencyCode: string | null;
  reportHref: string;
}) {
  return (
    <Paper withBorder radius="xl" p="md" className={classes.liveRow}>
      <Group justify="space-between" align="flex-start" gap="md" wrap="wrap">
        <div style={{ flex: 1, minWidth: 240 }}>
          <Group gap="xs" wrap="wrap" mb={6}>
            <Badge color={statusColor(campaign.status)} variant="light">
              {formatStatusLabel(campaign.status)}
            </Badge>
            <Badge color="gray" variant="outline">
              Campaign
            </Badge>
            {campaign.objective ? (
              <Badge color="blue" variant="outline">
                {formatStatusLabel(campaign.objective)}
              </Badge>
            ) : null}
          </Group>
          <Text fw={800}>{campaign.name}</Text>
        </div>

        <div className={classes.metricGrid}>
          <ComparisonMetric label="Spend" value={formatCurrency(campaign.spend, currencyCode)} />
          <ComparisonMetric label="Results" value={formatNumber(campaign.results)} />
          <ComparisonMetric
            label="Cost/Result"
            value={
              campaign.results > 0
                ? formatCurrency(campaign.costPerResult, currencyCode, 2)
                : '—'
            }
          />
          <ComparisonMetric label="CTR" value={formatRate(campaign.ctr)} />
          <ComparisonMetric label="Live ad sets" value={formatNumber(campaign.adsetCount)} />
          <ComparisonMetric label="Live ads" value={formatNumber(campaign.adCount)} />
        </div>
        <Button
          component={Link}
          href={reportHref}
          size="xs"
          radius="xl"
          variant="light"
          leftSection={<IconChartBar size={14} />}
        >
          View report
        </Button>
      </Group>
    </Paper>
  );
}

function AdsetComparisonRow({
  item,
  currencyCode,
  reportHref,
}: {
  item: DashboardLiveAdsetItem;
  currencyCode: string | null;
  reportHref: string;
}) {
  return (
    <Paper withBorder radius="xl" p="md" className={classes.liveRow}>
      <Group justify="space-between" align="flex-start" gap="md" wrap="wrap">
        <div style={{ flex: 1, minWidth: 240 }}>
          <Group gap="xs" wrap="wrap" mb={6}>
            <Badge color={statusColor(item.status)} variant="light">
              {formatStatusLabel(item.status)}
            </Badge>
            <Badge color="gray" variant="outline">
              Ad set
            </Badge>
            {item.optimizationGoal ? (
              <Badge color="blue" variant="outline">
                {formatStatusLabel(item.optimizationGoal)}
              </Badge>
            ) : null}
          </Group>
          <Text fw={800}>{item.name}</Text>
          <Text size="sm" c="dimmed" mt={6}>
            {item.campaignName ?? 'Campaign unavailable'}
          </Text>
          {item.topPublisherPlatform || item.topPlacement ? (
            <Text size="sm" c="dimmed" mt={4}>
              {[item.topPublisherPlatform, item.topPlacement].filter(Boolean).join(' · ')}
            </Text>
          ) : null}
        </div>

        <div className={classes.metricGrid}>
          <ComparisonMetric label="Spend" value={formatCurrency(item.spend, currencyCode)} />
          <ComparisonMetric label="Results" value={formatNumber(item.results)} />
          <ComparisonMetric
            label="Cost/Result"
            value={item.results > 0 ? formatCurrency(item.costPerResult, currencyCode, 2) : '—'}
          />
          <ComparisonMetric label="CTR" value={formatRate(item.ctr)} />
          <ComparisonMetric label="Live ads" value={formatNumber(item.adCount)} />
        </div>
        <Button
          component={Link}
          href={reportHref}
          size="xs"
          radius="xl"
          variant="light"
          leftSection={<IconChartBar size={14} />}
        >
          View report
        </Button>
      </Group>
    </Paper>
  );
}

function AdComparisonRow({
  item,
  currencyCode,
  reportHref,
}: {
  item: DashboardLiveAdItem;
  currencyCode: string | null;
  reportHref: string;
}) {
  return (
    <Paper withBorder radius="xl" p="md" className={classes.liveRow}>
      <Group justify="space-between" align="flex-start" gap="md" wrap="wrap">
        <div style={{ flex: 1, minWidth: 240 }}>
          <Group gap="xs" wrap="wrap" mb={6}>
            <Badge color={statusColor(item.status)} variant="light">
              {formatStatusLabel(item.status)}
            </Badge>
            <Badge color="gray" variant="outline">
              Ad
            </Badge>
          </Group>
          <Text fw={800}>{item.name}</Text>
          <Text size="sm" c="dimmed" mt={6}>
            {[item.campaignName, item.adsetName].filter(Boolean).join(' · ')}
          </Text>
          {item.topPublisherPlatform || item.topPlacement ? (
            <Text size="sm" c="dimmed" mt={4}>
              {[item.topPublisherPlatform, item.topPlacement].filter(Boolean).join(' · ')}
            </Text>
          ) : null}
        </div>

        <div className={classes.metricGrid}>
          <ComparisonMetric label="Spend" value={formatCurrency(item.spend, currencyCode)} />
          <ComparisonMetric label="Results" value={formatNumber(item.results)} />
          <ComparisonMetric
            label="Cost/Result"
            value={item.results > 0 ? formatCurrency(item.costPerResult, currencyCode, 2) : '—'}
          />
          <ComparisonMetric label="CTR" value={formatRate(item.ctr)} />
        </div>
        <Button
          component={Link}
          href={reportHref}
          size="xs"
          radius="xl"
          variant="light"
          leftSection={<IconChartBar size={14} />}
        >
          View report
        </Button>
      </Group>
    </Paper>
  );
}

function resolveBreakdownMetric(
  items: Array<{ results: number; clicks: number; spend: number }>
): BreakdownMetric {
  return items.some((item) => item.results > 0)
    ? 'results'
    : items.some((item) => item.clicks > 0)
      ? 'clicks'
      : 'spend';
}

function readBreakdownMetricValue(
  item: { results: number; clicks: number; spend: number },
  metric: BreakdownMetric
): number {
  return metric === 'results' ? item.results : metric === 'clicks' ? item.clicks : item.spend;
}

function normalizeGender(value: string): 'Female' | 'Male' | 'Unknown' {
  const normalized = value.trim().toLowerCase();

  if (normalized === 'female') {
    return 'Female';
  }

  if (normalized === 'male') {
    return 'Male';
  }

  return 'Unknown';
}

function ageBucketSortValue(value: string): number {
  const normalized = value.trim();
  const explicitIndex = AGE_BUCKET_ORDER.indexOf(normalized as (typeof AGE_BUCKET_ORDER)[number]);

  if (explicitIndex >= 0) {
    return explicitIndex;
  }

  if (/^\d+\+$/.test(normalized)) {
    return 900 + Number.parseInt(normalized, 10);
  }

  const rangeMatch = normalized.match(/^(\d+)\s*-\s*(\d+)$/);
  if (rangeMatch) {
    return Number.parseInt(rangeMatch[1], 10);
  }

  return 10_000;
}

function buildAgeGenderAudienceChart(input: {
  ageGender: DashboardAudienceSlice[];
  currencyCode: string | null;
}): AudienceChartConfig {
  const metric = resolveBreakdownMetric(input.ageGender);
  const ageBuckets = new Map<
    string,
    {
      segment: string;
      Female: number;
      Male: number;
      Unknown: number;
    }
  >();

  for (const slice of input.ageGender) {
    const [, ageValue = '', genderValue = ''] = slice.key.split(':');
    const age = ageValue.trim() || slice.label.trim();
    const gender = normalizeGender(genderValue);
    const current = ageBuckets.get(age) ?? {
      segment: age,
      Female: 0,
      Male: 0,
      Unknown: 0,
    };

    current[gender] += readBreakdownMetricValue(slice, metric);
    ageBuckets.set(age, current);
  }

  const data = Array.from(ageBuckets.values()).sort(
    (left, right) =>
      ageBucketSortValue(left.segment) - ageBucketSortValue(right.segment) ||
      left.segment.localeCompare(right.segment)
  );

  const includeUnknown = data.some((row) => row.Unknown > 0);
  const series: AudienceChartSeries[] = [
    { name: 'Female', color: 'pink.5' },
    { name: 'Male', color: 'blue.6' },
  ];

  if (includeUnknown) {
    series.push({ name: 'Unknown', color: 'gray.5' });
  }

  return {
    data,
    title: 'Audience response',
    type: 'stacked',
    series,
    formatter: (value: number) =>
      metric === 'spend'
        ? formatCompactCurrency(value, input.currencyCode)
        : formatNumber(value),
  };
}

function buildAudienceChart(input: {
  ageGender: DashboardAudienceSlice[];
  geo: DashboardAudienceSlice[];
  currencyCode: string | null;
}): AudienceChartConfig {
  if (input.ageGender.length > 0) {
    return buildAgeGenderAudienceChart({
      ageGender: input.ageGender,
      currencyCode: input.currencyCode,
    });
  }

  const metric = resolveBreakdownMetric(input.geo);
  const data = input.geo.slice(0, 6).map((item) => ({
    segment: item.label,
    Value: readBreakdownMetricValue(item, metric),
  }));

  return {
    data,
    title: 'Audience response by geo',
    type: 'default',
    series: [{ name: 'Value', color: 'teal.6' }],
    formatter: (value: number) =>
      metric === 'spend'
        ? formatCompactCurrency(value, input.currencyCode)
        : formatNumber(value),
  };
}

function buildSurfaceChart(input: {
  publisherPlatforms: DashboardPlatformSlice[];
  placements: DashboardPlatformSlice[];
  impressionDevices: DashboardPlatformSlice[];
  currencyCode: string | null;
}): SimpleBarChartConfig {
  const metric = resolveBreakdownMetric([
    ...input.publisherPlatforms,
    ...input.placements,
    ...input.impressionDevices,
  ]);

  const data = [
    ...input.publisherPlatforms.slice(0, 3).map((slice) => ({
      segment: `Platform · ${slice.label}`,
      Value: readBreakdownMetricValue(slice, metric),
    })),
    ...input.placements.slice(0, 3).map((slice) => ({
      segment: `Position · ${slice.label}`,
      Value: readBreakdownMetricValue(slice, metric),
    })),
    ...input.impressionDevices.slice(0, 2).map((slice) => ({
      segment: `Device · ${slice.label}`,
      Value: readBreakdownMetricValue(slice, metric),
    })),
  ];

  return {
    data,
    title: 'Surface response by platform, position, and device',
    color: 'blue.6',
    formatter: (value: number) =>
      metric === 'spend'
        ? formatCompactCurrency(value, input.currencyCode)
        : formatNumber(value),
  };
}

function buildGeoChart(input: {
  geo: DashboardAudienceSlice[];
  currencyCode: string | null;
}): SimpleBarChartConfig {
  const metric = resolveBreakdownMetric(input.geo);

  return {
    data: input.geo.slice(0, 6).map((slice) => ({
      segment: slice.secondaryLabel ? `${slice.label} · ${slice.secondaryLabel}` : slice.label,
      Value: readBreakdownMetricValue(slice, metric),
    })),
    title: 'Geo response from live delivery',
    color: 'teal.6',
    formatter: (value: number) =>
      metric === 'spend'
        ? formatCompactCurrency(value, input.currencyCode)
        : formatNumber(value),
  };
}

function resolvePlacementImage(label: string): { imageSrc: string; imageAlt: string } {
  const normalized = label.trim().toLowerCase();

  if (
    normalized.includes('instagram') ||
    normalized.includes('story') ||
    normalized.includes('stories') ||
    normalized.includes('reel') ||
    normalized.includes('explore') ||
    normalized.includes('profile')
  ) {
    return {
      imageSrc: '/images/platforms/logo/instagram.png',
      imageAlt: 'Instagram',
    };
  }

  if (
    normalized.includes('facebook') ||
    normalized.includes('feed') ||
    normalized.includes('video') ||
    normalized.includes('marketplace') ||
    normalized.includes('search') ||
    normalized.includes('right-hand') ||
    normalized.includes('in-stream')
  ) {
    return {
      imageSrc: '/images/platforms/logo/facebook.png',
      imageAlt: 'Facebook',
    };
  }

  return {
    imageSrc: '/images/platforms/logo/meta.png',
    imageAlt: 'Meta',
  };
}

function buildPlacementVisualRows(input: {
  placements: DashboardPlatformSlice[];
  currencyCode: string | null;
}): PlacementVisualRow[] {
  const metric = resolveBreakdownMetric(input.placements);
  const topPlacements = input.placements.slice(0, 5);
  const maxValue = Math.max(
    ...topPlacements.map((slice) => readBreakdownMetricValue(slice, metric)),
    0
  );

  return topPlacements.map((slice) => {
    const value = readBreakdownMetricValue(slice, metric);
    const { imageSrc, imageAlt } = resolvePlacementImage(slice.label);

    return {
      key: slice.key,
      label: slice.label,
      value,
      valueLabel:
        metric === 'spend'
          ? formatCompactCurrency(value, input.currencyCode)
          : formatNumber(value),
      detailLabel: `${slice.shareOfSpend.toFixed(1)}% of spend`,
      fillPercent: maxValue > 0 ? Math.max((value / maxValue) * 100, 8) : 0,
      imageSrc,
      imageAlt,
    };
  });
}

function platformSeriesColor(label: string): string {
  const normalized = label.trim().toLowerCase();

  switch (normalized) {
    case 'facebook':
      return 'blue.6';
    case 'instagram':
      return 'red.6';
    case 'messenger':
      return 'violet.6';
    case 'audience network':
      return 'orange.6';
    default:
      return 'gray.6';
  }
}

function buildPlatformPanelChart(input: {
  platforms: DashboardPlatformSlice[];
  currencyCode: string | null;
}): MultiSeriesBarChartConfig {
  const slices = input.platforms.slice(0, 4);
  const metric = resolveBreakdownMetric(slices);
  const series = slices.map((slice) => ({
    name: slice.label,
    color: platformSeriesColor(slice.label),
  }));

  const data = slices.map((slice) => {
    const row: Record<string, string | number> = {
      segment: slice.label,
    };

    for (const seriesItem of series) {
      row[seriesItem.name] = 0;
    }

    row[slice.label] = readBreakdownMetricValue(slice, metric);
    return row;
  });

  return {
    data,
    title: 'Publisher platform response',
    series,
    withLegend: series.length > 1,
    formatter: (value: number) =>
      metric === 'spend'
        ? formatCompactCurrency(value, input.currencyCode)
        : formatNumber(value),
  };
}

function buildDevicePanelChart(input: {
  devices: DashboardPlatformSlice[];
  currencyCode: string | null;
}): MultiSeriesBarChartConfig {
  const slices = input.devices.slice(0, 6);
  const metric = resolveBreakdownMetric(slices);

  return {
    data: slices.map((slice) => ({
      segment: slice.label,
      Value: readBreakdownMetricValue(slice, metric),
    })),
    title: 'Impression device response',
    series: [{ name: 'Value', color: 'cyan.6' }],
    withLegend: false,
    formatter: (value: number) =>
      metric === 'spend'
        ? formatCompactCurrency(value, input.currencyCode)
        : formatNumber(value),
  };
}

function pickTopChartSummary(
  chart: Pick<MultiSeriesBarChartConfig | AudienceChartConfig, 'data' | 'series' | 'formatter'>,
  eyebrow: string
): DataSummary | null {
  let topRow: Record<string, string | number> | null = null;
  let topValue = 0;

  for (const row of chart.data) {
    const value = chart.series.reduce((total, seriesItem) => {
      const rawValue = row[seriesItem.name];
      return total + (typeof rawValue === 'number' && Number.isFinite(rawValue) ? rawValue : 0);
    }, 0);

    if (!topRow || value > topValue) {
      topRow = row;
      topValue = value;
    }
  }

  if (!topRow || topValue <= 0) {
    return null;
  }

  return {
    eyebrow,
    label: String(topRow.segment ?? 'Top segment'),
    value: chart.formatter(topValue),
  };
}

function normalizeStateCode(label: string): string | null {
  const normalized = label.trim().toLowerCase().replace(/\./g, '');

  if (!normalized) {
    return null;
  }

  if (normalized.length === 2) {
    return normalized.toUpperCase();
  }

  return STATE_NAME_TO_CODE[normalized] ?? null;
}

function buildRegionStateMap(input: {
  geo: DashboardAudienceSlice[];
  currencyCode: string | null;
}): RegionStateMapConfig {
  const regionSlices = input.geo.filter(
    (slice) => slice.secondaryLabel?.trim().toLowerCase() === 'region'
  );
  const metric = resolveBreakdownMetric(regionSlices);
  const regionValues = new Map<string, { name: string; value: number }>();

  for (const slice of regionSlices) {
    const code = normalizeStateCode(slice.label);
    if (!code) {
      continue;
    }

    const current = regionValues.get(code) ?? {
      name:
        US_STATE_TILES.find((tile) => tile.code === code)?.name ??
        slice.label,
      value: 0,
    };

    current.value += readBreakdownMetricValue(slice, metric);
    regionValues.set(code, current);
  }

  const maxValue = Math.max(...Array.from(regionValues.values()).map((entry) => entry.value), 0);

  const states = US_STATE_TILES.map((tile) => {
    const match = regionValues.get(tile.code);
    const value = match?.value ?? 0;
    const intensity = maxValue > 0 ? value / maxValue : 0;

    return {
      code: tile.code,
      name: tile.name,
      col: tile.col,
      row: tile.row,
      value,
      valueLabel:
        metric === 'spend'
          ? formatCompactCurrency(value, input.currencyCode)
          : formatNumber(value),
      intensity,
      isActive: Boolean(match) && value > 0,
    };
  });

  return {
    title: 'Regional response by state',
    states,
    activeStates: states
      .filter((state) => state.isActive)
      .sort((left, right) => right.value - left.value || left.name.localeCompare(right.name))
      .slice(0, 6),
  };
}

function buildTrendChartConfig(input: {
  trendMode: TrendMode;
  granularity: HistoryGranularity;
  trendPoints: DashboardPayload['featuredAdsetHistory']['dailyTrend'];
  currencyCode: string | null;
}): TrendChartConfig {
  if (input.granularity === 'hourly') {
    if (input.trendMode === 'efficiency') {
      return {
        data: input.trendPoints.map((point) => ({
          label: point.label,
          'CTR (%)': Number(point.ctr.toFixed(2)),
          'CPC ($)': Number(point.cpc.toFixed(2)),
          'CPM ($)': Number(point.cpm.toFixed(2)),
        })),
        series: [
          { name: 'CTR (%)', color: FEATURED_HISTORY_COLORS.ctr },
          { name: 'CPC ($)', color: FEATURED_HISTORY_COLORS.cpc },
          { name: 'CPM ($)', color: FEATURED_HISTORY_COLORS.cpm },
        ],
        title: 'CTR, CPC, and CPM by hour',
        description:
          'Advertiser-time efficiency signals across the full synced hourly history for the featured ad set.',
        formatter: (value: number) => formatDecimal(value),
      };
    }

    if (input.trendMode === 'combined') {
      const deliveryValues = input.trendPoints.map(
        (point) =>
          point.spend * 0.3 +
          point.results * 0.35 +
          point.clicks * 0.2 +
          point.inlineLinkClicks * 0.15
      );
      const efficiencyValues = input.trendPoints.map((point) => {
        const ctrScore = point.ctr;
        const cpcScore = point.cpc > 0 ? 100 / point.cpc : 0;
        const cpmScore = point.cpm > 0 ? 100 / point.cpm : 0;

        return ctrScore * 0.4 + cpcScore * 0.35 + cpmScore * 0.25;
      });

      const normalizedDelivery = normalizeTrendSeries(deliveryValues);
      const normalizedEfficiency = normalizeTrendSeries(efficiencyValues);

      return {
        data: input.trendPoints.map((point, index) => ({
          label: point.label,
          'Delivery index': normalizedDelivery[index] ?? 0,
          'Efficiency index': normalizedEfficiency[index] ?? 0,
        })),
        series: [
          { name: 'Delivery index', color: FEATURED_HISTORY_COLORS.deliveryIndex },
          { name: 'Efficiency index', color: FEATURED_HISTORY_COLORS.efficiencyIndex },
        ],
        title: 'Hourly delivery and efficiency crossover',
        description:
          'Indexed advertiser-time view of delivery versus efficiency across the full synced hourly history for the featured ad set.',
        formatter: (value: number) => `${formatDecimal(value)} idx`,
      };
    }

    return {
      data: input.trendPoints.map((point) => ({
        label: point.label,
        'Spend ($)': Number(point.spend.toFixed(2)),
        Results: point.results,
        Clicks: point.clicks,
      })),
      series: [
        { name: 'Spend ($)', color: FEATURED_HISTORY_COLORS.spend },
        { name: 'Results', color: FEATURED_HISTORY_COLORS.results },
        { name: 'Clicks', color: FEATURED_HISTORY_COLORS.clicks },
      ],
      title: 'Spend, results, and clicks by hour',
      description:
        'Advertiser-time delivery across the full synced hourly history for the featured ad set, including hourly action-derived results.',
      formatter: (value: number) => formatCompactNumber(value),
    };
  }

  if (input.trendMode === 'efficiency') {
    return {
      data: input.trendPoints.map((point) => ({
        label: formatChartDateLabel(point.label),
        'CTR (%)': Number(point.ctr.toFixed(2)),
        'CPC ($)': Number(point.cpc.toFixed(2)),
        'CPM ($)': Number(point.cpm.toFixed(2)),
      })),
      series: [
        { name: 'CTR (%)', color: FEATURED_HISTORY_COLORS.ctr },
        { name: 'CPC ($)', color: FEATURED_HISTORY_COLORS.cpc },
        { name: 'CPM ($)', color: FEATURED_HISTORY_COLORS.cpm },
      ],
      title: 'CTR, CPC, and CPM',
      description: 'Efficiency signals that show whether the featured ad set is getting cheaper and cleaner over time.',
      formatter: (value: number) => formatDecimal(value),
    };
  }

  if (input.trendMode === 'combined') {
    const combinedPoints = buildCombinedTrendSeries({
      granularity: input.granularity,
      trendPoints: input.trendPoints,
    });

    return {
      data: combinedPoints.map((point) => ({
        label: point.displayLabel,
        'Delivery index': point.deliveryIndex,
        'Efficiency index': point.efficiencyIndex,
      })),
      series: [
        { name: 'Delivery index', color: FEATURED_HISTORY_COLORS.deliveryIndex },
        { name: 'Efficiency index', color: FEATURED_HISTORY_COLORS.efficiencyIndex },
      ],
      title: 'Delivery and efficiency crossover',
      description:
        'Indexed view of volume versus efficiency so you can spot where performance growth started to help or hurt efficiency.',
      formatter: (value: number) => `${formatDecimal(value)} idx`,
    };
  }

  return {
    data: input.trendPoints.map((point) => ({
      label: formatChartDateLabel(point.label),
      'Spend ($)': Number(point.spend.toFixed(2)),
      Results: point.results,
      Clicks: point.clicks,
    })),
    series: [
      { name: 'Spend ($)', color: FEATURED_HISTORY_COLORS.spend },
      { name: 'Results', color: FEATURED_HISTORY_COLORS.results },
      { name: 'Clicks', color: FEATURED_HISTORY_COLORS.clicks },
    ],
    title: 'Spend, results, and clicks',
    description: 'Delivery volume for the featured ad set from first delivery through today.',
    formatter: (value: number) => formatCompactNumber(value),
  };
}

export function DashboardShellClient({ basePayload, children, below }: DashboardShellClientProps) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshFeedback, setRefreshFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const stateMeta = stateContent(basePayload.state);
  const reportsHref = buildDashboardAccountReportHref(basePayload);

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
        message:
          result.message ??
          `Sync completed: ${result.refreshedCount ?? 0} updated, ${result.failedCount ?? 0} failed.`,
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

  return (
    <Container fluid px={6} py={0} className={`${classes.page} dashboard-page-shell`}>
      <Stack gap="md" className={classes.shell}>
        {refreshFeedback ? (
          <Alert
            color={refreshFeedback.type === 'success' ? 'green' : 'red'}
            icon={<IconRefresh size={16} />}
            radius="lg"
            withCloseButton
            closeButtonLabel="Dismiss sync notification"
            onClose={() => setRefreshFeedback(null)}
          >
            {refreshFeedback.message}
          </Alert>
        ) : null}

        {basePayload.syncCoverage?.historicalAnalysisPending ? (
          <Alert
            color={basePayload.syncCoverage.activeJobStatus === 'failed' ? 'red' : 'blue'}
            radius="lg"
            icon={<IconClock size={16} />}
            title={
              basePayload.syncCoverage.activeJobStatus === 'failed'
                ? 'History sync needs attention'
                : 'Recent data is ready while full history continues'
            }
          >
            <Text size="sm">
              {basePayload.syncCoverage.coverageStartDate && basePayload.syncCoverage.coverageEndDate
                ? `Dashboard readings are using synced data from ${basePayload.syncCoverage.coverageStartDate} through ${basePayload.syncCoverage.coverageEndDate}.`
                : 'DeepVisor is still filling the first historical sync for this account.'}
            </Text>
          </Alert>
        ) : null}

        {basePayload.state !== 'ready' ? (
          <Alert
            color={stateMeta.color}
            radius="lg"
            icon={<IconAlertCircle size={16} />}
            title={stateMeta.title}
          >
            <Text size="sm">{stateMeta.description}</Text>
            {basePayload.viewContext.platformError ? (
              <Text size="sm" mt="sm">
                {basePayload.viewContext.platformError}
              </Text>
            ) : null}
            <Group gap="sm" mt="md">
              <Button component={Link} href="/integration" size="xs" radius="xl" variant="light">
                Manage integrations
              </Button>
              {basePayload.viewContext.canRefresh ? (
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

        <Card withBorder radius="xl" p="lg" className={`${classes.topBar} ${classes.dashboardShellTopBar}`}>
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
                  <Badge color={statusColor(basePayload.viewContext.platformStatus)} variant="light">
                    {basePayload.viewContext.platformName ?? 'No platform selected'}
                  </Badge>
                  <Badge color={statusColor(basePayload.viewContext.adAccountStatus)} variant="outline">
                    {basePayload.viewContext.adAccountName ?? 'No ad account selected'}
                  </Badge>
                </Group>
                <Text fw={900} size="1.65rem" mt="sm" className={classes.title}>
                  {basePayload.viewContext.adAccountName ?? 'Selected ad account'}
                </Text>
              </div>

              <Group gap="sm" wrap="wrap" className={classes.topBarActions}>
                <Button
                  onClick={handleRefresh}
                  leftSection={<IconRefresh size={16} />}
                  loading={refreshing}
                  disabled={!basePayload.viewContext.canRefresh}
                  radius="xl"
                  className="app-platform-page-action-primary"
                >
                  Refresh
                </Button>
                <Button
                  component={Link}
                  href={reportsHref}
                  radius="xl"
                  variant="default"
                  className="app-platform-page-action-secondary"
                >
                  Reports
                </Button>
              </Group>
            </Group>

          </Stack>
        </Card>
        {children}
        {below}
      </Stack>
    </Container>
  );
}

export function FeaturedAdsetSkeleton() {
  return (
    <Grid gutter="md" align="stretch">
      <Grid.Col span={{ base: 12, xl: 8 }}>
        <Paper withBorder radius="xl" p="md" className={classes.chartPanel}>
          <Stack gap="md">
            <Skeleton height={26} width="40%" radius="md" />
            <Skeleton height={330} radius="lg" />
          </Stack>
        </Paper>
      </Grid.Col>
      <Grid.Col span={{ base: 12, xl: 4 }}>
        <Paper withBorder radius="xl" p="md" className={classes.chartPanel}>
          <Stack gap="md">
            <Skeleton height={26} width="55%" radius="md" />
            <Skeleton height={220} radius="lg" />
            <Skeleton height={160} radius="lg" />
          </Stack>
        </Paper>
      </Grid.Col>
    </Grid>
  );
}

export function SummaryCardsSkeleton() {
  return (
    <SimpleGrid cols={{ base: 3, sm: 3, lg: 3, xl: 6 }} spacing="md" className={classes.summaryCardsGrid}>
      {Array.from({ length: 6 }).map((_, index) => (
        <Paper key={index} withBorder radius="xl" p="md" className={classes.metricCard}>
          <Stack gap="sm">
            <Skeleton height={14} width="65%" radius="md" />
            <Skeleton height={30} width="50%" radius="md" />
          </Stack>
        </Paper>
      ))}
    </SimpleGrid>
  );
}

export function LiveDeliveryTablesSkeleton() {
  return (
    <Card withBorder radius="xl" p="lg" className={classes.panel}>
      <Stack gap="md">
        <Skeleton height={24} width="32%" radius="md" />
        <Skeleton height={180} radius="lg" />
        <Skeleton height={220} radius="lg" />
      </Stack>
    </Card>
  );
}

export default function DashboardClient({
  payload,
  variant = 'full',
  sections,
}: DashboardClientProps) {
  const isPhone = useMediaQuery('(max-width: 48em)');
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [trendMode, setTrendMode] = useState<TrendMode>('delivery');
  const [historyGranularity, setHistoryGranularity] = useState<HistoryGranularity>('day');
  const [hourlyRangeMode, setHourlyRangeMode] = useState<HourlyRangeMode>('today');
  const [deliveryWindowMode, setDeliveryWindowMode] = useState<DeliveryWindowMode>('today');
  const [surfacePanelMode, setSurfacePanelMode] = useState<SurfacePanelMode>('platform');
  const [mobileHistoryModalOpen, setMobileHistoryModalOpen] = useState(false);
  const [activeFindingsPopoverOpen, setActiveFindingsPopoverOpen] = useState(false);
  const [activeFindings, setActiveFindings] = useState(payload.activeFindings);
  const [dismissingFindingIds, setDismissingFindingIds] = useState<Set<string>>(() => new Set());
  const [dismissingAllFindings, setDismissingAllFindings] = useState(false);
  const [extensionModalOpen, setExtensionModalOpen] = useState(false);
  const [extensionDays, setExtensionDays] = useState(14);
  const [localNoLiveDeliveryAlertVisible, setLocalNoLiveDeliveryAlertVisible] = useState(true);
  const [localContinuationAlertVisible, setLocalContinuationAlertVisible] = useState(true);
  const [dismissedDashboardNotificationIds, setDismissedDashboardNotificationIds] = useState<
    Set<string>
  >(
    () =>
      new Set(
        payload.dashboardNotifications
          .filter((notification) => notification.read)
          .map((notification) => notification.id)
      )
  );
  const [refreshFeedback, setRefreshFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const expandedHourlyViewportRef = useRef<HTMLDivElement>(null);
  const activeFindingsCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const renderFullShell = variant === 'full';
  const showFeaturedHistory = sections?.featuredHistory ?? true;
  const showSummaryCards = sections?.summaryCards ?? true;
  const showLiveDeliveryTables = sections?.liveDeliveryTables ?? true;
  const showNoLiveDeliveryAlert = sections?.noLiveDeliveryAlert ?? renderFullShell;
  const showDashboardNotifications = sections?.dashboardNotifications ?? renderFullShell;
  const shouldRenderDashboardCard = renderFullShell || showFeaturedHistory || showSummaryCards;
  const noLiveDeliveryNotification = payload.dashboardNotifications.find(
    (notification) => notification.type === 'no_live_delivery'
  );
  const continuationNotification = payload.dashboardNotifications.find(
    (notification) => notification.type === 'campaign_ending'
  );
  const noLiveDeliveryAlertVisible = noLiveDeliveryNotification
    ? !dismissedDashboardNotificationIds.has(noLiveDeliveryNotification.id)
    : localNoLiveDeliveryAlertVisible;
  const continuationAlertVisible = continuationNotification
    ? !dismissedDashboardNotificationIds.has(continuationNotification.id)
    : localContinuationAlertVisible;
  const selectedPlatformIntegrationId =
    payload.platform?.id ?? payload.selection.selectedPlatformIntegrationId;
  const selectedAdAccountId = payload.adAccount?.id ?? payload.selection.selectedAdAccountId;
  const reportsHref = buildDashboardAccountReportHref(payload);

  const stateMeta = stateContent(payload.state);
  const isMeta = payload.platform?.vendor === 'meta';
  const todayLiveWindow = payload.liveToday;
  const lifetimeLiveWindow = payload.liveLifetime;
  const activeDeliveryWindowMode =
    deliveryWindowMode === 'lifetime' && lifetimeLiveWindow.hasLiveDelivery
      ? 'lifetime'
      : 'today';
  const liveWindow = activeDeliveryWindowMode === 'lifetime' ? lifetimeLiveWindow : todayLiveWindow;
  const liveSummary = liveWindow.summary;
  const mobileLiveRowLimit = 3;
  const isLifetimeDeliveryWindow = activeDeliveryWindowMode === 'lifetime';
  const summaryCampaignLabel = isLifetimeDeliveryWindow ? 'Campaigns' : 'Live campaigns';
  const summaryAdsetLabel = isLifetimeDeliveryWindow ? 'Ad sets' : 'Live ad sets';
  const summaryAdLabel = isLifetimeDeliveryWindow ? 'Ads' : 'Live ads';
  const summaryPlatformLabel = isLifetimeDeliveryWindow ? 'Platforms' : 'Serving platforms';
  const summaryPlatformValue =
    liveSummary.servingPlatformLabels.length > 0
      ? <ServingPlatformLogos labels={liveSummary.servingPlatformLabels} />
      : isLifetimeDeliveryWindow && payload.viewContext.platformName
        ? payload.viewContext.platformName
        : isMeta
          ? 'Syncing'
          : 'Unavailable';
  const liveComparisons = liveWindow.comparisons;
  const featuredPlatformBreakdowns = payload.featuredAdsetHistory.platformBreakdowns;
  const featuredAudienceBreakdowns = payload.featuredAdsetHistory.audienceBreakdowns;
  const dailyTrendPoints = payload.featuredAdsetHistory.dailyTrend;
  const hourlyTrendPoints = payload.featuredAdsetHistory.hourlyTrend;
  const hourlyTrendExpandedPoints = payload.featuredAdsetHistory.hourlyTrendExpanded;
  const hasExpandedHourlyTrend = hourlyTrendExpandedPoints.length > hourlyTrendPoints.length;
  const selectedHourlyTrendPoints =
    hourlyRangeMode === 'expanded' && hasExpandedHourlyTrend
      ? hourlyTrendExpandedPoints
      : hourlyTrendPoints;
  const trendPoints = historyGranularity === 'hourly' ? selectedHourlyTrendPoints : dailyTrendPoints;
  const featuredAdset = payload.featuredAdsetHistory.adset;
  const continuationSignal = payload.featuredAdsetHistory.continuationSignal;
  const primaryActiveFinding = activeFindings[0] ?? null;
  const dailyHistoryRangeLabel = formatDateSpan(
    payload.featuredAdsetHistory.dailyHistoryStartDate,
    payload.featuredAdsetHistory.dailyHistoryEndDate
  );
  const hourlyHistoryRangeLabel = formatDateSpan(
    payload.featuredAdsetHistory.hourlyHistoryStartDate,
    payload.featuredAdsetHistory.hourlyHistoryEndDate
  );
  const hasHourlyTrend = hourlyTrendPoints.length > 0;
  const hourlyTodayLabel = formatReadableDate(payload.featuredAdsetHistory.hourlyHistoryDate);
  const featuredHistoryChartHeight = isPhone ? 156 : FEATURED_HISTORY_CHART_HEIGHT;
  const mobileHistoryModalChartHeight = 360;
  const deliverySurfaceChartHeight = isPhone ? 160 : DELIVERY_SURFACE_CHART_HEIGHT;
  const audienceBreakdownChartHeight = isPhone ? 150 : AUDIENCE_BREAKDOWN_CHART_HEIGHT;
  const trendYAxisWidth = isPhone ? 34 : 68;
  const expandedHourlyPointWidth = isPhone ? 28 : EXPANDED_HOURLY_POINT_WIDTH;
  const expandedHourlyMinWidth = isPhone ? 1120 : EXPANDED_HOURLY_MIN_WIDTH;

  const trendChart = useMemo(
    () =>
      buildTrendChartConfig({
        trendMode,
        granularity: historyGranularity,
        trendPoints,
        currencyCode: payload.viewContext.currencyCode,
      }),
    [trendMode, historyGranularity, trendPoints, payload.viewContext.currencyCode]
  );
  const mobilePreviewTrendChart = useMemo(
    () =>
      buildTrendChartConfig({
        trendMode: 'delivery',
        granularity: 'day',
        trendPoints: dailyTrendPoints,
        currencyCode: payload.viewContext.currencyCode,
      }),
    [dailyTrendPoints, payload.viewContext.currencyCode]
  );
  const latestDailyTrendPair = useMemo(
    () => getLatestTrendPointPair(dailyTrendPoints),
    [dailyTrendPoints]
  );
  const summarySpendDelta = activeDeliveryWindowMode === 'today' &&
    liveSummary.spend > 0 &&
    latestDailyTrendPair?.previous
    ? buildSummaryDelta(
      latestDailyTrendPair.latest.spend,
      latestDailyTrendPair.previous.spend,
      (value) => formatCurrency(value, payload.viewContext.currencyCode)
    )
    : null;
  const summaryResultsDelta = activeDeliveryWindowMode === 'today' &&
    liveSummary.primaryOutcomeValue > 0 &&
    latestDailyTrendPair?.previous
    ? buildSummaryDelta(
      latestDailyTrendPair.latest.results,
      latestDailyTrendPair.previous.results,
      formatNumber
    )
    : null;
  const mobileTrendDataSummary = latestDailyTrendPair
    ? {
      eyebrow: 'Latest day',
      label: formatChartDateLabel(latestDailyTrendPair.latest.label),
      value: formatNumber(latestDailyTrendPair.latest.results),
      detail: `${formatCurrency(
        latestDailyTrendPair.latest.spend,
        payload.viewContext.currencyCode
      )} spend · ${formatNumber(latestDailyTrendPair.latest.clicks)} clicks`,
      color: FEATURED_HISTORY_COLORS.results,
    }
    : null;
  const continuationEndLabel =
    continuationSignal && historyGranularity === 'day'
      ? formatChartDateLabel(continuationSignal.endDate)
      : null;
  const trendChartData = useMemo(() => {
    if (!continuationSignal || historyGranularity !== 'day' || !continuationEndLabel) {
      return trendChart.data;
    }

    if (trendChart.data.some((point) => point.label === continuationEndLabel)) {
      return trendChart.data;
    }

    const insertIndex = dailyTrendPoints.findIndex(
      (point) => point.label > continuationSignal.endDate
    );
    const markerPoint: Record<string, string | number | null> = { label: continuationEndLabel };

    if (insertIndex < 0) {
      return [...trendChart.data, markerPoint];
    }

    return [
      ...trendChart.data.slice(0, insertIndex),
      markerPoint,
      ...trendChart.data.slice(insertIndex),
    ];
  }, [
    continuationEndLabel,
    continuationSignal,
    dailyTrendPoints,
    historyGranularity,
    trendChart.data,
  ]);
  const activeDeliveryDateKeys = useMemo(() => {
    const keys = new Set<string>();

    for (const point of dailyTrendPoints) {
      const dateKey = getTrendPointDateKey(point);

      if (dateKey && hasActiveDeliveryPoint(point)) {
        keys.add(dateKey);
      }
    }

    return keys;
  }, [dailyTrendPoints]);
  const extensionPreviewEndDate =
    continuationSignal ? addDaysToIsoDate(continuationSignal.endDate, extensionDays) : null;
  const expandedHourlyTickValues = useMemo(
    () =>
      historyGranularity === 'hourly' && hourlyRangeMode === 'expanded'
        ? trendChartData
          .map((point) => String(point.label ?? ''))
          .filter(isExpandedHourlyAnchor)
        : [],
    [historyGranularity, hourlyRangeMode, trendChartData]
  );
  const isExpandedHourlyScrollable =
    historyGranularity === 'hourly' && hourlyRangeMode === 'expanded';
  const expandedHourlyChartWidth = useMemo(
    () =>
      isExpandedHourlyScrollable
        ? Math.max(expandedHourlyMinWidth, trendChartData.length * expandedHourlyPointWidth)
        : null,
    [expandedHourlyMinWidth, expandedHourlyPointWidth, isExpandedHourlyScrollable, trendChartData.length]
  );
  const trendXAxisProps = useMemo(() => {
    const axisPadding = {
      left: isPhone ? 8 : 18,
      right: isPhone ? 10 : 30,
    };

    if (historyGranularity === 'hourly' && hourlyRangeMode === 'expanded') {
      return {
        interval: 0 as const,
        minTickGap: isPhone ? 18 : 28,
        tickMargin: isPhone ? 6 : 10,
        padding: axisPadding,
        ticks: expandedHourlyTickValues,
        tickFormatter: (value: string) => formatExpandedHourlyAxisLabel(String(value)),
      };
    }

    return {
      minTickGap: historyGranularity === 'hourly' ? (isPhone ? 18 : 24) : isPhone ? 28 : 18,
      tickMargin: isPhone ? 6 : 10,
      padding: axisPadding,
    };
  }, [expandedHourlyTickValues, historyGranularity, hourlyRangeMode, isPhone]);
  const trendDotProps = useMemo(
    () => ({
      r: isPhone ? 0 : 3,
      strokeWidth: isPhone ? 0 : 2,
      fill: '#ffffff',
    }),
    [isPhone]
  );
  const trendActiveDotProps = useMemo(
    () => ({
      r: isPhone ? 4 : 5,
      strokeWidth: isPhone ? 2 : 2,
      fill: '#ffffff',
    }),
    [isPhone]
  );
  const modalTrendDotProps = useMemo(
    () => ({
      r: 3,
      strokeWidth: 2,
      fill: '#ffffff',
    }),
    []
  );
  const modalTrendActiveDotProps = useMemo(
    () => ({
      r: 6,
      strokeWidth: 2,
      fill: '#ffffff',
    }),
    []
  );
  const trendLineChartProps = useMemo(
    () => ({
      margin: {
        top: isPhone ? 12 : 8,
        right: isPhone ? 8 : 32,
        bottom: isPhone ? 10 : 8,
        left: isPhone ? 0 : 8,
      },
    }),
    [isPhone]
  );
  const combinedTrendSignals = useMemo(
    () =>
      detectTrendSignals({
        granularity: historyGranularity,
        trendPoints,
      }),
    [historyGranularity, trendPoints]
  );
  const combinedSignalByLabel = useMemo(
    () =>
      new Map(
        combinedTrendSignals.map((signal) => [signal.dateLabel, signal] as const)
      ),
    [combinedTrendSignals]
  );
  const primaryCombinedTrendSignal = useMemo(
    () => selectPrimaryTrendSignal(combinedTrendSignals),
    [combinedTrendSignals]
  );
  const trendPointIndicators = useMemo<TrendPointIndicator[]>(() => {
    const indicators: TrendPointIndicator[] = [];

    if (trendMode === 'combined') {
      return [];
    }

    if (historyGranularity === 'day') {
      if (trendMode === 'delivery') {
        const topResultsPoint = pickMaxTrendPoint(dailyTrendPoints, 'results');
        const topSpendPoint = pickMaxTrendPoint(dailyTrendPoints, 'spend');

        if (topResultsPoint) {
          indicators.push({
            key: `day-results-indicator:${topResultsPoint.label}`,
            x: formatChartDateLabel(topResultsPoint.label),
            y: topResultsPoint.results,
            color: FEATURED_HISTORY_COLORS.results,
            label: 'Highest results',
            detail: 'Strongest daily results point in the full featured ad set history.',
          });
        }

        if (topSpendPoint) {
          indicators.push({
            key: `day-spend-indicator:${topSpendPoint.label}`,
            x: formatChartDateLabel(topSpendPoint.label),
            y: Number(topSpendPoint.spend.toFixed(2)),
            color: FEATURED_HISTORY_COLORS.spend,
            label: 'Highest spend',
            detail: 'Largest daily spend point in the full featured ad set history.',
          });
        }
      }

      if (trendMode === 'efficiency') {
        const topCtrPoint = pickMaxTrendPoint(dailyTrendPoints, 'ctr');

        if (topCtrPoint) {
          indicators.push({
            key: `day-ctr-indicator:${topCtrPoint.label}`,
            x: formatChartDateLabel(topCtrPoint.label),
            y: Number(topCtrPoint.ctr.toFixed(2)),
            color: FEATURED_HISTORY_COLORS.ctr,
            label: 'Best CTR',
            detail: 'Highest daily click-through rate point in the full featured ad set history.',
          });
        }
      }

      return indicators;
    }

    const findVisibleHourlyPoint = (target: DashboardTrendPoint | null) => {
      if (!target) {
        return null;
      }

      return trendPoints.find(
        (point) => point.dayKey === target.dayKey && point.hourOfDay === target.hourOfDay
      ) ?? null;
    };

    if (trendMode === 'delivery') {
      const topResultsPoint = pickMaxTrendPoint(hourlyTrendExpandedPoints, 'results');
      const visibleResultsPoint = findVisibleHourlyPoint(topResultsPoint);
      const topSpendPoint = pickMaxTrendPoint(hourlyTrendExpandedPoints, 'spend');
      const visibleSpendPoint = findVisibleHourlyPoint(topSpendPoint);

      if (visibleResultsPoint) {
        indicators.push({
          key: `hourly-results-indicator:${visibleResultsPoint.dayKey ?? visibleResultsPoint.label}:${visibleResultsPoint.hourOfDay ?? 'na'}`,
          x: visibleResultsPoint.label,
          y: visibleResultsPoint.results,
          color: FEATURED_HISTORY_COLORS.results,
          label: 'Highest results',
          detail: 'Strongest hourly results point in the full synced hourly history.',
        });
      }

      if (visibleSpendPoint) {
        indicators.push({
          key: `hourly-spend-indicator:${visibleSpendPoint.dayKey ?? visibleSpendPoint.label}:${visibleSpendPoint.hourOfDay ?? 'na'}`,
          x: visibleSpendPoint.label,
          y: Number(visibleSpendPoint.spend.toFixed(2)),
          color: FEATURED_HISTORY_COLORS.spend,
          label: 'Highest spend',
          detail: 'Largest hourly spend point in the full synced hourly history.',
        });
      }
    }

    if (trendMode === 'efficiency') {
      const topCtrPoint = pickMaxTrendPoint(hourlyTrendExpandedPoints, 'ctr');
      const visibleCtrPoint = findVisibleHourlyPoint(topCtrPoint);

      if (visibleCtrPoint) {
        indicators.push({
          key: `hourly-ctr-indicator:${visibleCtrPoint.dayKey ?? visibleCtrPoint.label}:${visibleCtrPoint.hourOfDay ?? 'na'}`,
          x: visibleCtrPoint.label,
          y: Number(visibleCtrPoint.ctr.toFixed(2)),
          color: FEATURED_HISTORY_COLORS.ctr,
          label: 'Best CTR',
          detail: 'Highest hourly click-through rate point in the full synced hourly history.',
        });
      }
    }

    return indicators;
  }, [dailyTrendPoints, historyGranularity, hourlyTrendExpandedPoints, trendMode, trendPoints]);
  const trendPointIndicatorsByLabel = useMemo(() => {
    const indicatorsByLabel = new Map<string, TrendPointIndicator[]>();

    for (const indicator of trendPointIndicators) {
      const current = indicatorsByLabel.get(indicator.x) ?? [];
      current.push(indicator);
      indicatorsByLabel.set(indicator.x, current);
    }

    return indicatorsByLabel;
  }, [trendPointIndicators]);
  const trendReferenceLines = useMemo(
    () => {
      const lines: Array<{
        x: string;
        color: string;
        label?: string;
        labelPosition: 'insideTop';
        strokeDasharray: string;
      }> = [];

      if (trendMode === 'combined' && primaryCombinedTrendSignal) {
        lines.push({
          x: primaryCombinedTrendSignal.dateLabel,
          color: signalSeverityColor(primaryCombinedTrendSignal.severity),
          label: undefined,
          labelPosition: 'insideTop',
          strokeDasharray: '4 4',
        });
      }

      const findingLabel =
        primaryActiveFinding?.metricSnapshot.sourceWindow === 'daily' &&
          historyGranularity === 'day' &&
          typeof primaryActiveFinding.metricSnapshot.label === 'string'
          ? formatChartDateLabel(primaryActiveFinding.metricSnapshot.label)
          : null;

      if (trendMode === 'combined' && findingLabel) {
        lines.push({
          x: findingLabel,
          color: signalSeverityColor(primaryActiveFinding.severity),
          label: undefined,
          labelPosition: 'insideTop',
          strokeDasharray: '2 6',
        });
      }

      if (continuationSignal && historyGranularity === 'day' && continuationEndLabel) {
        lines.push({
          x: continuationEndLabel,
          color: 'orange',
          label: isPhone
            ? undefined
            : `${formatContinuationEntityLevel(continuationSignal.entityLevel)} ends`,
          labelPosition: 'insideTop',
          strokeDasharray: '3 5',
        });
      }

      return lines.length > 0 ? lines : undefined;
    },
    [
      continuationEndLabel,
      continuationSignal,
      historyGranularity,
      isPhone,
      primaryActiveFinding,
      primaryCombinedTrendSignal,
      trendMode,
    ]
  );
  const trendTooltipProps = useMemo(
    () => ({
      content: ({
        label,
        payload: tooltipPayload,
      }: {
        label?: string;
        payload?: Array<{ name?: string; value?: number | string | null; color?: string }>;
      }) =>
        renderTrendTooltip({
          label,
          payload: tooltipPayload,
          series: trendChart.series,
          formatter: trendChart.formatter,
          signal:
            trendMode === 'combined' && typeof label === 'string'
              ? combinedSignalByLabel.get(label) ?? null
              : null,
          indicators:
            typeof label === 'string'
              ? trendPointIndicatorsByLabel.get(label) ?? []
              : [],
          continuationSignal,
          continuationLabel: continuationEndLabel,
          currencyCode: payload.viewContext.currencyCode,
        }),
    }),
    [
      combinedSignalByLabel,
      continuationEndLabel,
      continuationSignal,
      payload.viewContext.currencyCode,
      trendChart.formatter,
      trendChart.series,
      trendMode,
      trendPointIndicatorsByLabel,
    ]
  );
  const mobilePreviewTrendTooltipProps = useMemo(
    () => ({
      allowEscapeViewBox: { x: true, y: true },
      offset: 0,
      position: { x: 18, y: featuredHistoryChartHeight + 8 },
      wrapperStyle: {
        maxWidth: 'min(248px, calc(100vw - 96px))',
        outline: 'none',
        zIndex: 4,
      },
      content: ({
        label,
        payload: tooltipPayload,
      }: {
        label?: string;
        payload?: Array<{ name?: string; value?: number | string | null; color?: string }>;
      }) =>
        renderTrendTooltip({
          label,
          payload: tooltipPayload,
          series: mobilePreviewTrendChart.series,
          formatter: mobilePreviewTrendChart.formatter,
          signal: null,
          indicators: [],
          continuationSignal: null,
          continuationLabel: null,
          currencyCode: payload.viewContext.currencyCode,
        }),
    }),
    [
      featuredHistoryChartHeight,
      mobilePreviewTrendChart.formatter,
      mobilePreviewTrendChart.series,
      payload.viewContext.currencyCode,
    ]
  );

  const audienceChart = useMemo(
    () =>
      buildAudienceChart({
        ageGender: featuredAudienceBreakdowns.ageGender,
        geo: featuredAudienceBreakdowns.geo,
        currencyCode: payload.viewContext.currencyCode,
      }),
    [
      featuredAudienceBreakdowns.ageGender,
      featuredAudienceBreakdowns.geo,
      payload.viewContext.currencyCode,
    ]
  );

  const hourlyHeatmap = useMemo(
    () => buildHourlyHeatmap(hourlyTrendExpandedPoints),
    [hourlyTrendExpandedPoints]
  );

  const platformPanelChart = useMemo(
    () =>
      buildPlatformPanelChart({
        platforms: featuredPlatformBreakdowns.publisherPlatforms,
        currencyCode: payload.viewContext.currencyCode,
      }),
    [featuredPlatformBreakdowns.publisherPlatforms, payload.viewContext.currencyCode]
  );

  const devicePanelChart = useMemo(
    () =>
      buildDevicePanelChart({
        devices: featuredPlatformBreakdowns.impressionDevices,
        currencyCode: payload.viewContext.currencyCode,
      }),
    [
      featuredPlatformBreakdowns.impressionDevices,
      payload.viewContext.currencyCode,
    ]
  );

  const regionStateMap = useMemo(
    () =>
      buildRegionStateMap({
        geo: featuredAudienceBreakdowns.geo,
        currencyCode: payload.viewContext.currencyCode,
      }),
    [featuredAudienceBreakdowns.geo, payload.viewContext.currencyCode]
  );

  const placementRows = useMemo(
    () =>
      buildPlacementVisualRows({
        placements: featuredPlatformBreakdowns.placements,
        currencyCode: payload.viewContext.currencyCode,
      }),
    [featuredPlatformBreakdowns.placements, payload.viewContext.currencyCode]
  );

  const activeSurfaceChart =
    surfacePanelMode === 'platform' ? platformPanelChart : devicePanelChart;
  const activeSurfaceTooltipProps = useMemo(
    () => ({
      content: ({
        label,
        payload,
      }: {
        label?: string | number;
        payload?: Array<{ name?: string; value?: number | string | null; color?: string }>;
      }) =>
        renderFilteredBarTooltip({
          label,
          payload,
          series: activeSurfaceChart.series,
          formatter: activeSurfaceChart.formatter,
        }),
    }),
    [activeSurfaceChart.formatter, activeSurfaceChart.series]
  );
  const audienceChartTooltipProps = useMemo(
    () => ({
      content: ({
        label,
        payload,
      }: {
        label?: string | number;
        payload?: Array<{ name?: string; value?: number | string | null; color?: string }>;
      }) =>
        renderFilteredBarTooltip({
          label,
          payload,
          series: audienceChart.series,
          formatter: audienceChart.formatter,
        }),
    }),
    [audienceChart.formatter, audienceChart.series]
  );
  const surfaceDataSummary = useMemo<DataSummary | null>(() => {
    if (surfacePanelMode === 'times') {
      return hourlyHeatmap
        ? {
          eyebrow: 'Best time',
          label: hourlyHeatmap.summarySlotLabel,
          value: hourlyHeatmap.summaryDayLabel,
          detail: `Best hour: ${hourlyHeatmap.summaryHourLabel}`,
          color: '#2563eb',
        }
        : null;
    }

    if (surfacePanelMode === 'geo') {
      const topState = regionStateMap.activeStates[0] ?? null;

      return topState
        ? {
          eyebrow: 'Top geo',
          label: topState.name,
          value: topState.valueLabel,
          color: '#2563eb',
        }
        : null;
    }

    return pickTopChartSummary(
      activeSurfaceChart,
      surfacePanelMode === 'device' ? 'Top device' : 'Top platform'
    );
  }, [activeSurfaceChart, hourlyHeatmap, regionStateMap.activeStates, surfacePanelMode]);
  const audienceDataSummary = useMemo<DataSummary | null>(
    () => pickTopChartSummary(audienceChart, 'Top audience'),
    [audienceChart]
  );

  const activeFindingCampaignNameById = useMemo(() => {
    const map = new Map<string, string>();

    [...todayLiveWindow.campaigns, ...lifetimeLiveWindow.campaigns].forEach((campaign) => {
      map.set(campaign.id, campaign.name);
    });

    return map;
  }, [lifetimeLiveWindow.campaigns, todayLiveWindow.campaigns]);

  const activeFindingAdsetById = useMemo(() => {
    const map = new Map<string, DashboardLiveAdsetItem>();

    [...todayLiveWindow.adsets, ...lifetimeLiveWindow.adsets].forEach((adset) => {
      map.set(adset.id, adset);
    });

    return map;
  }, [lifetimeLiveWindow.adsets, todayLiveWindow.adsets]);

  function resolveFindingContext(finding: DashboardPayload['activeFindings'][number]) {
    const adset = finding.adsetId ? activeFindingAdsetById.get(finding.adsetId) : null;
    return (
      (finding.campaignId ? activeFindingCampaignNameById.get(finding.campaignId) : null) ??
      adset?.campaignName ??
      adset?.name ??
      null
    );
  }

  function resolveFindingDate(finding: DashboardPayload['activeFindings'][number]) {
    const snapshotLabel =
      typeof finding.metricSnapshot.label === 'string' ? finding.metricSnapshot.label : null;
    const labelDate = snapshotLabel?.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? null;

    return (
      formatShortNumericDate(finding.metricSnapshot.periodEnd) ??
      formatShortNumericDate(labelDate) ??
      formatShortNumericDate(finding.detectedAt)
    );
  }

  async function dismissFinding(findingId: string) {
    setDismissingFindingIds((current) => new Set(current).add(findingId));
    setRefreshFeedback(null);

    try {
      const response = await fetch(`/api/intelligence/findings/${findingId}/dismiss`, {
        method: 'POST',
      });
      const result = (await response.json()) as {
        success?: boolean;
        error?: string;
      };

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to dismiss finding.');
      }

      setActiveFindings((current) => {
        const next = current.filter((finding) => finding.id !== findingId);
        if (next.length === 0) {
          setActiveFindingsPopoverOpen(false);
        }
        return next;
      });
    } catch (error) {
      console.error('Failed to dismiss active finding:', error);
      setRefreshFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to dismiss finding.',
      });
    } finally {
      setDismissingFindingIds((current) => {
        const next = new Set(current);
        next.delete(findingId);
        return next;
      });
    }
  }

  async function dismissAllFindings() {
    if (activeFindings.length === 0 || dismissingAllFindings) {
      return;
    }

    const targetIds = activeFindings.map((finding) => finding.id);
    setDismissingAllFindings(true);
    setDismissingFindingIds(new Set(targetIds));
    setRefreshFeedback(null);

    try {
      const results = await Promise.allSettled(
        targetIds.map(async (findingId) => {
          const response = await fetch(`/api/intelligence/findings/${findingId}/dismiss`, {
            method: 'POST',
          });
          const result = (await response.json()) as {
            success?: boolean;
            error?: string;
          };

          if (!response.ok || !result.success) {
            throw new Error(result.error || 'Failed to dismiss finding.');
          }

          return findingId;
        })
      );

      const succeededIds = results
        .filter((result): result is PromiseFulfilledResult<string> => result.status === 'fulfilled')
        .map((result) => result.value);

      if (succeededIds.length > 0) {
        const succeededIdSet = new Set(succeededIds);
        setActiveFindings((current) =>
          current.filter((finding) => !succeededIdSet.has(finding.id))
        );
      }

      if (succeededIds.length === targetIds.length) {
        setActiveFindingsPopoverOpen(false);
      } else {
        throw new Error('Some findings could not be dismissed.');
      }
    } catch (error) {
      console.error('Failed to dismiss all active findings:', error);
      setRefreshFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to dismiss findings.',
      });
    } finally {
      setDismissingAllFindings(false);
      setDismissingFindingIds(new Set());
    }
  }

  function clearActiveFindingsCloseTimeout() {
    if (activeFindingsCloseTimeoutRef.current) {
      clearTimeout(activeFindingsCloseTimeoutRef.current);
      activeFindingsCloseTimeoutRef.current = null;
    }
  }

  function openActiveFindingsPopover() {
    clearActiveFindingsCloseTimeout();
    setActiveFindingsPopoverOpen(true);
  }

  function closeActiveFindingsPopoverSoon() {
    clearActiveFindingsCloseTimeout();
    activeFindingsCloseTimeoutRef.current = setTimeout(() => {
      setActiveFindingsPopoverOpen(false);
    }, 120);
  }

  function toggleActiveFindingsPopover() {
    clearActiveFindingsCloseTimeout();
    setActiveFindingsPopoverOpen((opened) => !opened);
  }

  function handleExtensionDateChange(value: string | null) {
    if (!continuationSignal || !value) {
      return;
    }

    setExtensionDays(clampExtensionDays(daysBetweenIsoDates(continuationSignal.endDate, value)));
  }

  useEffect(() => {
    setActiveFindings(payload.activeFindings);
  }, [payload.activeFindings]);

  useEffect(() => {
    if (deliveryWindowMode === 'lifetime' && !lifetimeLiveWindow.hasLiveDelivery) {
      setDeliveryWindowMode('today');
      return;
    }

    if (
      deliveryWindowMode === 'today' &&
      !todayLiveWindow.hasLiveDelivery &&
      lifetimeLiveWindow.hasLiveDelivery
    ) {
      setDeliveryWindowMode('lifetime');
    }
  }, [
    deliveryWindowMode,
    lifetimeLiveWindow.hasLiveDelivery,
    todayLiveWindow.hasLiveDelivery,
  ]);
  
  useEffect(() => {
    setHourlyRangeMode('today');
  }, [featuredAdset?.id]);

  useEffect(() => {
    if (!isPhone) {
      return;
    }

    setHistoryGranularity('day');
    setTrendMode('delivery');
    setHourlyRangeMode('today');
  }, [isPhone]);

  useEffect(() => {
    if (!hasExpandedHourlyTrend && hourlyRangeMode === 'expanded') {
      setHourlyRangeMode('today');
    }
  }, [hasExpandedHourlyTrend, hourlyRangeMode]);

  useEffect(() => {
    if (!isExpandedHourlyScrollable || !expandedHourlyViewportRef.current) {
      return;
    }

    const viewport = expandedHourlyViewportRef.current;
    viewport.scrollLeft = viewport.scrollWidth;
  }, [expandedHourlyChartWidth, isExpandedHourlyScrollable]);

  useEffect(
    () => () => {
      clearActiveFindingsCloseTimeout();
    },
    []
  );

  useEffect(() => {
    setDismissedDashboardNotificationIds((current) => {
      const next = new Set(current);

      for (const notification of payload.dashboardNotifications) {
        if (notification.read) {
          next.add(notification.id);
        }
      }

      return next;
    });
  }, [payload.dashboardNotifications]);

  function dismissDashboardNotification(
    notification: DashboardSurfaceNotification | undefined,
    fallback: () => void
  ) {
    if (!notification) {
      fallback();
      return;
    }

    setDismissedDashboardNotificationIds((current) => {
      const next = new Set(current);
      next.add(notification.id);
      return next;
    });

    void fetch(`/api/notifications/${notification.id}/read`, {
      method: 'POST',
    }).catch((error) => {
      console.error('Failed to persist dashboard notification dismissal:', error);
    });
  }

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
        message:
          result.message ??
          `Sync completed: ${result.refreshedCount ?? 0} updated, ${result.failedCount ?? 0} failed.`,
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

  return (
    <Container fluid px={6} py={0} className={`${classes.page} dashboard-page-shell`}>
      <Stack gap="md" className={classes.shell}>
        {refreshFeedback ? (
          <Alert
            color={refreshFeedback.type === 'success' ? 'green' : 'red'}
            icon={<IconRefresh size={16} />}
            radius="lg"
            withCloseButton
            closeButtonLabel="Dismiss sync notification"
            onClose={() => setRefreshFeedback(null)}
          >
            {refreshFeedback.message}
          </Alert>
        ) : null}

        {continuationSignal ? (
          <Modal
            opened={extensionModalOpen}
            onClose={() => setExtensionModalOpen(false)}
            title="Preview schedule extension"
            radius="lg"
            size="lg"
            centered
          >
            <Stack gap="md">
              <div>
                <Badge color="orange" variant="light" radius="sm">
                  Preview only
                </Badge>
                <Text fw={900} mt="sm">
                  {continuationSignal.entityName}
                </Text>
                <Text size="sm" c="dimmed" mt={4}>
                  {formatContinuationEntityLevel(continuationSignal.entityLevel)}{' '}
                  {formatContinuationDays(continuationSignal.daysUntilEnd)} on{' '}
                  {formatReadableDate(continuationSignal.endDate) ?? continuationSignal.endDate}.
                </Text>
              </div>

              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                <Paper withBorder radius="lg" p="sm" className={classes.extensionCalendarPanel}>
                  <DatePicker
                    value={extensionPreviewEndDate}
                    onChange={handleExtensionDateChange}
                    defaultDate={continuationSignal.endDate}
                    size="sm"
                    getDayProps={(date) => {
                      const isActiveDay = activeDeliveryDateKeys.has(date);
                      const isEndDate = date === continuationSignal.endDate;
                      const isBeforeOrCurrentEndDate = date <= continuationSignal.endDate;

                      if (!isActiveDay && !isEndDate) {
                        return { disabled: isBeforeOrCurrentEndDate };
                      }

                      return {
                        disabled: isBeforeOrCurrentEndDate,
                        title: isEndDate
                          ? 'Current campaign end date'
                          : 'Ad set had synced delivery on this date',
                      };
                    }}
                    renderDay={(date) => {
                      const isActiveDay = activeDeliveryDateKeys.has(date);
                      const isEndDate = date === continuationSignal.endDate;
                      const className = [
                        classes.extensionCalendarDay,
                        isActiveDay ? classes.extensionCalendarDayActive : '',
                        isEndDate ? classes.extensionCalendarDayEnd : '',
                      ]
                        .filter(Boolean)
                        .join(' ');

                      return <div className={className}>{getDateDayNumber(date)}</div>;
                    }}
                  />
                </Paper>

                <Stack gap="md">
                  <NumberInput
                    label="Extend schedule by days"
                    min={1}
                    max={365}
                    value={extensionDays}
                    onChange={(value) => {
                      const nextValue = typeof value === 'number' ? value : Number(value);
                      setExtensionDays(clampExtensionDays(nextValue));
                    }}
                  />

                  <Paper withBorder radius="lg" p="md">
                    <Stack gap="xs">
                      <Group justify="space-between" gap="md" wrap="nowrap">
                        <Text size="sm" c="dimmed">
                          Current end date
                        </Text>
                        <Text size="sm" fw={800} ta="right">
                          {formatReadableDate(continuationSignal.endDate) ??
                            continuationSignal.endDate}
                        </Text>
                      </Group>
                      <Group justify="space-between" gap="md" wrap="nowrap">
                        <Text size="sm" c="dimmed">
                          Proposed end date
                        </Text>
                        <Text size="sm" fw={800} ta="right">
                          {formatReadableDate(extensionPreviewEndDate) ??
                            extensionPreviewEndDate ??
                            '-'}
                        </Text>
                      </Group>
                    </Stack>
                  </Paper>

                  <Group gap="md" wrap="wrap">
                    <Group gap={6} wrap="nowrap">
                      <span className={`${classes.extensionCalendarLegendSwatch} ${classes.extensionCalendarLegendActive}`} />
                      <Text size="xs" c="dimmed">
                        Active ad delivery
                      </Text>
                    </Group>
                    <Group gap={6} wrap="nowrap">
                      <span className={`${classes.extensionCalendarLegendSwatch} ${classes.extensionCalendarLegendEnd}`} />
                      <Text size="xs" c="dimmed">
                        Current end date
                      </Text>
                    </Group>
                  </Group>
                </Stack>
              </SimpleGrid>

              <Group justify="flex-end" gap="sm">
                <Button
                  variant="default"
                  radius="xl"
                  onClick={() => setExtensionModalOpen(false)}
                >
                  Close
                </Button>
                <Button radius="xl" color="orange" disabled>
                  Preview only - no changes sent
                </Button>
              </Group>
            </Stack>
          </Modal>
        ) : null}

        <Modal
          opened={mobileHistoryModalOpen}
          onClose={() => setMobileHistoryModalOpen(false)}
          title="Explore ad set history"
          radius="lg"
          size="xl"
          fullScreen={isPhone}
          centered={!isPhone}
        >
          <Stack gap="md" className={classes.mobileChartModalBody}>
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={800}>
                Featured ad set
              </Text>
              <Text fw={900}>{featuredAdset?.name ?? 'Waiting for a live ad set today'}</Text>
              <Text size="sm" c="dimmed" mt={4}>
                {trendChart.title}
              </Text>
            </div>

            <div className={classes.historyControlsRow}>
              <SegmentedControl
                radius="xl"
                size="xs"
                value={historyGranularity}
                onChange={(value) => setHistoryGranularity(value as HistoryGranularity)}
                data={[
                  { label: 'Day', value: 'day' },
                  { label: 'Hourly', value: 'hourly', disabled: !hasHourlyTrend },
                ]}
              />
              {historyGranularity === 'hourly' && hasExpandedHourlyTrend ? (
                <SegmentedControl
                  radius="xl"
                  size="xs"
                  value={hourlyRangeMode}
                  onChange={(value) => setHourlyRangeMode(value as HourlyRangeMode)}
                  data={[
                    { label: 'Today', value: 'today' },
                    { label: 'Full range', value: 'expanded' },
                  ]}
                />
              ) : null}
              <SegmentedControl
                radius="xl"
                size="xs"
                value={trendMode}
                onChange={(value) => setTrendMode(value as TrendMode)}
                data={[
                  { label: 'Delivery', value: 'delivery' },
                  { label: 'Efficiency', value: 'efficiency' },
                  { label: 'Combined', value: 'combined' },
                ]}
              />
            </div>

            {activeFindings.length > 0 ? (
              <Paper withBorder radius="lg" p="sm" className={classes.historyTooltipSignal}>
                <Group justify="space-between" gap="sm" wrap="nowrap">
                  <div>
                    <Text size="xs" c="dimmed" tt="uppercase" fw={800}>
                      Active findings
                    </Text>
                    <Text size="sm" fw={800}>
                      {activeFindings.length} saved trend{activeFindings.length === 1 ? '' : 's'} being watched
                    </Text>
                  </div>
                  <Badge color="orange" variant="light" radius="xl">
                    Live
                  </Badge>
                </Group>
              </Paper>
            ) : null}

            <div className={classes.historyChartBody}>
              {trendChartData.length > 0 ? (
                isExpandedHourlyScrollable ? (
                  <ScrollArea
                    type="auto"
                    scrollbars="x"
                    offsetScrollbars="x"
                    viewportRef={expandedHourlyViewportRef}
                    className={classes.historyChartScrollArea}
                  >
                    <div
                      className={classes.historyChartScrollableCanvas}
                      style={{ width: expandedHourlyChartWidth ?? undefined }}
                    >
                      <LineChart
                        h={mobileHistoryModalChartHeight}
                        data={trendChartData}
                        dataKey="label"
                        lineChartProps={trendLineChartProps}
                        type="default"
                        curveType="monotone"
                        withLegend
                        withDots
                        strokeWidth={4}
                        gridAxis="x"
                        strokeDasharray="4 4"
                        yAxisProps={{ width: trendYAxisWidth }}
                        xAxisProps={trendXAxisProps}
                        tooltipProps={trendTooltipProps}
                        dotProps={modalTrendDotProps}
                        activeDotProps={modalTrendActiveDotProps}
                        lineProps={(series) => ({
                          strokeDasharray: series.strokeDasharray,
                          strokeLinecap: 'round',
                          strokeLinejoin: 'round',
                        })}
                        referenceLines={trendReferenceLines}
                        series={trendChart.series}
                        valueFormatter={(value) =>
                          typeof value === 'number'
                            ? trendChart.formatter(value)
                            : String(value ?? '-')
                        }
                      >
                        {trendPointIndicators.map((indicator) => (
                          <ReferenceDot
                            key={indicator.key}
                            x={indicator.x}
                            y={indicator.y}
                            yAxisId="left"
                            r={8}
                            fill="#ffffff"
                            stroke={indicator.color}
                            strokeWidth={3}
                            isFront
                          />
                        ))}
                      </LineChart>
                    </div>
                  </ScrollArea>
                ) : (
                  <LineChart
                    h={mobileHistoryModalChartHeight}
                    data={trendChartData}
                    dataKey="label"
                    lineChartProps={trendLineChartProps}
                    type="default"
                    curveType="monotone"
                    withLegend
                    withDots
                    strokeWidth={4}
                    gridAxis="x"
                    strokeDasharray="4 4"
                    yAxisProps={{ width: trendYAxisWidth }}
                    xAxisProps={trendXAxisProps}
                    tooltipProps={trendTooltipProps}
                    dotProps={modalTrendDotProps}
                    activeDotProps={modalTrendActiveDotProps}
                    lineProps={(series) => ({
                      strokeDasharray: series.strokeDasharray,
                      strokeLinecap: 'round',
                      strokeLinejoin: 'round',
                    })}
                    referenceLines={trendReferenceLines}
                    series={trendChart.series}
                    valueFormatter={(value) =>
                      typeof value === 'number' ? trendChart.formatter(value) : String(value ?? '-')
                    }
                  >
                    {trendPointIndicators.map((indicator) => (
                      <ReferenceDot
                        key={indicator.key}
                        x={indicator.x}
                        y={indicator.y}
                        yAxisId="left"
                        r={8}
                        fill="#ffffff"
                        stroke={indicator.color}
                        strokeWidth={3}
                        isFront
                      />
                    ))}
                  </LineChart>
                )
              ) : (
                <Stack justify="center" align="center" h={mobileHistoryModalChartHeight} gap="xs">
                  <Text fw={800}>No live ad set history yet</Text>
                  <Text size="sm" c="dimmed" ta="center" maw={360}>
                    Once a live ad set is serving today, this graph will show its synced delivery
                    history.
                  </Text>
                </Stack>
              )}
            </div>

            <DataSummaryBox summary={mobileTrendDataSummary} />
          </Stack>
        </Modal>

        {renderFullShell && payload.syncCoverage?.historicalAnalysisPending ? (
          <Alert
            color={payload.syncCoverage.activeJobStatus === 'failed' ? 'red' : 'blue'}
            radius="lg"
            icon={<IconClock size={16} />}
            title={
              payload.syncCoverage.activeJobStatus === 'failed'
                ? 'History sync needs attention'
                : 'Recent data is ready while full history continues'
            }
          >
            <Text size="sm">
              {payload.syncCoverage.coverageStartDate && payload.syncCoverage.coverageEndDate
                ? `Dashboard readings are using synced data from ${payload.syncCoverage.coverageStartDate} through ${payload.syncCoverage.coverageEndDate}.`
                : 'DeepVisor is still filling the first historical sync for this account.'}
            </Text>
          </Alert>
        ) : null}

        {renderFullShell && payload.state !== 'ready' ? (
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

        {showDashboardNotifications &&
          showNoLiveDeliveryAlert &&
          payload.state === 'ready' &&
          !todayLiveWindow.hasLiveDelivery &&
          noLiveDeliveryAlertVisible ? (
          <Alert
            color="blue"
            radius="lg"
            icon={<IconAlertCircle size={16} />}
            withCloseButton
            closeButtonLabel="Dismiss live delivery notification"
            onClose={() =>
              dismissDashboardNotification(noLiveDeliveryNotification, () =>
                setLocalNoLiveDeliveryAlertVisible(false)
              )
            }
          >
            <Text size="sm">
              No live delivery was found today. This dashboard only shows campaigns, ad sets, and
              ads that are active and actually serving right now.
            </Text>
          </Alert>
        ) : null}

        {showDashboardNotifications && continuationSignal && continuationAlertVisible ? (
          <Alert
            color="orange"
            radius="lg"
            icon={<IconClock size={16} />}
            withCloseButton
            closeButtonLabel="Dismiss campaign end notification"
            onClose={() =>
              dismissDashboardNotification(continuationNotification, () =>
                setLocalContinuationAlertVisible(false)
              )
            }
          >
            <Group justify="space-between" align="center" gap="sm" wrap="wrap">
              <div>
                <Text size="sm" fw={800}>
                  {formatContinuationEntityLevel(continuationSignal.entityLevel)}{' '}
                  {formatContinuationDays(continuationSignal.daysUntilEnd)} on{' '}
                  {formatReadableDate(continuationSignal.endDate) ?? continuationSignal.endDate}
                </Text>
                <Text size="xs" c="dimmed" mt={3}>
                  {continuationSignal.entityName}
                  {continuationSignal.parentName ? ` | ${continuationSignal.parentName}` : ''}
                  {formatContinuationBudget(continuationSignal, payload.viewContext.currencyCode)
                    ? ` | ${formatContinuationBudget(
                      continuationSignal,
                      payload.viewContext.currencyCode
                    )}`
                    : ''}
                </Text>
              </div>
              <Button
                size="xs"
                radius="xl"
                color="orange"
                variant="light"
                onClick={() => setExtensionModalOpen(true)}
              >
                Review extension
              </Button>
            </Group>
          </Alert>
        ) : null}

        {shouldRenderDashboardCard ? (
          <Card withBorder radius="xl" p="lg" className={classes.topBar}>
            <Stack gap="lg" className={classes.dashboardContentStack}>
              {renderFullShell ? (
                <Group
                  justify="space-between"
                  align="flex-start"
                  gap="md"
                  wrap="wrap"
                  className={`${classes.surfaceToolbar} ${classes.dashboardToolbar}`}
                >
                  <div>
                    <Group gap="xs" wrap="wrap">
                      <Badge variant="light" className="app-platform-page-badge">
                        Dashboard
                      </Badge>
                      <Badge color={statusColor(payload.viewContext.platformStatus)} variant="light">
                        {payload.viewContext.platformName ?? 'No platform selected'}
                      </Badge>
                      <Badge color={statusColor(payload.viewContext.adAccountStatus)} variant="outline">
                        {payload.viewContext.adAccountName ?? 'No ad account selected'}
                      </Badge>
                    </Group>
                    <Text fw={900} size="1.65rem" mt="sm" className={classes.title}>
                      {payload.viewContext.adAccountName ?? 'Selected ad account'}
                    </Text>
                  </div>

                  <Group gap="sm" wrap="wrap" className={classes.topBarActions}>
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
                      href={reportsHref}
                      radius="xl"
                      variant="default"
                      className="app-platform-page-action-secondary"
                    >
                      Reports
                    </Button>
                  </Group>
                </Group>
              ) : null}

              {showSummaryCards ? (
                <Stack gap="sm" className={classes.summaryCardsSection}>
                  <Group justify="flex-end" align="center" gap="sm" className={classes.summaryWindowControlRow}>
                    <SegmentedControl
                      radius="xl"
                      size="xs"
                      value={activeDeliveryWindowMode}
                      onChange={(value) => setDeliveryWindowMode(value as DeliveryWindowMode)}
                      className={classes.summaryWindowControl}
                      data={[
                        {
                          label: 'Today',
                          value: 'today',
                        },
                        {
                          label: 'Lifetime',
                          value: 'lifetime',
                          disabled: !lifetimeLiveWindow.hasLiveDelivery,
                        },
                      ]}
                    />
                  </Group>
                  <SimpleGrid cols={{ base: 3, sm: 3, lg: 3, xl: 6 }} spacing="md" className={classes.summaryCardsGrid}>
                    <SummaryCard
                      label={summaryCampaignLabel}
                      value={formatNumber(liveSummary.liveCampaignCount)}
                      icon={IconUsers}
                    />
                    <SummaryCard
                      label={summaryAdsetLabel}
                      value={formatNumber(liveSummary.liveAdsetCount)}
                      icon={IconTargetArrow}
                    />
                    <SummaryCard
                      label={summaryAdLabel}
                      value={formatNumber(liveSummary.liveAdCount)}
                      icon={IconLink}
                    />
                    <SummaryCard
                      label="Spend"
                      value={formatCurrency(liveSummary.spend, payload.viewContext.currencyCode)}
                      delta={summarySpendDelta}
                      icon={IconCurrencyDollar}
                    />
                    <SummaryCard
                      label={liveSummary.primaryOutcomeLabel}
                      value={formatNumber(liveSummary.primaryOutcomeValue)}
                      delta={summaryResultsDelta}
                      icon={IconTargetArrow}
                    />
                    <SummaryCard
                      label={summaryPlatformLabel}
                      value={summaryPlatformValue}
                      icon={IconLink}
                    />
                  </SimpleGrid>
                </Stack>
              ) : null}

              {showFeaturedHistory ? (
                <Grid gutter="md" align="stretch">
                  <Grid.Col span={{ base: 12, xl: 8 }}>
                    <Paper withBorder radius="xl" p="md" className={`${classes.chartPanel} ${classes.featuredChartPanel}`}>
                      <Stack gap="md" mb="md" className={classes.historyHeader}>
                        <Group justify="space-between" align="flex-start" gap="sm" wrap="wrap">
                          <Group gap="sm" wrap="nowrap" align="flex-start">
                            <ThemeIcon color="blue" variant="light" radius="md">
                              <IconChartLine size={18} />
                            </ThemeIcon>
                            <div className={classes.historyHeaderBody}>
                              <Text size="xs" c="dimmed" tt="uppercase" fw={800}>
                                Featured ad set history
                              </Text>
                              <Text fw={800}>
                                {featuredAdset?.name ?? 'Waiting for a live ad set today'}
                              </Text>
                              <Text size="sm" c="dimmed" mt={4}>
                                {trendChart.title}
                              </Text>
                              {historyGranularity === 'day' && dailyHistoryRangeLabel ? (
                                <Text size="sm" c="dimmed" mt={4}>
                                  {dailyHistoryRangeLabel}
                                </Text>
                              ) : null}
                              {historyGranularity === 'hourly' && hourlyRangeMode === 'today' && hourlyTodayLabel ? (
                                <Text size="sm" c="dimmed" mt={4}>
                                  {hourlyTodayLabel} · advertiser account time
                                </Text>
                              ) : null}
                            </div>
                          </Group>

                          {isPhone ? (
                            <Button
                              size="compact-xs"
                              radius="xl"
                              variant="default"
                              className={classes.mobileExploreChartButton}
                              onClick={() => setMobileHistoryModalOpen(true)}
                            >
                              Explore chart
                            </Button>
                          ) : (
                            <Stack gap="xs" align="flex-end" className={classes.historyControlsPanel}>
                              <div className={classes.historyControlsRow}>
                                <SegmentedControl
                                  radius="xl"
                                  size="xs"
                                  value={historyGranularity}
                                  onChange={(value) => setHistoryGranularity(value as HistoryGranularity)}
                                  data={[
                                    { label: 'Day', value: 'day' },
                                    { label: 'Hourly', value: 'hourly', disabled: !hasHourlyTrend },
                                  ]}
                                />
                                {historyGranularity === 'hourly' && hasExpandedHourlyTrend ? (
                                  <SegmentedControl
                                    radius="xl"
                                    size="xs"
                                    value={hourlyRangeMode}
                                    onChange={(value) => setHourlyRangeMode(value as HourlyRangeMode)}
                                    data={[
                                      { label: 'Today', value: 'today' },
                                      { label: 'Full range', value: 'expanded' },
                                    ]}
                                  />
                                ) : null}
                                <SegmentedControl
                                  radius="xl"
                                  size="xs"
                                  value={trendMode}
                                  onChange={(value) => setTrendMode(value as TrendMode)}
                                  data={[
                                    { label: 'Delivery', value: 'delivery' },
                                    { label: 'Efficiency', value: 'efficiency' },
                                    { label: 'Combined', value: 'combined' },
                                  ]}
                                />
                              </div>

                              {activeFindings.length > 0 ? (
                                <Popover
                                  opened={activeFindingsPopoverOpen}
                                  onDismiss={() => setActiveFindingsPopoverOpen(false)}
                                  position="bottom-end"
                                  withArrow
                                  shadow="md"
                                  offset={8}
                                  radius="lg"
                                  withinPortal
                                >
                                  <Popover.Target>
                                    <Indicator
                                      inline
                                      processing
                                      color="orange"
                                      size={10}
                                      offset={6}
                                      disabled={activeFindings.length === 0}
                                    >
                                      <Button
                                        size="xs"
                                        radius="xl"
                                        variant="light"
                                        color="orange"
                                        leftSection={<IconAlertCircle size={14} />}
                                        className={classes.activeFindingsTrigger}
                                        onMouseEnter={openActiveFindingsPopover}
                                        onMouseLeave={closeActiveFindingsPopoverSoon}
                                        onClick={toggleActiveFindingsPopover}
                                      >
                                        {activeFindings.length} active finding{activeFindings.length === 1 ? '' : 's'}
                                      </Button>
                                    </Indicator>
                                  </Popover.Target>
                                  <Popover.Dropdown
                                    className={classes.activeFindingsPopover}
                                    onMouseEnter={openActiveFindingsPopover}
                                    onMouseLeave={closeActiveFindingsPopoverSoon}
                                  >
                                    <Stack gap="sm">
                                      <Group justify="space-between" align="flex-start" gap="sm" wrap="nowrap">
                                        <div>
                                          <Text size="sm" fw={800}>
                                            Active findings
                                          </Text>
                                          <Text size="xs" c="dimmed" mt={4}>
                                            DeepVisor is actively watching {activeFindings.length} saved trend
                                            {activeFindings.length === 1 ? '' : 's'} for this account.
                                          </Text>
                                        </div>
                                        <Button
                                          size="compact-xs"
                                          variant="subtle"
                                          color="gray"
                                          loading={dismissingAllFindings}
                                          disabled={activeFindings.length === 0}
                                          onClick={() => {
                                            void dismissAllFindings();
                                          }}
                                        >
                                          Mark all read
                                        </Button>
                                      </Group>

                                      <Stack gap="xs">
                                        {activeFindings.map((finding) => {
                                          const context = resolveFindingContext(finding);
                                          const detectedDate = resolveFindingDate(finding);

                                          return (
                                            <Paper key={finding.id} withBorder radius="md" p="sm">
                                              <Stack gap={6}>
                                                <Group justify="space-between" align="flex-start" gap="sm" wrap="nowrap">
                                                  <Group gap="xs" wrap="wrap" style={{ minWidth: 0 }}>
                                                    <Badge
                                                      color={signalSeverityColor(finding.severity)}
                                                      variant="light"
                                                      radius="sm"
                                                      size="xs"
                                                    >
                                                      {formatStatusLabel(finding.severity)}
                                                    </Badge>
                                                    <Text size="sm" fw={700} className={classes.activeFindingLine}>
                                                      {finding.title}
                                                    </Text>
                                                  </Group>
                                                  <ActionIcon
                                                    variant="subtle"
                                                    color="gray"
                                                    size="sm"
                                                    aria-label="Mark finding as read"
                                                    loading={dismissingFindingIds.has(finding.id)}
                                                    onClick={() => {
                                                      void dismissFinding(finding.id);
                                                    }}
                                                  >
                                                    <IconX size={14} />
                                                  </ActionIcon>
                                                </Group>
                                                {(context || detectedDate) ? (
                                                  <Text size="xs" c="dimmed">
                                                    {[context, detectedDate].filter(Boolean).join(' | ')}
                                                  </Text>
                                                ) : null}
                                              </Stack>
                                            </Paper>
                                          );
                                        })}
                                      </Stack>
                                    </Stack>
                                  </Popover.Dropdown>
                                </Popover>
                              ) : null}
                            </Stack>
                          )}
                        </Group>

                        {historyGranularity === 'hourly' &&
                          hourlyRangeMode === 'expanded' &&
                          hourlyHistoryRangeLabel ? (
                          <Text size="sm" c="dimmed">
                            {hourlyHistoryRangeLabel} · advertiser account time
                          </Text>
                        ) : null}

                      </Stack>

                      <div className={classes.historyChartBody}>
                        {isPhone && mobilePreviewTrendChart.data.length > 0 ? (
                          <Stack gap="xs">
                            <LineChart
                              h={featuredHistoryChartHeight}
                              data={mobilePreviewTrendChart.data}
                              dataKey="label"
                              lineChartProps={trendLineChartProps}
                              type="default"
                              curveType="monotone"
                              withLegend={false}
                              withDots={false}
                              strokeWidth={3}
                              gridAxis="x"
                              strokeDasharray="4 4"
                              yAxisProps={{ width: trendYAxisWidth }}
                              xAxisProps={{
                                minTickGap: 28,
                                tickMargin: 6,
                                padding: { left: 8, right: 10 },
                              }}
                              tooltipProps={mobilePreviewTrendTooltipProps}
                              dotProps={trendDotProps}
                              activeDotProps={trendActiveDotProps}
                              lineProps={(series) => ({
                                strokeDasharray: series.strokeDasharray,
                                strokeLinecap: 'round',
                                strokeLinejoin: 'round',
                              })}
                              series={mobilePreviewTrendChart.series}
                              valueFormatter={(value) =>
                                typeof value === 'number'
                                  ? mobilePreviewTrendChart.formatter(value)
                                  : String(value ?? '-')
                              }
                            />
                            <DataSummaryBox summary={mobileTrendDataSummary} />
                          </Stack>
                        ) : trendChartData.length > 0 ? (
                          isExpandedHourlyScrollable ? (
                            <ScrollArea
                              type="auto"
                              scrollbars="x"
                              offsetScrollbars="x"
                              viewportRef={expandedHourlyViewportRef}
                              className={classes.historyChartScrollArea}
                            >
                              <div
                                className={classes.historyChartScrollableCanvas}
                                style={{ width: expandedHourlyChartWidth ?? undefined }}
                              >
                                <LineChart
                                  h={featuredHistoryChartHeight}
                                  data={trendChartData}
                                  dataKey="label"
                                  lineChartProps={trendLineChartProps}
                                  type="default"
                                  curveType="monotone"
                                  withLegend
                                  withDots
                                  strokeWidth={4}
                                  gridAxis="x"
                                  strokeDasharray="4 4"
                                  yAxisProps={{ width: trendYAxisWidth }}
                                  xAxisProps={trendXAxisProps}
                                  tooltipProps={trendTooltipProps}
                                  dotProps={trendDotProps}
                                  activeDotProps={trendActiveDotProps}
                                  lineProps={(series) => ({
                                    strokeDasharray: series.strokeDasharray,
                                    strokeLinecap: 'round',
                                    strokeLinejoin: 'round',
                                  })}
                                  referenceLines={trendReferenceLines}
                                  series={trendChart.series}
                                  valueFormatter={(value) =>
                                    typeof value === 'number'
                                      ? trendChart.formatter(value)
                                      : String(value ?? '—')
                                  }
                                >
                                  {trendPointIndicators.map((indicator) => (
                                    <ReferenceDot
                                      key={indicator.key}
                                      x={indicator.x}
                                      y={indicator.y}
                                      yAxisId="left"
                                      r={8}
                                      fill="#ffffff"
                                      stroke={indicator.color}
                                      strokeWidth={3}
                                      isFront
                                    />
                                  ))}
                                </LineChart>
                              </div>
                            </ScrollArea>
                          ) : (
                            <LineChart
                              h={featuredHistoryChartHeight}
                              data={trendChartData}
                              dataKey="label"
                              lineChartProps={trendLineChartProps}
                              type="default"
                              curveType="monotone"
                              withLegend
                              withDots
                              strokeWidth={4}
                              gridAxis="x"
                              strokeDasharray="4 4"
                              yAxisProps={{ width: trendYAxisWidth }}
                              xAxisProps={trendXAxisProps}
                              tooltipProps={trendTooltipProps}
                              dotProps={trendDotProps}
                              activeDotProps={trendActiveDotProps}
                              lineProps={(series) => ({
                                strokeDasharray: series.strokeDasharray,
                                strokeLinecap: 'round',
                                strokeLinejoin: 'round',
                              })}
                              referenceLines={trendReferenceLines}
                              series={trendChart.series}
                              valueFormatter={(value) =>
                                typeof value === 'number'
                                  ? trendChart.formatter(value)
                                  : String(value ?? '—')
                              }
                            >
                              {trendPointIndicators.map((indicator) => (
                                <ReferenceDot
                                  key={indicator.key}
                                  x={indicator.x}
                                  y={indicator.y}
                                  yAxisId="left"
                                  r={8}
                                  fill="#ffffff"
                                  stroke={indicator.color}
                                  strokeWidth={3}
                                  isFront
                                />
                              ))}
                            </LineChart>
                          )
                        ) : (
                          <Stack
                            justify="center"
                            align="center"
                            h={featuredHistoryChartHeight}
                            gap="xs"
                          >
                            <Text fw={800}>No live ad set history yet</Text>
                            <Text size="sm" c="dimmed" ta="center" maw={360}>
                              {historyGranularity === 'hourly'
                                ? 'Hourly advertiser-time rows will appear here once the featured ad set has synced enough hourly performance to show its full active-time history.'
                                : 'Once a live ad set is serving today, this graph will stay anchored on today and expand backward across that ad set&apos;s history.'}
                            </Text>
                            <Text size="sm" c="dimmed" ta="center" maw={360}>
                              {trendChart.description}
                            </Text>
                          </Stack>
                        )}
                      </div>
                    </Paper>
                  </Grid.Col>

                  <Grid.Col span={{ base: 12, xl: 4 }}>
                    <Paper withBorder radius="xl" p="md" className={classes.chartPanel}>
                      <Group justify="space-between" align="flex-start" gap="sm" mb="md" wrap="wrap">
                        <Group gap="sm" wrap="nowrap">
                          <ThemeIcon color="teal" variant="light" radius="md">
                            <IconChartBar size={18} />
                          </ThemeIcon>
                          <div>
                            <Text size="xs" c="dimmed" tt="uppercase" fw={800}>
                              Delivery surface graph
                            </Text>
                            <Text fw={800}>
                              {surfacePanelMode === 'platform'
                                ? platformPanelChart.title
                                : surfacePanelMode === 'device'
                                  ? devicePanelChart.title
                                  : surfacePanelMode === 'times'
                                    ? hourlyHeatmap?.title ?? 'Best recurring click times'
                                    : regionStateMap.title}
                            </Text>
                          </div>
                        </Group>
                        <Group gap="xs" wrap="wrap" className={classes.surfacePanelActions}>
                          <Button
                            size="xs"
                            radius="xl"
                            variant={surfacePanelMode === 'platform' ? 'filled' : 'light'}
                            onClick={() => setSurfacePanelMode('platform')}
                          >
                            Platforms
                          </Button>
                          <Button
                            size="xs"
                            radius="xl"
                            variant={surfacePanelMode === 'device' ? 'filled' : 'light'}
                            onClick={() => setSurfacePanelMode('device')}
                          >
                            Devices
                          </Button>
                          <Button
                            size="xs"
                            radius="xl"
                            variant={surfacePanelMode === 'geo' ? 'filled' : 'light'}
                            onClick={() => setSurfacePanelMode('geo')}
                          >
                            Geo
                          </Button>
                          <Button
                            size="xs"
                            radius="xl"
                            variant={surfacePanelMode === 'times' ? 'filled' : 'light'}
                            onClick={() => setSurfacePanelMode('times')}
                          >
                            Times
                          </Button>
                        </Group>
                      </Group>

                      <Stack gap="md">
                        <div className={classes.surfaceGraphGrid}>
                          <div className={classes.surfaceGraphCard}>
                            {surfacePanelMode === 'times' ? (
                              hourlyHeatmap ? (
                                <Stack gap="sm">
                                  <Group gap="xs" wrap="wrap">
                                    <Badge color="blue" variant="light" radius="sm">
                                      Best slot: {hourlyHeatmap.summarySlotLabel}
                                    </Badge>
                                    <Badge color="gray" variant="outline" radius="sm">
                                      Best day: {hourlyHeatmap.summaryDayLabel}
                                    </Badge>
                                    <Badge color="gray" variant="outline" radius="sm">
                                      Best hour: {hourlyHeatmap.summaryHourLabel}
                                    </Badge>
                                  </Group>

                                  <ScrollArea
                                    type="auto"
                                    scrollbars="x"
                                    offsetScrollbars="x"
                                    className={classes.heatmapScrollArea}
                                  >
                                    <div className={classes.heatmapGrid}>
                                      <div className={classes.heatmapCorner} />
                                      {hourlyHeatmap.hourLabels.map((label, index) => (
                                        <Text
                                          key={`heatmap-hour-${index}`}
                                          size="10px"
                                          c="dimmed"
                                          ta="center"
                                          className={classes.heatmapHourLabel}
                                        >
                                          {label}
                                        </Text>
                                      ))}

                                      {hourlyHeatmap.rows.map((row) => (
                                        <Fragment key={`heatmap-row-${row.dayOfWeek}`}>
                                          <Text
                                            size="10px"
                                            fw={700}
                                            c="dimmed"
                                            className={classes.heatmapDayLabel}
                                          >
                                            {row.dayLabel}
                                          </Text>
                                          {row.cells.map((cell) => (
                                            <div
                                              key={cell.key}
                                              className={classes.heatmapCell}
                                              style={{
                                                backgroundColor:
                                                  cell.metricAverage > 0
                                                    ? `rgba(37, 99, 235, ${0.12 + cell.intensity * 0.76})`
                                                    : 'rgba(241, 245, 249, 0.94)',
                                                borderColor:
                                                  cell.metricAverage > 0
                                                    ? 'rgba(37, 99, 235, 0.28)'
                                                    : 'rgba(226, 232, 240, 0.94)',
                                              }}
                                              title={`${cell.dayLabel} · ${formatHourLongLabel(
                                                cell.hourOfDay
                                              )}: avg ${formatDecimal(cell.metricAverage)} ${hourlyHeatmap.metricLabel
                                                }/slot · total ${formatNumber(
                                                  cell.metricTotal
                                                )} · CTR ${formatRate(cell.ctr)} · Spend ${formatCurrency(
                                                  cell.spend,
                                                  payload.viewContext.currencyCode,
                                                  2
                                                )}`}
                                            />
                                          ))}
                                        </Fragment>
                                      ))}
                                    </div>
                                  </ScrollArea>
                                </Stack>
                              ) : (
                                <Paper withBorder radius="xl" p="md" className={classes.emptyPanel}>
                                  <Text fw={700}>
                                    {hasHourlyTrend
                                      ? 'Best times heatmap is still preparing'
                                      : 'Hourly history is still syncing'}
                                  </Text>
                                  <Text size="sm" c="dimmed" mt={6}>
                                    The heatmap will appear here once enough hourly advertiser-time rows
                                    exist for the featured ad set.
                                  </Text>
                                </Paper>
                              )
                            ) : surfacePanelMode === 'geo' ? (
                              featuredAudienceBreakdowns.state === 'available' &&
                                regionStateMap.activeStates.length > 0 ? (
                                <Stack gap="sm">
                                  <div className={classes.stateMapWrap}>
                                    <div className={classes.stateMapGrid}>
                                      {regionStateMap.states.map((state) => (
                                        <div
                                          key={state.code}
                                          className={classes.stateMapTile}
                                          style={{
                                            gridColumn: `${state.col}`,
                                            gridRow: `${state.row}`,
                                            backgroundColor: state.isActive
                                              ? `rgba(37, 99, 235, ${0.18 + state.intensity * 0.68})`
                                              : 'rgba(241, 245, 249, 0.96)',
                                            borderColor: state.isActive
                                              ? 'rgba(37, 99, 235, 0.42)'
                                              : 'rgba(203, 213, 225, 0.9)',
                                            color:
                                              state.isActive && state.intensity > 0.45
                                                ? '#ffffff'
                                                : state.isActive
                                                  ? '#1d4ed8'
                                                  : '#64748b',
                                          }}
                                          title={
                                            state.isActive
                                              ? `${state.name}: ${state.valueLabel}`
                                              : state.name
                                          }
                                        >
                                          {state.code}
                                        </div>
                                      ))}
                                    </div>
                                  </div>

                                  <Group gap="xs" wrap="wrap">
                                    {regionStateMap.activeStates.map((state) => (
                                      <Badge key={state.code} color="blue" variant="light" radius="sm">
                                        {state.name}: {state.valueLabel}
                                      </Badge>
                                    ))}
                                  </Group>
                                </Stack>
                              ) : (
                                <Stack justify="center" align="center" h={deliverySurfaceChartHeight} gap="xs">
                                  <Text fw={800}>
                                    {isMeta
                                      ? 'Regional state rows are still syncing'
                                      : 'Regional state map is currently Meta-only'}
                                  </Text>
                                  <Text size="sm" c="dimmed" ta="center" maw={320}>
                                    {isMeta
                                      ? 'DeepVisor will highlight state-level regions here once Meta region rows are available across the featured ad set history.'
                                      : 'The geo state map is only wired for Meta right now.'}
                                  </Text>
                                </Stack>
                              )
                            ) : featuredPlatformBreakdowns.state === 'available' &&
                              activeSurfaceChart.data.length > 0 ? (
                              <BarChart
                                h={deliverySurfaceChartHeight}
                                data={activeSurfaceChart.data}
                                dataKey="segment"
                                withLegend={activeSurfaceChart.withLegend}
                                series={activeSurfaceChart.series}
                                tooltipProps={activeSurfaceTooltipProps}
                                valueFormatter={activeSurfaceChart.formatter}
                                tickLine="y"
                              />
                            ) : (
                              <Stack justify="center" align="center" h={deliverySurfaceChartHeight} gap="xs">
                                <Text fw={800}>
                                  {isMeta
                                    ? surfacePanelMode === 'device'
                                      ? 'Device rows are still syncing'
                                      : 'Platform rows are still syncing'
                                    : 'This graph is currently Meta-only'}
                                </Text>
                                <Text size="sm" c="dimmed" ta="center" maw={320}>
                                  {isMeta
                                    ? surfacePanelMode === 'device'
                                      ? 'Impression-device bars will appear here as Meta sync fills in the featured ad set history.'
                                      : 'Publisher platform bars will appear here as Meta sync fills in the featured ad set history.'
                                    : 'The top-right surface graph is only wired for Meta right now.'}
                                </Text>
                              </Stack>
                            )}
                            <DataSummaryBox summary={surfaceDataSummary} />
                          </div>

                          <div className={`${classes.chartSubSection} ${classes.surfaceGraphCard}`}>
                            <Text size="xs" c="dimmed" tt="uppercase" fw={800} mb={6}>
                              Audience breakdown
                            </Text>
                            <Text fw={700} mb="sm">
                              {audienceChart.title}
                            </Text>
                            {featuredAudienceBreakdowns.state === 'available' &&
                              audienceChart.data.length > 0 ? (
                              <BarChart
                                h={audienceBreakdownChartHeight}
                                type={audienceChart.type}
                                data={audienceChart.data}
                                dataKey="segment"
                                withLegend={audienceChart.series.length > 1}
                                series={audienceChart.series}
                                tooltipProps={audienceChartTooltipProps}
                                valueFormatter={audienceChart.formatter}
                                tickLine="y"
                              />
                            ) : (
                              <Paper withBorder radius="xl" p="md" className={classes.emptyPanel}>
                                <Text fw={700}>
                                  {isMeta
                                    ? 'Audience rows are still syncing'
                                    : 'Audience graph is currently Meta-only'}
                                </Text>
                                <Text size="sm" c="dimmed" mt={6}>
                                  {isMeta
                                    ? 'Age and gender breakdowns will appear here as synced audience rows fill in for the featured ad set history.'
                                    : 'The audience breakdown graph is only wired for Meta right now.'}
                                </Text>
                              </Paper>
                            )}
                            <DataSummaryBox summary={audienceDataSummary} />
                          </div>
                        </div>
                      </Stack>
                    </Paper>
                  </Grid.Col>
                </Grid>
              ) : null}
            </Stack>
          </Card>
        ) : null}

        {showLiveDeliveryTables && payload.state === 'ready' && (todayLiveWindow.hasLiveDelivery || lifetimeLiveWindow.hasLiveDelivery) ? (
          <Card withBorder radius="xl" p="lg" className={classes.panel}>
            <Stack gap="md">
              <Group justify="space-between" align="flex-start" gap="md" wrap="wrap">
                <div>
                  <Text fw={800} className={classes.liveDeliveryTitle}>
                    {activeDeliveryWindowMode === 'today'
                      ? 'Live delivery today'
                      : 'Live delivery lifetime'}
                  </Text>
                  <Text size="sm" c="dimmed" mt={4}>
                    Current active campaigns, ad sets, and ads for the selected account.
                  </Text>
                </div>
                <SegmentedControl
                  radius="xl"
                  size="xs"
                  value={activeDeliveryWindowMode}
                  onChange={(value) => setDeliveryWindowMode(value as DeliveryWindowMode)}
                  data={[
                    {
                      label: 'Today',
                      value: 'today',
                      disabled: !todayLiveWindow.hasLiveDelivery,
                    },
                    {
                      label: 'Lifetime',
                      value: 'lifetime',
                      disabled: !lifetimeLiveWindow.hasLiveDelivery,
                    },
                  ]}
                />
              </Group>
              <Stack gap="xs">
                <LiveDeliverySectionHeader title="Campaign containers" />
                {isPhone ? (
                  <Stack gap="sm">
                    {liveWindow.campaigns.slice(0, mobileLiveRowLimit).map((campaign) => {
                      const reportHref = buildDashboardEntityReportHref({
                        scope: 'campaign',
                        platformIntegrationId: selectedPlatformIntegrationId,
                        adAccountId: selectedAdAccountId,
                        campaignId: campaign.id,
                        schedules: [campaign.schedule],
                      });

                      return (
                        <CampaignLiveRow
                          key={campaign.id}
                          campaign={campaign}
                          currencyCode={payload.viewContext.currencyCode}
                          reportHref={reportHref}
                        />
                      );
                    })}
                    {liveWindow.campaigns.length > mobileLiveRowLimit ? (
                      <Text size="xs" c="dimmed" ta="center">
                        Showing top {mobileLiveRowLimit} of {formatNumber(liveWindow.campaigns.length)} campaigns.
                      </Text>
                    ) : null}
                  </Stack>
                ) : (
                  <div className={classes.tableWrap}>
                    <ScrollArea>
                      <Table
                        striped
                        highlightOnHover
                        withTableBorder
                        className={`${classes.dataTable} ${classes.liveCampaignTable}`}
                      >
                        <colgroup>
                          <col style={{ width: '220px' }} />
                          <col style={{ width: '110px' }} />
                          <col style={{ width: '150px' }} />
                          <col style={{ width: '100px' }} />
                          <col style={{ width: '90px' }} />
                          <col style={{ width: '120px' }} />
                          <col style={{ width: '80px' }} />
                          <col style={{ width: '100px' }} />
                          <col style={{ width: '90px' }} />
                          <col style={{ width: '110px' }} />
                        </colgroup>
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th>Campaign</Table.Th>
                            <Table.Th>Status</Table.Th>
                            <Table.Th>Objective</Table.Th>
                            <Table.Th ta="right" className={`${classes.tableMetricDivider} ${classes.tableStatHeader}`}>
                              Spend
                            </Table.Th>
                            <Table.Th ta="right" className={classes.tableStatHeader}>
                              Results
                            </Table.Th>
                            <Table.Th ta="right" className={classes.tableStatHeader}>
                              Cost/Result
                            </Table.Th>
                            <Table.Th ta="right" className={classes.tableStatHeader}>
                              CTR
                            </Table.Th>
                            <Table.Th ta="right" className={classes.tableStatHeader}>
                              Live ad sets
                            </Table.Th>
                            <Table.Th ta="right" className={classes.tableStatHeader}>
                              Live ads
                            </Table.Th>
                            <Table.Th ta="right" className={classes.tableStatHeader}>
                              Report
                            </Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {liveWindow.campaigns.map((campaign) => {
                            const reportHref = buildDashboardEntityReportHref({
                              scope: 'campaign',
                              platformIntegrationId: selectedPlatformIntegrationId,
                              adAccountId: selectedAdAccountId,
                              campaignId: campaign.id,
                              schedules: [campaign.schedule],
                            });

                            return (
                              <Table.Tr key={campaign.id}>
                                <Table.Td>
                                  <Text fw={700} className={classes.tableTruncatePrimary}>
                                    {campaign.name}
                                  </Text>
                                </Table.Td>
                                <Table.Td>
                                  <TableStatusBadge status={campaign.status} />
                                </Table.Td>
                                <Table.Td>
                                  <Text className={classes.tableValueText}>
                                    {campaign.objective ? formatStatusLabel(campaign.objective) : '—'}
                                  </Text>
                                </Table.Td>
                                <Table.Td
                                  ta="right"
                                  className={`${classes.tableMetricDivider} ${classes.tableStatCell}`}
                                >
                                  {formatCurrency(campaign.spend, payload.viewContext.currencyCode)}
                                </Table.Td>
                                <Table.Td ta="right" className={classes.tableStatCell}>
                                  {formatNumber(campaign.results)}
                                </Table.Td>
                                <Table.Td ta="right" className={classes.tableStatCell}>
                                  {campaign.results > 0
                                    ? formatCurrency(
                                      campaign.costPerResult,
                                      payload.viewContext.currencyCode,
                                      2
                                    )
                                    : '—'}
                                </Table.Td>
                                <Table.Td ta="right" className={classes.tableStatCell}>
                                  {formatRate(campaign.ctr)}
                                </Table.Td>
                                <Table.Td ta="right" className={classes.tableStatCell}>
                                  {formatNumber(campaign.adsetCount)}
                                </Table.Td>
                                <Table.Td ta="right" className={classes.tableStatCell}>
                                  {formatNumber(campaign.adCount)}
                                </Table.Td>
                                <Table.Td ta="right" className={classes.tableStatCell}>
                                  <Button
                                    component={Link}
                                    href={reportHref}
                                    size="xs"
                                    radius="xl"
                                    variant="subtle"
                                  >
                                    View
                                  </Button>
                                </Table.Td>
                              </Table.Tr>
                            );
                          })}
                        </Table.Tbody>
                      </Table>
                    </ScrollArea>
                  </div>
                )}
              </Stack>

              <Stack gap="xs" className={classes.subSection}>
                <LiveDeliverySectionHeader title="Ad set comparison" />
                {isPhone ? (
                  <Stack gap="sm">
                    {liveComparisons.adsets.slice(0, mobileLiveRowLimit).map((item) => {
                      const reportHref = buildDashboardEntityReportHref({
                        scope: 'adset',
                        platformIntegrationId: selectedPlatformIntegrationId,
                        adAccountId: selectedAdAccountId,
                        campaignId: item.campaignId,
                        adsetId: item.id,
                        schedules: [item.schedule, item.campaignSchedule],
                      });

                      return (
                        <AdsetComparisonRow
                          key={item.id}
                          item={item}
                          currencyCode={payload.viewContext.currencyCode}
                          reportHref={reportHref}
                        />
                      );
                    })}
                    {liveComparisons.adsets.length > mobileLiveRowLimit ? (
                      <Text size="xs" c="dimmed" ta="center">
                        Showing top {mobileLiveRowLimit} of {formatNumber(liveComparisons.adsets.length)} ad sets.
                      </Text>
                    ) : null}
                  </Stack>
                ) : (
                  <div className={classes.tableWrap}>
                    <ScrollArea>
                      <Table
                        striped
                        highlightOnHover
                        withTableBorder
                        className={`${classes.dataTable} ${classes.liveAdsetTable}`}
                      >
                        <colgroup>
                          <col style={{ width: '220px' }} />
                          <col style={{ width: '200px' }} />
                          <col style={{ width: '110px' }} />
                          <col style={{ width: '150px' }} />
                          <col style={{ width: '100px' }} />
                          <col style={{ width: '90px' }} />
                          <col style={{ width: '80px' }} />
                          <col style={{ width: '120px' }} />
                          <col style={{ width: '90px' }} />
                          <col style={{ width: '110px' }} />
                        </colgroup>
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th>Ad set</Table.Th>
                            <Table.Th>Campaign</Table.Th>
                            <Table.Th>Status</Table.Th>
                            <Table.Th>Goal</Table.Th>
                            <Table.Th ta="right" className={`${classes.tableMetricDivider} ${classes.tableStatHeader}`}>
                              Spend
                            </Table.Th>
                            <Table.Th ta="right" className={classes.tableStatHeader}>
                              Results
                            </Table.Th>
                            <Table.Th ta="right" className={classes.tableStatHeader}>
                              Cost/Result
                            </Table.Th>
                            <Table.Th ta="right" className={classes.tableStatHeader}>
                              CTR
                            </Table.Th>
                            <Table.Th ta="right" className={classes.tableStatHeader}>
                              Live ads
                            </Table.Th>
                            <Table.Th ta="right" className={classes.tableStatHeader}>
                              Report
                            </Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {liveComparisons.adsets.map((item) => {
                            const reportHref = buildDashboardEntityReportHref({
                              scope: 'adset',
                              platformIntegrationId: selectedPlatformIntegrationId,
                              adAccountId: selectedAdAccountId,
                              campaignId: item.campaignId,
                              adsetId: item.id,
                              schedules: [item.schedule, item.campaignSchedule],
                            });

                            return (
                              <Table.Tr key={item.id}>
                                <Table.Td>
                                  <Text fw={700} className={classes.tableTruncatePrimary}>
                                    {item.name}
                                  </Text>
                                </Table.Td>
                                <Table.Td className={classes.tableCellMuted}>
                                  <Text className={classes.tableTruncateMuted}>
                                    {item.campaignName ?? '—'}
                                  </Text>
                                </Table.Td>
                                <Table.Td>
                                  <TableStatusBadge status={item.status} />
                                </Table.Td>
                                <Table.Td>
                                  <Text className={classes.tableValueText}>
                                    {item.optimizationGoal
                                      ? formatStatusLabel(item.optimizationGoal)
                                      : '—'}
                                  </Text>
                                </Table.Td>
                                <Table.Td
                                  ta="right"
                                  className={`${classes.tableMetricDivider} ${classes.tableStatCell}`}
                                >
                                  {formatCurrency(item.spend, payload.viewContext.currencyCode)}
                                </Table.Td>
                                <Table.Td ta="right" className={classes.tableStatCell}>
                                  {formatNumber(item.results)}
                                </Table.Td>
                                <Table.Td ta="right" className={classes.tableStatCell}>
                                  {item.results > 0
                                    ? formatCurrency(
                                      item.costPerResult,
                                      payload.viewContext.currencyCode,
                                      2
                                    )
                                    : '—'}
                                </Table.Td>
                                <Table.Td ta="right" className={classes.tableStatCell}>
                                  {formatRate(item.ctr)}
                                </Table.Td>
                                <Table.Td ta="right" className={classes.tableStatCell}>
                                  {formatNumber(item.adCount)}
                                </Table.Td>
                                <Table.Td ta="right" className={classes.tableStatCell}>
                                  <Button
                                    component={Link}
                                    href={reportHref}
                                    size="xs"
                                    radius="xl"
                                    variant="subtle"
                                  >
                                    View
                                  </Button>
                                </Table.Td>
                              </Table.Tr>
                            );
                          })}
                        </Table.Tbody>
                      </Table>
                    </ScrollArea>
                  </div>
                )}
              </Stack>

              <Stack gap="xs" className={classes.subSection}>
                <LiveDeliverySectionHeader
                  title="Ad comparison"
                />
                {isPhone ? (
                  <Stack gap="sm">
                    {liveComparisons.ads.slice(0, mobileLiveRowLimit).map((item) => {
                      const reportHref = buildDashboardEntityReportHref({
                        scope: 'ad',
                        platformIntegrationId: selectedPlatformIntegrationId,
                        adAccountId: selectedAdAccountId,
                        campaignId: item.campaignId,
                        adsetId: item.adsetId,
                        adId: item.id,
                        schedules: [item.schedule, item.adsetSchedule, item.campaignSchedule],
                      });

                      return (
                        <AdComparisonRow
                          key={item.id}
                          item={item}
                          currencyCode={payload.viewContext.currencyCode}
                          reportHref={reportHref}
                        />
                      );
                    })}
                    {liveComparisons.ads.length > mobileLiveRowLimit ? (
                      <Text size="xs" c="dimmed" ta="center">
                        Showing top {mobileLiveRowLimit} of {formatNumber(liveComparisons.ads.length)} ads.
                      </Text>
                    ) : null}
                  </Stack>
                ) : (
                  <div className={classes.tableWrap}>
                    <ScrollArea>
                      <Table
                        striped
                        highlightOnHover
                        withTableBorder
                        className={`${classes.dataTable} ${classes.liveAdTable}`}
                      >
                        <colgroup>
                          <col style={{ width: '220px' }} />
                          <col style={{ width: '190px' }} />
                          <col style={{ width: '190px' }} />
                          <col style={{ width: '110px' }} />
                          <col style={{ width: '100px' }} />
                          <col style={{ width: '90px' }} />
                          <col style={{ width: '80px' }} />
                          <col style={{ width: '120px' }} />
                          <col style={{ width: '110px' }} />
                        </colgroup>
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th>Ad</Table.Th>
                            <Table.Th>Campaign</Table.Th>
                            <Table.Th>Ad set</Table.Th>
                            <Table.Th>Status</Table.Th>
                            <Table.Th ta="right" className={`${classes.tableMetricDivider} ${classes.tableStatHeader}`}>
                              Spend
                            </Table.Th>
                            <Table.Th ta="right" className={classes.tableStatHeader}>
                              Results
                            </Table.Th>
                            <Table.Th ta="right" className={classes.tableStatHeader}>
                              Cost/Result
                            </Table.Th>
                            <Table.Th ta="right" className={classes.tableStatHeader}>
                              CTR
                            </Table.Th>
                            <Table.Th ta="right" className={classes.tableStatHeader}>
                              Report
                            </Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {liveComparisons.ads.map((item) => {
                            const reportHref = buildDashboardEntityReportHref({
                              scope: 'ad',
                              platformIntegrationId: selectedPlatformIntegrationId,
                              adAccountId: selectedAdAccountId,
                              campaignId: item.campaignId,
                              adsetId: item.adsetId,
                              adId: item.id,
                              schedules: [
                                item.schedule,
                                item.adsetSchedule,
                                item.campaignSchedule,
                              ],
                            });

                            return (
                              <Table.Tr key={item.id}>
                                <Table.Td>
                                  <Text fw={700} className={classes.tableTruncatePrimary}>
                                    {item.name}
                                  </Text>
                                </Table.Td>
                                <Table.Td className={classes.tableCellMuted}>
                                  <Text className={classes.tableTruncateMuted}>
                                    {item.campaignName ?? '—'}
                                  </Text>
                                </Table.Td>
                                <Table.Td className={classes.tableCellMuted}>
                                  <Text className={classes.tableTruncateMuted}>
                                    {item.adsetName ?? '—'}
                                  </Text>
                                </Table.Td>
                                <Table.Td>
                                  <TableStatusBadge status={item.status} />
                                </Table.Td>
                                <Table.Td
                                  ta="right"
                                  className={`${classes.tableMetricDivider} ${classes.tableStatCell}`}
                                >
                                  {formatCurrency(item.spend, payload.viewContext.currencyCode)}
                                </Table.Td>
                                <Table.Td ta="right" className={classes.tableStatCell}>
                                  {formatNumber(item.results)}
                                </Table.Td>
                                <Table.Td ta="right" className={classes.tableStatCell}>
                                  {item.results > 0
                                    ? formatCurrency(
                                      item.costPerResult,
                                      payload.viewContext.currencyCode,
                                      2
                                    )
                                    : '—'}
                                </Table.Td>
                                <Table.Td ta="right" className={classes.tableStatCell}>
                                  {formatRate(item.ctr)}
                                </Table.Td>
                                <Table.Td ta="right" className={classes.tableStatCell}>
                                  <Button
                                    component={Link}
                                    href={reportHref}
                                    size="xs"
                                    radius="xl"
                                    variant="subtle"
                                  >
                                    View
                                  </Button>
                                </Table.Td>
                              </Table.Tr>
                            );
                          })}
                        </Table.Tbody>
                      </Table>
                    </ScrollArea>
                  </div>
                )}
              </Stack>
            </Stack>
          </Card>
        ) : null}
      </Stack>
    </Container>
  );
}
