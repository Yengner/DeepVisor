import 'server-only';

import { createHash } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isLikelyActiveStatus } from '@/lib/server/dashboard/buildPayload';
import { buildReportUrl } from '@/lib/shared';
import type { Database } from '@/lib/shared/types/supabase';
import {
  createOrUpdateDeliveryLog,
  upsertNotification,
} from '../repositories/notifications';
import {
  buildDefaultNotificationPreference,
  listNotificationPreferencesForBusiness,
} from '../repositories/notificationPreferences';
import {
  buildDefaultReportSubscription,
  getReportSubscription,
} from '../repositories/reportSubscriptions';
import { syncTrendFindings } from '../repositories/trendFindings';
import type {
  MetaTrendIntelligenceArtifacts,
  NotificationPreference,
  ReportSubscriptionSetting,
  TrendFinding,
  TrendFindingConfidence,
  TrendFindingDraft,
  TrendFindingMetricSnapshot,
  TrendFindingNotificationSummary,
  TrendFindingRecommendedAction,
  TrendFindingSeverity,
  TrendFindingType,
} from '../types';

type IntelligenceClient = SupabaseClient<Database>;

type AdsetSummaryRow = {
  adset_id: string;
  campaign_id: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  inline_link_clicks: number;
  leads: number;
  messages: number;
  calls: number;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  cost_per_result: number | null;
  first_day: string | null;
  last_day: string | null;
  history_status: string;
};

type AdsetDimensionRow = {
  id: string;
  name: string | null;
  campaign_id: string | null;
  optimization_goal: string | null;
  status: string | null;
};

type CampaignDimensionRow = {
  id: string;
  name: string | null;
  objective: string | null;
  status: string | null;
};

type DailyRow = {
  adset_id: string;
  day: string;
  spend: number;
  impressions: number;
  clicks: number;
  inline_link_clicks: number;
  leads: number;
  messages: number;
  calls: number;
  status: string | null;
};

type HourlyRow = {
  adset_id: string;
  day: string;
  day_of_week: number;
  hour_of_day: number;
  spend: number;
  impressions: number;
  clicks: number;
  inline_link_clicks: number;
  ctr: number;
  cpc: number;
  cpm: number;
  time_basis: string;
};

type RecipientContext = {
  userId: string;
  notificationPreference: NotificationPreference;
  reportSubscription: ReportSubscriptionSetting;
};

type AdsetCandidate = {
  adsetId: string;
  adsetName: string;
  adsetStatus: string | null;
  optimizationGoal: string | null;
  campaignId: string | null;
  campaignName: string | null;
  campaignObjective: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  linkClicks: number;
  results: number;
  ctr: number;
  costPerResult: number;
  firstDay: string | null;
  lastDay: string | null;
  dailyRows: DailyRow[];
  hourlyRows: HourlyRow[];
};

type CombinedPoint = {
  day: string;
  deliveryIndex: number;
  efficiencyIndex: number;
};

type BestTimePattern = {
  adsetId: string;
  adsetName: string;
  dayOfWeek: number;
  hourOfDay: number;
  hourRange: string;
  metricLabel: string;
  averageMetric: number;
  totalMetric: number;
  occurrences: number;
  confidence: TrendFindingConfidence;
};

const DAILY_SIGNAL_MIN_SPEND = 40;
const DAILY_SIGNAL_MIN_IMPRESSIONS = 600;
const DAILY_SIGNAL_MIN_RESULTS = 2;
const HOURLY_BEST_TIME_MIN_OCCURRENCES = 2;
const HOURLY_BEST_TIME_MIN_IMPRESSIONS = 150;
const HOURLY_BEST_TIME_MIN_CLICKS = 4;
const HOURLY_BEST_TIME_MIN_SPEND = 10;
const DIVERGENCE_THRESHOLD = 8;
const MAJOR_DIVERGENCE_THRESHOLD = 15;

function hashPayload(value: unknown): string {
  return createHash('sha1').update(JSON.stringify(value)).digest('hex');
}

function toFixedNumber(value: number, digits = 2): number {
  return Number((Number.isFinite(value) ? value : 0).toFixed(digits));
}

function getResults(input: { leads?: number | null; messages?: number | null; calls?: number | null }): number {
  return (input.leads ?? 0) + (input.messages ?? 0) + (input.calls ?? 0);
}

function computeCtr(clicks: number, impressions: number): number {
  return impressions > 0 ? toFixedNumber((clicks / impressions) * 100, 2) : 0;
}

function computeCostPerResult(spend: number, results: number): number {
  return results > 0 ? toFixedNumber(spend / results, 2) : 0;
}

function formatHourLabel(hour: number): string {
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const normalizedHour = hour % 12 || 12;
  return `${normalizedHour}${suffix}`;
}

function formatHourRange(startHour: number): string {
  const endHour = (startHour + 2) % 24;
  return `${formatHourLabel(startHour)}-${formatHourLabel(endHour)}`;
}

function formatDayLabel(dayOfWeek: number): string {
  return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][dayOfWeek] ?? 'Unknown';
}

