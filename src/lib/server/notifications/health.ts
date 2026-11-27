import 'server-only';
import { createAdminClient } from '@/lib/server/supabase/admin';
import { healthNotificationKeys, type HealthNotice } from '@/lib/shared';
import type { Json } from '@/lib/shared/types/supabase';

/**
 * Connection and refresh alerts in the bell, sent to a business's owners and admins. The saved
 * title and message are English fallbacks; screens word the row from `payload_json.health` in the
 * reader's language (`healthNotificationKeys`).
 *
 * Each alert has a dedupe key, unique per user: the same problem never creates a second row, and
 * an alert the person already read stays read.
 */

const ENGLISH = {
  signInNeededTitle: 'Sign in to Facebook again',
  signInNeededOwn: 'Meta stopped accepting DeepVisor’s saved login, so ad data isn’t updating. Reconnect on Connections.',
  signInNeededShared: 'Meta stopped accepting your saved login, so ad data for you and your clients isn’t updating. Reconnect on Connections.',
  signInExpiringTitle: 'Your Facebook login expires soon',
  signInExpiringMessage: 'Sign in again on Connections before it expires so ad data keeps updating.',
  refreshFailedTitle: 'Ad data couldn’t refresh',
  refreshFailedMessage: 'The last automatic refresh failed. DeepVisor will try again later, or you can refresh now.',
} as const;

const LINKS: Record<HealthNotice['kind'], string> = {
  signInNeeded: '/integration',
  signInExpiring: '/integration',
  refreshFailed: '/dashboard',
};

/** At most one "sign in again" alert per connection per day, whichever path found the problem first. */
export function loginRejectedKey(integrationId: string, now: Date): string {
  return `meta-login-rejected:${integrationId}:${now.toISOString().slice(0, 10)}`;
}

/** At most one "refresh failed" alert per ad account per day. */
export function refreshFailedKey(adAccountId: string, now: Date): string {
  return `refresh-failed:${adAccountId}:${now.toISOString().slice(0, 10)}`;
}

/** Owners and admins of the business, who can act on a connection problem. */
async function managers(businessId: string): Promise<string[]> {
  const db = createAdminClient();
  const business = await db.from('business_profiles').select('organization_id').eq('id', businessId).maybeSingle();
  if (business.error) throw business.error;
  if (!business.data?.organization_id) return [];
  const members = await db.from('organization_memberships').select('user_id')
    .eq('organization_id', business.data.organization_id).in('role', ['owner', 'admin']);
  if (members.error) throw members.error;
  return [...new Set(members.data.map((row) => row.user_id))];
}

/** Saves the alert once per person for this `dedupeKey`. Never throws: an alert must not break the work that found it. */
export async function notifyHealth(input: { businessId: string; dedupeKey: string; notice: HealthNotice }): Promise<void> {
  try {
    const keys = healthNotificationKeys(input.notice);
    const users = await managers(input.businessId);
    if (!users.length) return;
    for (const userId of users) {
      const { error } = await createAdminClient().from('notifications').insert({
        business_id: input.businessId,
        user_id: userId,
        dedupe_key: input.dedupeKey,
        source_type: 'system',
        type: 'connection_health',
        severity: input.notice.kind === 'signInExpiring' ? 'warning' : 'critical',
        title: ENGLISH[keys.title],
        message: ENGLISH[keys.message],
        link: LINKS[input.notice.kind],
        payload_json: { surface: 'bell', health: input.notice } as unknown as Json,
      });
      // 23505: this person already has this alert (the unique index is partial, so no upsert).
      if (error && error.code !== '23505') throw error;
    }
  } catch (error) {
    console.warn('Connection alert could not be saved:', error instanceof Error ? error.message : 'unknown error');
  }
}
