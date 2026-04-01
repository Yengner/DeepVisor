import { asNumber, asRecord } from '@/lib/shared';
import type {
  AdAccountAggregatedMetrics,
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
  ctr: 0,
  cpc: 0,
  cpm: 0,
};

export function parseAggregatedMetrics(value: unknown): AdAccountAggregatedMetrics {
  const metrics = asRecord(value);

  const spend = asNumber(metrics.spend);
  const impressions = asNumber(metrics.impressions);
  const clicks = asNumber(metrics.clicks);

  const ctr = asNumber(metrics.ctr) || (impressions > 0 ? (clicks / impressions) * 100 : 0);
  const cpc = asNumber(metrics.cpc) || (clicks > 0 ? spend / clicks : 0);
  const cpm =
    asNumber(metrics.cpm) || (impressions > 0 ? spend / (impressions / 1000) : 0);

  return {
    spend,
    impressions,
    clicks,
    link_clicks: asNumber(metrics.link_clicks ?? metrics.inline_link_clicks),
    reach: asNumber(metrics.reach),
    leads: asNumber(metrics.leads),
    messages: asNumber(metrics.messages),
    ctr,
    cpc,
    cpm,
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

export interface AdAccountDailyMetricsRow {
  day: string;
  spend: number;
  reach: number;
  impressions: number;
  clicks: number;
  inline_link_clicks: number;
  leads: number;
  messages: number;
  currency_code: string | null;
}

function sortDailyRows(rows: AdAccountDailyMetricsRow[]): AdAccountDailyMetricsRow[] {
  return [...rows].sort((left, right) => left.day.localeCompare(right.day));
}

function toTimeIncrementPoint(rows: AdAccountDailyMetricsRow[]): AdAccountTimeIncrementPoint {
  const spend = rows.reduce((total, row) => total + row.spend, 0);
  const reach = rows.reduce((total, row) => total + row.reach, 0);
  const impressions = rows.reduce((total, row) => total + row.impressions, 0);
  const clicks = rows.reduce((total, row) => total + row.clicks, 0);
  const linkClicks = rows.reduce((total, row) => total + row.inline_link_clicks, 0);
  const leads = rows.reduce((total, row) => total + row.leads, 0);
  const messages = rows.reduce((total, row) => total + row.messages, 0);

  return {
    date_start: rows[0]?.day ?? null,
    date_stop: rows[rows.length - 1]?.day ?? null,
    spend,
    impressions,
    clicks,
    link_clicks: linkClicks,
    reach,
    leads,
    messages,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    cpc: clicks > 0 ? spend / clicks : 0,
    cpm: impressions > 0 ? spend / (impressions / 1000) : 0,
  };
}

export function parseDailyMetricsRowsFromTimeIncrementMetrics(
  value: unknown,
  input?: { currencyCode?: string | null }
): AdAccountDailyMetricsRow[] {
  const metrics = parseTimeIncrementMetrics(value);
  const rowsByDay = new Map<string, AdAccountDailyMetricsRow>();

  for (const point of metrics['1']) {
    const day = point.date_start ?? point.date_stop;
    if (!day) {
      continue;
    }

    rowsByDay.set(day, {
      day,
      spend: point.spend,
      reach: point.reach,
      impressions: point.impressions,
      clicks: point.clicks,
      inline_link_clicks: point.link_clicks,
      leads: point.leads,
      messages: point.messages,
      currency_code: input?.currencyCode ?? null,
    });
  }

  return sortDailyRows(Array.from(rowsByDay.values()));
}

export function aggregateDailyMetricsRows(
  rows: AdAccountDailyMetricsRow[]
): AdAccountAggregatedMetrics {
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

  for (const row of rows) {
    spend += row.spend;
    impressions += row.impressions;
    clicks += row.clicks;
    linkClicks += row.inline_link_clicks;
    reach += row.reach;
    leads += row.leads;
    messages += row.messages;
  }

  return {
    spend,
    impressions,
    clicks,
    link_clicks: linkClicks,
    reach,
    leads,
    messages,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    cpc: clicks > 0 ? spend / clicks : 0,
    cpm: impressions > 0 ? spend / (impressions / 1000) : 0,
  };
}

export function buildTimeIncrementMetricsFromDailyRows(
  rows: AdAccountDailyMetricsRow[]
): AdAccountTimeIncrementMetrics {
  const sortedRows = sortDailyRows(rows);

  const buildBuckets = (windowSize: number): AdAccountTimeIncrementPoint[] => {
    const buckets: AdAccountTimeIncrementPoint[] = [];

    for (let index = 0; index < sortedRows.length; index += windowSize) {
      const bucketRows = sortedRows.slice(index, index + windowSize);
      if (bucketRows.length === 0) {
        continue;
      }

      buckets.push(toTimeIncrementPoint(bucketRows));
    }

    return buckets;
  };

  return {
    '1': sortedRows.map((row) => toTimeIncrementPoint([row])),
    '7': buildBuckets(7),
    '30': buildBuckets(30),
  };
}

export function sumAggregatedMetrics(metrics: AdAccountAggregatedMetrics[]): AdAccountAggregatedMetrics {
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

  for (const metric of metrics) {
    spend += metric.spend;
    impressions += metric.impressions;
    clicks += metric.clicks;
    linkClicks += metric.link_clicks;
    reach += metric.reach;
    leads += metric.leads;
    messages += metric.messages;
  }

  return {
    spend,
    impressions,
    clicks,
    link_clicks: linkClicks,
    reach,
    leads,
    messages,
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
    metrics.messages > 0
  );
}
