'use client';

import '@mantine/charts/styles.css';

import { BarChart, LineChart } from '@mantine/charts';
import {
  Alert,
  Badge,
  Button,
  Card,
  Container,
  Grid,
  Group,
  Paper,
  ScrollArea,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Table,
  Text,
  ThemeIcon,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconChartBar,
  IconChartLine,
  IconCalendarEvent,
  IconClock,
  IconCurrencyDollar,
  IconLink,
  IconRefresh,
  IconTargetArrow,
  IconUsers,
} from '@tabler/icons-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { formatRetryDelay } from '@/lib/shared';
import type {
  DashboardLiveAdItem,
  DashboardLiveAdsetItem,
  DashboardLiveCampaignContainer,
  DashboardPayload,
  DashboardAudienceSlice,
  DashboardPlatformSlice,
  DashboardState,
} from '../types';
import classes from './DashboardClient.module.css';

type DashboardClientProps = {
  payload: DashboardPayload;
};

type TrendMode = 'delivery' | 'efficiency' | 'combined';
type HistoryGranularity = 'day' | 'hourly';
type HourlyRangeMode = 'today' | 'expanded';
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
  data: Record<string, string | number>[];
  series: {
    name: string;
    color: string;
    strokeDasharray?: string | number;
  }[];
  title: string;
  description: string;
  formatter: (value: number) => string;
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

type CalendarSuggestion = {
  itemType: 'review_report' | 'launch_test' | 'investigate_efficiency' | 'refresh_creative';
  priority: 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  destinationHref: string;
  markerLabel: string;
  dedupeKey: string;
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
const FEATURED_HISTORY_CHART_HEIGHT = 560;
const DELIVERY_SURFACE_CHART_HEIGHT = 260;
const AUDIENCE_BREAKDOWN_CHART_HEIGHT = 180;
const DIVERGENCE_THRESHOLD = 10;
const MAJOR_DIVERGENCE_THRESHOLD = 15;
const HOURLY_SIGNAL_MIN_IMPRESSIONS = 100;
const HOURLY_SIGNAL_MIN_CLICKS = 3;
const HOURLY_SIGNAL_MIN_SPEND = 5;
const EXPANDED_HOURLY_POINT_WIDTH = 28;
const EXPANDED_HOURLY_MIN_WIDTH = 1400;

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
  { code: 'TX', name: 'Texas', col: 4, row: 5 },
  { code: 'MN', name: 'Minnesota', col: 5, row: 1 },
  { code: 'NE', name: 'Nebraska', col: 5, row: 2 },
  { code: 'KS', name: 'Kansas', col: 5, row: 3 },
  { code: 'OK', name: 'Oklahoma', col: 5, row: 4 },
  { code: 'LA', name: 'Louisiana', col: 5, row: 6 },
  { code: 'WI', name: 'Wisconsin', col: 6, row: 1 },
  { code: 'IA', name: 'Iowa', col: 6, row: 2 },
  { code: 'MO', name: 'Missouri', col: 6, row: 3 },
  { code: 'AR', name: 'Arkansas', col: 6, row: 4 },
  { code: 'MS', name: 'Mississippi', col: 6, row: 5 },
  { code: 'MI', name: 'Michigan', col: 7, row: 1 },
  { code: 'IL', name: 'Illinois', col: 7, row: 2 },
  { code: 'KY', name: 'Kentucky', col: 7, row: 3 },
  { code: 'TN', name: 'Tennessee', col: 7, row: 4 },
  { code: 'AL', name: 'Alabama', col: 7, row: 5 },
  { code: 'IN', name: 'Indiana', col: 8, row: 2 },
  { code: 'OH', name: 'Ohio', col: 9, row: 2 },
  { code: 'WV', name: 'West Virginia', col: 9, row: 3 },
  { code: 'GA', name: 'Georgia', col: 8, row: 5 },
  { code: 'FL', name: 'Florida', col: 9, row: 6 },
  { code: 'PA', name: 'Pennsylvania', col: 10, row: 2 },
  { code: 'VA', name: 'Virginia', col: 10, row: 3 },
  { code: 'NC', name: 'North Carolina', col: 10, row: 4 },
  { code: 'SC', name: 'South Carolina', col: 9, row: 5 },
  { code: 'NY', name: 'New York', col: 11, row: 1 },
  { code: 'NJ', name: 'New Jersey', col: 11, row: 2 },
  { code: 'MD', name: 'Maryland', col: 11, row: 3 },
  { code: 'DE', name: 'Delaware', col: 12, row: 3 },
  { code: 'VT', name: 'Vermont', col: 12, row: 1 },
  { code: 'NH', name: 'New Hampshire', col: 13, row: 1 },
  { code: 'MA', name: 'Massachusetts', col: 12, row: 2 },
  { code: 'CT', name: 'Connecticut', col: 12, row: 4 },
  { code: 'RI', name: 'Rhode Island', col: 13, row: 2 },
  { code: 'ME', name: 'Maine', col: 14, row: 1 },
  { code: 'DC', name: 'District of Columbia', col: 13, row: 4 },
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

function formatReadableDateLabel(value: string): string {
  const trimmed = value.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return formatReadableDate(trimmed) ?? trimmed;
  }

  const rangeMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})\s*-\s*(\d{4}-\d{2}-\d{2})$/);
  if (rangeMatch) {
    const start = formatReadableDate(rangeMatch[1]);
    const end = formatReadableDate(rangeMatch[2]);
    return start && end ? `${start} - ${end}` : trimmed;
  }

  return trimmed;
}

