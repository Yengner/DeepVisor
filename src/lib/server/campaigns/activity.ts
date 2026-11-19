import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/shared/types/supabase';
import { readAllPages } from '@/lib/server/repositories/pagination';
import { activeDeliveryKeys } from './exploration/delivery';

/**
 * Whether any ad is on a complete active delivery chain now, from the saved hierarchy (the same
 * rule as Campaigns: configured ACTIVE past its end date is COMPLETED). Null when unknown: no
 * saved ads, or the hierarchy could not be read. Unknown is never treated as "nothing running".
 */
export async function accountActiveNow(db: SupabaseClient<Database>, businessId: string, accountId: string): Promise<boolean | null> {
  const rows = await readAllPages((from, to) => db.from('ad_entities').select('id,external_id,parent_external_id,entity_level,status,raw')
    .eq('business_id', businessId).eq('ad_account_id', accountId).order('id').range(from, to), { nullDataError: 'Hierarchy unavailable' }).catch(() => null);
  if (!rows || !rows.some(r => r.entity_level === 'ad')) return null;
  return activeDeliveryKeys(rows).length > 0;
}
