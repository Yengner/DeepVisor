'use client';

import '@mantine/charts/styles.css';
import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';

import { BarChart, ChartTooltip, LineChart } from '@mantine/charts';
import {
  Accordion,
  Badge,
  Button,
  Card,
  Container,
  Drawer,
  Grid,
  Group,
  Loader,
  Modal,
  Paper,
  ScrollArea,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
} from '@mantine/core';
import {
  IconArrowDownRight,
  IconArrowUpRight,
  IconChartBar,
  IconChevronRight,
  IconTimeline,
} from '@tabler/icons-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Fragment, useEffect, useMemo, useState, useTransition } from 'react';
import { ReferenceDot } from 'recharts';
import { buildReportUrl, CHART_METRIC_COLORS, formatChartDateLabel } from '@/lib/shared';
import type {
  DashboardAudienceSlice,
  DashboardPlatformSlice,
  DashboardTrendPoint,
} from '@/lib/server/dashboard/types';
import type {
  ReportBreakdownRow,
  ReportFilterOptions,
  ReportKpi,
  ReportPayload,
  ReportTimeSeriesPoint,
} from '@/lib/server/reports/types';
import PerformanceTable from './cards/PerformanceTable';
import ReportsHeader from './layout/ReportsHeader';
import ReportsSidebar from './layout/ReportsSidebar';
import classes from './ReportsClient.module.css';

interface ReportsClientProps {
  payload: ReportPayload;
  filterOptions: ReportFilterOptions;
  isDemo?: boolean;
}

type ReportChartSeries = {
  name: string;
  color: string;
};

type TimelineAnnotation = {
  key: string;
  chartLabel: string;
  value: number;
  label: string;
  detail: string;
  color: string;
};

type FindingAnnotationBucket = 'timeline' | 'quality';

type ReportTooltipPayloadItem = {
  name?: string | number;
  dataKey?: string | number;
  value?: number | string | Array<number | string>;
  color?: string;
  fill?: string;
  stroke?: string;
};

type ReportTooltipContentProps = {
  active?: boolean;
  label?: string | number;
  payload?: ReportTooltipPayloadItem[];
};

const PERFORMANCE_TIMELINE_SERIES: ReportChartSeries[] = [
  { name: 'Spend', color: CHART_METRIC_COLORS.spend },
  { name: 'Results', color: CHART_METRIC_COLORS.results },
  { name: 'Clicks', color: CHART_METRIC_COLORS.clicks },
];

const EFFICIENCY_TIMELINE_SERIES: ReportChartSeries[] = [
  { name: 'CTR', color: CHART_METRIC_COLORS.ctr },
  { name: 'CPC', color: CHART_METRIC_COLORS.cpc },
  { name: 'CPM', color: CHART_METRIC_COLORS.cpm },
];

const FINDING_ANNOTATION_COLORS = {
  critical: '#e76156',
  warning: '#d69324',
  info: '#6e6bf4',
} as const;

const FINDING_SHORT_LABELS = {
  best_time_window: 'Best time',
  delivery_drop_vs_efficiency: 'Delivery drop',
  efficiency_drop_vs_delivery: 'Efficiency pressure',
  meaningful_crossover: 'Trend crossover',
  sustained_divergence: 'Sustained pressure',
  stale_live_delivery: 'Weak live delivery',
} as const;

const TIMELINE_FINDING_TYPES = new Set([
  'delivery_drop_vs_efficiency',
  'meaningful_crossover',
  'stale_live_delivery',
]);

function isIsoDateLabel(value: string | null | undefined) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function resolveFindingAnchorDate(finding: ReportPayload['findings'][number]) {
  if (isIsoDateLabel(finding.metricSnapshot.periodEnd)) {
    return finding.metricSnapshot.periodEnd;
  }

  if (isIsoDateLabel(finding.metricSnapshot.periodStart)) {
    return finding.metricSnapshot.periodStart;
  }

  if (isIsoDateLabel(finding.metricSnapshot.label)) {
    return finding.metricSnapshot.label;
  }

  if (isIsoDateLabel(finding.detectedAt.slice(0, 10))) {
    return finding.detectedAt.slice(0, 10);
  }

  return null;
}

function findSeriesPointForDate(
  series: ReportTimeSeriesPoint[],
  targetDate: string | null | undefined
) {
  if (!targetDate) {
    return null;
  }

  return (
    series.find((point) => point.startDate <= targetDate && point.endDate >= targetDate) ??
    series.find((point) => point.label === targetDate) ??
    null
  );
}

function resolveFindingAnnotationBucket(
  finding: ReportPayload['findings'][number]
): FindingAnnotationBucket {
  return TIMELINE_FINDING_TYPES.has(finding.findingType) ? 'timeline' : 'quality';
}

function buildFindingAnnotation(
  finding: ReportPayload['findings'][number],
  series: ReportTimeSeriesPoint[]
): { bucket: FindingAnnotationBucket; annotation: TimelineAnnotation } | null {
  const targetDate = resolveFindingAnchorDate(finding);
  const point = findSeriesPointForDate(series, targetDate);

  if (!point || !targetDate) {
    return null;
  }

  const bucket = resolveFindingAnnotationBucket(finding);
  const value =
    bucket === 'timeline'
      ? point.conversion > 0
        ? point.conversion
        : Number(point.spend.toFixed(2))
      : point.ctr > 0
        ? Number(point.ctr.toFixed(2))
        : point.cpc > 0
          ? Number(point.cpc.toFixed(2))
          : Number(point.cpm.toFixed(2));

  return {
    bucket,
    annotation: {
      key: `finding-${finding.id}`,
      chartLabel: formatChartDateLabel(targetDate),
      value,
      label: FINDING_SHORT_LABELS[finding.findingType] ?? 'Finding',
      detail: finding.summary,
      color: FINDING_ANNOTATION_COLORS[finding.severity],
    },
  };
}

type SurfacePanelMode = 'platform' | 'device' | 'geo' | 'times';
type AudienceChartType = 'default' | 'stacked';
type BreakdownMetric = 'results' | 'clicks' | 'spend';

type AudienceChartSeries = {
  name: string;
  color: string;
};

type MultiSeriesBarChartConfig = {
  data: Record<string, string | number>[];
  title: string;
  formatter: (value: number) => string;
  series: AudienceChartSeries[];
  withLegend: boolean;
};

type AudienceChartConfig = {
  data: Record<string, string | number>[];
  title: string;
  formatter: (value: number) => string;
  type: AudienceChartType;
  series: AudienceChartSeries[];
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

const SURFACE_CHART_HEIGHT = 260;
const AUDIENCE_BREAKDOWN_CHART_HEIGHT = 180;
const HEATMAP_DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

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

function resolveScope(params: URLSearchParams) {
  if (params.get('ad_id')) {
    return 'ad';
  }

  if (params.get('adset_id')) {
    return 'adset';
  }

  if (params.get('campaign_id')) {
    return 'campaign';
  }

  if (params.get('ad_account_id')) {
    return 'ad_account';
  }

  if (params.get('platform_integration_id')) {
    return 'platform';
  }

  return 'business';
}

function formatCurrency(value: number, currencyCode: string | null, digits = 0) {
  if (!currencyCode || currencyCode === 'MIXED') {
    return digits === 0 ? Math.round(value).toLocaleString() : value.toFixed(digits);
  }

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(value);
  } catch {
    return `$${value.toFixed(digits)}`;
  }
}

function formatSignedPercent(value: number | null) {
  if (value == null) {
    return 'No comparison';
  }

  const rounded = Math.abs(value).toFixed(1);
  return value >= 0 ? `+${rounded}%` : `-${rounded}%`;
}

function formatCompactCurrency(value: number, currencyCode: string | null) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode || 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatRate(value: number) {
  return `${(Number.isFinite(value) ? value : 0).toFixed(2)}%`;
}

function formatDecimal(value: number) {
  return (Number.isFinite(value) ? value : 0).toFixed(2);
}

