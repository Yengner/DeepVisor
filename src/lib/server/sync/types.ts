import type { SupportedIntegrationPlatform } from '@/lib/shared/types/integrations';

export type SyncTrigger = 'integration' | 'manual_refresh' | 'cron';
export const FULL_HISTORY_BACKFILL_DAYS = 10_000;

export interface BusinessPlatformSyncCounts {
  adAccounts: number;
  campaignDims: number;
  adsetDims: number;
  adDims: number;
  adCreatives: number;
  creativeFeatureSnapshots: number;
  adAccountPerformanceRows: number;
  campaignPerformanceRows: number;
  adsetPerformanceRows: number;
  adPerformanceRows: number;
  campaignPerformanceSummaries: number;
  adsetPerformanceSummaries: number;
  adPerformanceSummaries: number;
}

export interface BusinessPlatformSyncSummary {
  businessId: string;
  platformId: string;
  integrationId: string;
  platformKey: SupportedIntegrationPlatform;
  trigger: SyncTrigger;
  backfillDays: number;
  startedAt: string;
  completedAt: string;
  counts: BusinessPlatformSyncCounts;
}

export interface SyncConnectedBusinessPlatformsResult {
  successCount: number;
  failedCount: number;
  syncedAdAccounts: number;
  summaries: BusinessPlatformSyncSummary[];
  errors: Array<{
    businessId: string;
    platformId: string;
    message: string;
  }>;
}
