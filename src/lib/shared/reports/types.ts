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

