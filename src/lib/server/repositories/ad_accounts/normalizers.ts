
import type { AdAccountAggregatedMetrics, AdAccountDailyMetricsRow, AdAccountPerformanceSummary } from '../types';

const ZERO_METRICS: AdAccountAggregatedMetrics = {
  spend: 0,
  impressions: 0,
  clicks: 0,
  link_clicks: 0,
  reach: null,
  leads: 0,
  messages: 0,
  calls: 0,
  ctr: null,
  cpc: null,
  cpm: null,
};

export type { AdAccountDailyMetricsRow } from '../types';

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

  let leads = 0;
  let messages = 0;
  let calls = 0;

  for (const row of rows) {
    spend += row.spend;
    impressions += row.impressions;
    clicks += row.clicks;
    linkClicks += row.inline_link_clicks;

    leads += row.leads;
    messages += row.messages;
    calls += row.calls ?? 0;
  }

  return {
    spend,
    impressions,
    clicks,
    link_clicks: linkClicks,
    reach: null,
    leads,
    messages,
    calls,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : null,
    cpc: clicks > 0 ? spend / clicks : null,
    cpm: impressions > 0 ? spend / (impressions / 1000) : null,
  };
}

export function hasMeaningfulMetrics(metrics: AdAccountAggregatedMetrics): boolean {
  return (
    metrics.spend > 0 ||
    metrics.impressions > 0 ||
    metrics.clicks > 0 ||
    metrics.link_clicks > 0 ||
    (metrics.reach ?? 0) > 0 ||
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