function formatHourShortLabel(hour: number) {
  if (!Number.isFinite(hour) || hour < 0 || hour > 23) {
    return '';
  }

  const suffix = hour >= 12 ? 'P' : 'A';
  const normalizedHour = hour % 12 || 12;
  return `${normalizedHour}${suffix}`;
}

function formatHourLongLabel(hour: number) {
  if (!Number.isFinite(hour) || hour < 0 || hour > 23) {
    return 'Unknown';
  }

  const suffix = hour >= 12 ? 'PM' : 'AM';
  const normalizedHour = hour % 12 || 12;
  return `${normalizedHour}${suffix}`;
}

function shouldRenderHeatmapHourLabel(hour: number) {
  return hour === 0 || hour === 4 || hour === 8 || hour === 12 || hour === 16 || hour === 20;
}

function formatPerformanceChartValue(value: number) {
  return value.toLocaleString();
}

function formatEfficiencyChartValue(value: number) {
  return Number(value).toFixed(2);
}

function formatTooltipPayloadValue(
  value: ReportTooltipPayloadItem['value'],
  valueFormatter: (value: number) => string
) {
  if (Array.isArray(value)) {
    return value.join(' - ');
  }

  const numericValue =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim() !== ''
        ? Number(value)
        : Number.NaN;

  if (Number.isFinite(numericValue)) {
    return valueFormatter(numericValue);
  }

  return value == null ? '0' : String(value);
}

function formatEntityPerformance(row: ReportBreakdownRow, currencyCode: string | null) {
  if (row.conversion > 0) {
    return `${row.conversion.toLocaleString()} results at ${formatCurrency(row.costPerResult, currencyCode, 2)} per result`;
  }

  return `${formatCurrency(row.spend, currencyCode, 2)} spent without a recorded result`;
}

function getEntityLabel(level: ReportBreakdownRow['level']) {
  if (level === 'campaign') {
    return 'Campaign';
  }

  if (level === 'adset') {
    return 'Ad set';
  }

  return 'Ad';
}

function getEntityPluralLabel(level: ReportBreakdownRow['level']) {
  if (level === 'campaign') {
    return 'Campaigns';
  }

  if (level === 'adset') {
    return 'Ad sets';
  }

  return 'Ads';
}

function scoreStrongestRow(row: ReportBreakdownRow) {
  const resultEfficiency = row.conversion > 0 ? row.conversion / Math.max(row.spend, 1) : 0;
  return row.conversion * 1000 + resultEfficiency * 10000 + row.ctr * 100 - row.cpc * 10;
}

function scoreWeakestRow(row: ReportBreakdownRow) {
  const resultPenalty = row.conversion === 0 ? 1000 : 0;
  return (
    resultPenalty +
    row.costPerResult * 12 +
    row.cpc * 6 +
    row.spend / 10 -
    row.ctr * 40 -
    row.conversion * 30
  );
}

function scoreRankedRow(row: ReportBreakdownRow) {
  return scoreStrongestRow(row);
}

function dedupeRows(rows: ReportBreakdownRow[]) {
  return Array.from(new Map(rows.map((row) => [row.id, row])).values());
}

function rankBreakdownRows(rows: ReportBreakdownRow[]) {
  return dedupeRows(rows)
    .filter(
      (row) =>
        row.spend > 0 ||
        row.conversion > 0 ||
        row.clicks > 0 ||
        row.impressions > 0 ||
        row.reach > 0
    )
    .sort((left, right) => scoreRankedRow(right) - scoreRankedRow(left));
}

function pickStrongestRow(rows: ReportBreakdownRow[]) {
  return [...rows]
    .filter((row) => row.spend > 0 || row.conversion > 0 || row.clicks > 0)
    .sort((left, right) => scoreStrongestRow(right) - scoreStrongestRow(left))[0] ?? null;
}

function pickWeakestRow(rows: ReportBreakdownRow[]) {
  return [...rows]
    .filter((row) => row.spend > 0 || row.clicks > 0)
    .sort((left, right) => scoreWeakestRow(right) - scoreWeakestRow(left))[0] ?? null;
}

function pickMaxPoint(series: ReportTimeSeriesPoint[], key: keyof ReportTimeSeriesPoint) {
  return [...series].sort((left, right) => Number(right[key]) - Number(left[key]))[0] ?? null;
}

function resolveBreakdownMetric(
  slices: Array<DashboardPlatformSlice | DashboardAudienceSlice>
): BreakdownMetric {
  if (slices.some((slice) => slice.results > 0)) {
    return 'results';
  }

  if (slices.some((slice) => slice.clicks > 0)) {
    return 'clicks';
  }

  return 'spend';
}

function readBreakdownMetricValue(
  slice: DashboardPlatformSlice | DashboardAudienceSlice,
  metric: BreakdownMetric
) {
  if (metric === 'results') {
    return slice.results;
  }

  if (metric === 'clicks') {
    return slice.clicks;
  }

  return slice.spend;
}

