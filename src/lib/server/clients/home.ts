import 'server-only';
import { redirect } from 'next/navigation';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import { isManagedClient } from './operator';
import { syncedClientAccount } from './sharedSync';

/**
 * A client business has nothing to show until its linked account syncs, so pages built around an
 * account send the operator to the client's own page instead of an empty one with a Connect button.
 */
export async function redirectUnsyncedClient(): Promise<void> {
  const { businessId } = await getRequiredAppContext();
  if (await isManagedClient(businessId) && !(await syncedClientAccount(businessId))) redirect(`/clients/${businessId}`);
}

/** A client's connection is managed on its Business details page, never on Connections. */
export async function redirectClientConnections(): Promise<void> {
  const { businessId } = await getRequiredAppContext();
  if (await isManagedClient(businessId)) redirect(`/clients/${businessId}`);
}
