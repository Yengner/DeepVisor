import 'server-only';
import { cache } from 'react';
import { listUserBusinesses } from '@/lib/server/actions/business/context';
import { createAdminClient } from '@/lib/server/supabase/admin';
import { getOperator } from './operator';

/** What the switcher needs: the user's own memberships, by business name. */
export const loadSwitcher = cache(async (userId: string) => {
  const memberships = await listUserBusinesses(userId);
  const [operator, profiles] = await Promise.all([
    getOperator(userId),
    createAdminClient().from('business_profiles').select('id,business_name').in('id', memberships.map((business) => business.businessId)),
  ]);
  if (profiles.error) throw profiles.error;
  const names = new Map(profiles.data.map((row) => [row.id, row.business_name]));
  return {
    isOperator: Boolean(operator),
    businesses: memberships.map((business) => ({ id: business.businessId, name: names.get(business.businessId) ?? business.organizationName })),
  };
});
