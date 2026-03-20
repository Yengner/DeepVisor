import { asRecord } from '@/lib/shared';
import { toIntegrationStatus } from '@/lib/server/integrations/normalizers';
import { createSupabaseClient } from '@/lib/server/supabase/server';
import type { PlatformDetails } from '../types';
import { toSupportedVendor } from './normalizers';

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

/**
 * Fetches a business-scoped platform integration and resolves joined platform metadata.
 */
export async function getPlatformDetails(
  selectedPlatformIntegrationId: string,
  businessId: string
): Promise<PlatformDetails | null> {
  const supabase = await createSupabaseClient();

  const { data, error } = await supabase
    .from('platform_integrations')
    .select(
      'id, business_id, platform_id, status, connected_at, disconnected_at, token_expires_at, last_synced_at, last_error, updated_at, integration_details, access_token_secret_id, refresh_token_secret_id, platforms ( id, key, name )'
    )
    .eq('id', selectedPlatformIntegrationId)
    .eq('business_id', businessId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching platform details:', error.message);
    return null;
  }

  if (!data) {
    return null;
  }

  const integration = data as unknown as PlatformIntegrationWithPlatform;
  const platform = Array.isArray(integration.platforms)
    ? integration.platforms[0] ?? null
    : integration.platforms;

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

    // Compatibility aliases.
    platform_name: vendor,
    is_integrated: status === 'connected',
    access_token: null,
  };
}