function addUtcDays(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function daysBetween(start: string, end: string): number {
  const startDate = new Date(`${start}T00:00:00Z`);
  const endDate = new Date(`${end}T00:00:00Z`);
  return Math.round((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
}

function normalizeTrendSeries(values: number[]): number[] {
  const baseline = values.find((value) => value > 0) ?? 0;
  if (baseline <= 0) {
    return values.map(() => 0);
  }

  return values.map((value) => Number(((value / baseline) * 100).toFixed(1)));
}

function chunkValues<T>(items: T[], chunkSize = 100): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }
  return chunks;
}

function compareSeverity(left: TrendFindingSeverity, right: TrendFindingSeverity): number {
  const rank: Record<TrendFindingSeverity, number> = {
    info: 1,
    warning: 2,
    critical: 3,
  };
  return rank[left] - rank[right];
}

function meetsSeverityThreshold(
  severity: TrendFindingSeverity,
  threshold: TrendFindingSeverity
): boolean {
  return compareSeverity(severity, threshold) >= 0;
}

function buildAdsetReportHref(input: {
  platformIntegrationId: string;
  adAccountId: string;
  campaignId: string | null;
  adsetId: string;
}): string {
  return buildReportUrl({
    scope: 'adset',
    platformIntegrationId: input.platformIntegrationId,
    adAccountIds: [input.adAccountId],
    campaignIds: input.campaignId ? [input.campaignId] : [],
    adsetIds: [input.adsetId],
    compareMode: 'previous_period',
  });
}

function buildFindingAction(input: {
  type: TrendFindingType;
  platformIntegrationId: string;
  adAccountId: string;
  adsetId: string;
  adsetName: string;
  campaignId: string | null;
}): TrendFindingRecommendedAction | null {
  const reportHref = buildAdsetReportHref({
    platformIntegrationId: input.platformIntegrationId,
    adAccountId: input.adAccountId,
    campaignId: input.campaignId,
    adsetId: input.adsetId,
  });

  switch (input.type) {
    case 'best_time_window':
      return {
        type: 'launch_test',
        label: 'Send timing suggestion to calendar',
        destination: 'calendar',
        href: reportHref,
        reportHref,
        queueSuggested: true,
        payload: {
          adsetId: input.adsetId,
          campaignId: input.campaignId,
        },
      };
    case 'delivery_drop_vs_efficiency':
      return {
        type: 'launch_test',
        label: `Add a recovery test to ${input.adsetName}`,
        destination: 'campaign_draft',
        href: `/campaigns/create?scope=ad&adset_id=${input.adsetId}`,
        reportHref,
        queueSuggested: true,
        payload: {
          adsetId: input.adsetId,
          campaignId: input.campaignId,
        },
      };
    case 'efficiency_drop_vs_delivery':
    case 'sustained_divergence':
    case 'meaningful_crossover':
      return {
        type: 'investigate_efficiency',
        label: 'Review the account report',
        destination: 'reports',
        href: reportHref,
        reportHref,
        queueSuggested: true,
        payload: {
          adsetId: input.adsetId,
          campaignId: input.campaignId,
        },
      };
    case 'stale_live_delivery':
      return {
        type: 'refresh_creative',
        label: 'Queue a creative refresh review',
        destination: 'calendar',
        href: reportHref,
        reportHref,
        queueSuggested: true,
        payload: {
          adsetId: input.adsetId,
          campaignId: input.campaignId,
        },
      };
    default:
      return null;
  }
}

async function loadAdsetCandidates(
  supabase: IntelligenceClient,
  input: {
    adAccountId: string;
  }
): Promise<AdsetCandidate[]> {
  const [summaryResult, dimensionResult, campaignResult] = await Promise.all([
    (supabase as any)
      .from('adset_performance_summary')
      .select(
        'adset_id, campaign_id, spend, impressions, clicks, inline_link_clicks, leads, messages, calls, ctr, cost_per_result, first_day, last_day, history_status'
      )
      .eq('ad_account_id', input.adAccountId),
    (supabase as any)
      .from('adset_dims')
      .select('id, name, campaign_id, optimization_goal, status')
      .eq('ad_account_id', input.adAccountId),
    (supabase as any)
      .from('campaign_dims')
      .select('id, name, objective, status')
      .eq('ad_account_id', input.adAccountId),
  ]);

  if (summaryResult.error) {
    throw summaryResult.error;
  }
  if (dimensionResult.error) {
    throw dimensionResult.error;
  }
  if (campaignResult.error) {
    throw campaignResult.error;
  }

  const summaries = (summaryResult.data ?? []) as AdsetSummaryRow[];
  const dimensionsById = new Map(
    ((dimensionResult.data ?? []) as AdsetDimensionRow[]).map((row) => [row.id, row])
  );
  const campaignsById = new Map(
    ((campaignResult.data ?? []) as CampaignDimensionRow[]).map((row) => [row.id, row])
  );

  const candidateSummaries = summaries.filter((row) => {
    const dimension = dimensionsById.get(row.adset_id);
    const campaign = row.campaign_id ? campaignsById.get(row.campaign_id) ?? null : null;
    const hasDelivery = row.spend > 0 || row.impressions > 0 || row.clicks > 0;

    return (
      hasDelivery &&
      isLikelyActiveStatus(dimension?.status) &&
      (!campaign || isLikelyActiveStatus(campaign.status))
    );
  });

  const adsetIds = candidateSummaries.map((row) => row.adset_id);
  const dailyRows = await loadDailyRowsForAdsets(supabase, adsetIds);
  const hourlyRows = await loadHourlyRowsForAdsets(supabase, adsetIds);
  const dailyRowsByAdset = new Map<string, DailyRow[]>();
  const hourlyRowsByAdset = new Map<string, HourlyRow[]>();

  for (const row of dailyRows) {
    const current = dailyRowsByAdset.get(row.adset_id) ?? [];
    current.push(row);
    dailyRowsByAdset.set(row.adset_id, current);
  }

  for (const row of hourlyRows) {
    const current = hourlyRowsByAdset.get(row.adset_id) ?? [];
    current.push(row);
    hourlyRowsByAdset.set(row.adset_id, current);
  }

  return candidateSummaries.map((row) => {
    const dimension = dimensionsById.get(row.adset_id);
    const campaign = row.campaign_id ? campaignsById.get(row.campaign_id) ?? null : null;
    const results = getResults(row);

    return {
      adsetId: row.adset_id,
      adsetName: dimension?.name ?? 'Unnamed ad set',
      adsetStatus: dimension?.status ?? null,
      optimizationGoal: dimension?.optimization_goal ?? null,
      campaignId: row.campaign_id,
      campaignName: campaign?.name ?? null,
      campaignObjective: campaign?.objective ?? null,
      spend: row.spend ?? 0,
      impressions: row.impressions ?? 0,
      clicks: row.clicks ?? 0,
      linkClicks: row.inline_link_clicks ?? 0,
      results,
      ctr: row.ctr ?? computeCtr(row.clicks ?? 0, row.impressions ?? 0),
      costPerResult:
        row.cost_per_result ?? computeCostPerResult(row.spend ?? 0, results),
      firstDay: row.first_day,
      lastDay: row.last_day,
      dailyRows: (dailyRowsByAdset.get(row.adset_id) ?? []).sort((a, b) =>
        a.day.localeCompare(b.day)
      ),
      hourlyRows: (hourlyRowsByAdset.get(row.adset_id) ?? []).sort(
        (a, b) => a.day.localeCompare(b.day) || a.hour_of_day - b.hour_of_day
      ),
    };
  });
}

async function loadDailyRowsForAdsets(
  supabase: IntelligenceClient,
  adsetIds: string[]
): Promise<DailyRow[]> {
  const rows: DailyRow[] = [];

  for (const chunk of chunkValues(adsetIds, 100)) {
    const { data, error } = await (supabase as any)
      .from('adsets_performance_daily')
      .select(
        'adset_id, day, spend, impressions, clicks, inline_link_clicks, leads, messages, calls, status'
      )
      .in('adset_id', chunk)
      .order('day', { ascending: true });

    if (error) {
      throw error;
    }

    rows.push(...((data ?? []) as DailyRow[]));
  }

  return rows;
}

async function loadHourlyRowsForAdsets(
  supabase: IntelligenceClient,
  adsetIds: string[]
): Promise<HourlyRow[]> {
  const rows: HourlyRow[] = [];

  for (const chunk of chunkValues(adsetIds, 100)) {
    const { data, error } = await (supabase as any)
      .from('meta_hourly_performance')
      .select(
        'adset_id, day, day_of_week, hour_of_day, spend, impressions, clicks, inline_link_clicks, ctr, cpc, cpm, time_basis'
      )
      .in('adset_id', chunk)
      .eq('time_basis', 'advertiser')
      .order('day', { ascending: true })
      .order('hour_of_day', { ascending: true });

    if (error) {
      throw error;
    }

    rows.push(...((data ?? []) as HourlyRow[]));
  }

  return rows;
}

function buildCombinedSeries(rows: DailyRow[]): CombinedPoint[] {
  const deliveryValues = rows.map((row) => {
    const results = getResults(row);
    return row.spend * 0.35 + results * 0.4 + row.clicks * 0.25;
  });

  const efficiencyValues = rows.map((row) => {
    const results = getResults(row);
    const ctr = computeCtr(row.clicks, row.impressions);
    const cpc = row.clicks > 0 ? row.spend / row.clicks : 0;
    const costPerResult = computeCostPerResult(row.spend, results);
    const cpcScore = cpc > 0 ? 100 / cpc : 0;
    const resultScore = costPerResult > 0 ? 100 / costPerResult : 0;
    return ctr * 0.4 + cpcScore * 0.3 + resultScore * 0.3;
  });

  const normalizedDelivery = normalizeTrendSeries(deliveryValues);
  const normalizedEfficiency = normalizeTrendSeries(efficiencyValues);

  return rows.map((row, index) => ({
    day: row.day,
    deliveryIndex: normalizedDelivery[index] ?? 0,
    efficiencyIndex: normalizedEfficiency[index] ?? 0,
  }));
}

function evaluateDailyTrendFinding(
  candidate: AdsetCandidate,
  reportContext: {
    platformIntegrationId: string;
    adAccountId: string;
  }
): TrendFindingDraft | null {
  const recentRows = candidate.dailyRows.slice(-14);
  if (recentRows.length < 4) {
    return null;
  }

  const totalSpend = recentRows.reduce((sum, row) => sum + row.spend, 0);
  const totalImpressions = recentRows.reduce((sum, row) => sum + row.impressions, 0);
  const totalResults = recentRows.reduce((sum, row) => sum + getResults(row), 0);

  if (
    totalSpend < DAILY_SIGNAL_MIN_SPEND &&
    totalImpressions < DAILY_SIGNAL_MIN_IMPRESSIONS &&
    totalResults < DAILY_SIGNAL_MIN_RESULTS
  ) {
    return null;
  }

  const combinedPoints = buildCombinedSeries(recentRows);
  const findings: Array<{
    type: TrendFindingType;
    severity: TrendFindingSeverity;
    confidence: TrendFindingConfidence;
    title: string;
    summary: string;
    reason: string;
    point: CombinedPoint;
    gap: number;
  }> = [];

  for (let index = 1; index < combinedPoints.length; index += 1) {
    const previous = combinedPoints[index - 1];
    const current = combinedPoints[index];
    const previousGap = Math.abs(previous.deliveryIndex - previous.efficiencyIndex);
    const gap = Math.abs(current.deliveryIndex - current.efficiencyIndex);
    const majorGap = gap >= MAJOR_DIVERGENCE_THRESHOLD;

    if (
      previous.efficiencyIndex < previous.deliveryIndex &&
      current.efficiencyIndex >= current.deliveryIndex
    ) {
      findings.push({
        type: 'meaningful_crossover',
        severity: 'info',
        confidence: 'medium',
        title: `Efficiency crossed above delivery in ${candidate.adsetName}`,
        summary: `Efficiency moved above delivery on ${current.day}, which can mean quality held up while volume pressure shifted.`,
        reason: 'Daily efficiency index moved above the delivery index.',
        point: current,
        gap,
      });
    }

    if (
      current.deliveryIndex < previous.deliveryIndex &&
      current.efficiencyIndex >= previous.efficiencyIndex &&
      gap >= DIVERGENCE_THRESHOLD
    ) {
      findings.push({
        type: 'delivery_drop_vs_efficiency',
        severity: majorGap ? 'critical' : 'warning',
        confidence: 'high',
        title: `Delivery weakened while efficiency held in ${candidate.adsetName}`,
        summary: `Delivery fell while efficiency held up on ${current.day}. The ad set may be losing volume momentum while remaining relatively efficient.`,
        reason: 'Daily delivery index fell while the efficiency index stayed flat or improved.',
        point: current,
        gap,
      });
    }

    if (
      current.efficiencyIndex < previous.efficiencyIndex &&
      current.deliveryIndex >= previous.deliveryIndex &&
      gap >= DIVERGENCE_THRESHOLD
    ) {
      findings.push({
        type: 'efficiency_drop_vs_delivery',
        severity: majorGap ? 'critical' : 'warning',
        confidence: 'high',
        title: `Volume is rising faster than efficiency in ${candidate.adsetName}`,
        summary: `Delivery continued to rise while efficiency weakened on ${current.day}. Scaling may be outrunning quality.`,
        reason: 'Daily efficiency index deteriorated while the delivery index stayed flat or improved.',
        point: current,
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

      if (index === 1 || earlierGap < DIVERGENCE_THRESHOLD) {
        const efficiencyLeading = current.efficiencyIndex > current.deliveryIndex;
        findings.push({
          type: 'sustained_divergence',
          severity: majorGap ? 'critical' : 'warning',
          confidence: 'high',
          title: efficiencyLeading
            ? `Efficiency is outpacing delivery in ${candidate.adsetName}`
            : `Scaling may be slowing in ${candidate.adsetName}`,
          summary: efficiencyLeading
            ? `Efficiency stayed meaningfully ahead of delivery through ${current.day}.`
            : `Delivery stayed materially ahead of efficiency through ${current.day}.`,
          reason: 'The gap between delivery and efficiency stayed above the alert threshold for consecutive daily points.',
          point: current,
          gap,
        });
      }
    }
  }

  const strongest = findings.sort((left, right) => {
    const severityDelta = compareSeverity(right.severity, left.severity);
    if (severityDelta !== 0) {
      return severityDelta;
    }
    return right.gap - left.gap;
  })[0];

  if (!strongest) {
    return null;
  }

  const metricSnapshot: TrendFindingMetricSnapshot = {
    label: strongest.point.day,
    sourceWindow: 'daily',
    periodStart: recentRows[0]?.day ?? null,
    periodEnd: recentRows.at(-1)?.day ?? null,
    spend: toFixedNumber(totalSpend, 2),
    impressions: totalImpressions,
    results: totalResults,
    deliveryIndex: strongest.point.deliveryIndex,
    efficiencyIndex: strongest.point.efficiencyIndex,
    gap: strongest.gap,
  };

  return {
    businessId: '',
    platformIntegrationId: '',
    adAccountId: '',
    campaignId: candidate.campaignId,
    adsetId: candidate.adsetId,
    adId: null,
    findingType: strongest.type,
    severity: strongest.severity,
    confidence: strongest.confidence,
    title: strongest.title,
    summary: strongest.summary,
    reason: strongest.reason,
    metricSnapshot,
    recommendedAction: buildFindingAction({
      type: strongest.type,
      platformIntegrationId: reportContext.platformIntegrationId,
      adAccountId: reportContext.adAccountId,
      adsetId: candidate.adsetId,
      adsetName: candidate.adsetName,
      campaignId: candidate.campaignId,
    }),
    snapshotHash: hashPayload(metricSnapshot),
    dedupeKey: `${candidate.adsetId}:${strongest.type}`,
    detectedAt: new Date().toISOString(),
  };
}

function evaluateBestTimeFinding(
  candidate: AdsetCandidate,
  reportContext: {
    platformIntegrationId: string;
    adAccountId: string;
  }
): {
  finding: TrendFindingDraft | null;
  pattern: BestTimePattern | null;
} {
  if (candidate.hourlyRows.length < 8) {
    return { finding: null, pattern: null };
  }

  const prefersLinkClicks = candidate.hourlyRows.some((row) => row.inline_link_clicks > 0);
  const grouped = new Map<
    string,
    {
      dayOfWeek: number;
      hourOfDay: number;
      clicks: number;
      linkClicks: number;
      spend: number;
      impressions: number;
      occurrences: number;
    }
  >();

  for (const row of candidate.hourlyRows) {
    const key = `${row.day_of_week}:${row.hour_of_day}`;
    const current = grouped.get(key) ?? {
      dayOfWeek: row.day_of_week,
      hourOfDay: row.hour_of_day,
      clicks: 0,
      linkClicks: 0,
      spend: 0,
      impressions: 0,
      occurrences: 0,
    };
    current.clicks += row.clicks;
    current.linkClicks += row.inline_link_clicks;
    current.spend += row.spend;
    current.impressions += row.impressions;
    current.occurrences += 1;
    grouped.set(key, current);
  }

  const blockCandidates: Array<{
    dayOfWeek: number;
    startHour: number;
    totalMetric: number;
    averageMetric: number;
    impressions: number;
    clicks: number;
    spend: number;
    occurrences: number;
    confidence: TrendFindingConfidence;
  }> = [];

  for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek += 1) {
    for (let hour = 0; hour < 23; hour += 1) {
      const first = grouped.get(`${dayOfWeek}:${hour}`);
      const second = grouped.get(`${dayOfWeek}:${hour + 1}`);

      if (!first || !second) {
        continue;
      }

      const totalMetric = prefersLinkClicks
        ? first.linkClicks + second.linkClicks
        : first.clicks + second.clicks;
      const occurrences = Math.min(first.occurrences, second.occurrences);
      const averageMetric = occurrences > 0 ? totalMetric / occurrences : 0;
      const impressions = first.impressions + second.impressions;
      const clicks = first.clicks + second.clicks;
      const spend = first.spend + second.spend;

      let confidence: TrendFindingConfidence = 'low';
      if (
        occurrences >= HOURLY_BEST_TIME_MIN_OCCURRENCES &&
        (impressions >= HOURLY_BEST_TIME_MIN_IMPRESSIONS ||
          clicks >= HOURLY_BEST_TIME_MIN_CLICKS ||
          spend >= HOURLY_BEST_TIME_MIN_SPEND)
      ) {
        confidence =
          impressions >= HOURLY_BEST_TIME_MIN_IMPRESSIONS * 2 ||
          clicks >= HOURLY_BEST_TIME_MIN_CLICKS * 2 ||
          spend >= HOURLY_BEST_TIME_MIN_SPEND * 2
            ? 'high'
            : 'medium';
      }

      blockCandidates.push({
        dayOfWeek,
        startHour: hour,
        totalMetric,
        averageMetric,
        impressions,
        clicks,
        spend,
        occurrences,
        confidence,
      });
    }
  }

  const bestBlock = blockCandidates
    .filter((item) => item.totalMetric > 0)
    .sort(
      (left, right) =>
        right.averageMetric - left.averageMetric ||
        right.totalMetric - left.totalMetric ||
        right.impressions - left.impressions
    )[0];

  if (!bestBlock) {
    return { finding: null, pattern: null };
  }

  const metricLabel = prefersLinkClicks ? 'Link clicks' : 'Clicks';
  const hourRange = formatHourRange(bestBlock.startHour);
  const pattern: BestTimePattern = {
    adsetId: candidate.adsetId,
    adsetName: candidate.adsetName,
    dayOfWeek: bestBlock.dayOfWeek,
    hourOfDay: bestBlock.startHour,
    hourRange,
    metricLabel,
    averageMetric: toFixedNumber(bestBlock.averageMetric, 2),
    totalMetric: bestBlock.totalMetric,
    occurrences: bestBlock.occurrences,
    confidence: bestBlock.confidence,
  };

  const metricSnapshot: TrendFindingMetricSnapshot = {
    label: `${formatDayLabel(bestBlock.dayOfWeek)} ${hourRange}`,
    metricLabel,
    sourceWindow: 'hourly',
    periodStart: candidate.hourlyRows[0]?.day ?? null,
    periodEnd: candidate.hourlyRows.at(-1)?.day ?? null,
    bestDayOfWeek: bestBlock.dayOfWeek,
    bestHourOfDay: bestBlock.startHour,
    bestHourRange: hourRange,
    averageMetric: pattern.averageMetric,
    impressions: bestBlock.impressions,
    clicks: bestBlock.clicks,
    linkClicks: prefersLinkClicks ? bestBlock.totalMetric : 0,
    spend: toFixedNumber(bestBlock.spend, 2),
    occurrenceCount: bestBlock.occurrences,
    confidenceGateReason:
      bestBlock.confidence === 'low' ? 'volume_below_confidence_threshold' : null,
  };

  return {
    pattern,
    finding: {
      businessId: '',
      platformIntegrationId: '',
      adAccountId: '',
      campaignId: candidate.campaignId,
      adsetId: candidate.adsetId,
      adId: null,
      findingType: 'best_time_window',
      severity: bestBlock.confidence === 'low' ? 'info' : 'warning',
      confidence: bestBlock.confidence,
      title:
        bestBlock.confidence === 'low'
          ? `Promising time window, limited delivery in ${candidate.adsetName}`
          : `Best recurring active time for ${candidate.adsetName}`,
      summary:
        bestBlock.confidence === 'low'
          ? `${formatDayLabel(bestBlock.dayOfWeek)} ${hourRange} looks efficient, but the recurring hourly sample is still thin.`
          : `${formatDayLabel(bestBlock.dayOfWeek)} ${hourRange} is the strongest recurring ${metricLabel.toLowerCase()} block for this live ad set.`,
      reason:
        bestBlock.confidence === 'low'
          ? 'Recurring timing signal exists, but the hourly volume is below the confidence gate.'
          : 'Advertiser-time hourly rows show a repeatable best-response block.',
      metricSnapshot,
      recommendedAction: buildFindingAction({
        type: 'best_time_window',
        platformIntegrationId: reportContext.platformIntegrationId,
        adAccountId: reportContext.adAccountId,
        adsetId: candidate.adsetId,
        adsetName: candidate.adsetName,
        campaignId: candidate.campaignId,
      }),
      snapshotHash: hashPayload(metricSnapshot),
      dedupeKey: `${candidate.adsetId}:best-time:${bestBlock.dayOfWeek}:${bestBlock.startHour}`,
      detectedAt: new Date().toISOString(),
    },
  };
}

function evaluateStaleLiveDeliveryFinding(
  candidate: AdsetCandidate,
  reportContext: {
    platformIntegrationId: string;
    adAccountId: string;
  }
): TrendFindingDraft | null {
  const recentRows = candidate.dailyRows.slice(-7);
  if (recentRows.length === 0) {
    return null;
  }

  const spend = recentRows.reduce((sum, row) => sum + row.spend, 0);
  const impressions = recentRows.reduce((sum, row) => sum + row.impressions, 0);
  const clicks = recentRows.reduce((sum, row) => sum + row.clicks, 0);
  const results = recentRows.reduce((sum, row) => sum + getResults(row), 0);

  const latestDay = recentRows.at(-1)?.day ?? candidate.lastDay;
  if (!latestDay) {
    return null;
  }

  const daysSinceLatest = daysBetween(latestDay, new Date().toISOString().slice(0, 10));
  const weakDelivery =
    spend >= 20 && (results === 0 || (clicks < 5 && impressions > 0) || computeCtr(clicks, impressions) < 0.6);

  if (!weakDelivery || daysSinceLatest > 5) {
    return null;
  }

  const severity: TrendFindingSeverity = spend >= 50 ? 'critical' : 'warning';
  const metricSnapshot: TrendFindingMetricSnapshot = {
    sourceWindow: 'daily',
    periodStart: recentRows[0]?.day ?? null,
    periodEnd: latestDay,
    spend: toFixedNumber(spend, 2),
    impressions,
    clicks,
    results,
    ctr: computeCtr(clicks, impressions),
    costPerResult: computeCostPerResult(spend, results),
  };

  return {
    businessId: '',
    platformIntegrationId: '',
    adAccountId: '',
    campaignId: candidate.campaignId,
    adsetId: candidate.adsetId,
    adId: null,
    findingType: 'stale_live_delivery',
    severity,
    confidence: spend >= 50 || impressions >= 1000 ? 'high' : 'medium',
    title: `Live delivery looks weak in ${candidate.adsetName}`,
    summary:
      results > 0
        ? 'Delivery is still live, but the recent result pace is weak relative to the spend being used.'
        : 'Delivery is still live, but recent spend is not producing enough customer signal.',
    reason: 'The ad set is active and spending recently, but current delivery quality looks weak.',
    metricSnapshot,
    recommendedAction: buildFindingAction({
      type: 'stale_live_delivery',
      platformIntegrationId: reportContext.platformIntegrationId,
      adAccountId: reportContext.adAccountId,
      adsetId: candidate.adsetId,
      adsetName: candidate.adsetName,
      campaignId: candidate.campaignId,
    }),
    snapshotHash: hashPayload(metricSnapshot),
    dedupeKey: `${candidate.adsetId}:stale-live-delivery`,
    detectedAt: new Date().toISOString(),
  };
}

function attachContext(
  draft: TrendFindingDraft,
  input: {
    businessId: string;
    platformIntegrationId: string;
    adAccountId: string;
  }
): TrendFindingDraft {
  return {
    ...draft,
    businessId: input.businessId,
    platformIntegrationId: input.platformIntegrationId,
    adAccountId: input.adAccountId,
  };
}

async function syncBestTimePatterns(
  supabase: IntelligenceClient,
  input: {
    businessId: string;
    patterns: BestTimePattern[];
  }
): Promise<number> {
  const payload = input.patterns
    .slice()
    .sort((left, right) => right.averageMetric - left.averageMetric)
    .slice(0, 5)
    .map((pattern) => ({
      adsetId: pattern.adsetId,
      adsetName: pattern.adsetName,
      dayOfWeek: pattern.dayOfWeek,
      dayLabel: formatDayLabel(pattern.dayOfWeek),
      hourOfDay: pattern.hourOfDay,
      hourRange: pattern.hourRange,
      metricLabel: pattern.metricLabel,
      averageMetric: pattern.averageMetric,
      totalMetric: pattern.totalMetric,
      occurrences: pattern.occurrences,
      confidence: pattern.confidence,
    }));

  const timestamp = new Date().toISOString();
  const { data: existing, error: existingError } = await (supabase as any)
    .schema('ai')
    .from('business_agent_profiles')
    .select('id')
    .eq('business_id', input.businessId)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existing?.id) {
    const { error } = await (supabase as any)
      .schema('ai')
      .from('business_agent_profiles')
      .update({
        best_time_patterns_json: payload,
        last_learning_update_at: timestamp,
        updated_at: timestamp,
      })
      .eq('id', existing.id);

    if (error) {
      throw error;
    }

    return payload.length;
  }

  const { error } = await (supabase as any)
    .schema('ai')
    .from('business_agent_profiles')
    .insert({
      business_id: input.businessId,
      best_time_patterns_json: payload,
      last_learning_update_at: timestamp,
      updated_at: timestamp,
    });

  if (error) {
    throw error;
  }

  return payload.length;
}

async function listBusinessRecipientContexts(
  supabase: IntelligenceClient,
  input: {
    businessId: string;
  }
): Promise<RecipientContext[]> {
  const { data: businessProfile, error: businessError } = await supabase
    .from('business_profiles')
    .select('organization_id')
    .eq('id', input.businessId)
    .maybeSingle();

  if (businessError) {
    throw businessError;
  }

  const organizationId = businessProfile?.organization_id;
  if (!organizationId) {
    return [];
  }

  const { data: memberships, error: membershipError } = await supabase
    .from('organization_memberships')
    .select('user_id')
    .eq('organization_id', organizationId);

  if (membershipError) {
    throw membershipError;
  }

  const userIds = Array.from(
    new Set(((memberships ?? []) as Array<{ user_id: string }>).map((row) => row.user_id))
  );

  if (userIds.length === 0) {
    return [];
  }

  const preferences = await listNotificationPreferencesForBusiness(supabase, {
    businessId: input.businessId,
    userIds,
  });
  const preferencesByUserId = new Map(preferences.map((item) => [item.userId, item]));

  return Promise.all(
    userIds.map(async (userId) => {
      const notificationPreference =
        preferencesByUserId.get(userId) ??
        buildDefaultNotificationPreference({
          businessId: input.businessId,
          userId,
        });
      const reportSubscription = await getReportSubscription(supabase, {
        businessId: input.businessId,
        userId,
      });

      return {
        userId,
        notificationPreference,
        reportSubscription,
      };
    })
  );
}

async function syncFindingNotifications(
  supabase: IntelligenceClient,
  input: {
    businessId: string;
    adAccountId: string;
    findings: TrendFinding[];
  }
): Promise<TrendFindingNotificationSummary[]> {
  const recipients = await listBusinessRecipientContexts(supabase, {
    businessId: input.businessId,
  });

  if (recipients.length === 0) {
    return [];
  }

  const summaries: TrendFindingNotificationSummary[] = [];

  for (const finding of input.findings) {
    if (finding.status !== 'active') {
      continue;
    }

    if (finding.confidence === 'low' && finding.severity === 'info') {
      continue;
    }

    let notificationCount = 0;
    let emailQueuedCount = 0;

    for (const recipient of recipients) {
      if (!meetsSeverityThreshold(finding.severity, recipient.notificationPreference.minSeverity)) {
        continue;
      }

      const inAppDedupeKey = `trend-finding:${finding.dedupeKey}`;

      if (recipient.notificationPreference.inAppEnabled) {
        await upsertNotification(supabase, {
          businessId: input.businessId,
          userId: recipient.userId,
          sourceType: 'trend_finding',
          sourceId: finding.id,
          dedupeKey: inAppDedupeKey,
          severity: finding.severity,
          type: 'insight',
          title: finding.title,
          message: finding.summary,
          link:
            finding.recommendedAction?.reportHref ??
            finding.recommendedAction?.href ??
            '/dashboard',
          payload: {
            findingId: finding.id,
            adAccountId: input.adAccountId,
          },
        });
        await createOrUpdateDeliveryLog(supabase, {
          businessId: input.businessId,
          userId: recipient.userId,
          channel: 'in_app',
          sourceType: 'trend_finding',
          sourceId: finding.id,
          dedupeKey: inAppDedupeKey,
          status: 'sent',
          sentAt: new Date().toISOString(),
        });
        notificationCount += 1;
      }

      if (recipient.notificationPreference.emailEnabled) {
        const emailDedupeKey = `email:trend-finding:${finding.dedupeKey}`;
        await createOrUpdateDeliveryLog(supabase, {
          businessId: input.businessId,
          userId: recipient.userId,
          channel: 'email',
          sourceType: 'trend_finding',
          sourceId: finding.id,
          dedupeKey: emailDedupeKey,
          status: 'queued',
          payload: {
            title: finding.title,
            summary: finding.summary,
            findingId: finding.id,
          },
        });
        emailQueuedCount += 1;
      }

      if (
        recipient.notificationPreference.reportReadyEnabled &&
        recipient.reportSubscription.isEnabled &&
        recipient.reportSubscription.inAppEnabled &&
        finding.severity !== 'info'
      ) {
        const reportReadyDedupeKey = `report-ready:${input.adAccountId}:${new Date()
          .toISOString()
          .slice(0, 10)}`;
        await upsertNotification(supabase, {
          businessId: input.businessId,
          userId: recipient.userId,
          sourceType: 'report_ready',
          sourceId: finding.id,
          dedupeKey: reportReadyDedupeKey,
          severity: finding.severity,
          type: 'report',
          title: 'Report ready for review',
          message: `DeepVisor found a meaningful change in the selected Meta account. Review the updated report and decide whether to act.`,
          link: finding.recommendedAction?.reportHref ?? '/reports',
          payload: {
            findingId: finding.id,
            cadence: recipient.reportSubscription.cadence,
          },
        });
      }
    }

    summaries.push({
      findingId: finding.id,
      notificationCount,
      emailQueuedCount,
    });
  }

  return summaries;
}

export async function evaluateMetaTrendFindingsForAdAccount(
  supabase: IntelligenceClient,
  input: {
    businessId: string;
    platformIntegrationId: string;
    adAccountId: string;
  }
): Promise<{
  drafts: TrendFindingDraft[];
  patterns: BestTimePattern[];
}> {
  const candidates = await loadAdsetCandidates(supabase, {
    adAccountId: input.adAccountId,
  });

  const drafts: TrendFindingDraft[] = [];
  const patterns: BestTimePattern[] = [];

  for (const candidate of candidates) {
    const bestTime = evaluateBestTimeFinding(candidate, {
      platformIntegrationId: input.platformIntegrationId,
      adAccountId: input.adAccountId,
    });
    if (bestTime.pattern) {
      patterns.push(bestTime.pattern);
    }

    const dailyFinding = evaluateDailyTrendFinding(candidate, {
      platformIntegrationId: input.platformIntegrationId,
      adAccountId: input.adAccountId,
    });
    const staleFinding = evaluateStaleLiveDeliveryFinding(candidate, {
      platformIntegrationId: input.platformIntegrationId,
      adAccountId: input.adAccountId,
    });

    for (const finding of [bestTime.finding, dailyFinding, staleFinding]) {
      if (!finding) {
        continue;
      }

      drafts.push(
        attachContext(finding, {
          businessId: input.businessId,
          platformIntegrationId: input.platformIntegrationId,
          adAccountId: input.adAccountId,
        })
      );
    }
  }

  return { drafts, patterns };
}

export async function syncMetaTrendIntelligenceArtifacts(input: {
  supabase: IntelligenceClient;
  businessId: string;
  platformIntegrationId: string;
  adAccountId: string;
}): Promise<MetaTrendIntelligenceArtifacts> {
  const { drafts, patterns } = await evaluateMetaTrendFindingsForAdAccount(input.supabase, {
    businessId: input.businessId,
    platformIntegrationId: input.platformIntegrationId,
    adAccountId: input.adAccountId,
  });
  const findings = await syncTrendFindings(input.supabase, {
    businessId: input.businessId,
    adAccountId: input.adAccountId,
    drafts,
  });
  const notificationSummary = await syncFindingNotifications(input.supabase, {
    businessId: input.businessId,
    adAccountId: input.adAccountId,
    findings,
  });
  const patternCount = await syncBestTimePatterns(input.supabase, {
    businessId: input.businessId,
    patterns,
  });

  return {
    findings,
    notificationSummary,
    patternCount,
  };
}
