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
  platform_name: SupportedPlatformVendor;
}
