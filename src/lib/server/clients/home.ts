import 'server-only';
import { redirect } from 'next/navigation';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import { isManagedClient } from './operator';

/**
 * Client businesses aren't synced and can't connect Meta here, so pages built around a synced
 * account send the operator to the client's own page instead of an empty one with a Connect button.
 */
export async function redirectUnsyncedClient(): Promise<void> {
  const { businessId } = await getRequiredAppContext();
  if (await isManagedClient(businessId)) redirect(`/clients/${businessId}`);
}
