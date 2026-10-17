import type { SyncCoverage } from '@/lib/shared/types/integrations';
import type {
  DashboardAudienceBreakdowns,
  DashboardPlatformBreakdowns,
  DashboardTrendPoint,
} from '@/lib/server/dashboard/types';
import type { TrendFindingView } from '@/lib/server/intelligence/types';

export type ReportScope = 'business' | 'platform' | 'ad_account' | 'campaign' | 'adset' | 'ad';

export type ReportGroupBy = 'day' | 'week' | 'month';

export type ReportCompareMode = 'none' | 'previous_period';

export type ReportRangeMode = 'date_range' | 'max';

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
  rangeMode?: ReportRangeMode;
  /** Resolved against authorized account timezone by the loader. */
  presetDays?: 7 | 30 | 90;
}

export type ReportMetricKey =
  | "spend" | "reach" | "impressions" | "clicks" | "linkClicks"
  | "leads" | "messages" | "calls" | "conversion" | "conversionRate"
  | "costPerResult" | "ctr" | "cpc" | "cpm" | "frequency";
export type ReportMetricAvailability = Partial<Record<ReportMetricKey, string>>;
export interface ReportCoverage {
  state: "available" | "partial" | "mixed" | "unknown" | "empty" | "error";
  basis: "period" | "snapshot";
  dateFrom: string | null;
  dateTo: string | null;
  windows?: Array<{ dateFrom: string; dateTo: string }>;
  observedDays?: number;
  expectedDays?: number;
}

export interface ReportMetricTotals {
  unavailable?: ReportMetricAvailability;
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
  deltaUnit?: "percent" | "percentage_points";
  direction?: "favorable" | "unfavorable" | "neutral";
  unavailableReason?: string;
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
  creativePreview?: { image: string | null; fallbackImages?: string[]; fallbackImage?: string | null; kind: 'image' | 'video' | 'carousel' | 'dynamic' } | null;
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
  topAdAccountCampaigns: ReportBreakdownRow[];
  sameCampaignAdsets: ReportBreakdownRow[];
  topAdAccountAdsets: ReportBreakdownRow[];
  sameAdsetAds: ReportBreakdownRow[];
  topAdAccountAds: ReportBreakdownRow[];
}

export interface ReportActiveDatePoint {
  date: string;
  activeEntityCount: number;
}

export interface ReportActiveDateContext {
  scope: 'campaign' | 'adset' | 'ad';
  label: string;
  entityLabel: string;
  totalEntities: number;
  totalActiveDays: number;
  startDate: string | null;
  endDate: string | null;
  days: ReportActiveDatePoint[];
}

export interface ReportComparisonSummary {
  previousDateFrom: string | null;
  previousDateTo: string | null;
  previousTotals: ReportMetricTotals | null;
  previousSeries?: ReportTimeSeriesPoint[];
  disabledReason?: string | null;
  coverage?: ReportCoverage;
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

export interface ReportSnapshotMeasurement {
  entityId: string | null;
  entityLevel: 'adset' | 'ad';
  breakdownType: string;
  dimension1: { key: string; value: string };
  dimension2: { key: string; value: string };
  dateFrom: string | null;
  dateTo: string | null;
  currencyCode: string | null;
  values: Partial<Record<ReportMetricKey, number | null>>;
}
export interface ReportSurfaceContext {
  measurements?: ReportSnapshotMeasurement[];
  isMeta: boolean;
  platformBreakdowns: DashboardPlatformBreakdowns;
  audienceBreakdowns: DashboardAudienceBreakdowns;
  hourlyTrendExpanded: DashboardTrendPoint[];
  coverage?: Record<string, ReportCoverage>;
  unavailableMetrics?: Record<string, ReportMetricAvailability>;
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
    timezone?: string | null;
    today?: string | null;
    partialDay?: boolean;
    warnings?: string[];
    coverage?: ReportCoverage;
    comparisonDisabledReason?: string | null;
  };
  summary: ReportMetricTotals;
  kpis: ReportKpi[];
  series: ReportTimeSeriesPoint[];
  comparison: ReportComparisonSummary;
  findings: TrendFindingView[];
  breakdown: {
    title: string;
    rows: ReportBreakdownRow[];
    chart: ReportBreakdownChartPoint[];
  };
  ranking: ReportRankingContext;
  activeDates: ReportActiveDateContext | null;
  surface: ReportSurfaceContext;
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
