export type SupportedPlatformVendor = 'meta' | 'google' | 'tiktok';
export type PlatformIntegrationStatus = 'connected' | 'disconnected' | 'needs_reauth' | 'error';

export interface AggregatedMetric {
  total_spend: number;
  total_leads: number;
  total_clicks: number;
  total_ctr: number;
  total_link_clicks: number;
  total_impressions: number;
  total_messages: number;
  total_conversions: number;
}

export interface PlatformDetails {
  id: string;
  integrationId: string;
  businessId: string;
  platformId: string;
  vendor: SupportedPlatformVendor;
  vendorKey: string;
  displayName: string;
  status: PlatformIntegrationStatus;
  isIntegrated: boolean;
  connectedAt: string | null;
  disconnectedAt: string | null;
  tokenExpiresAt: string | null;
  lastSyncedAt: string | null;
  lastError: string | null;
  updated_at: string;
  integrationDetails: Record<string, unknown>;
  accessTokenSecretId: string | null;
  refreshTokenSecretId: string | null;

  // Compatibility aliases for existing callers.
  platform_name: SupportedPlatformVendor;
  is_integrated: boolean;
  access_token: string | null;
}

export interface AdAccount {
  ad_account_id: string;
  name: string;
}

export interface CampaignMetric {
  ad_account_id: string;
  campaign_id: string;
  campaign_name: string;
  leads: number;
  clicks: number;
  messages: number;
  spend: number;
  link_clicks: number;
  conversion: number;
  conversion_rate: number;
  status: string;
  impressions: number;
  ctr: number;
  cpc: number;
  cpm: number;
  cost_per_result: number;
  ad_account_name: string;
}

export interface CampaignData {
  campaign_id: string;
  name: string;
  leads: number | null;
  clicks: number | null;
  messages: number | null;
  spend: number | null;
  link_clicks: number | null;
  status: string;
}

export interface AdAccountAggregatedMetrics {
  spend: number;
  impressions: number;
  clicks: number;
  link_clicks: number;
  reach: number;
  leads: number;
  messages: number;
  ctr: number;
  cpc: number;
  cpm: number;
}

export interface AdAccountTimeIncrementPoint {
  date_start: string | null;
  date_stop: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  link_clicks: number;
  reach: number;
  leads: number;
  messages: number;
  ctr: number;
  cpc: number;
  cpm: number;
}

export interface AdAccountTimeIncrementMetrics extends Record<string, AdAccountTimeIncrementPoint[]> {
  '1': AdAccountTimeIncrementPoint[];
  '7': AdAccountTimeIncrementPoint[];
  '30': AdAccountTimeIncrementPoint[];
}

export interface AdAccountData {
  id: string;
  business_id: string;
  platform_id: string;
  platform_integration_id: string;
  external_account_id: string;
  ad_account_id: string;
  name: string | null;
  status: string | null;
  account_status: string;
  currency_code: string | null;
  timezone: string | null;
  created_at: string;
  updated_at: string;
  last_synced: string | null;
  aggregated_metrics: AdAccountAggregatedMetrics;
  time_increment_metrics: AdAccountTimeIncrementMetrics;
  platform_name: SupportedPlatformVendor;
}

export interface BusinessAdAccountRollupAccount {
  id: string;
  platform_id: string;
  external_account_id: string;
  name: string | null;
  status: string | null;
  last_synced: string | null;
  aggregated_metrics: AdAccountAggregatedMetrics;
}

export interface BusinessAdAccountRollup {
  businessId: string;
  accountCount: number;
  activeAccountCount: number;
  syncedAccountCount: number;
  lastSyncedAt: string | null;
  totals: AdAccountAggregatedMetrics;
  accounts: BusinessAdAccountRollupAccount[];
}

export interface CampaignMetrics {
  cpc: number;
  cpm: number;
  ctr: number;
  leads: number;
  reach: number;
  spend: number;
  clicks: number;
  messages: number;
  campaign_id: string;
  impressions: number;
  link_clicks: number;
}

export interface RawCampaignData {
  id: string;
  name: string;
  status: string;
  insights: unknown;
  objective: string;
  stop_time: string;
  start_time: string;
}

export interface TopAdAccountCampaign {
  id: number;
  ad_account_id: string;
  campaign_id: string;
  name: string;
  status: string;
  objective: string;
  start_date: string;
  end_date: string;
  clicks: number;
  impressions: number;
  spend: number;
  leads: number;
  reach: number;
  link_clicks: number;
  messages: number;
  cpm: number;
  ctr: number;
  cpc: number;
  raw_data: RawCampaignData;
  created_at: string;
  updated_at: string;
  platform_name: string;
  today_metrics: CampaignMetrics;
  yesterday_metrics: CampaignMetrics;
  last_7d_metrics: CampaignMetrics;
  last_30d_metrics: CampaignMetrics;
  this_month_metrics: CampaignMetrics;
  last_month_metrics: CampaignMetrics;
  conversion: number;
  conversion_rate: number;
  cost_per_result: number;
}
