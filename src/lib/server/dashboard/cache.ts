import 'server-only';

import { unstable_cache } from 'next/cache';
import { asRecord } from '@/lib/shared';
import { toIntegrationStatus } from '@/lib/server/integrations/normalizers';
import { createAdminClient } from '@/lib/server/supabase/admin';
import { toSupportedVendor } from '@/lib/server/repositories/platforms/normalizers';
import type { AdAccountData, PlatformDetails } from '@/lib/server/repositories/types';
import type { Database } from '@/lib/shared/types/supabase';

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

function toDashboardAdAccountShell(input: {
  integration: IntegrationLookup;
  adAccount: Pick<
    Database['public']['Tables']['ad_accounts']['Row'],
    | 'id'
    | 'business_id'
    | 'platform_id'
    | 'external_account_id'
    | 'name'
    | 'status'
    | 'last_synced'
    | 'created_at'
    | 'updated_at'
    | 'currency_code'
    | 'timezone'
  >;
  platformVendor: AdAccountData['platform_name'];
}): AdAccountData {
  return {
    id: input.adAccount.id,
    business_id: input.adAccount.business_id,
    platform_id: input.adAccount.platform_id,
    platform_integration_id: input.integration.id,
    external_account_id: input.adAccount.external_account_id,
    ad_account_id: input.adAccount.external_account_id,
    name: input.adAccount.name,
    status: input.adAccount.status,
    account_status: input.adAccount.status ?? 'unknown',
    currency_code: input.adAccount.currency_code,
    timezone: input.adAccount.timezone,
    created_at: input.adAccount.created_at,
    updated_at: input.adAccount.updated_at,
    last_synced: input.adAccount.last_synced,
    platform_name: input.platformVendor,
  };
}

function firstPlatform(value: PlatformJoin | PlatformJoin[]): PlatformJoin {
  return Array.isArray(value) ? value[0] ?? null : value;
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
    { revalidate: 300, tags: [`dashboard-context:${businessId}`] }
  )();
}

export function getCachedAdAccountShellData(
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
        console.error('Error validating cached selected integration shell:', integrationError.message);
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
        console.error('Error fetching cached ad account shell:', adAccountError.message);
        return null;
      }

      if (!adAccount) {
        return null;
      }

      return toDashboardAdAccountShell({
        integration,
        adAccount,
        platformVendor: toSupportedVendor(platform?.key),
      });
    },
    [
      'dashboard-ad-account-shell',
      userId,
      businessId,
      selectedPlatformIntegrationId,
      selectedAdAccountId,
    ],
    { revalidate: 60, tags: [`dashboard-context:${businessId}`] }
  )();
}
