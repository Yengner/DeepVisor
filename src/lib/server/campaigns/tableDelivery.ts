import 'server-only';
import { createAdminClient } from '@/lib/server/supabase/admin';
import { allPages } from '@/lib/server/dashboard/overview/load';
import { activeDeliveryKeys } from './exploration/delivery';

/** Called after the page validates the authenticated business's selected account. */
export async function loadTableDelivery(businessId: string, adAccountId: string, integrationId: string) {
  try {
    const client = createAdminClient();
    const entities = await allPages((from, to) => client.from('ad_entities')
      .select('external_id,parent_external_id,entity_level,status,raw')
      .eq('business_id', businessId).eq('ad_account_id', adAccountId)
      .eq('platform_integration_id', integrationId).order('id').range(from, to));
    return { activeKeys: activeDeliveryKeys(entities), available: true };
  } catch {
    // Missing hierarchy must never produce a positive delivery highlight.
    return { activeKeys: [] as string[], available: false };
  }
}