function ageBucketSortValue(value: string) {
  const match = value.match(/\d+/);
  return match ? Number(match[0]) : 999;
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
    const parts = slice.label.split(/\s+/);
    const age = parts.at(-1) ?? 'Unknown';
    const rawGender = parts.slice(0, -1).join(' ').toLowerCase();
    const gender = rawGender.includes('female')
      ? 'Female'
      : rawGender.includes('male')
        ? 'Male'
        : 'Unknown';
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
  const series: AudienceChartSeries[] = [
    { name: 'Female', color: 'pink.5' },
    { name: 'Male', color: 'blue.6' },
  ];

  if (data.some((row) => row.Unknown > 0)) {
    series.push({ name: 'Unknown', color: 'gray.5' });
  }

  return {
    data,
    title: 'Audience response by age and gender',
    type: 'stacked',
    series,
    formatter: (value: number) =>
      metric === 'spend' ? formatCompactCurrency(value, input.currencyCode) : formatNumber(value),
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

  return {
    data: input.geo.slice(0, 6).map((item) => ({
      segment: item.secondaryLabel ? `${item.label} · ${item.secondaryLabel}` : item.label,
      Value: readBreakdownMetricValue(item, metric),
    })),
    title: 'Audience response by geo',
    type: 'default',
    series: [{ name: 'Value', color: 'teal.6' }],
    formatter: (value: number) =>
      metric === 'spend' ? formatCompactCurrency(value, input.currencyCode) : formatNumber(value),
  };
}

function platformSeriesColor(label: string) {
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

  return {
    data: slices.map((slice) => {
      const row: Record<string, string | number> = {
        segment: slice.label,
      };

      for (const seriesItem of series) {
        row[seriesItem.name] = 0;
      }

      row[slice.label] = readBreakdownMetricValue(slice, metric);
      return row;
    }),
    title: 'Publisher platform response',
    series,
    withLegend: series.length > 1,
    formatter: (value: number) =>
      metric === 'spend' ? formatCompactCurrency(value, input.currencyCode) : formatNumber(value),
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
      metric === 'spend' ? formatCompactCurrency(value, input.currencyCode) : formatNumber(value),
  };
}

function normalizeStateCode(label: string) {
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
      name: US_STATE_TILES.find((tile) => tile.code === code)?.name ?? slice.label,
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
        metric === 'spend' ? formatCompactCurrency(value, input.currencyCode) : formatNumber(value),
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

function buildHourlyHeatmap(points: DashboardTrendPoint[]): HourlyHeatmapConfig | null {
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
  const prefersLinkClicks =
    !prefersResults && hourlyPoints.some((point) => point.inlineLinkClicks > 0);
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
      dayLabel: HEATMAP_DAY_LABELS[aggregate.dayOfWeek] ?? '-',
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
        (candidate) => candidate.dayOfWeek === dayOfWeek && candidate.hourOfDay === hourOfDay
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
  const bestHour = Array.from({ length: 24 }, (_, hourOfDay) => ({
    hourOfDay,
    metricAverage: rows.reduce((sum, row) => sum + row.cells[hourOfDay].metricAverage, 0),
  })).sort((left, right) => right.metricAverage - left.metricAverage)[0];

  return {
    title: `Best recurring ${metricLabel.toLowerCase()} times`,
    metricLabel,
    summarySlotLabel: `${bestCell.dayLabel} · ${formatHourLongLabel(bestCell.hourOfDay)}`,
    summaryDayLabel: bestDay?.dayLabel ?? '-',
    summaryHourLabel: bestHour ? formatHourLongLabel(bestHour.hourOfDay) : '-',
    rows,
    hourLabels: Array.from({ length: 24 }, (_, hourOfDay) =>
      shouldRenderHeatmapHourLabel(hourOfDay) ? formatHourShortLabel(hourOfDay) : ''
    ),
  };
}

function renderFilteredBarTooltip(input: {
  label?: string | number;
  payload?: Array<{ name?: string; value?: number | string | null; color?: string }>;
  series: AudienceChartSeries[];
  formatter: (value: number) => string;
}) {
  const filteredPayload = (input.payload ?? []).filter((item) => Number(item.value ?? 0) > 0);

  if (filteredPayload.length === 0) {
    return null;
  }

  return (
    <ChartTooltip
      label={input.label}
      payload={filteredPayload}
      series={input.series}
      valueFormatter={input.formatter}
    />
  );
}

function getActiveFilterCount(payload: ReportPayload) {
  let count = 0;

  if (payload.query.platformIntegrationId) {
    count += 1;
  }

  if (payload.query.adAccountIds.length > 0) {
    count += 1;
  }

  if (payload.query.campaignIds.length > 0) {
    count += 1;
  }

  if (payload.query.adsetIds.length > 0) {
    count += 1;
  }

  if (payload.query.adIds.length > 0) {
    count += 1;
  }

  return count;
}

type ReportBreadcrumbItem = {
  label: string;
  href: string | null;
};

function findFilterLabel(
  options: Array<{ id: string; label: string }>,
  id: string | null | undefined,
  fallback: string
) {
  if (!id) {
    return fallback;
  }

  return options.find((option) => option.id === id)?.label ?? fallback;
}

function buildReportBreadcrumbs(
  payload: ReportPayload,
  filterOptions: ReportFilterOptions
): ReportBreadcrumbItem[] {
  const items: ReportBreadcrumbItem[] = [];
  const { query } = payload;

  if (query.platformIntegrationId) {
    items.push({
      label: findFilterLabel(filterOptions.platforms, query.platformIntegrationId, 'Platform'),
      href:
        query.adAccountIds.length > 0 ||
        query.campaignIds.length > 0 ||
        query.adsetIds.length > 0 ||
        query.adIds.length > 0
          ? buildReportUrl({
              scope: 'platform',
              platformIntegrationId: query.platformIntegrationId,
              dateFrom: query.dateFrom,
              dateTo: query.dateTo,
              groupBy: query.groupBy,
              compareMode: query.compareMode,
              rangeMode: query.rangeMode,
            })
          : null,
    });
  }

  if (query.adAccountIds.length === 1) {
    items.push({
      label: findFilterLabel(filterOptions.adAccounts, query.adAccountIds[0], 'Ad account'),
      href:
        query.campaignIds.length > 0 || query.adsetIds.length > 0 || query.adIds.length > 0
          ? buildReportUrl({
              scope: 'ad_account',
              platformIntegrationId: query.platformIntegrationId,
              adAccountIds: [query.adAccountIds[0]],
              dateFrom: query.dateFrom,
              dateTo: query.dateTo,
              groupBy: query.groupBy,
              compareMode: query.compareMode,
              rangeMode: query.rangeMode,
            })
          : null,
    });
  }

  if (query.campaignIds.length === 1) {
    items.push({
      label: findFilterLabel(filterOptions.campaigns, query.campaignIds[0], 'Campaign'),
      href:
        query.adsetIds.length > 0 || query.adIds.length > 0
          ? buildReportUrl({
              scope: 'campaign',
              platformIntegrationId: query.platformIntegrationId,
              adAccountIds: query.adAccountIds,
              campaignIds: [query.campaignIds[0]],
              dateFrom: query.dateFrom,
              dateTo: query.dateTo,
              groupBy: query.groupBy,
              compareMode: query.compareMode,
              rangeMode: query.rangeMode,
            })
          : null,
    });
  }

  if (query.adsetIds.length === 1) {
    items.push({
      label: findFilterLabel(filterOptions.adsets, query.adsetIds[0], 'Ad set'),
      href:
        query.adIds.length > 0
          ? buildReportUrl({
              scope: 'adset',
              platformIntegrationId: query.platformIntegrationId,
              adAccountIds: query.adAccountIds,
              campaignIds: query.campaignIds,
              adsetIds: [query.adsetIds[0]],
              dateFrom: query.dateFrom,
              dateTo: query.dateTo,
              groupBy: query.groupBy,
              compareMode: query.compareMode,
              rangeMode: query.rangeMode,
            })
          : null,
    });
  }

  if (query.adIds.length === 1) {
    items.push({
      label: findFilterLabel(filterOptions.ads, query.adIds[0], 'Ad'),
      href: null,
    });
  }

  return items;
}

function KpiCard({ kpi }: { kpi: ReportKpi }) {
  const deltaClass =
    kpi.deltaPercent == null
      ? classes.deltaNeutral
      : kpi.deltaPercent >= 0
        ? classes.deltaPositive
        : classes.deltaNegative;
  const DeltaIcon =
    kpi.deltaPercent == null ? IconTimeline : kpi.deltaPercent >= 0 ? IconArrowUpRight : IconArrowDownRight;

  return (
    <Paper withBorder radius="xl" p="md" className={classes.kpiCard}>
      <Stack gap="xs">
        <Text size="xs" c="dimmed" tt="uppercase" fw={800}>
          {kpi.label}
        </Text>
        <Text fw={900} size="1.75rem" className={classes.kpiValue}>
          {kpi.formattedValue}
        </Text>
        <span className={`${classes.deltaPill} ${deltaClass}`}>
          <DeltaIcon size={13} />
          {formatSignedPercent(kpi.deltaPercent)}
        </span>
      </Stack>
    </Paper>
  );
}

function getRankTone(index: number, total: number) {
  if (index === 0) {
    return { color: 'teal', label: 'Top performer' };
  }

  if (index <= Math.max(1, Math.floor(total * 0.25))) {
    return { color: 'blue', label: 'Leading' };
  }

  if (index >= Math.max(0, total - Math.max(1, Math.floor(total * 0.25)))) {
    return { color: 'orange', label: 'Needs review' };
  }

  return { color: 'gray', label: 'Mid-pack' };
}

type RankingSection = {
  title: string;
  rows: ReportBreakdownRow[];
};

type RankingGroup = {
  key: ReportBreakdownRow['level'];
  level: ReportBreakdownRow['level'];
  title: string;
  sections: RankingSection[];
  fullRows: ReportBreakdownRow[];
};

function getFullRankingTitle(level: ReportBreakdownRow['level']) {
  return `Full ${getEntityLabel(level).toLowerCase()} ranking`;
}

function getAccountRankingTitle(
  level: ReportBreakdownRow['level'],
  query: ReportPayload['query']
) {
  const accountLabel = query.adAccountIds.length === 1 ? 'this ad account' : 'selected accounts';
  return `Best ${getEntityPluralLabel(level).toLowerCase()} in ${accountLabel}`;
}

function getParentRankingTitle(
  level: ReportBreakdownRow['level'],
  query: ReportPayload['query']
) {
  if (level === 'adset') {
    const parentLabel = query.campaignIds.length > 1 ? 'these campaigns' : 'this campaign';
    return `Ad sets in ${parentLabel} ranking`;
  }

  if (level === 'ad') {
    const parentLabel = query.adsetIds.length > 1 ? 'these ad sets' : 'this ad set';
    return `Ads in ${parentLabel} ranking`;
  }

  return 'Campaign ranking';
}

function getRankingLevelOrder(level: ReportBreakdownRow['level']) {
  if (level === 'campaign') {
    return 0;
  }

  if (level === 'adset') {
    return 1;
  }

  return 2;
}

function shouldCollapseParentRankingGroup(
  groupLevel: ReportBreakdownRow['level'],
  currentLevel: ReportBreakdownRow['level'] | null
) {
  if (!currentLevel) {
    return false;
  }

  const currentLevelOrder = getRankingLevelOrder(currentLevel);
  if (currentLevelOrder === 0) {
    return false;
  }

  return getRankingLevelOrder(groupLevel) < currentLevelOrder;
}

function isNestedEntityScope(scope: ReportPayload['query']['scope']) {
  return scope === 'campaign' || scope === 'adset' || scope === 'ad';
}

function buildRankingGroup(input: {
  level: ReportBreakdownRow['level'];
  primaryTitle: string;
  primaryRows: ReportBreakdownRow[];
  comparisonTitle?: string;
  comparisonRows?: ReportBreakdownRow[];
}): RankingGroup | null {
  const primaryRows = input.primaryRows;
  const comparisonSourceRows = input.comparisonRows ?? [];
  const primaryIds = new Set(primaryRows.map((row) => row.id));
  const comparisonRows = comparisonSourceRows.filter((row) => !primaryIds.has(row.id));
  const sections: RankingSection[] = [];
  const fullRows = comparisonSourceRows.length > 0 ? comparisonSourceRows : primaryRows;

  if (primaryRows.length > 0) {
    sections.push({
      title: input.primaryTitle,
      rows: primaryRows,
    });
  }

  if (comparisonRows.length > 0 && input.comparisonTitle) {
    sections.push({
      title: input.comparisonTitle,
      rows: comparisonRows,
    });
  }

  if (sections.length === 0 || fullRows.length === 0) {
    return null;
  }

  return {
    key: input.level,
    level: input.level,
    title: `${getEntityLabel(input.level)} ranking`,
    sections,
    fullRows,
  };
}

function RankedEntityBoard({
  rows,
  currencyCode,
  ranking,
  query,
}: {
  rows: ReportBreakdownRow[];
  currencyCode: string | null;
  ranking: ReportPayload['ranking'];
  query: ReportPayload['query'];
}) {
  const [openedRankingKey, setOpenedRankingKey] = useState<ReportBreakdownRow['level'] | null>(null);
  const [openedCollapsedRankingKeys, setOpenedCollapsedRankingKeys] = useState<
    ReportBreakdownRow['level'][]
  >([]);
  const rankedRows = rankBreakdownRows(rows);
  const currentLevel = rankedRows[0]?.level ?? null;
  const campaignRows = rankBreakdownRows(
    currentLevel === 'campaign' ? rankedRows : ranking.topAdAccountCampaigns
  );
  const adsetPrimaryRows = rankBreakdownRows(
    currentLevel === 'adset' ? rankedRows : ranking.sameCampaignAdsets
  );
  const adsetComparisonRows = rankBreakdownRows(ranking.topAdAccountAdsets);
  const adPrimaryRows = rankBreakdownRows(
    currentLevel === 'ad' ? rankedRows : ranking.sameAdsetAds
  );
  const adComparisonRows = rankBreakdownRows(ranking.topAdAccountAds);
  const rankingGroups = [
    buildRankingGroup({
      level: 'campaign',
      primaryTitle: currentLevel === 'campaign' ? 'Ranked campaigns' : getAccountRankingTitle('campaign', query),
      primaryRows: campaignRows,
    }),
    buildRankingGroup({
      level: 'adset',
      primaryTitle: getParentRankingTitle('adset', query),
      primaryRows: adsetPrimaryRows,
      comparisonTitle: getAccountRankingTitle('adset', query),
      comparisonRows: adsetComparisonRows,
    }),
    buildRankingGroup({
      level: 'ad',
      primaryTitle: getParentRankingTitle('ad', query),
      primaryRows: adPrimaryRows,
      comparisonTitle: getAccountRankingTitle('ad', query),
      comparisonRows: adComparisonRows,
    }),
  ].filter((group): group is RankingGroup => Boolean(group));
  const activeRankingGroup =
    rankingGroups.find((group) => group.key === openedRankingKey) ?? null;
  const collapsedRankingGroups = rankingGroups.filter((group) =>
    shouldCollapseParentRankingGroup(group.level, currentLevel)
  );
  const visibleRankingGroups = rankingGroups.filter(
    (group) => !shouldCollapseParentRankingGroup(group.level, currentLevel)
  );
  const isTopLevelReport = !isNestedEntityScope(query.scope);

  useEffect(() => {
    setOpenedCollapsedRankingKeys([]);
  }, [currentLevel, rankingGroups.map((group) => group.key).join('|')]);

  const renderRankedRows = (inputRows: ReportBreakdownRow[]) =>
    inputRows.slice(0, 4).map((row, index) => {
      const tone = getRankTone(index, inputRows.length);

      return (
        <div key={`${row.level}:${row.id}`} className={classes.moverRow}>
          <Group justify="space-between" align="flex-start" gap="md" wrap="nowrap">
            <div style={{ flex: 1, minWidth: 0 }}>
              <Group gap={8} wrap="wrap">
                <Badge color={tone.color} variant="light" radius="sm">
                  #{index + 1}
                </Badge>
                <Text fw={800} lineClamp={1}>
                  {row.name}
                </Text>
              </Group>
              <Text size="sm" c="dimmed" mt={6}>
                {formatEntityPerformance(row, currencyCode)}
              </Text>
              <Text size="xs" c="dimmed" mt={6} lineClamp={1}>
                {row.creativeContext
                  ? `Creative: ${row.creativeContext}`
                  : row.primaryContext || row.secondaryContext
                    ? [row.primaryContext, row.secondaryContext].filter(Boolean).join(' · ')
                    : 'No extra context yet'}
              </Text>
            </div>
            <Stack gap={6} align="flex-end">
              <Badge color={tone.color} variant="light" radius="sm">
                {tone.label}
              </Badge>
              <Badge color="gray" variant="light" radius="sm">
                {getEntityLabel(row.level)}
              </Badge>
              {row.drilldownHref ? (
                <Button
                  component={Link}
                  href={row.drilldownHref}
                  variant="subtle"
                  size="compact-xs"
                  radius="xl"
                >
                  {row.drilldownLabel ?? 'Open'}
                </Button>
              ) : null}
            </Stack>
          </Group>
          <Group gap="xs" mt="sm" wrap="wrap">
            <Badge variant="outline" color="gray" radius="sm">
              {row.conversion.toLocaleString()} results
            </Badge>
            <Badge variant="outline" color="gray" radius="sm">
              {formatCurrency(row.costPerResult, currencyCode, 2)} / result
            </Badge>
            <Badge variant="outline" color="gray" radius="sm">
              {row.ctr.toFixed(2)}% CTR
            </Badge>
            <Badge variant="outline" color="gray" radius="sm">
              {formatCurrency(row.spend, currencyCode, 2)} spend
            </Badge>
          </Group>
        </div>
      );
    });

  const renderRankingGroupContent = (group: RankingGroup) => (
    <Stack gap="sm">
      {group.sections.map((section) => (
        <Stack key={`${group.key}:${section.title}`} gap="sm">
          <Text size="xs" c="dimmed" tt="uppercase" fw={800}>
            {section.title}
          </Text>
          {renderRankedRows(section.rows)}
        </Stack>
      ))}
      <Group justify="flex-end">
        <Button
          variant="light"
          radius="xl"
          size="xs"
          onClick={() => setOpenedRankingKey(group.key)}
        >
          Open {getFullRankingTitle(group.level).toLowerCase()}
        </Button>
      </Group>
    </Stack>
  );

  if (isTopLevelReport) {
    return (
      <Paper withBorder radius="xl" p="md" className={classes.reportCard}>
        <Group gap="sm" mb="md" className={classes.cardHeader}>
          <ThemeIcon variant="light" color="blue" radius="md">
            <IconTimeline size={18} />
          </ThemeIcon>
          <div>
            <Text fw={800}>Performance ranking</Text>
            <Text size="sm" c="dimmed">
              Full campaign, ad set, and ad rankings for the current report scope.
            </Text>
          </div>
        </Group>

        {rankingGroups.length > 0 ? (
          <Accordion
            multiple
            defaultValue={query.scope === 'ad_account' ? rankingGroups.map((group) => group.key) : undefined}
            radius="lg"
            variant="separated"
            className={classes.rankingAccordion}
          >
            {rankingGroups.map((group) => (
              <Accordion.Item
                key={group.key}
                value={group.key}
                className={classes.rankingAccordionItem}
              >
                <Accordion.Control className={classes.rankingAccordionControl}>
                  <Group justify="space-between" align="center" gap="sm" wrap="wrap">
                    <Text fw={800}>{getEntityPluralLabel(group.level)} ranking</Text>
                    <Group gap="xs" wrap="wrap">
                      <Badge color="gray" variant="outline" radius="sm">
                        Full ranking
                      </Badge>
                      <Badge color="gray" variant="light" radius="sm">
                        {group.fullRows.length.toLocaleString()} ranked
                      </Badge>
                    </Group>
                  </Group>
                </Accordion.Control>
                <Accordion.Panel>
                  <PerformanceTable
                    title={getFullRankingTitle(group.level)}
                    rows={group.fullRows}
                    currencyCode={currencyCode}
                    hideTitle
                    showRanking
                  />
                </Accordion.Panel>
              </Accordion.Item>
            ))}
          </Accordion>
        ) : (
          <Text size="sm" c="dimmed">
            No entity ranking is available for the current filters.
          </Text>
        )}
      </Paper>
    );
  }

  return (
    <Paper withBorder radius="xl" p="md" className={classes.reportCard}>
      <Modal
        opened={Boolean(activeRankingGroup)}
        onClose={() => setOpenedRankingKey(null)}
        title={activeRankingGroup ? getFullRankingTitle(activeRankingGroup.level) : 'Full ranking'}
        size="90%"
        centered
      >
        {activeRankingGroup ? (
          <PerformanceTable
            title={getFullRankingTitle(activeRankingGroup.level)}
            rows={activeRankingGroup.fullRows}
            currencyCode={currencyCode}
            hideTitle
            showRanking
          />
        ) : null}
      </Modal>

      <Group gap="sm" mb="md" className={classes.cardHeader}>
        <ThemeIcon variant="light" color="blue" radius="md">
          <IconTimeline size={18} />
        </ThemeIcon>
        <div>
          <Text fw={800}>Performance ranking</Text>
          <Text size="sm" c="dimmed">
            Highest to lowest for campaigns, ad sets, and ads in the current filters.
          </Text>
        </div>
      </Group>
      <Stack gap="sm">
        {rankingGroups.length > 0 ? (
          <>
            {collapsedRankingGroups.length > 0 ? (
              <Accordion
                multiple
                radius="lg"
                variant="separated"
                value={openedCollapsedRankingKeys}
                onChange={(value) =>
                  setOpenedCollapsedRankingKeys(value as ReportBreakdownRow['level'][])
                }
                className={classes.rankingAccordion}
              >
                {collapsedRankingGroups.map((group) => (
                  <Accordion.Item
                    key={group.key}
                    value={group.key}
                    className={classes.rankingAccordionItem}
                  >
                    <Accordion.Control className={classes.rankingAccordionControl}>
                      <Group justify="space-between" align="center" gap="sm" wrap="wrap">
                        <Text fw={800}>{group.title}</Text>
                        <Group gap="xs" wrap="wrap">
                          <Badge color="gray" variant="outline" radius="sm">
                            Previous level
                          </Badge>
                          <Badge color="gray" variant="light" radius="sm">
                            {group.fullRows.length.toLocaleString()} ranked
                          </Badge>
                        </Group>
                      </Group>
                    </Accordion.Control>
                    <Accordion.Panel>{renderRankingGroupContent(group)}</Accordion.Panel>
                  </Accordion.Item>
                ))}
              </Accordion>
            ) : null}

            {visibleRankingGroups.map((group) => (
              <Stack key={group.key} gap="sm">
                <Group justify="space-between" align="center" gap="sm" wrap="wrap">
                  <Text fw={800}>{group.title}</Text>
                  <Badge color="gray" variant="light" radius="sm">
                    {group.fullRows.length.toLocaleString()} ranked
                  </Badge>
                </Group>
                {renderRankingGroupContent(group)}
              </Stack>
            ))}
          </>
        ) : (
          <Text size="sm" c="dimmed">
            No entity breakdown is available for the current filters.
          </Text>
        )}
      </Stack>
    </Paper>
  );
}

function ReportDeliverySurfaceGraph({ payload }: { payload: ReportPayload }) {
  const [surfacePanelMode, setSurfacePanelMode] = useState<SurfacePanelMode>('platform');
  const isMeta = payload.surface.isMeta;
  const platformBreakdowns = payload.surface.platformBreakdowns;
  const audienceBreakdowns = payload.surface.audienceBreakdowns;
  const hourlyHeatmap = useMemo(
    () => buildHourlyHeatmap(payload.surface.hourlyTrendExpanded),
    [payload.surface.hourlyTrendExpanded]
  );
  const platformPanelChart = useMemo(
    () =>
      buildPlatformPanelChart({
        platforms: platformBreakdowns.publisherPlatforms,
        currencyCode: payload.meta.currencyCode,
      }),
    [payload.meta.currencyCode, platformBreakdowns.publisherPlatforms]
  );
  const devicePanelChart = useMemo(
    () =>
      buildDevicePanelChart({
        devices: platformBreakdowns.impressionDevices,
        currencyCode: payload.meta.currencyCode,
      }),
    [payload.meta.currencyCode, platformBreakdowns.impressionDevices]
  );
  const regionStateMap = useMemo(
    () =>
      buildRegionStateMap({
        geo: audienceBreakdowns.geo,
        currencyCode: payload.meta.currencyCode,
      }),
    [audienceBreakdowns.geo, payload.meta.currencyCode]
  );
  const audienceChart = useMemo(
    () =>
      buildAudienceChart({
        ageGender: audienceBreakdowns.ageGender,
        geo: audienceBreakdowns.geo,
        currencyCode: payload.meta.currencyCode,
      }),
    [audienceBreakdowns.ageGender, audienceBreakdowns.geo, payload.meta.currencyCode]
  );
  const activeSurfaceChart =
    surfacePanelMode === 'platform' ? platformPanelChart : devicePanelChart;
  const activeSurfaceTooltipProps = useMemo(
    () => ({
      content: ({
        label,
        payload: tooltipPayload,
      }: {
        label?: string | number;
        payload?: Array<{ name?: string; value?: number | string | null; color?: string }>;
      }) =>
        renderFilteredBarTooltip({
          label,
          payload: tooltipPayload,
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
        payload: tooltipPayload,
      }: {
        label?: string | number;
        payload?: Array<{ name?: string; value?: number | string | null; color?: string }>;
      }) =>
        renderFilteredBarTooltip({
          label,
          payload: tooltipPayload,
          series: audienceChart.series,
          formatter: audienceChart.formatter,
        }),
    }),
    [audienceChart.formatter, audienceChart.series]
  );
  const activeSurfaceTitle =
    surfacePanelMode === 'platform'
      ? platformPanelChart.title
      : surfacePanelMode === 'device'
        ? devicePanelChart.title
        : surfacePanelMode === 'times'
          ? hourlyHeatmap?.title ?? 'Best recurring click times'
          : regionStateMap.title;

  return (
    <Card withBorder radius="xl" p="lg" h="100%" className={classes.reportCard}>
      <Stack gap="md" h="100%">
        <Group justify="space-between" align="flex-start" gap="sm" wrap="wrap" className={classes.cardHeader}>
          <Group gap="sm" wrap="nowrap">
            <ThemeIcon color="teal" variant="light" radius="md">
              <IconChartBar size={18} />
            </ThemeIcon>
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={800}>
                Delivery surface graph
              </Text>
              <Text fw={900} size="xl" mt={4}>
                {activeSurfaceTitle}
              </Text>
              <Text size="sm" c="dimmed" mt={4}>
                Synced surface breakdowns for the selected scope and date range.
              </Text>
            </div>
          </Group>
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

        <Stack gap="md" className={classes.surfacePanelBody}>
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
                        key={`report-heatmap-hour-${index}`}
                        size="10px"
                        c="dimmed"
                        ta="center"
                        className={classes.heatmapHourLabel}
                      >
                        {label}
                      </Text>
                    ))}

                    {hourlyHeatmap.rows.map((row) => (
                      <Fragment key={`report-heatmap-row-${row.dayOfWeek}`}>
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
                                  ? `rgba(20, 168, 102, ${0.12 + cell.intensity * 0.76})`
                                  : 'rgba(238, 240, 233, 0.94)',
                              borderColor:
                                cell.metricAverage > 0
                                  ? 'rgba(11, 122, 75, 0.3)'
                                  : 'rgba(21, 23, 20, 0.12)',
                            }}
                            title={`${cell.dayLabel} · ${formatHourLongLabel(
                              cell.hourOfDay
                            )}: avg ${formatDecimal(cell.metricAverage)} ${
                              hourlyHeatmap.metricLabel
                            }/slot · total ${formatNumber(cell.metricTotal)} · CTR ${formatRate(
                              cell.ctr
                            )} · Spend ${formatCurrency(cell.spend, payload.meta.currencyCode, 2)}`}
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
                  {isMeta ? 'Best times heatmap is still preparing' : 'Best times are Meta-only'}
                </Text>
                <Text size="sm" c="dimmed" mt={6}>
                  {isMeta
                    ? 'Hourly rows will appear here once the selected report scope has advertiser-time history.'
                    : 'The times heatmap is only wired for Meta right now.'}
                </Text>
              </Paper>
            )
          ) : surfacePanelMode === 'geo' ? (
            audienceBreakdowns.state === 'available' && regionStateMap.activeStates.length > 0 ? (
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
                            ? `rgba(20, 168, 102, ${0.18 + state.intensity * 0.68})`
                            : 'rgba(238, 240, 233, 0.96)',
                          borderColor: state.isActive
                            ? 'rgba(11, 122, 75, 0.42)'
                            : 'rgba(21, 23, 20, 0.18)',
                          color:
                            state.isActive && state.intensity > 0.45
                              ? '#ffffff'
                              : state.isActive
                                ? '#075f3b'
                                : '#697067',
                        }}
                        title={state.isActive ? `${state.name}: ${state.valueLabel}` : state.name}
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
              <Stack justify="center" align="center" h={SURFACE_CHART_HEIGHT} gap="xs">
                <Text fw={800}>
                  {isMeta ? 'Regional state rows are still syncing' : 'Regional state map is Meta-only'}
                </Text>
                <Text size="sm" c="dimmed" ta="center" maw={320}>
                  {isMeta
                    ? 'State-level regions will appear here once Meta region rows are available for this report scope.'
                    : 'The geo state map is only wired for Meta right now.'}
                </Text>
              </Stack>
            )
          ) : platformBreakdowns.state === 'available' && activeSurfaceChart.data.length > 0 ? (
            <BarChart
              h={SURFACE_CHART_HEIGHT}
              data={activeSurfaceChart.data}
              dataKey="segment"
              withLegend={activeSurfaceChart.withLegend}
              series={activeSurfaceChart.series}
              tooltipProps={activeSurfaceTooltipProps}
              valueFormatter={activeSurfaceChart.formatter}
              tickLine="y"
            />
          ) : (
            <Stack justify="center" align="center" h={SURFACE_CHART_HEIGHT} gap="xs">
              <Text fw={800}>
                {isMeta
                  ? surfacePanelMode === 'device'
                    ? 'Device rows are still syncing'
                    : 'Platform rows are still syncing'
                  : 'This graph is Meta-only'}
              </Text>
              <Text size="sm" c="dimmed" ta="center" maw={320}>
                {isMeta
                  ? surfacePanelMode === 'device'
                    ? 'Impression-device bars will appear here once Meta rows exist for this report scope.'
                    : 'Publisher platform bars will appear here once Meta rows exist for this report scope.'
                  : 'The delivery surface graph is only wired for Meta right now.'}
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
            {audienceBreakdowns.state === 'available' && audienceChart.data.length > 0 ? (
              <BarChart
                h={AUDIENCE_BREAKDOWN_CHART_HEIGHT}
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
                  {isMeta ? 'Audience rows are still syncing' : 'Audience graph is Meta-only'}
                </Text>
                <Text size="sm" c="dimmed" mt={6}>
                  {isMeta
                    ? 'Age, gender, and geo breakdowns will appear here once Meta audience rows exist for this report scope.'
                    : 'The audience breakdown graph is only wired for Meta right now.'}
                </Text>
              </Paper>
            )}
          </div>
        </Stack>
      </Stack>
    </Card>
  );
}

