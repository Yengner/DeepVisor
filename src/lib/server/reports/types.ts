import type { SyncCoverage } from '@/lib/shared/types/integrations';

export type ReportScope = 'business' | 'platform' | 'ad_account' | 'campaign' | 'adset' | 'ad';

export type ReportGroupBy = 'day' | 'week' | 'month';

export type ReportCompareMode = 'none' | 'previous_period';

export interface ReportQueryInput {
  businessId: string;
  scope: ReportScope;
  platformIntegrationId?: string | null;
  adAccountIds: string[];
  campaignIds: string[];
  adsetIds: string[];
  adIds: string[];
  dateFrom: string;
  dateTo: string;
  groupBy: ReportGroupBy;
  compareMode: ReportCompareMode;
}

export interface ReportMetricTotals {
  spend: number;
  reach: number;
  impressions: number;
  clicks: number;
  linkClicks: number;
  leads: number;
  messages: number;
  calls: number;
  conversion: number;
  conversionRate: number;
  costPerResult: number;
  ctr: number;
  cpc: number;
  cpm: number;
  frequency: number;
}

export interface ReportKpi {
  key:
    | 'spend'
    | 'conversion'
    | 'impressions'
    | 'clicks'
    | 'ctr'
    | 'cpc'
    | 'cpm'
    | 'costPerResult';
  label: string;
  value: number;
  formattedValue: string;
  deltaPercent: number | null;
}

export interface ReportTimeSeriesPoint extends ReportMetricTotals {
  key: string;
  label: string;
  startDate: string;
  endDate: string;
}

export interface ReportBreakdownRow extends ReportMetricTotals {
  id: string;
  name: string;
  level: 'campaign' | 'adset' | 'ad';
  status: string | null;
  primaryContext: string | null;
  secondaryContext: string | null;
  creativeContext?: string | null;
  drilldownLabel?: string | null;
  drilldownHref?: string | null;
  startDate: string | null;
  endDate: string | null;
}

export interface ReportBreakdownChartPoint {
  id: string;
  label: string;
  spend: number;
  conversion: number;
  clicks: number;
}

export interface ReportRankingContext {
  sameAdsetAds: ReportBreakdownRow[];
  topAdAccountAds: ReportBreakdownRow[];
}

export interface ReportComparisonSummary {
  previousDateFrom: string | null;
  previousDateTo: string | null;
  previousTotals: ReportMetricTotals | null;
}

export interface ReportExportMetadata {
  title: string;
  subtitle: string;
  generatedAt: string;
  filterSummary: Array<{
    label: string;
    value: string;
  }>;
}

export interface ReportPayload {
  query: ReportQueryInput;
  meta: {
    businessName: string;
    title: string;
    subtitle: string;
    scopeLabel: string;
    currencyCode: string | null;
    generatedAt: string;
    syncCoverage?: SyncCoverage | null;
  };
  summary: ReportMetricTotals;
  kpis: ReportKpi[];
  series: ReportTimeSeriesPoint[];
  comparison: ReportComparisonSummary;
  breakdown: {
    title: string;
    rows: ReportBreakdownRow[];
    chart: ReportBreakdownChartPoint[];
  };
  ranking: ReportRankingContext;
  export: ReportExportMetadata;
}

export interface ReportFilterOption {
  id: string;
  label: string;
  parentId: string | null;
}

export interface ReportFilterOptions {
  platforms: ReportFilterOption[];
  adAccounts: ReportFilterOption[];
  campaigns: ReportFilterOption[];
  adsets: ReportFilterOption[];
  ads: ReportFilterOption[];
}
