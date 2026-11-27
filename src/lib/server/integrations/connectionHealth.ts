import 'server-only';
import { createAdminClient } from '@/lib/server/supabase/admin';
import { markIntegrationNeedsReauth, resolvePlatformByKey } from '@/lib/server/integrations/service';
import { SIMULATION_TAG } from '@/lib/server/integrations/simulation/meta';
import { loginRejectedKey, notifyHealth } from '@/lib/server/notifications/health';
import { SHARED_FROM_KEY, sharedFromBusiness } from '@/lib/shared/integrations/sharedConnection';
import { asRecord } from '@/lib/shared';
import type { Json } from '@/lib/shared/types/supabase';
import { classifyTokenResponse, expiryWarning, tokenCheckDue, TOKEN_CHECKED_AT_KEY, type TokenCheck } from './metaLogin';

/**
 * Daily check that Meta still accepts each saved login, so a broken login is found before a
 * client notices stale numbers. It runs on the existing sync worker tick (no extra cron job) and
 * checks at most `MAX_PER_RUN` logins per tick, each once a day.
 *
 * Only a business's own connection is checked. Client connections borrow the operator's login
 * (`clients/sharedSync.ts`), so a rejected login marks them too and one alert names how many.
 */

const MAX_PER_RUN = 10;
const RUNNING = ['connected', 'error', 'needs_reauth'];
const REJECTED_MESSAGE = 'Meta no longer accepts this login. Sign in again on Connections.';

export type ConnectionCheckResult = { checked: number; rejected: number; expiring: number };

/** One `/me` request. Network trouble, outages and rate limits are `unknown`, never a rejection. */
async function checkToken(accessToken: string): Promise<TokenCheck> {
  try {
    const response = await fetch('https://graph.facebook.com/me?fields=id', {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(10_000),
    });
    const body = await response.json().catch(() => ({}));
    return classifyTokenResponse(response.status, body);
  } catch {
    return 'unknown';
  }
}

async function markChecked(id: string, details: Json) {
  const { error } = await createAdminClient().from('platform_integrations').update({
    integration_details: { ...asRecord(details), [TOKEN_CHECKED_AT_KEY]: new Date().toISOString() } as Json,
  }).eq('id', id);
  if (error) throw error;
}

/** Marks the business's own connection and every client connection borrowing it. Returns how many clients. */
async function markRejected(source: { id: string; business_id: string }): Promise<number> {
  const db = createAdminClient();
  await markIntegrationNeedsReauth(db, source.id, REJECTED_MESSAGE);
  const lent = await db.from('platform_integrations').select('id')
    .eq(`integration_details->>${SHARED_FROM_KEY}`, source.business_id).in('status', RUNNING);
  if (lent.error) throw lent.error;
  for (const row of lent.data) await markIntegrationNeedsReauth(db, row.id, REJECTED_MESSAGE);
  return lent.data.length;
}

export async function checkMetaConnectionsDue(now = new Date()): Promise<ConnectionCheckResult> {
  const result: ConnectionCheckResult = { checked: 0, rejected: 0, expiring: 0 };
  const db = createAdminClient();
  const platform = await resolvePlatformByKey(db, 'meta');
  if (!platform) return result;
  const { data, error } = await db.from('platform_integrations')
    .select('id,business_id,status,access_token_secret_id,token_expires_at,integration_details')
    .eq('platform_id', platform.id).in('status', RUNNING).not('access_token_secret_id', 'is', null);
  if (error) throw error;

  const due = data.filter((row) => {
    const details = asRecord(row.integration_details);
    // Client connections share the operator's login; simulated ones have no real login.
    return !sharedFromBusiness(details) && !details[SIMULATION_TAG] && row.status !== 'needs_reauth'
      && tokenCheckDue(details[TOKEN_CHECKED_AT_KEY], now);
  }).sort((a, b) => String(asRecord(a.integration_details)[TOKEN_CHECKED_AT_KEY] ?? '')
    .localeCompare(String(asRecord(b.integration_details)[TOKEN_CHECKED_AT_KEY] ?? ''))).slice(0, MAX_PER_RUN);

  for (const row of due) {
    try {
      const token = await db.rpc('get_platform_token', { secret_id: row.access_token_secret_id! });
      if (token.error) throw token.error;
      const check = typeof token.data === 'string' && token.data ? await checkToken(token.data) : 'rejected';
      if (check === 'unknown') continue; // Try again on a later tick.
      result.checked += 1;
      await markChecked(row.id, row.integration_details);
      if (check === 'rejected') {
        result.rejected += 1;
        const clients = await markRejected(row);
        await notifyHealth({ businessId: row.business_id, dedupeKey: loginRejectedKey(row.id, now), notice: { kind: 'signInNeeded', clients } });
        continue;
      }
      const warning = expiryWarning(row.token_expires_at, now);
      if (warning) {
        result.expiring += 1;
        // One warning per saved login: signing in again stores a new secret, and so a new key.
        await notifyHealth({ businessId: row.business_id, dedupeKey: `meta-login-expiring:${row.access_token_secret_id}`, notice: { kind: 'signInExpiring', days: warning.days } });
      }
    } catch (checkError) {
      console.warn('Meta login check failed:', checkError instanceof Error ? checkError.message : 'unknown error');
    }
  }
  return result;
}
