import { asNumber, asRecord } from '@/lib/shared';
import type {
  AdAccountAggregatedMetrics,
  AdAccountDailyMetricsRow,
  AdAccountPerformanceSummary,
  AdAccountTimeIncrementMetrics,
  AdAccountTimeIncrementPoint,
} from '../types';

const ZERO_METRICS: AdAccountAggregatedMetrics = {
  spend: 0,
  impressions: 0,
  clicks: 0,
  link_clicks: 0,
  reach: 0,
  leads: 0,
  messages: 0,
  calls: 0,
  ctr: 0,
  cpc: 0,
  cpm: 0,
};

export type { AdAccountDailyMetricsRow } from '../types';

export function parseAggregatedMetrics(value: unknown): AdAccountAggregatedMetrics {
  const metrics = asRecord(value);

  const spend = asNumber(metrics.spend);
  const impressions = asNumber(metrics.impressions);
  const clicks = asNumber(metrics.clicks);

  return {
    spend,
    impressions,
    clicks,
    link_clicks: asNumber(metrics.link_clicks ?? metrics.inline_link_clicks),
    reach: asNumber(metrics.reach),
    leads: asNumber(metrics.leads),
    messages: asNumber(metrics.messages),
    calls: asNumber(metrics.calls),
    ctr: asNumber(metrics.ctr) || (impressions > 0 ? (clicks / impressions) * 100 : 0),
    cpc: asNumber(metrics.cpc) || (clicks > 0 ? spend / clicks : 0),
    cpm: asNumber(metrics.cpm) || (impressions > 0 ? spend / (impressions / 1000) : 0),
  };
}

function parseTimePoint(value: unknown): AdAccountTimeIncrementPoint {
  const row = asRecord(value);
  const spend = asNumber(row.spend);
  const impressions = asNumber(row.impressions);
  const clicks = asNumber(row.clicks);

  return {
    date_start: typeof row.date_start === 'string' ? row.date_start : null,
    date_stop: typeof row.date_stop === 'string' ? row.date_stop : null,
    spend,
    impressions,
    clicks,
    link_clicks: asNumber(row.link_clicks ?? row.inline_link_clicks),
    reach: asNumber(row.reach),
    leads: asNumber(row.leads),
    messages: asNumber(row.messages),
    calls: asNumber(row.calls),
    ctr: asNumber(row.ctr) || (impressions > 0 ? (clicks / impressions) * 100 : 0),
    cpc: asNumber(row.cpc) || (clicks > 0 ? spend / clicks : 0),
    cpm: asNumber(row.cpm) || (impressions > 0 ? spend / (impressions / 1000) : 0),
  };
}

function parseTimeBucket(value: unknown): AdAccountTimeIncrementPoint[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map(parseTimePoint);
}

export function parseTimeIncrementMetrics(value: unknown): AdAccountTimeIncrementMetrics {
  const raw = asRecord(value);
  const metrics: AdAccountTimeIncrementMetrics = {
    '1': parseTimeBucket(raw['1']),
    '7': parseTimeBucket(raw['7']),
    '30': parseTimeBucket(raw['30']),
  };

  for (const [key, bucketValue] of Object.entries(raw)) {
    if (key === '1' || key === '7' || key === '30') {
      continue;
    }

    metrics[key] = parseTimeBucket(bucketValue);
  }

  return metrics;
}

function sortDailyRows(rows: AdAccountDailyMetricsRow[]): AdAccountDailyMetricsRow[] {
  return [...rows].sort((left, right) => left.day.localeCompare(right.day));
}

export function aggregateDailyMetricsRows(
  rows: AdAccountDailyMetricsRow[]
): AdAccountPerformanceSummary {
  if (rows.length === 0) {
    return { ...ZERO_METRICS };
  }

  let spend = 0;
  let impressions = 0;
  let clicks = 0;
  let linkClicks = 0;
  let reach = 0;
  let leads = 0;
  let messages = 0;
  let calls = 0;

  for (const row of rows) {
    spend += row.spend;
    impressions += row.impressions;
    clicks += row.clicks;
    linkClicks += row.inline_link_clicks;
    reach += row.reach;
    leads += row.leads;
    messages += row.messages;
    calls += row.calls ?? 0;
  }

  return {
    spend,
    impressions,
    clicks,
    link_clicks: linkClicks,
    reach,
    leads,
    messages,
    calls,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    cpc: clicks > 0 ? spend / clicks : 0,
    cpm: impressions > 0 ? spend / (impressions / 1000) : 0,
  };
}

export function sumAggregatedMetrics(
  metrics: AdAccountAggregatedMetrics[]
): AdAccountAggregatedMetrics {
  return sumPerformanceSummaries(metrics);
}

