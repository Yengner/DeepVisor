import type {
  AdAccountAggregatedMetrics,
  AdAccountTimeIncrementMetrics,
  AdAccountTimeIncrementPoint,
  PlatformIntegrationStatus,
  SupportedPlatformVendor,
} from '../types';

const SUPPORTED_VENDORS = new Set<SupportedPlatformVendor>(['meta', 'google', 'tiktok']);
const SUPPORTED_INTEGRATION_STATUSES = new Set<PlatformIntegrationStatus>([
  'connected',
  'disconnected',
  'needs_reauth',
  'error',
]);

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

function asNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
}

export function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

export function toSupportedVendor(value: unknown): SupportedPlatformVendor {
  if (typeof value === 'string' && SUPPORTED_VENDORS.has(value as SupportedPlatformVendor)) {
    return value as SupportedPlatformVendor;
  }

  return 'meta';
}

export function toIntegrationStatus(value: unknown): PlatformIntegrationStatus {
  if (typeof value === 'string' && SUPPORTED_INTEGRATION_STATUSES.has(value as PlatformIntegrationStatus)) {
    return value as PlatformIntegrationStatus;
  }

  return 'disconnected';
}

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
