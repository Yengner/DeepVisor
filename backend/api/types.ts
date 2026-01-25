
export interface AccountInfo {
  balance: number;
  todaySpend: number;
  name: string;
  currency: string;
  spendCap: number;
  lifetimeSpend: number;
  accountStatus: string;
  totalCampaigns: number;
  insights?: {
    clicks: number;
    linkClicks: number;
    postEngagement: number;
  };
};

export interface InsightAction {
  action_type: string;
  value: string | number;
}

export interface InsightEntry {
  clicks?: string;
  spend?: string;
  balance?: string;
  name?: string;
  currency?: string;
  spend_cap?: string;
  amount_spent?: string;
  account_status?: string;
  actions?: InsightAction[];
  date_start?: string;
  date_stop?: string;
}

export interface FacebookInsightsResponse {
  data: InsightEntry[]; // Reflects the actual structure of the API response
}

//TopCampaigns.ts
export interface CampaignMetric {
  id: string;
  name: string;
  status: string;
  start_time: string | null;
  stop_time: string | null;
  impressions: number;
  clicks: number;
  spend: number;
  leads: number;
  messages: number;
}

//Metrics.ts
export interface Action {
  action_type: string;
  value: number;
};

export interface MetricEntry {
  impressions: number;
  clicks: number;
  spend: string;
  reach: number;
  ctr: string;
  cpc: string;
  cpm: string;
  leads: number;
  dateStart: string | undefined;
  dateStop: string | undefined;
};

//performanceMetrics.ts
export interface TrendDataEntry {
  date: string;
  cost: number;
  impressions: number;
  clicks: number;
  leads: number;
  messagingConversationsStarted: number;
  reach: number;
  ctr: number;
  cpc: number;
};

export interface PerformanceMetrics {
  cost: number;
  impressions: number;
  clicks: number;
  leads: number;
  messagingConversationsStarted: number;
  reach: number;
  ctr: number;
  cpc: number;
  trendData: TrendDataEntry[];
};

export interface FacebookMetricsResponse {
  data: {
    date_start: string;
    date_stop: string;
    impressions: string;
    clicks: string;
    spend: string;
    reach: string;
    ctr: string;
    cpc: string;
    actions?: { action_type: string; value: number }[];
  }[];
};