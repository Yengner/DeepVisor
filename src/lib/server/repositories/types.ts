import type { IntegrationStatus } from '@/lib/shared/types/integrations';

export type SupportedPlatformVendor = 'meta' | 'google' | 'tiktok';
export type PlatformIntegrationStatus = IntegrationStatus;

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

export interface AdAccountAggregatedMetrics {
  spend: number;
  impressions: number;
  clicks: number;
  link_clicks: number;
  reach: number | null;
  leads: number;
  messages: number;
  calls?: number;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
}

export interface AdAccountTimeIncrementPoint {
  date_start: string | null;
  date_stop: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  link_clicks: number;
  reach: number | null;
  leads: number;
  messages: number;
  calls?: number;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
}

export interface AdAccountTimeIncrementMetrics
  extends Record<string, AdAccountTimeIncrementPoint[]> {
  '1': AdAccountTimeIncrementPoint[];
  '7': AdAccountTimeIncrementPoint[];
  '30': AdAccountTimeIncrementPoint[];
}

export type AdAccountPerformanceSummary = AdAccountAggregatedMetrics;

export interface AdAccountDailyMetricsRow {
  day: string;
  spend: number;
  reach: number | null;
  impressions: number;
  clicks: number;
  inline_link_clicks: number;
  leads: number;
  messages: number;
  calls?: number;
  currency_code: string | null;
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
  performance_summary: AdAccountPerformanceSummary;
  daily_metrics: AdAccountDailyMetricsRow[];
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
  performance_summary: AdAccountPerformanceSummary;
}

export interface BusinessAdAccountRollup {
  businessId: string;
  accountCount: number;
  activeAccountCount: number;
  syncedAccountCount: number;
  lastSyncedAt: string | null;
  totals: AdAccountPerformanceSummary;
  accounts: BusinessAdAccountRollupAccount[];
}
