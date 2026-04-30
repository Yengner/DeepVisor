import 'server-only';

import { createAdminClient } from '@/lib/server/supabase/admin';
import {
  runBusinessAssessment,
  runMetaAdAccountAssessment,
  syncMetaAccountIntelligenceArtifacts,
} from '@/lib/server/intelligence';
import { toIntegrationStatus } from '@/lib/server/integrations/normalizers';
import {
  getPrimaryAdAccountSelection,
  markIntegrationError,
  markIntegrationSynced,
  resolveIntegrationAccessToken,
  type BusinessIntegration,
} from '@/lib/server/integrations/service';
import { toSupportedIntegrationPlatform } from '@/lib/shared';
import type { Database } from '@/lib/shared/types/supabase';
import type { SupportedIntegrationPlatform } from '@/lib/shared/types/integrations';
import { syncMetaBusinessPlatform } from './meta/syncMetaBusinessPlatform';
import {
  FULL_HISTORY_BACKFILL_DAYS,
  type PlatformSyncMode,
} from './types';
import type {
  BusinessPlatformSyncSummary,
  SyncConnectedBusinessPlatformsResult,
  SyncTrigger,
} from './types';

type SyncIntegrationRow = Database['public']['Tables']['platform_integrations']['Row'] & {
  platforms?: { key: string } | { key: string }[] | null;
};

type SyncableBusinessIntegration = Omit<BusinessIntegration, 'platformKey'> & {
  businessId: string;
  platformKey: SupportedIntegrationPlatform;
};

/**
 * Determines whether an integration status is allowed to enter the sync pipeline.
 *
 * @param integration - Integration-like object exposing the current sync/auth status.
 * @returns `true` when the integration can be synced, otherwise `false`.
 */
function isSyncEligible(integration: Pick<BusinessIntegration, 'status'>): boolean {
  return (
    integration.status === 'connected' ||
    integration.status === 'error' ||
    integration.status === 'needs_reauth'
  );
}

/**
 * Resolves the effective historical window for a sync run.
 *
 * @param trigger - Sync trigger that indicates whether the run came from integration setup,
 * a manual refresh, or scheduled automation.
 * @param override - Optional explicit backfill override in days.
 * @returns The final number of days the sync should request from the provider.
 */
function resolveBackfillDays(trigger: SyncTrigger, override?: number): number {
  if (typeof override === 'number' && Number.isFinite(override) && override > 0) {
    return Math.floor(override);
  }

  switch (trigger) {
    case 'integration':
      return FULL_HISTORY_BACKFILL_DAYS;
    case 'manual_refresh':
      return 30;
    case 'cron':
      return 7;
    default:
      return 30;
  }
}

/**
 * Maps a sync trigger into the assessment trigger vocabulary used by the AI assessment pipeline.
 *
 * @param trigger - Sync trigger from the platform sync orchestration layer.
 * @returns `integration` for first-connect flows, otherwise `sync`.
 */
function toAssessmentTrigger(trigger: SyncTrigger): 'integration' | 'sync' {
  return trigger === 'integration' ? 'integration' : 'sync';
}

/**
 * Normalizes a raw `platform_integrations` row into the subset required by sync orchestration.
 *
 * @param row - Joined integration row loaded from Supabase.
 * @returns A syncable integration model when the platform is supported, otherwise `null`.
 */
function toSyncableIntegration(row: SyncIntegrationRow): SyncableBusinessIntegration | null {
  const platform = Array.isArray(row.platforms) ? row.platforms[0] : row.platforms;
  const platformKey = toSupportedIntegrationPlatform(platform?.key);

  if (!platformKey) {
    return null;
  }

  const status = toIntegrationStatus(row.status);

  return {
    id: row.id,
    businessId: row.business_id,
    platformId: row.platform_id,
    platformKey,
    status,
    isIntegrated: status === 'connected',
    accessToken: row.access_token_secret_id,
    integrationDetails: row.integration_details,
  };
}

/**
 * Loads the latest integration row per platform for a business and filters to supported platforms.
 *
 * @param businessId - Business whose platform integrations should be considered for syncing.
 * @returns One normalized integration per platform, ordered by most recently updated row per platform.
 */