function ReportChartTooltip({
  active,
  label,
  payload,
  series,
  annotations,
  valueFormatter,
}: ReportTooltipContentProps & {
  series: ReportChartSeries[];
  annotations: TimelineAnnotation[];
  valueFormatter: (value: number) => string;
}) {
  if (!active) {
    return null;
  }

  const labelText = label == null ? '' : String(label);
  const rows = Array.isArray(payload) ? payload : [];
  const matchingAnnotations = annotations.filter((annotation) => annotation.chartLabel === labelText);

  return (
    <Paper withBorder radius="md" p={8} className={classes.reportChartTooltip}>
      {labelText ? (
        <Text fw={850} size="xs" className={classes.reportChartTooltipTitle}>
          {labelText}
        </Text>
      ) : null}

      <Stack gap={4} mt={labelText ? 6 : 0}>
        {rows.map((item) => {
          const name = String(item.name ?? item.dataKey ?? '');
          const seriesConfig = series.find((entry) => entry.name === name);
          const color = item.color ?? item.stroke ?? item.fill ?? seriesConfig?.color ?? '#64748b';

          return (
            <Group key={name} justify="space-between" gap="md" wrap="nowrap" className={classes.reportChartTooltipRow}>
              <Group gap={6} wrap="nowrap">
                <span className={classes.reportChartTooltipDot} style={{ backgroundColor: color }} />
                <Text size="xs">{name}</Text>
              </Group>
              <Text size="xs" fw={800}>
                {formatTooltipPayloadValue(item.value, valueFormatter)}
              </Text>
            </Group>
          );
        })}
      </Stack>

      {matchingAnnotations.length > 0 ? (
        <Stack gap={5} mt={6} pt={6} className={classes.reportAnnotationTooltip}>
          {matchingAnnotations.map((annotation) => (
            <Group key={annotation.key} gap={6} wrap="nowrap" align="flex-start">
              <span className={classes.chartAnnotationDot} style={{ backgroundColor: annotation.color, marginTop: 4 }} />
              <div>
                <Text size="xs" fw={850}>
                  {annotation.label}
                </Text>
                <Text size="xs" c="dimmed" className={classes.reportAnnotationTooltipDetail}>
                  {annotation.detail}
                </Text>
              </div>
            </Group>
          ))}
        </Stack>
      ) : null}
    </Paper>
  );
}