function formatDateSpan(start: string | null, end: string | null): string | null {
  const startLabel = formatReadableDate(start);
  const endLabel = formatReadableDate(end);

  if (startLabel && endLabel) {
    return start === end ? startLabel : `${startLabel} through ${endLabel}`;
  }

  return startLabel ?? endLabel ?? null;
}

function formatTrendLabel(value: string, granularity: HistoryGranularity): string {
  return granularity === 'day' ? formatReadableDateLabel(value) : value.trim();
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

  const prefersLinkClicks = hourlyPoints.some((point) => point.inlineLinkClicks > 0);
  const metricLabel = prefersLinkClicks ? 'Link clicks' : 'Clicks';
  const aggregates = new Map<
    string,
    {
      dayOfWeek: number;
      hourOfDay: number;
      impressions: number;
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
      clicks: 0,
      linkClicks: 0,
      spend: 0,
      occurrences: 0,
    };

    current.impressions += point.impressions;
    current.clicks += point.clicks;
    current.linkClicks += point.inlineLinkClicks;
    current.spend += point.spend;
    current.occurrences += 1;
    aggregates.set(key, current);
  }

  const cells = Array.from(aggregates.values()).map((aggregate) => {
    const metricTotal = prefersLinkClicks ? aggregate.linkClicks : aggregate.clicks;
    const metricAverage = aggregate.occurrences > 0 ? metricTotal / aggregate.occurrences : 0;
    const ctr = aggregate.impressions > 0 ? (aggregate.clicks / aggregate.impressions) * 100 : 0;

    return {
      key: `${aggregate.dayOfWeek}:${aggregate.hourOfDay}`,
      dayLabel: HEATMAP_DAY_LABELS[aggregate.dayOfWeek] ?? '—',
      dayOfWeek: aggregate.dayOfWeek,
      hourOfDay: aggregate.hourOfDay,
      metricAverage,
      metricTotal,
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

function buildCombinedTrendSeries(input: {
  granularity: HistoryGranularity;
  trendPoints: DashboardPayload['featuredAdsetHistory']['dailyTrend'];
}): CombinedTrendPoint[] {
  const deliveryValues =
    input.granularity === 'hourly'
      ? input.trendPoints.map(
          (point) => point.spend * 0.4 + point.clicks * 0.35 + point.inlineLinkClicks * 0.25
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
    const previousGap = Math.abs(previous.deliveryIndex - previous.efficiencyIndex);
    const gap = Math.abs(current.deliveryIndex - current.efficiencyIndex);
    const majorGap = gap >= MAJOR_DIVERGENCE_THRESHOLD;
    const lowConfidenceEfficiency =
      input.granularity === 'hourly' && isLowConfidenceHourlyEfficiencyPoint(currentPoint);

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
      gap >= DIVERGENCE_THRESHOLD
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
      const isFirstSustainedPoint = index === 1 || earlierGap < DIVERGENCE_THRESHOLD;

      if (isFirstSustainedPoint) {
        const efficiencyLeading = current.efficiencyIndex > current.deliveryIndex;

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
  payload: Array<{ name?: string; value?: number | string; color?: string }> | undefined;
  series: TrendChartConfig['series'];
  formatter: (value: number) => string;
  signal: TrendSignal | null;
}) {
  if (!input.label || !input.payload || input.payload.length === 0) {
    return null;
  }

  const colorBySeriesName = new Map(input.series.map((series) => [series.name, series.color]));

  return (
    <Paper withBorder radius="md" p="sm" shadow="sm" className={classes.historyTooltipCard}>
      <Stack gap={8}>
        <Text size="sm" fw={700}>
          {input.label}
        </Text>

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
                  <ThemeIcon color={color} variant="light" radius="xl" size="xs" />
                  <Text size="sm" c="dimmed">
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

        {input.signal ? (
          <Paper withBorder radius="md" p="xs" className={classes.historyTooltipSignal}>
            <Badge color={signalSeverityColor(input.signal.severity)} variant="light" size="xs">
              {input.signal.title}
            </Badge>
            {input.signal.confidence === 'low' ? (
              <Text size="xs" c="dimmed" mt={6} fw={700} className={classes.historyTooltipCopy}>
                Low-confidence hourly read
              </Text>
            ) : null}
            <Text size="xs" c="dimmed" mt={6} className={classes.historyTooltipCopy}>
              {input.signal.description}
            </Text>
            <Text size="xs" c="dimmed" mt={4} fw={700} className={classes.historyTooltipCopy}>
              Gap {formatDecimal(input.signal.gap)} idx
            </Text>
          </Paper>
        ) : null}
      </Stack>
    </Paper>
  );
}

function buildCreateAdHref(input: {
  campaignId?: string | null;
  adsetId?: string | null;
}): string | null {
  if (!input.adsetId) {
    return null;
  }

  const params = new URLSearchParams({
    scope: 'ad',
    adset_id: input.adsetId,
  });

  if (input.campaignId) {
    params.set('campaign_id', input.campaignId);
  }

  return `/campaigns/create?${params.toString()}`;
}

function buildCalendarSuggestion(input: {
  signal: TrendSignal | null;
  adset: DashboardLiveAdsetItem | null;
}): CalendarSuggestion | null {
  if (!input.signal || !input.adset) {
    return null;
  }

  if (input.signal.confidence === 'low') {
    return null;
  }

  const adCreateHref = buildCreateAdHref({
    campaignId: input.adset.campaignId,
    adsetId: input.adset.id,
  });
  const markerLabel = `${input.signal.dateLabel} · gap ${formatDecimal(input.signal.gap)} idx`;
  const dedupeKey = `${input.adset.id}:${input.signal.type}:${input.signal.dateLabel}`;

  switch (input.signal.type) {
    case 'delivery_drop_vs_efficiency':
      return {
        itemType: 'launch_test',
        priority: input.signal.severity === 'critical' ? 'critical' : 'high',
        title: `Add a recovery test to ${input.adset.name}`,
        description:
          `Delivery lost momentum while efficiency held up around ${input.signal.dateLabel}. Queue one new ad or variation to recover volume without changing too many variables at once.`,
        destinationHref: adCreateHref ?? '/campaigns/create',
        markerLabel,
        dedupeKey,
      };
    case 'efficiency_drop_vs_delivery':
      return {
        itemType: 'investigate_efficiency',
        priority: input.signal.severity === 'critical' ? 'critical' : 'high',
        title: `Review efficiency drift in ${input.adset.name}`,
        description:
          `Delivery kept rising while efficiency weakened around ${input.signal.dateLabel}. Queue a review before scaling further so spend does not outrun quality.`,
        destinationHref: '/reports',
        markerLabel,
        dedupeKey,
      };
    case 'sustained_divergence':
      return {
        itemType:
          input.signal.efficiencyIndex > input.signal.deliveryIndex
            ? 'launch_test'
            : 'investigate_efficiency',
        priority: input.signal.severity === 'critical' ? 'critical' : 'high',
        title:
          input.signal.efficiencyIndex > input.signal.deliveryIndex
            ? `Turn ${input.adset.name} into a scheduled test`
            : `Watch the scale pressure in ${input.adset.name}`,
        description:
          input.signal.efficiencyIndex > input.signal.deliveryIndex
            ? `Efficiency stayed ahead of delivery for multiple points starting around ${input.signal.dateLabel}. Queue a test so the ad set can pick up more volume carefully.`
            : `Delivery stayed materially ahead of efficiency for multiple points starting around ${input.signal.dateLabel}. Queue a calendar review before scale pressure worsens.`,
        destinationHref:
          input.signal.efficiencyIndex > input.signal.deliveryIndex
            ? adCreateHref ?? '/campaigns/create'
            : '/reports',
        markerLabel,
        dedupeKey,
      };
    case 'crossover_up':
    case 'crossover_down':
    default:
      return {
        itemType: 'review_report',
        priority: 'medium',
        title: `Review crossover point for ${input.adset.name}`,
        description:
          `Delivery and efficiency crossed around ${input.signal.dateLabel}. Queue a short report review so the next decision is tied to a real inflection point instead of a guess.`,
        destinationHref: '/reports',
        markerLabel,
        dedupeKey,
      };
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
  icon: Icon,
}: {
  label: string;
  value: string;
  detail?: string | null;
  icon: typeof IconUsers;
}) {
  return (
    <Paper withBorder radius="xl" p="md" className={classes.metricCard}>
      <Group justify="space-between" align="flex-start" gap="md" wrap="nowrap">
        <div>
          <Text size="xs" c="dimmed" tt="uppercase" fw={800}>
            {label}
          </Text>
          <Text fw={900} mt={8} className={classes.metricValue}>
            {value}
          </Text>
          {detail ? (
            <Text size="sm" c="dimmed" mt={8}>
              {detail}
            </Text>
          ) : null}
        </div>
        <ThemeIcon variant="light" color="blue" radius="md">
          <Icon size={18} />
        </ThemeIcon>
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
}: {
  campaign: DashboardLiveCampaignContainer;
  currencyCode: string | null;
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
          <ComparisonMetric label="CTR" value={formatRate(campaign.ctr)} />
          <ComparisonMetric label="Live ad sets" value={formatNumber(campaign.adsetCount)} />
          <ComparisonMetric label="Live ads" value={formatNumber(campaign.adCount)} />
        </div>
      </Group>
    </Paper>
  );
}

function AdsetComparisonRow({
  item,
  currencyCode,
}: {
  item: DashboardLiveAdsetItem;
  currencyCode: string | null;
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
          <ComparisonMetric label="CTR" value={formatRate(item.ctr)} />
          <ComparisonMetric
            label="Cost / result"
            value={item.results > 0 ? formatCurrency(item.costPerResult, currencyCode, 2) : '—'}
          />
          <ComparisonMetric label="Live ads" value={formatNumber(item.adCount)} />
        </div>
      </Group>
    </Paper>
  );
}

function AdComparisonRow({
  item,
  currencyCode,
}: {
  item: DashboardLiveAdItem;
  currencyCode: string | null;
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
          <ComparisonMetric label="CTR" value={formatRate(item.ctr)} />
          <ComparisonMetric
            label="Cost / result"
            value={item.results > 0 ? formatCurrency(item.costPerResult, currencyCode, 2) : '—'}
          />
        </div>
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
    title: 'Audience response by age and gender',
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
          { name: 'CTR (%)', color: 'teal.8' },
          { name: 'CPC ($)', color: 'orange.8' },
          { name: 'CPM ($)', color: 'grape.8', strokeDasharray: '6 4' },
        ],
        title: 'CTR, CPC, and CPM by hour',
        description:
          'Advertiser-time efficiency signals across the full synced hourly history for the featured ad set.',
        formatter: (value: number) => formatDecimal(value),
      };
    }

    if (input.trendMode === 'combined') {
      const deliveryValues = input.trendPoints.map(
        (point) => point.spend * 0.4 + point.clicks * 0.35 + point.inlineLinkClicks * 0.25
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
          { name: 'Delivery index', color: 'blue.8' },
          { name: 'Efficiency index', color: 'green.8' },
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
        Clicks: point.clicks,
        'Link clicks': point.inlineLinkClicks,
      })),
      series: [
        { name: 'Spend ($)', color: 'indigo.8' },
        { name: 'Clicks', color: 'green.8' },
        { name: 'Link clicks', color: 'blue.7', strokeDasharray: '6 4' },
      ],
      title: 'Spend, clicks, and link clicks by hour',
      description:
        'Advertiser-time delivery across the full synced hourly history for the featured ad set.',
      formatter: (value: number) => formatCompactNumber(value),
    };
  }

  if (input.trendMode === 'efficiency') {
    return {
      data: input.trendPoints.map((point) => ({
        label: formatReadableDateLabel(point.label),
        'CTR (%)': Number(point.ctr.toFixed(2)),
        'CPC ($)': Number(point.cpc.toFixed(2)),
        Frequency: Number(point.frequency.toFixed(2)),
      })),
      series: [
        { name: 'CTR (%)', color: 'teal.8' },
        { name: 'CPC ($)', color: 'orange.8' },
        { name: 'Frequency', color: 'grape.8', strokeDasharray: '6 4' },
      ],
      title: 'CTR, CPC, and frequency',
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
        { name: 'Delivery index', color: 'blue.8' },
        { name: 'Efficiency index', color: 'green.8' },
      ],
      title: 'Delivery and efficiency crossover',
      description:
        'Indexed view of volume versus efficiency so you can spot where performance growth started to help or hurt efficiency.',
      formatter: (value: number) => `${formatDecimal(value)} idx`,
    };
  }

  return {
      data: input.trendPoints.map((point) => ({
        label: formatReadableDateLabel(point.label),
        'Spend ($)': Number(point.spend.toFixed(2)),
        Results: point.results,
        Clicks: point.clicks,
      })),
      series: [
        { name: 'Spend ($)', color: 'indigo.8' },
        { name: 'Results', color: 'green.8' },
        { name: 'Clicks', color: 'blue.7', strokeDasharray: '6 4' },
      ],
    title: 'Spend, results, and clicks',
    description: 'Delivery volume for the featured ad set from first delivery through today.',
    formatter: (value: number) => formatCompactNumber(value),
  };
}

