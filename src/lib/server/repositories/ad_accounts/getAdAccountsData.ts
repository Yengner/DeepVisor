import { createSupabaseClient } from '@/lib/server/supabase/server';
import type { AdAccountData } from '../types';
import { toSupportedVendor } from '../platforms/normalizers';
import {
  parseAggregatedMetrics,
  parseTimeIncrementMetrics,
} from './normalizers';

/**
 * @deprecated Prefer importing `getAdAccountData` from
 * `@/lib/server/repositories/ad_accounts/getAdAccountData` or `@/lib/server/data`.
 */

type IntegrationPlatformJoin = {
  key: string;
  name: string;
} | null;

type IntegrationLookup = {
  id: string;
  business_id: string;
  platform_id: string;
  platforms: IntegrationPlatformJoin | IntegrationPlatformJoin[];
};

/**
 * Fetches an ad account row scoped to the selected business and platform integration.
 */
export async function getAdAccountData(
  selectedAdAccountId: string,
  selectedPlatformIntegrationId: string,
  businessId: string
): Promise<AdAccountData | null> {
  const supabase = await createSupabaseClient();

  const { data: integrationData, error: integrationError } = await supabase
    .from('platform_integrations')
    .select('id, business_id, platform_id, platforms ( key, name )')
    .eq('id', selectedPlatformIntegrationId)
    .eq('business_id', businessId)
    .maybeSingle();

  if (integrationError) {
    console.error('Error validating selected integration:', integrationError.message);
    return null;
  }

  if (!integrationData) {
    return null;
  }

  const integration = integrationData as unknown as IntegrationLookup;
  const platform = Array.isArray(integration.platforms)
    ? integration.platforms[0] ?? null
    : integration.platforms;

  const { data: adAccount, error: adAccountError } = await supabase
    .from('ad_accounts')
    .select(
      'id, business_id, platform_id, external_account_id, name, status, aggregated_metrics, time_increment_metrics, last_synced, created_at, updated_at, currency_code, timezone'
    )
    .eq('id', selectedAdAccountId)
    .eq('business_id', businessId)
    .eq('platform_id', integration.platform_id)
    .maybeSingle();

  if (adAccountError) {
    console.error('Error fetching ad account data:', adAccountError.message);
    return null;
  }

  if (!adAccount) {
    return null;
  }

  const platformVendor = toSupportedVendor(platform?.key);

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
    aggregated_metrics: parseAggregatedMetrics(adAccount.aggregated_metrics),
    time_increment_metrics: parseTimeIncrementMetrics(adAccount.time_increment_metrics),

    // Compatibility alias.
    platform_name: platformVendor,
  };
}
