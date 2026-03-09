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