export default function DashboardClient({ payload }: DashboardClientProps) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [trendMode, setTrendMode] = useState<TrendMode>('delivery');
  const [historyGranularity, setHistoryGranularity] = useState<HistoryGranularity>('day');
  const [hourlyRangeMode, setHourlyRangeMode] = useState<HourlyRangeMode>('today');
  const [surfacePanelMode, setSurfacePanelMode] = useState<SurfacePanelMode>('platform');
  const [refreshFeedback, setRefreshFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [calendarSuggestionState, setCalendarSuggestionState] = useState<{
    status: 'idle' | 'creating' | 'created' | 'error';
    message: string | null;
  }>({
    status: 'idle',
    message: null,
  });
  const expandedHourlyViewportRef = useRef<HTMLDivElement>(null);

  const stateMeta = stateContent(payload.state);
  const liveWindow = payload.liveToday;
  const liveSummary = payload.liveToday.summary;
  const liveComparisons = payload.liveToday.comparisons;
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
  const isMeta = payload.platform?.vendor === 'meta';
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
  const expandedHourlyTickValues = useMemo(
    () =>
      historyGranularity === 'hourly' && hourlyRangeMode === 'expanded'
        ? trendChart.data
            .map((point) => String(point.label ?? ''))
            .filter(isExpandedHourlyAnchor)
        : [],
    [historyGranularity, hourlyRangeMode, trendChart.data]
  );
  const isExpandedHourlyScrollable =
    historyGranularity === 'hourly' && hourlyRangeMode === 'expanded';
  const expandedHourlyChartWidth = useMemo(
    () =>
      isExpandedHourlyScrollable
        ? Math.max(EXPANDED_HOURLY_MIN_WIDTH, trendChart.data.length * EXPANDED_HOURLY_POINT_WIDTH)
        : null,
    [isExpandedHourlyScrollable, trendChart.data.length]
  );
  const trendXAxisProps = useMemo(() => {
    if (historyGranularity === 'hourly' && hourlyRangeMode === 'expanded') {
      return {
        interval: 0 as const,
        minTickGap: 28,
        tickMargin: 10,
        ticks: expandedHourlyTickValues,
        tickFormatter: (value: string) => formatExpandedHourlyAxisLabel(String(value)),
      };
    }

    return undefined;
  }, [expandedHourlyTickValues, historyGranularity, hourlyRangeMode]);
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
  const calendarSuggestion = useMemo(
    () =>
      buildCalendarSuggestion({
        signal: primaryCombinedTrendSignal,
        adset: featuredAdset,
      }),
    [primaryCombinedTrendSignal, featuredAdset]
  );
  const trendReferenceLines = useMemo(
    () =>
      trendMode === 'combined' && primaryCombinedTrendSignal
        ? [
            {
              x: primaryCombinedTrendSignal.dateLabel,
              color: signalSeverityColor(primaryCombinedTrendSignal.severity),
              label: primaryCombinedTrendSignal.markerLabel,
              labelPosition: 'insideTop' as const,
              strokeDasharray: '4 4',
            },
          ]
        : undefined,
    [primaryCombinedTrendSignal, trendMode]
  );
  const trendTooltipProps = useMemo(
    () => ({
      content: ({
        label,
        payload,
      }: {
        label?: string;
        payload?: Array<{ name?: string; value?: number | string; color?: string }>;
      }) =>
        renderTrendTooltip({
          label,
          payload,
          series: trendChart.series,
          formatter: trendChart.formatter,
          signal:
            trendMode === 'combined' && typeof label === 'string'
              ? combinedSignalByLabel.get(label) ?? null
              : null,
        }),
    }),
    [combinedSignalByLabel, trendChart.formatter, trendChart.series, trendMode]
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

  useEffect(() => {
    setCalendarSuggestionState({
      status: 'idle',
      message: null,
    });
  }, [calendarSuggestion?.dedupeKey]);

  useEffect(() => {
    setHourlyRangeMode('today');
  }, [featuredAdset?.id]);

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

  async function handleCreateCalendarSuggestion() {
    if (!calendarSuggestion || !payload.selection.selectedAdAccountId || !payload.selection.selectedPlatformIntegrationId) {
      return;
    }

    setCalendarSuggestionState({
      status: 'creating',
      message: null,
    });

    try {
      const response = await fetch('/api/calendar/queue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          platformIntegrationId: payload.selection.selectedPlatformIntegrationId,
          adAccountId: payload.selection.selectedAdAccountId,
          itemType: calendarSuggestion.itemType,
          priority: calendarSuggestion.priority,
          title: calendarSuggestion.title,
          description: calendarSuggestion.description,
          destinationHref: calendarSuggestion.destinationHref,
          payload: {
            source: 'dashboard_trend_signal',
            dedupeKey: calendarSuggestion.dedupeKey,
            markerLabel: calendarSuggestion.markerLabel,
            featuredAdsetId: featuredAdset?.id ?? null,
            featuredAdsetName: featuredAdset?.name ?? null,
            signalType: primaryCombinedTrendSignal?.type ?? null,
          },
        }),
      });

      const result = (await response.json()) as {
        success?: boolean;
        created?: boolean;
        error?: string;
      };

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Unable to send suggestion to calendar.');
      }

      setCalendarSuggestionState({
        status: 'created',
        message: result.created === false ? 'Suggestion is already in the calendar.' : 'Suggestion added to the calendar queue.',
      });
    } catch (error) {
      setCalendarSuggestionState({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Unable to send suggestion to the calendar.',
      });
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
          >
            {refreshFeedback.message}
          </Alert>
        ) : null}

        {payload.syncCoverage?.historicalAnalysisPending ? (
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

        <Card withBorder radius="xl" p="lg" className={classes.topBar}>
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

              <Group gap="sm" wrap="wrap">
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
              </Group>
            </Group>

            <Grid gutter="md" align="stretch">
              <Grid.Col span={{ base: 12, xl: 8 }}>
                <Paper withBorder radius="xl" p="md" className={classes.chartPanel}>
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
                    </Group>

                    {historyGranularity === 'hourly' &&
                    hourlyRangeMode === 'expanded' &&
                    hourlyHistoryRangeLabel ? (
                      <Text size="sm" c="dimmed">
                        {hourlyHistoryRangeLabel} · advertiser account time
                      </Text>
                    ) : null}
                  </Stack>

                  {trendChart.data.length > 0 ? (
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
                            h={FEATURED_HISTORY_CHART_HEIGHT}
                            data={trendChart.data}
                            dataKey="label"
                            type="default"
                            curveType="monotone"
                            withLegend
                            withDots
                            strokeWidth={4}
                            gridAxis="xy"
                            strokeDasharray="4 4"
                            yAxisProps={{ width: 68 }}
                            xAxisProps={trendXAxisProps}
                            tooltipProps={trendTooltipProps}
                            dotProps={{
                              r: 3,
                              strokeWidth: 2,
                              fill: '#ffffff',
                            }}
                            activeDotProps={{
                              r: 5,
                              strokeWidth: 2,
                              fill: '#ffffff',
                            }}
                            lineProps={(series) => ({
                              strokeDasharray: series.strokeDasharray,
                              strokeLinecap: 'round',
                              strokeLinejoin: 'round',
                            })}
                            referenceLines={trendReferenceLines}
                            series={trendChart.series}
                            valueFormatter={(value) =>
                              typeof value === 'number' ? trendChart.formatter(value) : String(value)
                            }
                          />
                        </div>
                      </ScrollArea>
                    ) : (
                      <LineChart
                        h={FEATURED_HISTORY_CHART_HEIGHT}
                        data={trendChart.data}
                        dataKey="label"
                        type="default"
                        curveType="monotone"
                        withLegend
                        withDots
                        strokeWidth={4}
                        gridAxis="xy"
                        strokeDasharray="4 4"
                        yAxisProps={{ width: 68 }}
                        xAxisProps={trendXAxisProps}
                        tooltipProps={trendTooltipProps}
                        dotProps={{
                          r: 3,
                          strokeWidth: 2,
                          fill: '#ffffff',
                        }}
                        activeDotProps={{
                          r: 5,
                          strokeWidth: 2,
                          fill: '#ffffff',
                        }}
                        lineProps={(series) => ({
                          strokeDasharray: series.strokeDasharray,
                          strokeLinecap: 'round',
                          strokeLinejoin: 'round',
                        })}
                        referenceLines={trendReferenceLines}
                        series={trendChart.series}
                        valueFormatter={(value) =>
                          typeof value === 'number' ? trendChart.formatter(value) : String(value)
                        }
                      />
                    )
                  ) : (
                    <Stack
                      justify="center"
                      align="center"
                      h={FEATURED_HISTORY_CHART_HEIGHT}
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
                        {surfacePanelMode === 'platform' || surfacePanelMode === 'device' ? (
                          featuredAdset ? (
                            <Text size="sm" c="dimmed" mt={4}>
                              Full synced delivery surface history for {featuredAdset.name}
                            </Text>
                          ) : null
                        ) : null}
                        {surfacePanelMode === 'times' ? (
                          <Text size="sm" c="dimmed" mt={4}>
                            Recurring hourly response from synced advertiser-time history.
                          </Text>
                        ) : null}
                        {surfacePanelMode === 'geo' ? (
                          <Text size="sm" c="dimmed" mt={4}>
                            Country rows are excluded here. Only state-level regional rows are
                            highlighted.
                          </Text>
                        ) : null}
                      </div>
                    </Group>
                    <Group gap="xs" wrap="wrap">
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
                                      )}: avg ${formatDecimal(cell.metricAverage)} ${
                                        hourlyHeatmap.metricLabel
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

                          <Text size="xs" c="dimmed">
                            Full synced hourly history in advertiser account time. Darker cells show
                            stronger recurring {hourlyHeatmap.metricLabel.toLowerCase()} periods.
                          </Text>
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
                        <Stack justify="center" align="center" h={DELIVERY_SURFACE_CHART_HEIGHT} gap="xs">
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
                        h={DELIVERY_SURFACE_CHART_HEIGHT}
                        data={activeSurfaceChart.data}
                        dataKey="segment"
                        withLegend={activeSurfaceChart.withLegend}
                        series={activeSurfaceChart.series}
                        valueFormatter={activeSurfaceChart.formatter}
                        tickLine="y"
                      />
                    ) : (
                      <Stack justify="center" align="center" h={DELIVERY_SURFACE_CHART_HEIGHT} gap="xs">
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

                    <div className={classes.chartSubSection}>
                      <Text size="xs" c="dimmed" tt="uppercase" fw={800} mb={6}>
                        Audience breakdown
                      </Text>
                      <Text fw={700} mb="sm">
                        {audienceChart.title}
                      </Text>
                      {featuredAudienceBreakdowns.state === 'available' &&
                      audienceChart.data.length > 0 ? (
                        <BarChart
                          h={AUDIENCE_BREAKDOWN_CHART_HEIGHT}
                          type={audienceChart.type}
                          data={audienceChart.data}
                          dataKey="segment"
                          withLegend={audienceChart.series.length > 1}
                          series={audienceChart.series}
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
                    </div>
                  </Stack>
                </Paper>
              </Grid.Col>
            </Grid>

            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3, xl: 6 }} spacing="md">
              <SummaryCard
                label="Live campaigns"
                value={formatNumber(liveSummary.liveCampaignCount)}
                icon={IconUsers}
              />
              <SummaryCard
                label="Live ad sets"
                value={formatNumber(liveSummary.liveAdsetCount)}
                icon={IconTargetArrow}
              />
              <SummaryCard
                label="Live ads"
                value={formatNumber(liveSummary.liveAdCount)}
                icon={IconLink}
              />
              <SummaryCard
                label="Spend"
                value={formatCurrency(liveSummary.spend, payload.viewContext.currencyCode)}
                icon={IconCurrencyDollar}
              />
              <SummaryCard
                label={liveSummary.primaryOutcomeLabel}
                value={formatNumber(liveSummary.primaryOutcomeValue)}
                icon={IconTargetArrow}
              />
              <SummaryCard
                label="Serving platforms"
                value={
                  liveSummary.servingPlatformLabels.length > 0
                    ? liveSummary.servingPlatformLabels.join(', ')
                    : isMeta
                      ? 'Syncing'
                      : 'Unavailable'
                }
                icon={IconLink}
              />
            </SimpleGrid>
          </Stack>
        </Card>

        {payload.state === 'ready' && !liveWindow.hasLiveDelivery ? (
          <Alert color="blue" radius="lg" icon={<IconAlertCircle size={16} />}>
            <Text size="sm">
              No live delivery was found today. This dashboard only shows campaigns, ad sets, and
              ads that are active and actually serving right now.
            </Text>
          </Alert>
        ) : null}

        {payload.state === 'ready' && liveWindow.hasLiveDelivery ? (
          <Grid gutter="md" align="stretch">
            <Grid.Col span={{ base: 12, xl: 8 }}>
              <Card withBorder radius="xl" p="lg" h="100%" className={classes.panel}>
                <Stack gap="md">
                  <Text fw={800} className={classes.liveDeliveryTitle}>
                    Live delivery today
                  </Text>

                  <Stack gap="xs">
                    <LiveDeliverySectionHeader
                      title="Campaign containers"
                    />
                    <div className={classes.tableWrap}>
                      <ScrollArea>
                        <Table
                          striped
                          highlightOnHover
                          withTableBorder
                          className={`${classes.dataTable} ${classes.liveCampaignTable}`}
                        >
                          <colgroup>
                            <col style={{ width: '260px' }} />
                            <col style={{ width: '130px' }} />
                            <col style={{ width: '170px' }} />
                            <col style={{ width: '110px' }} />
                            <col style={{ width: '110px' }} />
                            <col style={{ width: '90px' }} />
                            <col style={{ width: '120px' }} />
                            <col style={{ width: '120px' }} />
                          </colgroup>
                          <Table.Thead>
                            <Table.Tr>
                              <Table.Th>Campaign</Table.Th>
                              <Table.Th>Status</Table.Th>
                              <Table.Th>Objective</Table.Th>
                              <Table.Th ta="right">Spend</Table.Th>
                              <Table.Th ta="right">Results</Table.Th>
                              <Table.Th ta="right">CTR</Table.Th>
                              <Table.Th ta="right">Live ad sets</Table.Th>
                              <Table.Th ta="right">Live ads</Table.Th>
                            </Table.Tr>
                          </Table.Thead>
                          <Table.Tbody>
                            {liveWindow.campaigns.map((campaign) => (
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
                                <Table.Td ta="right">
                                  {formatCurrency(campaign.spend, payload.viewContext.currencyCode)}
                                </Table.Td>
                                <Table.Td ta="right">{formatNumber(campaign.results)}</Table.Td>
                                <Table.Td ta="right">{formatRate(campaign.ctr)}</Table.Td>
                                <Table.Td ta="right">{formatNumber(campaign.adsetCount)}</Table.Td>
                                <Table.Td ta="right">{formatNumber(campaign.adCount)}</Table.Td>
                              </Table.Tr>
                            ))}
                          </Table.Tbody>
                        </Table>
                      </ScrollArea>
                    </div>
                  </Stack>

                  <Stack gap="xs" className={classes.subSection}>
                    <LiveDeliverySectionHeader
                      title="Ad set comparison"
                    />
                    <div className={classes.tableWrap}>
                      <ScrollArea>
                        <Table
                          striped
                          highlightOnHover
                          withTableBorder
                          className={`${classes.dataTable} ${classes.liveAdsetTable}`}
                        >
                          <colgroup>
                            <col style={{ width: '260px' }} />
                            <col style={{ width: '220px' }} />
                            <col style={{ width: '130px' }} />
                            <col style={{ width: '170px' }} />
                            <col style={{ width: '120px' }} />
                            <col style={{ width: '110px' }} />
                            <col style={{ width: '100px' }} />
                            <col style={{ width: '140px' }} />
                            <col style={{ width: '130px' }} />
                            <col style={{ width: '150px' }} />
                            <col style={{ width: '110px' }} />
                          </colgroup>
                          <Table.Thead>
                            <Table.Tr>
                              <Table.Th>Ad set</Table.Th>
                              <Table.Th>Campaign</Table.Th>
                              <Table.Th>Status</Table.Th>
                              <Table.Th>Goal</Table.Th>
                              <Table.Th ta="right">Spend</Table.Th>
                              <Table.Th ta="right">Results</Table.Th>
                              <Table.Th ta="right">CTR</Table.Th>
                              <Table.Th ta="right">Cost / result</Table.Th>
                              <Table.Th>Platform</Table.Th>
                              <Table.Th>Placement</Table.Th>
                              <Table.Th ta="right">Live ads</Table.Th>
                            </Table.Tr>
                          </Table.Thead>
                          <Table.Tbody>
                            {liveComparisons.adsets.map((item) => (
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
                                <Table.Td ta="right">
                                  {formatCurrency(item.spend, payload.viewContext.currencyCode)}
                                </Table.Td>
                                <Table.Td ta="right">{formatNumber(item.results)}</Table.Td>
                                <Table.Td ta="right">{formatRate(item.ctr)}</Table.Td>
                                <Table.Td ta="right">
                                  {item.results > 0
                                    ? formatCurrency(
                                        item.costPerResult,
                                        payload.viewContext.currencyCode,
                                        2
                                      )
                                    : '—'}
                                </Table.Td>
                                <Table.Td>
                                  <Text className={classes.tableValueText}>
                                    {item.topPublisherPlatform ?? '—'}
                                  </Text>
                                </Table.Td>
                                <Table.Td>
                                  <Text className={classes.tableValueText}>
                                    {item.topPlacement ?? '—'}
                                  </Text>
                                </Table.Td>
                                <Table.Td ta="right">{formatNumber(item.adCount)}</Table.Td>
                              </Table.Tr>
                            ))}
                          </Table.Tbody>
                        </Table>
                      </ScrollArea>
                    </div>
                  </Stack>

                  <Stack gap="xs" className={classes.subSection}>
                    <LiveDeliverySectionHeader
                      title="Ad comparison"
                    />
                    <div className={classes.tableWrap}>
                      <ScrollArea>
                        <Table
                          striped
                          highlightOnHover
                          withTableBorder
                          className={`${classes.dataTable} ${classes.liveAdTable}`}
                        >
                          <colgroup>
                            <col style={{ width: '260px' }} />
                            <col style={{ width: '220px' }} />
                            <col style={{ width: '220px' }} />
                            <col style={{ width: '130px' }} />
                            <col style={{ width: '120px' }} />
                            <col style={{ width: '110px' }} />
                            <col style={{ width: '100px' }} />
                            <col style={{ width: '140px' }} />
                            <col style={{ width: '130px' }} />
                            <col style={{ width: '150px' }} />
                          </colgroup>
                          <Table.Thead>
                            <Table.Tr>
                              <Table.Th>Ad</Table.Th>
                              <Table.Th>Campaign</Table.Th>
                              <Table.Th>Ad set</Table.Th>
                              <Table.Th>Status</Table.Th>
                              <Table.Th ta="right">Spend</Table.Th>
                              <Table.Th ta="right">Results</Table.Th>
                              <Table.Th ta="right">CTR</Table.Th>
                              <Table.Th ta="right">Cost / result</Table.Th>
                              <Table.Th>Platform</Table.Th>
                              <Table.Th>Placement</Table.Th>
                            </Table.Tr>
                          </Table.Thead>
                          <Table.Tbody>
                            {liveComparisons.ads.map((item) => (
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
                                <Table.Td ta="right">
                                  {formatCurrency(item.spend, payload.viewContext.currencyCode)}
                                </Table.Td>
                                <Table.Td ta="right">{formatNumber(item.results)}</Table.Td>
                                <Table.Td ta="right">{formatRate(item.ctr)}</Table.Td>
                                <Table.Td ta="right">
                                  {item.results > 0
                                    ? formatCurrency(
                                        item.costPerResult,
                                        payload.viewContext.currencyCode,
                                        2
                                      )
                                    : '—'}
                                </Table.Td>
                                <Table.Td>
                                  <Text className={classes.tableValueText}>
                                    {item.topPublisherPlatform ?? '—'}
                                  </Text>
                                </Table.Td>
                                <Table.Td>
                                  <Text className={classes.tableValueText}>
                                    {item.topPlacement ?? '—'}
                                  </Text>
                                </Table.Td>
                              </Table.Tr>
                            ))}
                          </Table.Tbody>
                        </Table>
                      </ScrollArea>
                    </div>
                  </Stack>
                </Stack>
              </Card>
            </Grid.Col>

            <Grid.Col span={{ base: 12, xl: 4 }}>
              <Card withBorder radius="xl" p="lg" h="100%" className={classes.panel}>
                <Stack gap="md">
                  <Group justify="space-between" align="flex-start" className={classes.sectionHeader}>
                    <div>
                      <Text size="xs" c="dimmed" tt="uppercase" fw={800}>
                        Calendar approvals
                      </Text>
                    </div>
                  </Group>

                  {calendarSuggestion && primaryCombinedTrendSignal ? (
                    <Paper withBorder radius="xl" p="md" className={classes.approvalCard}>
                      <Stack gap="md">
                        <Group justify="space-between" align="flex-start" gap="sm" wrap="wrap">
                          <div>
                            <Group gap="xs" wrap="wrap" mb={8}>
                              <Badge
                                color={signalSeverityColor(primaryCombinedTrendSignal.severity)}
                                variant="light"
                              >
                                {primaryCombinedTrendSignal.title}
                              </Badge>
                              <Badge color="gray" variant="outline">
                                Marker on combined chart
                              </Badge>
                            </Group>
                            <Text fw={800}>{calendarSuggestion.title}</Text>
                            <Text size="sm" c="dimmed" mt={6}>
                              {calendarSuggestion.description}
                            </Text>
                          </div>
                          <ThemeIcon color="blue" variant="light" radius="xl" size="lg">
                            <IconCalendarEvent size={18} />
                          </ThemeIcon>
                        </Group>

                        <div className={classes.approvalMeta}>
                          <Text size="xs" c="dimmed" tt="uppercase" fw={800}>
                            Trigger point
                          </Text>
                          <Text fw={700}>{calendarSuggestion.markerLabel}</Text>
                          <Text size="sm" c="dimmed" mt={4}>
                            Approve this suggestion to move it into the calendar queue for follow-up.
                          </Text>
                        </div>

                        {calendarSuggestionState.message ? (
                          <Alert
                            color={calendarSuggestionState.status === 'error' ? 'red' : 'green'}
                            radius="lg"
                            icon={<IconAlertCircle size={16} />}
                          >
                            {calendarSuggestionState.message}
                          </Alert>
                        ) : null}

                        <Group gap="sm" wrap="wrap">
                          <Button
                            radius="xl"
                            onClick={handleCreateCalendarSuggestion}
                            loading={calendarSuggestionState.status === 'creating'}
                            disabled={calendarSuggestionState.status === 'created'}
                          >
                            {calendarSuggestionState.status === 'created'
                              ? 'Added to calendar'
                              : 'Send to calendar'}
                          </Button>
                          <Button
                            component={Link}
                            href="/calendar"
                            radius="xl"
                            variant="default"
                          >
                            Open calendar
                          </Button>
                          <Button
                            component={Link}
                            href={calendarSuggestion.destinationHref}
                            radius="xl"
                            variant="light"
                          >
                            Open suggested action
                          </Button>
                        </Group>
                      </Stack>
                    </Paper>
                  ) : (
                    <Paper withBorder radius="xl" p="md" className={classes.emptyPanel}>
                      <Text fw={700}>
                        {trendPoints.length > 1
                          ? 'No calendar approval suggestion yet'
                          : 'Waiting for enough chart history'}
                      </Text>
                      <Text size="sm" c="dimmed" mt={6}>
                        {trendPoints.length > 1
                          ? 'Once the combined chart sees a meaningful crossover or divergence, DeepVisor will surface the suggested next move here for approval.'
                          : 'DeepVisor needs at least a small sequence of featured ad set history points before it can suggest a calendar action from the chart.'}
                      </Text>
                    </Paper>
                  )}
                </Stack>
              </Card>
            </Grid.Col>
          </Grid>
        ) : null}
      </Stack>
    </Container>
  );
}
