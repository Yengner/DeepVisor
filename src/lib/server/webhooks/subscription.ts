import 'server-only';
import { createAdminClient } from '@/lib/server/supabase/admin';
import { fetchMetaObject, META_GRAPH_BASE_URL } from '@/lib/server/sync/meta/client';
import { asRecord } from '@/lib/shared/utils/format';

/**
 * Connect this app to one ad account's webhooks (`/act_<id>/subscribed_apps`). This changes only
 * which app receives notifications. It is not an advertising write and never touches campaigns,
 * budgets or ads. Gated by DEEPVISOR_META_WEBHOOKS; every failure leaves the account on polling.
 */
const enabled = () => process.env.DEEPVISOR_META_WEBHOOKS === 'true';
const RECHECK_MS = 24 * 3600_000;
/** Real Meta account ids only: synthetic/simulated ids are never sent to Meta. */
export const metaAccountPath = (external: string): string | null => {
  const id = external.replace(/^act_/, '');
  return /^\d{1,20}$/.test(id) ? `act_${id}` : null;
};
type Scope = { businessId: string; adAccountId: string; externalAccountId: string; accessToken: string };

async function save(scope: Scope, status: 'subscribed' | 'failed' | 'unsubscribed', reason: string | null) {
  const { error } = await createAdminClient().from('meta_webhook_subscriptions').upsert({ ad_account_id: scope.adAccountId, business_id: scope.businessId, status, reason, checked_at: new Date().toISOString() }, { onConflict: 'ad_account_id' });
  if (error) throw error;
}
async function write(method: 'POST' | 'DELETE', path: string, accessToken: string, appId: string) {
  const url = new URL(`${META_GRAPH_BASE_URL}/${path}/subscribed_apps`);
  const response = await fetch(url, { method, headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ access_token: accessToken, app_id: appId }), signal: AbortSignal.timeout(15000) });
  const body = asRecord(await response.json().catch(() => ({})));
  // Keep Meta's numeric error code/subcode (e.g. subscription_400_200) so failures are diagnosable without the message.
  const err = asRecord(body.error), code = [err.code, err.error_subcode].filter(v => Number.isInteger(v)).join('_');
  if (!response.ok || body.success === false) throw new Error(`subscription_${response.status}${code ? `_${code}` : ''}`);
}

/**
 * Called from the existing refresh worker. Checks at most once a day per account, so a
 * subscription Meta removed (it drops them when an account is disabled or closed) is restored.
 */
export async function ensureAccountWebhooks(scope: Scope, now = Date.now()): Promise<'subscribed' | 'failed' | 'skipped'> {
  const appId = process.env.META_APP_ID, path = metaAccountPath(scope.externalAccountId);
  if (!enabled() || !appId || !path) return 'skipped';
  const db = createAdminClient();
  const current = await db.from('meta_webhook_subscriptions').select('status,checked_at').eq('ad_account_id', scope.adAccountId).maybeSingle();
  if (current.error) throw current.error;
  if (current.data && now - Date.parse(current.data.checked_at) < RECHECK_MS) return 'skipped';
  try {
    const existing = await fetchMetaObject<{ data?: Array<{ id?: string }> }>({ path: `${path}/subscribed_apps`, accessToken: scope.accessToken });
    if (!existing.data?.some(app => String(app.id) === appId)) await write('POST', path, scope.accessToken, appId);
    await save(scope, 'subscribed', null);
    return 'subscribed';
  } catch (error) {
    // Keep only a short machine reason: never the provider message or token.
    await save(scope, 'failed', error instanceof Error && /^subscription_\d{3}(?:_\d{1,10}){0,2}$/.test(error.message) ? error.message : 'unavailable');
    return 'failed';
  }
}

/**
 * On disconnect. Meta's DELETE removes the app from the whole ad account, so it is skipped while
 * any other connected business still has that account selected.
 */
export async function releaseAccountWebhooks(scope: Scope): Promise<'unsubscribed' | 'kept' | 'skipped'> {
  const appId = process.env.META_APP_ID, path = metaAccountPath(scope.externalAccountId);
  if (!enabled() || !appId || !path) return 'skipped';
  const db = createAdminClient();
  const others = await db.from('platform_integrations').select('id', { count: 'exact', head: true }).neq('business_id', scope.businessId)
    .in('status', ['connected', 'error']).is('disconnected_at', null).in('integration_details->>primary_ad_account_external_id', [path, path.slice(4)]);
  if (others.error) throw others.error;
  if ((others.count ?? 0) > 0) return 'kept';
  await write('DELETE', path, scope.accessToken, appId);
  await save(scope, 'unsubscribed', null);
  return 'unsubscribed';
}
