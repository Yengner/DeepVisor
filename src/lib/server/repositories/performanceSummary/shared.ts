import { derivePerformanceMetrics } from '../campaigns/normalizers';

export const PERFORMANCE_SUMMARY_SOURCE = 'daily_rollup';
export const PERFORMANCE_SUMMARY_HISTORY_STATUS = 'full';

export interface PerformanceSummaryDailyRow {
  day: string;
  spend: number | null;
  reach: number | null;
  impressions: number | null;
  clicks: number | null;
  inline_link_clicks: number | null;
  leads: number | null;
  messages: number | null;
  calls?: number | null;
}

export interface PerformanceSummaryTotals {
  spend: number;
  reach: number;
  impressions: number;
  clicks: number;
  inlineLinkClicks: number;
  leads: number;
  messages: number;
  calls: number;
  firstDay: string | null;
  lastDay: string | null;
  rowCount: number;
}

export function aggregatePerformanceSummaryRows(
  rows: PerformanceSummaryDailyRow[]
): PerformanceSummaryTotals {
  return rows.reduce<PerformanceSummaryTotals>(
    (totals, row) => {
      totals.spend += row.spend ?? 0;
      totals.reach += row.reach ?? 0;
      totals.impressions += row.impressions ?? 0;
      totals.clicks += row.clicks ?? 0;
      totals.inlineLinkClicks += row.inline_link_clicks ?? 0;
      totals.leads += row.leads ?? 0;
      totals.messages += row.messages ?? 0;
      totals.calls += row.calls ?? 0;
      totals.firstDay = totals.firstDay === null || row.day < totals.firstDay ? row.day : totals.firstDay;
      totals.lastDay = totals.lastDay === null || row.day > totals.lastDay ? row.day : totals.lastDay;
      totals.rowCount += 1;

      return totals;
    },
    {
      spend: 0,
      reach: 0,
      impressions: 0,
      clicks: 0,
      inlineLinkClicks: 0,
      leads: 0,
      messages: 0,
      calls: 0,
      firstDay: null,
      lastDay: null,
      rowCount: 0,
    }
  );
}

export function deriveSummaryMetricFields(totals: PerformanceSummaryTotals) {
  return derivePerformanceMetrics({
    spend: totals.spend,
    reach: totals.reach,
    impressions: totals.impressions,
    clicks: totals.clicks,
    leads: totals.leads,
    messages: totals.messages,
  });
}
