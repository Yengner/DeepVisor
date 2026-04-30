import type { SupportedIntegrationPlatform } from '@/lib/shared/types/integrations';

export type SyncTrigger = 'integration' | 'manual_refresh' | 'cron';
export const FULL_HISTORY_BACKFILL_DAYS = 10_000;
export const RECENT_SEED_SYNC_DAYS = 90;
export type PlatformSyncMode = 'default' | 'seed_recent' | 'full_backfill';

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
  metaHourlyPerformanceRows: number;
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
  syncMode: PlatformSyncMode;
  backfillDays: number;
  startedAt: string;
  completedAt: string;
  coverageStartDate: string | null;
  coverageEndDate: string | null;
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