async function listBusinessPlatformIntegrations(
  businessId: string
): Promise<SyncableBusinessIntegration[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('platform_integrations')
    .select('*, platforms ( key )')
    .eq('business_id', businessId)
    .order('updated_at', { ascending: false });

  if (error) {
    throw error;
  }

  const latestByPlatformId = new Map<string, SyncableBusinessIntegration>();

  for (const row of (data ?? []) as SyncIntegrationRow[]) {
    if (latestByPlatformId.has(row.platform_id)) {
      continue;
    }

    const integration = toSyncableIntegration(row);
    if (!integration) {
      continue;
    }

    latestByPlatformId.set(row.platform_id, integration);
  }

  return Array.from(latestByPlatformId.values());
}

/**
 * Resolves the single integration that should be synced for a business.
 *
 * The lookup can target an explicit integration id or fall back to the latest row for a
 * specific platform id.
 *
 * @param input - Business-scoped integration lookup criteria.
 * @returns The normalized syncable integration, or `null` when no matching row exists.
 */
async function getBusinessPlatformIntegration(input: {
  businessId: string;
  platformId?: string;
  integrationId?: string;
}): Promise<SyncableBusinessIntegration | null> {
  const supabase = createAdminClient();

  if (input.integrationId) {
    const { data, error } = await supabase
      .from('platform_integrations')
      .select('*, platforms ( key )')
      .eq('business_id', input.businessId)
      .eq('id', input.integrationId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data ? toSyncableIntegration(data as SyncIntegrationRow) : null;
  }

  if (!input.platformId) {
    throw new Error('Missing platform id or integration id for sync');
  }

  const { data, error } = await supabase
    .from('platform_integrations')
    .select('*, platforms ( key )')
    .eq('business_id', input.businessId)
    .eq('platform_id', input.platformId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? toSyncableIntegration(data as SyncIntegrationRow) : null;
}

/**
 * Runs the full sync workflow for one business/platform integration.
 *
 * The function resolves the target integration, validates sync eligibility, loads the live
 * access token from Vault, executes the provider-specific sync, triggers post-sync assessments,
 * and persists the final integration health state.
 *
 * @param input - Business, integration/platform selector, trigger metadata, and optional sync overrides.
 * @returns A sync summary containing coverage dates, counts, and orchestration metadata.
 * @throws When the integration cannot be found, is not eligible, lacks a token, or the provider sync fails.
 */
export async function syncBusinessPlatform(input: {
  businessId: string;
  platformId?: string;
  integrationId?: string;
  trigger: SyncTrigger;
  backfillDays?: number;
  syncMode?: PlatformSyncMode;
  primaryExternalAccountId?: string | null;
}): Promise<BusinessPlatformSyncSummary> {
  const startedAt = new Date().toISOString();
  const backfillDays = resolveBackfillDays(input.trigger, input.backfillDays);
  const syncMode = input.syncMode ?? 'default';
  const supabase = createAdminClient();

  const integration = await getBusinessPlatformIntegration({
    businessId: input.businessId,
    platformId: input.platformId,
    integrationId: input.integrationId,
  });

  if (!integration) {
    throw new Error('Connected platform integration not found for business');
  }

  if (!isSyncEligible(integration)) {
    throw new Error('Platform integration is not eligible for sync');
  }

  const accessToken = await resolveIntegrationAccessToken(supabase, integration);
  if (!accessToken) {
    await markIntegrationError(supabase, integration.id, 'Missing access token');
    throw new Error('Missing access token');
  }

  const primaryAdAccountSelection = getPrimaryAdAccountSelection(integration.integrationDetails);
  const primaryExternalAccountId =
    input.primaryExternalAccountId ?? primaryAdAccountSelection.externalAccountId;

  try {
    const syncResult =
      integration.platformKey === 'meta'
        ? await (() => {
            if (!primaryExternalAccountId) {
              throw new Error('Select a Meta ad account before syncing this integration');
            }

            return syncMetaBusinessPlatform({
              supabase,
              businessId: input.businessId,
              platformId: integration.platformId,
              platformIntegrationId: integration.id,
              accessToken,
              backfillDays,
              syncedAt: startedAt,
              trigger: input.trigger,
              primaryExternalAccountId,
              syncMode,
            });
          })()
        : null;

    if (!syncResult) {
      throw new Error(`Unsupported sync platform: ${integration.platformKey}`);
    }

    if (integration.platformKey === 'meta' && primaryExternalAccountId) {
      const { data: syncedAccount, error: syncedAccountError } = await supabase
        .from('ad_accounts')
        .select('id')
        .eq('business_id', input.businessId)
        .eq('platform_id', integration.platformId)
        .eq('external_account_id', primaryExternalAccountId)
        .maybeSingle();

      if (syncedAccountError) {
        throw syncedAccountError;
      }

      if (syncedAccount?.id) {
        const adAccountAssessment = await runMetaAdAccountAssessment({
          supabase,
          businessId: input.businessId,
          platformIntegrationId: integration.id,
          adAccountId: syncedAccount.id,
          trigger: toAssessmentTrigger(input.trigger),
        });
        await syncMetaAccountIntelligenceArtifacts({
          supabase,
          assessment: adAccountAssessment,
        });
        await runBusinessAssessment({
          supabase,
          businessId: input.businessId,
          trigger: toAssessmentTrigger(input.trigger),
        });
      }
    }

    await markIntegrationSynced(supabase, integration.id);

    return {
      businessId: input.businessId,
      platformId: integration.platformId,
      integrationId: integration.id,
      platformKey: integration.platformKey,
      trigger: input.trigger,
      syncMode,
      backfillDays,
      startedAt,
      completedAt: new Date().toISOString(),
      coverageStartDate: syncResult.coverageStartDate,
      coverageEndDate: syncResult.coverageEndDate,
      counts: {
        adAccounts: syncResult.adAccounts,
        campaignDims: syncResult.campaignDims,
        adsetDims: syncResult.adsetDims,
        adDims: syncResult.adDims,
        adCreatives: syncResult.adCreatives,
        creativeFeatureSnapshots: syncResult.creativeFeatureSnapshots,
        adAccountPerformanceRows: syncResult.adAccountPerformanceRows,
        campaignPerformanceRows: syncResult.campaignPerformanceRows,
        adsetPerformanceRows: syncResult.adsetPerformanceRows,
        adPerformanceRows: syncResult.adPerformanceRows,
        metaHourlyPerformanceRows: syncResult.metaHourlyPerformanceRows,
        campaignPerformanceSummaries: syncResult.campaignPerformanceSummaries,
        adsetPerformanceSummaries: syncResult.adsetPerformanceSummaries,
        adPerformanceSummaries: syncResult.adPerformanceSummaries,
      },
    };
  } catch (error) {
    await markIntegrationError(
      supabase,
      integration.id,
      error instanceof Error ? error.message : 'Sync failed'
    );

    throw error;
  }
}

/**
 * Syncs every eligible connected platform integration for a business, optionally filtered by platform.
 *
 * Integrations are processed sequentially so each failure can be captured independently without
 * aborting the rest of the business-wide sync run.
 *
 * @param input - Business id, trigger metadata, and optional platform/backfill filters.
 * @returns Aggregate success/failure counts plus the per-integration sync summaries and errors.
 */
export async function syncConnectedBusinessPlatforms(input: {
  businessId: string;
  trigger: SyncTrigger;
  backfillDays?: number;
  platformKey?: SupportedIntegrationPlatform;
}): Promise<SyncConnectedBusinessPlatformsResult> {
  const integrations = await listBusinessPlatformIntegrations(input.businessId);
  const candidates = integrations.filter((integration) => {
    if (!isSyncEligible(integration)) {
      return false;
    }

    if (input.platformKey && integration.platformKey !== input.platformKey) {
      return false;
    }

    return true;
  });

  const summaries: BusinessPlatformSyncSummary[] = [];
  const errors: SyncConnectedBusinessPlatformsResult['errors'] = [];

  for (const integration of candidates) {
    try {
      const summary = await syncBusinessPlatform({
        businessId: input.businessId,
        integrationId: integration.id,
        trigger: input.trigger,
        backfillDays: input.backfillDays,
      });

      summaries.push(summary);
    } catch (error) {
      errors.push({
        businessId: input.businessId,
        platformId: integration.platformId,
        message: error instanceof Error ? error.message : 'Sync failed',
      });
    }
  }

  return {
    successCount: summaries.length,
    failedCount: errors.length,
    syncedAdAccounts: summaries.reduce((total, summary) => total + summary.counts.adAccounts, 0),
    summaries,
    errors,
  };
}
