import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/shared/types/supabase';
import { readAllPages } from '@/lib/server/repositories/pagination';
import { activeDeliveryKeys } from './exploration/delivery';

/** How many ads are on a complete active delivery chain now; null when unknown (as above). */
export async function accountActiveAdCount(db: SupabaseClient<Database>, businessId: string, accountId: string): Promise<number | null> {
  const rows = await readAllPages((from, to) => db.from('ad_entities').select('id,external_id,parent_external_id,entity_level,status,raw')
    .eq('business_id', businessId).eq('ad_account_id', accountId).order('id').range(from, to), { nullDataError: 'Hierarchy unavailable' }).catch(() => null);
  if (!rows || !rows.some(r => r.entity_level === 'ad')) return null;
  return activeDeliveryKeys(rows).filter(key => key.startsWith('ad:')).length;
}
