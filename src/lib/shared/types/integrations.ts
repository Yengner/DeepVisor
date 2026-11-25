export type SupportedIntegrationPlatform = 'meta';

export type IntegrationStatus = 'connected' | 'disconnected' | 'needs_reauth' | 'error';

export type IntegrationReturnTo = '/onboarding' | '/integration';

export interface DisconnectIntegrationRequest {
  integrationId: string;
}

export interface DisconnectIntegrationResponse {
  success: boolean;
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

export type AccountSyncJobStatus = 'queued' | 'running' | 'completed' | 'failed';
export type HistoricalSyncType =
  | 'initial_historical'
  | 'incremental'
  | 'manual_refresh'
  | 'backfill';
export type FirstSyncStage =
  | 'resolving_account'
  | 'syncing_campaigns'
  | 'syncing_adsets'
  | 'syncing_ads'
  | 'syncing_creatives'
  | 'syncing_performance_windows'
  | 'finalizing_summaries'
  | 'running_assessments'
  | 'completed';

export interface FirstSyncStatusCounts {
  campaignsSynced: number;
  adsetsSynced: number;
  adsSynced: number;
  creativesSynced: number;
  performanceRowsSynced: number;
}

export interface SyncCoverage {
  syncMode: 'first_sync' | 'incremental';
  coverageStartDate: string | null;
  coverageEndDate: string | null;
  firstFullSyncCompleted: boolean;
  activeJobId: string | null;
  activeJobStatus: AccountSyncJobStatus | null;
  activeJobSyncType: HistoricalSyncType | null;
  historicalAnalysisPending: boolean;
}

export interface FirstSyncJobStatus {
  jobId: string;
  adAccountId: string;
  integrationId: string;
  status: AccountSyncJobStatus;
  stage: FirstSyncStage | null;
  message: string | null;
  windowSince: string | null;
  windowUntil: string | null;
  windowsCompleted: number;
  coverageStartDate: string | null;
  coverageEndDate: string | null;
  firstFullSyncCompleted: boolean;
  counts: FirstSyncStatusCounts;
  startedAt: string | null;
  finishedAt: string | null;
  errorMessage: string | null;
}
