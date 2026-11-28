import 'server-only';
import { cache } from 'react';
import { createAdminClient } from '@/lib/server/supabase/admin';
import { listUserBusinesses } from '@/lib/server/actions/business/context';

/**
 * Operator records live in server-only tables (`operator_workspaces`, `client_engagements`,
 * `client_ad_accounts`). Callers pass the signed-in user's id; nothing here trusts the browser.
 */
type Db = ReturnType<typeof createAdminClient>;
/** The client tables are newer than the generated database types. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const clientsDb = (): any => createAdminClient() as Db;

/** True before the client-businesses migration is applied: the feature is then simply off. */
const missingTable = (error: { code?: string } | null) => error?.code === '42P01' || error?.code === 'PGRST205';

export type Operator = { organizationId: string; businessId: string };

/** The user's own operator workspace, or null for everyone else. */
export const getOperator = cache(async (userId: string): Promise<Operator | null> => {
  const owned = (await listUserBusinesses(userId)).filter((business) => business.role === 'owner');
  if (!owned.length) return null;
  const { data, error } = await clientsDb().from('operator_workspaces').select('organization_id')
    .in('organization_id', owned.map((business) => business.organizationId));
  if (error) {
    if (missingTable(error)) return null;
    throw new Error(error.message);
  }
  const operators = new Set((data as Array<{ organization_id: string }>).map((row) => row.organization_id));
  const mine = owned.find((business) => operators.has(business.organizationId));
  return mine ? { organizationId: mine.organizationId, businessId: mine.businessId } : null;
});

/**
 * A business someone manages for a client. It must never connect Meta from the manager's login:
 * that would copy every account the manager can see into the client's workspace. A failed read
 * throws, so connection routes fail closed.
 */
export const isManagedClient = cache(async (businessId: string): Promise<boolean> => {
  const { data, error } = await clientsDb().from('client_engagements').select('business_id')
    .eq('business_id', businessId).is('ended_at', null).maybeSingle();
  if (error) {
    if (missingTable(error)) return false;
    throw new Error(error.message);
  }
  return Boolean(data);
});
