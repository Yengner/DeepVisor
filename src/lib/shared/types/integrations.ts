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
  message?: string;
  retryAfterMs?: number;
  nextAllowedAt?: string;
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

export type BackfillStatus = 'queued' | 'running' | 'completed' | 'failed';

export interface SyncCoverage {
  syncMode: 'seed_recent';
  coverageStartDate: string | null;
  coverageEndDate: string | null;
  backfillJobId: string | null;
  backfillStatus: BackfillStatus | null;
  historicalAnalysisPending: boolean;
}

export type InitialMetaHistoryAnalysisState =
  | 'empty'
  | 'launch_ready'
  | 'learning'
  | 'optimizable'
  | 'mature'
  | 'stale'
  | 'misconfigured';

export type InitialMetaHistoryAnalysisTrackingConfidence = 'low' | 'medium' | 'high';

export type InitialMetaHistoryAnalysisPrimaryFlow =
  | 'launch'
  | 'optimize'
  | 'revive'
  | 'fix_tracking';

export type InitialMetaHistoryAnalysisWindowKey =
  | 'last7d'
  | 'last30d'
  | 'last90d'
  | 'lifetime';

export interface InitialMetaHistoryAnalysisObjectiveMixItem {
  objective: string;
  spend: number;
  shareOfSpend: number;
  campaigns: number;
}

export interface InitialMetaHistoryAnalysisCampaignItem {
  id: string;
  name: string;
  status: string | null;
  objective: string | null;
  spend: number;
  conversion: number;
  ctr: number;
  costPerResult: number;
}

export interface InitialMetaHistoryAnalysisWindowSnapshot {
  key: InitialMetaHistoryAnalysisWindowKey;
  label: string;
  spend: number;
  conversion: number;
  ctr: number;
  costPerResult: number;
  activeDays: number;
}

export interface InitialMetaHistoryAnalysisBestWindow
  extends InitialMetaHistoryAnalysisWindowSnapshot {
  reason: string;
}

export interface InitialMetaHistoryAnalysis {
  adAccountName: string | null;
  generatedAt: string;
  historyWindow: {
    firstDay: string | null;
    lastDay: string | null;
    historyDays: number;
    insightsSyncedThrough: string | null;
  };
  accountState: InitialMetaHistoryAnalysisState;
  trackingConfidence: InitialMetaHistoryAnalysisTrackingConfidence;
  maturityScore: number;
  primaryFlow: InitialMetaHistoryAnalysisPrimaryFlow;
  summary: string;
  strengths: string[];
  risks: string[];
  nextSteps: string[];
  businessSummary: string | null;
  businessPriority: string | null;
  objectiveMix: InitialMetaHistoryAnalysisObjectiveMixItem[];
  topCampaigns: InitialMetaHistoryAnalysisCampaignItem[];
  windowSnapshots: InitialMetaHistoryAnalysisWindowSnapshot[];
  bestWindow: InitialMetaHistoryAnalysisBestWindow;
}
