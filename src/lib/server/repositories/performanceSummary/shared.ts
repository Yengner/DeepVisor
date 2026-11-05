export type PerformanceSummarySource =
  | 'lifetime_snapshot'
  | 'aggregated_daily'
  | 'mixed';

export type PerformanceSummaryHistoryStatus =
  | 'not_started'
  | 'partial'
  | 'complete';

// These summary rows are rebuilt from stored daily facts, so they represent
// an aggregated daily rollup that is complete at the time of the sync.
export const PERFORMANCE_SUMMARY_SOURCE: PerformanceSummarySource = 'aggregated_daily';
export const PERFORMANCE_SUMMARY_HISTORY_STATUS: PerformanceSummaryHistoryStatus = 'complete';

// Compatibility exports: calculations are owned by the shared performance domain.
export { aggregatePerformanceSummaryRows, deriveSummaryMetricFields } from '@/lib/shared/performance/summary';
export type { PerformanceSummaryDailyRow, PerformanceSummaryTotals } from '@/lib/shared/performance/summary';
