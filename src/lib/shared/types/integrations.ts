export type SupportedIntegrationPlatform = 'meta';

export type IntegrationStatus = 'connected' | 'disconnected' | 'needs_reauth' | 'error';

export type IntegrationReturnTo = '/onboarding' | '/integration';

export type IntegrationCallbackStatus = 'connected' | 'error';

export interface DisconnectIntegrationRequest {
  integrationId: string;
}

export interface DisconnectIntegrationResponse {
  success: boolean;
}

export interface RefreshIntegrationsResponse {
  success: boolean;
  refreshedCount: number;
  failedCount: number;
}

export interface RefetchAdAccountsResult {
  businessId: string;
  refreshedIntegrations: number;
  failedIntegrations: number;
  syncedAdAccounts: number;
}

export interface RefetchAdAccountsResponse {
  success: boolean;
  platform?: SupportedIntegrationPlatform;
  businessesProcessed?: number;
  refreshedIntegrations?: number;
  failedIntegrations?: number;
  syncedAdAccounts?: number;
  results?: RefetchAdAccountsResult[];
  error?: string;
}
