import 'server-only';

import { createAdminClient } from '@/lib/server/supabase/admin';
import { toIntegrationStatus } from '@/lib/server/integrations/normalizers';
import {
  markIntegrationError,
  markIntegrationSynced,
  resolveIntegrationAccessToken,
  type BusinessIntegration,
} from '@/lib/server/integrations/service';
import type { Database } from '@/lib/shared/types/supabase';
import type { SupportedIntegrationPlatform } from '@/lib/shared/types/integrations';
import { syncMetaBusinessPlatform } from './meta/syncMetaBusinessPlatform';
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

function isSyncEligible(integration: Pick<BusinessIntegration, 'status'>): boolean {
  return (
    integration.status === 'connected' ||
    integration.status === 'error' ||
    integration.status === 'needs_reauth'
  );
}

function resolveBackfillDays(trigger: SyncTrigger, override?: number): number {
  if (typeof override === 'number' && Number.isFinite(override) && override > 0) {
    return Math.floor(override);
  }

  switch (trigger) {
    case 'integration':
      return 90;
    case 'manual_refresh':
      return 30;
    case 'cron':
      return 7;
    default:
      return 30;
  }
}

function toPlatformKey(
  value: string | null | undefined
): SupportedIntegrationPlatform | null {
  return value === 'meta' ? 'meta' : null;
}

function toSyncableIntegration(row: SyncIntegrationRow): SyncableBusinessIntegration | null {
  const platform = Array.isArray(row.platforms) ? row.platforms[0] : row.platforms;
  const platformKey = toPlatformKey(platform?.key);

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

export async function syncBusinessPlatform(input: {
  businessId: string;
  platformId: string;
  trigger: SyncTrigger;
  backfillDays?: number;
}): Promise<BusinessPlatformSyncSummary> {
  const startedAt = new Date().toISOString();
  const backfillDays = resolveBackfillDays(input.trigger, input.backfillDays);
  const supabase = createAdminClient();

  const integrations = await listBusinessPlatformIntegrations(input.businessId);
  const integration = integrations.find((item) => item.platformId === input.platformId);

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

  try {
    const counts =
      integration.platformKey === 'meta'
        ? await syncMetaBusinessPlatform({
            supabase,
            businessId: input.businessId,
            platformId: input.platformId,
            accessToken,
            backfillDays,
            syncedAt: startedAt,
          })
        : null;

    if (!counts) {
      throw new Error(`Unsupported sync platform: ${integration.platformKey}`);
    }

    await markIntegrationSynced(supabase, integration.id);

    return {
      businessId: input.businessId,
      platformId: input.platformId,
      integrationId: integration.id,
      platformKey: integration.platformKey,
      trigger: input.trigger,
      backfillDays,
      startedAt,
      completedAt: new Date().toISOString(),
      counts,
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
        platformId: integration.platformId,
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
