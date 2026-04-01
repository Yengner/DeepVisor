import type { Json } from '@/lib/shared/types/supabase';
import type {
  IntegrationCallbackStatus,
  IntegrationReturnTo,
  IntegrationStatus,
  SupportedIntegrationPlatform,
} from '@/lib/shared/types/integrations';

export type { IntegrationStatus, SupportedIntegrationPlatform, IntegrationReturnTo, IntegrationCallbackStatus };

export interface IntegrationPlatform {
  id: string;
  key: SupportedIntegrationPlatform;
  name: string;
}

export interface IntegrationTokenDetails {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  issued_at: string;
}

export interface IntegrationDetails extends Record<string, unknown> {
  access_token?: string;
  access_token_secret_id?: string;
  refresh_token?: string;
  refresh_token_secret_id?: string;
  expires_in?: number;
  token_type?: string;
  issued_at?: string;
  token_expires_at?: string;
  scopes?: string[];
  primary_ad_account_external_id?: string;
  primary_ad_account_name?: string;
  account_selection_completed_at?: string;
}

export interface UpsertIntegrationInput {
  businessId: string;
  platformId: string;
  userId: string;
  status: IntegrationStatus;
  integrationDetails: IntegrationDetails;
  connectedAt?: string;
  disconnectedAt?: string | null;
  lastError?: string | null;
}

export interface MetaOAuthToken {
  access_token: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
}

export interface MetaAdAccountSnapshot {
  externalAccountId: string;
  name: string | null;
  status: string | null;
  currencyCode: string | null;
  timezone: string | null;
  aggregatedMetrics: Json | null;
  timeIncrementMetrics: Json | null;
}

export interface MetaOAuthBuildInput {
  state: string;
  redirectUri: string;
}

export interface MetaExchangeCodeInput {
  code: string;
  redirectUri: string;
}

export interface OAuthStateRecord {
  id: string;
  state: string;
  user_id: string;
  business_id: string;
  platform_id: string;
  created_at: string;
  expires_at: string;
}
