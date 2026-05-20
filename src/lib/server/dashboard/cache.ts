import 'server-only';

import { unstable_cache } from 'next/cache';
import { asRecord } from '@/lib/shared';
import { toIntegrationStatus } from '@/lib/server/integrations/normalizers';
import { createAdminClient } from '@/lib/server/supabase/admin';
import { getAdAccountSyncCoverage } from '@/lib/server/repositories/ad_accounts/syncState';
import {
  aggregateDailyMetricsRows,
  buildTimeIncrementMetricsFromDailyRows,
} from '@/lib/server/repositories/ad_accounts/normalizers';
import { listAdAccountDailyMetricsRowsByAccount } from '@/lib/server/repositories/ad_accounts/getAdAccountPerformance';
import { toSupportedVendor } from '@/lib/server/repositories/platforms/normalizers';
import type { AdAccountData, PlatformDetails } from '@/lib/server/data/types';
import type { SyncCoverage } from '@/lib/shared/types/integrations';

type PlatformJoin = {
  id: string;
  key: string;
  name: string;
} | null;

type PlatformIntegrationWithPlatform = {
  id: string;
  business_id: string;
  platform_id: string;
  status: string;
  connected_at: string | null;
  disconnected_at: string | null;
  token_expires_at: string | null;
  last_synced_at: string | null;
  last_error: string | null;
  updated_at: string;
  integration_details: unknown;
  access_token_secret_id: string | null;
  refresh_token_secret_id: string | null;
  platforms: PlatformJoin | PlatformJoin[];
};

type IntegrationLookup = {
  id: string;
  business_id: string;
  platform_id: string;
  platforms: PlatformJoin | PlatformJoin[];
};

function firstPlatform(value: PlatformJoin | PlatformJoin[]): PlatformJoin {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function isPlaceholderBusinessName(value: string | null | undefined): boolean {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return (
    normalized === 'my business' ||
    normalized === 'business setup' ||
    normalized === 'new business' ||
    normalized === 'untitled business'
  );
}

export function getCachedBusinessName(
  userId: string,
  businessId: string
): Promise<string | null> {
  return unstable_cache(
    async () => {
      const supabase = createAdminClient();
      const { data, error } = await supabase
        .from('business_profiles')
        .select('business_name')
        .eq('id', businessId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      const businessName = data?.business_name ?? null;
      return isPlaceholderBusinessName(businessName) ? null : businessName;
    },
    ['dashboard-business-name', userId, businessId],
    { revalidate: 60 }
  )();
}

export function getCachedPlatformDetails(
  userId: string,
  selectedPlatformIntegrationId: string,
  businessId: string
): Promise<PlatformDetails | null> {
  return unstable_cache(
    async () => {
      const supabase = createAdminClient();
      const { data, error } = await supabase
        .from('platform_integrations')
        .select(
          'id, business_id, platform_id, status, connected_at, disconnected_at, token_expires_at, last_synced_at, last_error, updated_at, integration_details, access_token_secret_id, refresh_token_secret_id, platforms ( id, key, name )'
        )
        .eq('id', selectedPlatformIntegrationId)
        .eq('business_id', businessId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching cached platform details:', error.message);
        return null;
      }

      if (!data) {
        return null;
      }

      const integration = data as unknown as PlatformIntegrationWithPlatform;
      const platform = firstPlatform(integration.platforms);
      const vendor = toSupportedVendor(platform?.key);
      const status = toIntegrationStatus(integration.status);

      return {
        id: integration.id,
        integrationId: integration.id,
        businessId: integration.business_id,
        platformId: integration.platform_id,
        vendor,
        vendorKey: platform?.key ?? vendor,
        displayName: platform?.name ?? vendor.charAt(0).toUpperCase() + vendor.slice(1),
        status,
        isIntegrated: status === 'connected',
        connectedAt: integration.connected_at,
        disconnectedAt: integration.disconnected_at,
        tokenExpiresAt: integration.token_expires_at,
        lastSyncedAt: integration.last_synced_at,
        lastError: integration.last_error,
        updated_at: integration.updated_at,
        integrationDetails: asRecord(integration.integration_details),
        accessTokenSecretId: integration.access_token_secret_id,
        refreshTokenSecretId: integration.refresh_token_secret_id,
        platform_name: vendor,
        is_integrated: status === 'connected',
        access_token: null,
      };
    },
    ['dashboard-platform-details', userId, businessId, selectedPlatformIntegrationId],
    { revalidate: 300 }
  )();
}

export function getCachedAdAccountData(
  userId: string,
  selectedAdAccountId: string,
  selectedPlatformIntegrationId: string,
  businessId: string
): Promise<AdAccountData | null> {
  return unstable_cache(
    async () => {
      const supabase = createAdminClient();
      const { data: integrationData, error: integrationError } = await supabase
        .from('platform_integrations')
        .select('id, business_id, platform_id, platforms ( id, key, name )')
        .eq('id', selectedPlatformIntegrationId)
        .eq('business_id', businessId)
        .maybeSingle();

      if (integrationError) {
        console.error('Error validating cached selected integration:', integrationError.message);
        return null;
      }

      if (!integrationData) {
        return null;
      }

      const integration = integrationData as unknown as IntegrationLookup;
      const platform = firstPlatform(integration.platforms);
      const { data: adAccount, error: adAccountError } = await supabase
        .from('ad_accounts')
        .select(
          'id, business_id, platform_id, external_account_id, name, status, last_synced, created_at, updated_at, currency_code, timezone'
        )
        .eq('id', selectedAdAccountId)
        .eq('business_id', businessId)
        .eq('platform_id', integration.platform_id)
        .maybeSingle();

      if (adAccountError) {
        console.error('Error fetching cached ad account data:', adAccountError.message);
        return null;
      }

      if (!adAccount) {
        return null;
      }

      const platformVendor = toSupportedVendor(platform?.key);
      const dailyMetrics =
        (await listAdAccountDailyMetricsRowsByAccount({
          adAccountIds: [adAccount.id],
          supabase,
        })).get(adAccount.id) ?? [];
      const aggregatedMetrics = aggregateDailyMetricsRows(dailyMetrics);
      const timeIncrementMetrics = buildTimeIncrementMetricsFromDailyRows(dailyMetrics);

      return {
        id: adAccount.id,
        business_id: adAccount.business_id,
        platform_id: adAccount.platform_id,
        platform_integration_id: integration.id,
        external_account_id: adAccount.external_account_id,
        ad_account_id: adAccount.external_account_id,
        name: adAccount.name,
        status: adAccount.status,
        account_status: adAccount.status ?? 'unknown',
        currency_code: adAccount.currency_code,
        timezone: adAccount.timezone,
        created_at: adAccount.created_at,
        updated_at: adAccount.updated_at,
        last_synced: adAccount.last_synced,
        aggregated_metrics: aggregatedMetrics,
        time_increment_metrics: timeIncrementMetrics,
        performance_summary: aggregatedMetrics,
        daily_metrics: dailyMetrics,
        platform_name: platformVendor,
      };
    },
    [
      'dashboard-ad-account-data',
      userId,
      businessId,
      selectedPlatformIntegrationId,
      selectedAdAccountId,
    ],
    { revalidate: 60 }
  )();
}

export function getCachedAdAccountSyncCoverage(
  userId: string,
  businessId: string,
  adAccountId: string
): Promise<SyncCoverage | null> {
  return unstable_cache(
    async () => getAdAccountSyncCoverage(createAdminClient(), adAccountId),
    ['dashboard-sync-coverage', userId, businessId, adAccountId],
    { revalidate: 30 }
  )();
}