export function sumPerformanceSummaries(
  metrics: AdAccountPerformanceSummary[]
): AdAccountPerformanceSummary {
  if (metrics.length === 0) {
    return { ...ZERO_METRICS };
  }

  let spend = 0;
  let impressions = 0;
  let clicks = 0;
  let linkClicks = 0;
  let reach = 0;
  let leads = 0;
  let messages = 0;
  let calls = 0;

  for (const metric of metrics) {
    spend += metric.spend;
    impressions += metric.impressions;
    clicks += metric.clicks;
    linkClicks += metric.link_clicks;
    reach += metric.reach;
    leads += metric.leads;
    messages += metric.messages;
    calls += metric.calls ?? 0;
  }

  return {
    spend,
    impressions,
    clicks,
    link_clicks: linkClicks,
    reach,
    leads,
    messages,
    calls,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    cpc: clicks > 0 ? spend / clicks : 0,
    cpm: impressions > 0 ? spend / (impressions / 1000) : 0,
  };
}

export function hasMeaningfulMetrics(metrics: AdAccountAggregatedMetrics): boolean {
  return (
    metrics.spend > 0 ||
    metrics.impressions > 0 ||
    metrics.clicks > 0 ||
    metrics.link_clicks > 0 ||
    metrics.reach > 0 ||
    metrics.leads > 0 ||
    metrics.messages > 0 ||
    (metrics.calls ?? 0) > 0
  );
}

export function hasMeaningfulPerformance(
  metrics: AdAccountPerformanceSummary
): boolean {
  return hasMeaningfulMetrics(metrics);
}

export function sortAndAggregateDailyMetricsRows(
  rows: AdAccountDailyMetricsRow[]
): {
  dailyRows: AdAccountDailyMetricsRow[];
  summary: AdAccountPerformanceSummary;
} {
  const dailyRows = sortDailyRows(rows);

  return {
    dailyRows,
    summary: aggregateDailyMetricsRows(dailyRows),
  };
}

export function parseDailyMetricsRowsFromTimeIncrementMetrics(
  value: unknown,
  input?: { currencyCode?: string | null }
): AdAccountDailyMetricsRow[] {
  return parseTimeIncrementMetrics(value)['1']
    .map((point) => ({
      day: point.date_stop ?? point.date_start ?? '',
      spend: point.spend,
      reach: point.reach,
      impressions: point.impressions,
      clicks: point.clicks,
      inline_link_clicks: point.link_clicks,
      leads: point.leads,
      messages: point.messages,
      calls: point.calls ?? 0,
      currency_code: input?.currencyCode ?? null,
    }))
    .filter((row) => row.day.length > 0)
    .sort((left, right) => left.day.localeCompare(right.day));
}

function toTimeIncrementPoint(
  rows: AdAccountDailyMetricsRow[]
): AdAccountTimeIncrementPoint | null {
  if (rows.length === 0) {
    return null;
  }

  const summary = aggregateDailyMetricsRows(rows);

  return {
    date_start: rows[0]?.day ?? null,
    date_stop: rows[rows.length - 1]?.day ?? null,
    spend: summary.spend,
    impressions: summary.impressions,
    clicks: summary.clicks,
    link_clicks: summary.link_clicks,
    reach: summary.reach,
    leads: summary.leads,
    messages: summary.messages,
    calls: summary.calls ?? 0,
    ctr: summary.ctr,
    cpc: summary.cpc,
    cpm: summary.cpm,
  };
}

function buildBucket(
  rows: AdAccountDailyMetricsRow[],
  size: number
): AdAccountTimeIncrementPoint[] {
  const points: AdAccountTimeIncrementPoint[] = [];

  for (let index = 0; index < rows.length; index += size) {
    const point = toTimeIncrementPoint(rows.slice(index, index + size));
    if (point) {
      points.push(point);
    }
  }

  return points;
}

export function buildTimeIncrementMetricsFromDailyRows(
  rows: AdAccountDailyMetricsRow[]
): AdAccountTimeIncrementMetrics {
  const dailyRows = sortDailyRows(rows);

  return {
    '1': dailyRows.map((row) => ({
      date_start: row.day,
      date_stop: row.day,
      spend: row.spend,
      impressions: row.impressions,
      clicks: row.clicks,
      link_clicks: row.inline_link_clicks,
      reach: row.reach,
      leads: row.leads,
      messages: row.messages,
      calls: row.calls ?? 0,
      ctr: row.impressions > 0 ? (row.clicks / row.impressions) * 100 : 0,
      cpc: row.clicks > 0 ? row.spend / row.clicks : 0,
      cpm: row.impressions > 0 ? row.spend / (row.impressions / 1000) : 0,
    })),
    '7': buildBucket(dailyRows, 7),
    '30': buildBucket(dailyRows, 30),
  };
}