function AnnotationLegend({ annotations }: { annotations: TimelineAnnotation[] }) {
  if (annotations.length === 0) {
    return null;
  }

  return (
    <Group gap={8} wrap="wrap" className={classes.chartAnnotationLegend}>
      {annotations.map((annotation) => (
        <span key={annotation.key} className={classes.chartAnnotationChip} aria-hidden="true">
          <span className={classes.chartAnnotationDot} style={{ backgroundColor: annotation.color }} />
        </span>
      ))}
    </Group>
  );
}

export function ReportsClient({ payload, filterOptions, isDemo = false }: ReportsClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [filtersOpened, setFiltersOpened] = useState(false);

  const currentSearchString = searchParams?.toString() ?? '';

  const updateSearch = (mutate: (params: URLSearchParams) => void) => {
    const nextParams = new URLSearchParams(currentSearchString);
    mutate(nextParams);
    nextParams.set('scope', resolveScope(nextParams));

    startTransition(() => {
      router.replace(`${pathname}?${nextParams.toString()}`, { scroll: false });
    });
  };

  const exportLinks = useMemo(() => {
    const nextParams = new URLSearchParams(currentSearchString);

    if (isDemo) {
      nextParams.set('demo', '1');
    }

    const query = nextParams.toString() ? `?${nextParams.toString()}` : '';

    return {
      pdf: `/api/reports/pdf${query}`,
      csv: `/api/reports/csv${query}`,
    };
  }, [currentSearchString, isDemo]);

  const storyData = useMemo(
    () =>
      payload.series.map((point) => ({
        label: formatChartDateLabel(point.label),
        Spend: Number(point.spend.toFixed(2)),
        Results: point.conversion,
        Clicks: point.clicks,
      })),
    [payload.series]
  );
  const efficiencyTrendData = useMemo(
    () =>
      payload.series.map((point) => ({
        label: formatChartDateLabel(point.label),
        CTR: Number(point.ctr.toFixed(2)),
        CPC: Number(point.cpc.toFixed(2)),
        CPM: Number(point.cpm.toFixed(2)),
      })),
    [payload.series]
  );
  const reportTrendXAxisProps = useMemo(
    () => ({
      minTickGap: 20,
      tickMargin: 10,
      padding: {
        left: 18,
        right: 30,
      },
    }),
    []
  );
  const reportTrendChartProps = useMemo(
    () => ({
      margin: {
        top: 8,
        right: 32,
        bottom: 8,
        left: 8,
      },
    }),
    []
  );

  const activeFilterCount = useMemo(() => getActiveFilterCount(payload), [payload]);
  const visibleFilterSummary = useMemo(
    () =>
      payload.export.filterSummary.filter((item) => {
        if (item.label === 'Date range' || item.label === 'Range') {
          return true;
        }

        if (item.label === 'Compare' && item.value === 'None') {
          return false;
        }

        return !item.value.startsWith('All ');
      }),
    [payload.export.filterSummary]
  );
  const hasTrendData = storyData.length > 0;
  const hasEfficiencyTrendData = efficiencyTrendData.length > 0;
  const topResultsPoint = useMemo(
    () => pickMaxPoint(payload.series, 'conversion'),
    [payload.series]
  );
  const topSpendPoint = useMemo(() => pickMaxPoint(payload.series, 'spend'), [payload.series]);
  const topCtrPoint = useMemo(() => pickMaxPoint(payload.series, 'ctr'), [payload.series]);
  const persistedFindingAnnotations = useMemo(
    () =>
      payload.findings.slice(0, 6).reduce<{
        timeline: TimelineAnnotation[];
        quality: TimelineAnnotation[];
      }>(
        (accumulator, finding) => {
          const mapped = buildFindingAnnotation(finding, payload.series);
          if (!mapped) {
            return accumulator;
          }

          if (mapped.bucket === 'timeline') {
            accumulator.timeline.push(mapped.annotation);
          } else {
            accumulator.quality.push(mapped.annotation);
          }

          return accumulator;
        },
        { timeline: [], quality: [] }
      ),
    [payload.findings, payload.series]
  );
  const timelineAnnotations = useMemo<TimelineAnnotation[]>(() => {
    const annotations: TimelineAnnotation[] = [...persistedFindingAnnotations.timeline];

    if (topResultsPoint) {
      annotations.push({
        key: `results-${topResultsPoint.label}`,
        chartLabel: formatChartDateLabel(topResultsPoint.label),
        value: topResultsPoint.conversion,
        label: 'Highest results',
        detail: 'Strongest results point in the selected range.',
        color: CHART_METRIC_COLORS.results,
      });
    }

    if (topSpendPoint) {
      annotations.push({
        key: `spend-${topSpendPoint.label}`,
        chartLabel: formatChartDateLabel(topSpendPoint.label),
        value: Number(topSpendPoint.spend.toFixed(2)),
        label: 'Highest spend',
        detail: 'Largest spend point in the selected range.',
        color: CHART_METRIC_COLORS.spend,
      });
    }

    return annotations;
  }, [persistedFindingAnnotations.timeline, topResultsPoint, topSpendPoint]);
  const qualityAnnotations = useMemo<TimelineAnnotation[]>(() => {
    const annotations: TimelineAnnotation[] = [...persistedFindingAnnotations.quality];

    if (!topCtrPoint) {
      return annotations;
    }

    annotations.push({
        key: `ctr-${topCtrPoint.label}`,
        chartLabel: formatChartDateLabel(topCtrPoint.label),
        value: Number(topCtrPoint.ctr.toFixed(2)),
        label: 'Best CTR',
        detail: 'Highest click-through rate point in the selected range.',
        color: CHART_METRIC_COLORS.ctr,
      });

    return annotations;
  }, [persistedFindingAnnotations.quality, topCtrPoint]);
  const timelineTooltipProps = useMemo(
    () => ({
      content: (props: ReportTooltipContentProps) => (
        <ReportChartTooltip
          {...props}
          series={PERFORMANCE_TIMELINE_SERIES}
          annotations={timelineAnnotations}
          valueFormatter={formatPerformanceChartValue}
        />
      ),
    }),
    [timelineAnnotations]
  );
  const qualityTooltipProps = useMemo(
    () => ({
      content: (props: ReportTooltipContentProps) => (
        <ReportChartTooltip
          {...props}
          series={EFFICIENCY_TIMELINE_SERIES}
          annotations={qualityAnnotations}
          valueFormatter={formatEfficiencyChartValue}
        />
      ),
    }),
    [qualityAnnotations]
  );
  const breadcrumbs = useMemo(
    () => buildReportBreadcrumbs(payload, filterOptions),
    [filterOptions, payload]
  );

  return (
    <Container fluid px={6} py={0} className={`${classes.page} reports-page-shell`}>
      <Drawer
        opened={filtersOpened}
        onClose={() => setFiltersOpened(false)}
        title="Report filters"
        position="right"
        size="md"
      >
        <ReportsSidebar
          query={payload.query}
          filterOptions={filterOptions}
          onUpdate={(mutate) => {
            setFiltersOpened(false);
            updateSearch(mutate);
          }}
        />
      </Drawer>

      <Stack gap="md" className={classes.shell}>
        <ReportsHeader
          payload={payload}
          exportLinks={exportLinks}
          onUpdate={updateSearch}
          onRefresh={() => {
            startTransition(() => {
              router.refresh();
            });
          }}
          onOpenFilters={() => setFiltersOpened(true)}
          activeFilterCount={activeFilterCount}
          isDemo={isDemo}
          isPending={isPending}
        />

        {breadcrumbs.length > 0 ? (
          <Paper withBorder radius="xl" p="md" className={classes.breadcrumbCard}>
            <Group gap="xs" wrap="wrap">
              <Text size="xs" c="dimmed" tt="uppercase" fw={800}>
                Report path
              </Text>
              {breadcrumbs.map((item, index) => (
                <Group key={`${item.label}:${index}`} gap="xs" wrap="nowrap">
                  {index > 0 ? <IconChevronRight size={14} color="#94a3b8" /> : null}
                  {item.href ? (
                    <Button
                      component={Link}
                      href={item.href}
                      variant="subtle"
                      size="compact-xs"
                      radius="xl"
                    >
                      {item.label}
                    </Button>
                  ) : (
                    <Badge color="blue" variant="light" radius="sm">
                      {item.label}
                    </Badge>
                  )}
                </Group>
              ))}
            </Group>
          </Paper>
        ) : null}

        {payload.meta.syncCoverage?.historicalAnalysisPending ? (
          <Paper
            radius="xl"
            p="md"
            bg="rgba(20,168,102,0.08)"
            style={{ border: '1px solid rgba(20,168,102,0.18)' }}
          >
            <Group justify="space-between" align="flex-start" gap="md">
              <div>
                <Text fw={800}>Recent coverage is ready while full history sync continues</Text>
                <Text size="sm" c="dimmed" mt={4}>
                  {payload.meta.syncCoverage.coverageStartDate &&
                  payload.meta.syncCoverage.coverageEndDate
                    ? `This report currently reflects synced data from ${payload.meta.syncCoverage.coverageStartDate} through ${payload.meta.syncCoverage.coverageEndDate}.`
                    : 'DeepVisor is still expanding the history window for this selected ad account.'}
                </Text>
              </div>
              <Badge color="blue" variant="light">
                {payload.meta.syncCoverage.activeJobStatus ?? 'pending'}
              </Badge>
            </Group>
          </Paper>
        ) : null}

        {isPending && (
          <Card withBorder radius="lg" p="sm">
            <Group gap="sm">
              <Loader size="sm" />
              <Text size="sm" c="dimmed">
                Updating report…
              </Text>
            </Group>
          </Card>
        )}

        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
          {payload.kpis.map((kpi) => (
            <KpiCard key={kpi.key} kpi={kpi} />
          ))}
        </SimpleGrid>

        <Grid gutter="md" align="stretch">
          <Grid.Col span={{ base: 12, xl: 8 }}>
            <Card withBorder radius="xl" p="lg" h="100%" className={classes.reportCard}>
              <Group justify="space-between" align="flex-start" gap="md" wrap="wrap" className={classes.cardHeader}>
                <div>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={800}>
                    Timeline
                  </Text>
                  <Text fw={900} size="xl" mt={4}>
                    Performance over time
                  </Text>
                  <Text size="sm" c="dimmed" mt={4}>
                    Delivery and efficiency trends for the selected reporting window.
                  </Text>
                </div>
                <Group gap="xs" wrap="wrap">
                  <Badge variant="light" color="gray" radius="sm">
                    {payload.query.rangeMode === 'max'
                      ? 'Summary comparison'
                      : `Grouped by ${payload.query.groupBy}`}
                  </Badge>
                  <Badge variant="light" color={payload.query.compareMode === 'previous_period' ? 'teal' : 'gray'} radius="sm">
                    {payload.query.rangeMode === 'max'
                      ? 'Max summary'
                      : payload.query.compareMode === 'previous_period'
                        ? 'Previous period on'
                        : 'No comparison'}
                  </Badge>
                </Group>
              </Group>

              <Stack gap={0} className={classes.timelineChartStack}>
                <section className={classes.timelineChartSection}>
                  <Group justify="space-between" align="flex-start" gap="md" wrap="wrap" className={classes.timelineSectionHeader}>
                    <div>
                      <Text size="xs" c="dimmed" tt="uppercase" fw={800}>
                        Delivery trend
                      </Text>
                      <Text size="sm" c="dimmed" mt={3}>
                        Spend, results, and clicks.
                      </Text>
                    </div>
                    <Group gap="xs" wrap="wrap" justify="flex-end" className={classes.timelineHeaderActions}>
                      <AnnotationLegend annotations={timelineAnnotations} />
                      <Badge variant="light" color="gray" radius="sm">
                        Performance
                      </Badge>
                    </Group>
                  </Group>

                  <div className={classes.chartWrap}>
                    {hasTrendData ? (
                      <LineChart
                        h={320}
                        data={storyData}
                        dataKey="label"
                        xAxisProps={reportTrendXAxisProps}
                        lineChartProps={reportTrendChartProps}
                        series={PERFORMANCE_TIMELINE_SERIES}
                        tooltipProps={timelineTooltipProps}
                        curveType="linear"
                        withLegend
                        valueFormatter={formatPerformanceChartValue}
                      >
                        {timelineAnnotations.map((annotation) => (
                          <ReferenceDot
                            key={annotation.key}
                            x={annotation.chartLabel}
                            y={annotation.value}
                            yAxisId="left"
                            r={7}
                            fill="#ffffff"
                            stroke={annotation.color}
                            strokeWidth={3}
                            isFront
                          />
                        ))}
                      </LineChart>
                    ) : (
                      <Stack justify="center" align="center" h={320} gap="xs">
                        <Text fw={800}>No time-series trend available yet</Text>
                        <Text size="sm" c="dimmed" ta="center" maw={360}>
                          Breakdown data is still shown below, so you can still see which entities are carrying the report.
                        </Text>
                      </Stack>
                    )}
                  </div>
                </section>

                <section className={classes.timelineChartSection}>
                  <Group justify="space-between" align="flex-start" gap="md" wrap="wrap" className={classes.timelineSectionHeader}>
                    <div>
                      <Text size="xs" c="dimmed" tt="uppercase" fw={800}>
                        Quality trend
                      </Text>
                      <Text size="sm" c="dimmed" mt={3}>
                        CTR, CPC, and CPM over time.
                      </Text>
                    </div>
                    <Group gap="xs" wrap="wrap" justify="flex-end" className={classes.timelineHeaderActions}>
                      <AnnotationLegend annotations={qualityAnnotations} />
                      <Badge variant="light" color="gray" radius="sm">
                        Efficiency
                      </Badge>
                    </Group>
                  </Group>

                  <div className={classes.supportingChartWrap}>
                    {hasEfficiencyTrendData ? (
                      <LineChart
                        h={240}
                        data={efficiencyTrendData}
                        dataKey="label"
                        xAxisProps={reportTrendXAxisProps}
                        lineChartProps={reportTrendChartProps}
                        series={EFFICIENCY_TIMELINE_SERIES}
                        tooltipProps={qualityTooltipProps}
                        curveType="linear"
                        withLegend
                        valueFormatter={formatEfficiencyChartValue}
                      >
                        {qualityAnnotations.map((annotation) => (
                          <ReferenceDot
                            key={annotation.key}
                            x={annotation.chartLabel}
                            y={annotation.value}
                            yAxisId="left"
                            r={7}
                            fill="#ffffff"
                            stroke={annotation.color}
                            strokeWidth={3}
                            isFront
                          />
                        ))}
                      </LineChart>
                    ) : (
                      <Stack justify="center" align="center" h={240} gap="xs">
                        <Text fw={800}>No efficiency trend available yet</Text>
                        <Text size="sm" c="dimmed" ta="center" maw={360}>
                          Once more time-series points are available, DeepVisor will show how traffic
                          quality changed across the selected period.
                        </Text>
                      </Stack>
                    )}
                  </div>
                </section>
              </Stack>
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 12, xl: 4 }}>
            <ReportDeliverySurfaceGraph payload={payload} />
          </Grid.Col>
        </Grid>

        <RankedEntityBoard
          rows={payload.breakdown.rows}
          currencyCode={payload.meta.currencyCode}
          ranking={payload.ranking}
          query={payload.query}
        />

        <Card withBorder radius="xl" p="lg" className={`${classes.reportCard} ${classes.tableCard}`}>
          <Stack gap="md">
            <Group justify="space-between" align="flex-start" gap="md" wrap="wrap" className={classes.cardHeader}>
              <div>
                <Text size="xs" c="dimmed" tt="uppercase" fw={800}>
                  Performance table
                </Text>
                <Text fw={900} size="xl" mt={4}>
                  {payload.breakdown.title}
                </Text>
                <Text size="sm" c="dimmed" mt={4}>
                  Full row-level view for campaigns, ad sets, or ads in the current filters.
                </Text>
              </div>
              <Group gap="xs" wrap="wrap">
                {visibleFilterSummary.map((item) => (
                  <Badge key={`${item.label}:${item.value}`} variant="light" color="gray" radius="sm">
                    {item.label}: {item.value}
                  </Badge>
                ))}
              </Group>
            </Group>

            <PerformanceTable
              title={payload.breakdown.title}
              rows={payload.breakdown.rows}
              currencyCode={payload.meta.currencyCode}
              hideTitle
            />
          </Stack>
        </Card>
      </Stack>
    </Container>
  );
}
