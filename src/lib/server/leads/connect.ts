import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/shared/types/supabase';

/**
 * "Connect WhatsApp": finishes Embedded Signup (v4, WhatsApp Business app onboarding a.k.a.
 * coexistence) on the server. The browser only hands over the 30-second code and the ids Meta
 * returned; every id is re-checked with the business token before anything is saved.
 *
 * Steps (Meta's Tech Provider onboarding): exchange the code for a business token → confirm the
 * number belongs to the account and is a WhatsApp Business app number → subscribe this app to the
 * account's webhooks → keep the token in Vault → save the connection → request the contact and
 * history sync, which Meta requires within 24 hours or it offboards the number. Registration is
 * skipped: an app number is already registered. Nothing is sent to customers.
 */
export const GRAPH_URL = 'https://graph.facebook.com/v24.0';

export type ConnectFailure = 'config' | 'exchange' | 'access' | 'not_app_number' | 'taken' | 'subscribe';
export class WhatsAppConnectError extends Error {
  constructor(readonly reason: ConnectFailure, readonly metaCode?: number) {
    super(`WhatsApp connect failed: ${reason}${metaCode ? ` (Meta ${metaCode})` : ''}`);
  }
}

/** `phoneNumberId` is null when Meta's finish event named only the account; the server picks the account's app number. */
export interface ConnectWhatsAppInput { businessId: string; code: string; phoneNumberId: string | null; wabaId: string }
export interface ConnectWhatsAppDeps { fetch: typeof fetch; appId?: string; appSecret?: string }
export interface ConnectWhatsAppResult { connectionId: string; displayPhone: string | null; synced: boolean }

const DIGITS = /^\d{1,30}$/;
export const isMetaId = (value: unknown): value is string => typeof value === 'string' && DIGITS.test(value);

type GraphResult = { ok: true; data: Record<string, unknown> } | { ok: false; code?: number };
async function graph(deps: ConnectWhatsAppDeps, path: string, init: { token?: string; method?: 'GET' | 'POST'; query?: Record<string, string>; json?: unknown } = {}): Promise<GraphResult> {
  const url = new URL(`${GRAPH_URL}/${path}`);
  for (const [k, v] of Object.entries(init.query ?? {})) url.searchParams.set(k, v);
  const headers: Record<string, string> = {};
  if (init.token) headers.Authorization = `Bearer ${init.token}`;
  if (init.json !== undefined) headers['Content-Type'] = 'application/json';
  try {
    const response = await deps.fetch(url, {
      method: init.method ?? 'GET', headers, cache: 'no-store', signal: AbortSignal.timeout(15_000),
      body: init.json === undefined ? undefined : JSON.stringify(init.json),
    });
    const data = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) {
      const code = (data.error as { code?: unknown } | undefined)?.code;
      return { ok: false, code: typeof code === 'number' ? code : undefined };
    }
    return { ok: true, data };
  } catch {
    return { ok: false };
  }
}

export async function connectWhatsApp(
  db: SupabaseClient<Database>,
  input: ConnectWhatsAppInput,
  deps: ConnectWhatsAppDeps = { fetch, appId: process.env.META_APP_ID, appSecret: process.env.META_APP_SECRET },
): Promise<ConnectWhatsAppResult> {
  if (!deps.appId || !deps.appSecret) throw new WhatsAppConnectError('config');
  if ((input.phoneNumberId !== null && !isMetaId(input.phoneNumberId)) || !isMetaId(input.wabaId) || !input.code || input.code.length > 2048) {
    throw new WhatsAppConnectError('access');
  }

  const exchange = await graph(deps, 'oauth/access_token', { query: { client_id: deps.appId, client_secret: deps.appSecret, code: input.code } });
  const token = exchange.ok && typeof exchange.data.access_token === 'string' ? exchange.data.access_token : null;
  if (!token) throw new WhatsAppConnectError('exchange', exchange.ok ? undefined : exchange.code);

  // The ids came from the browser: trust them only if this token can see the number on that account.
  const numbers = await graph(deps, `${input.wabaId}/phone_numbers`, { token, query: { fields: 'id,display_phone_number,is_on_biz_app', limit: '100' } });
  if (!numbers.ok || !Array.isArray(numbers.data.data)) throw new WhatsAppConnectError('access', numbers.ok ? undefined : numbers.code);
  const rows = (numbers.data.data as Array<Record<string, unknown>>).filter(n => isMetaId(n?.id));
  const appNumbers = rows.filter(n => n.is_on_biz_app === true);
  const number = input.phoneNumberId === null ? (appNumbers.length === 1 ? appNumbers[0] : undefined) : rows.find(n => n.id === input.phoneNumberId);
  if (!number) throw new WhatsAppConnectError(input.phoneNumberId === null && appNumbers.length === 0 ? 'not_app_number' : 'access');
  if (number.is_on_biz_app !== true) throw new WhatsAppConnectError('not_app_number');
  const phoneNumberId = number.id as string;
  const displayPhone = typeof number.display_phone_number === 'string' ? number.display_phone_number.slice(0, 40) : null;

  const { data: existing, error: existingError } = await db.from('whatsapp_connections')
    .select('business_id').eq('phone_number_id', phoneNumberId).eq('status', 'active').maybeSingle();
  if (existingError) throw existingError;
  if (existing && existing.business_id !== input.businessId) throw new WhatsAppConnectError('taken');

  const subscribed = await graph(deps, `${input.wabaId}/subscribed_apps`, { token, method: 'POST' });
  if (!subscribed.ok) throw new WhatsAppConnectError('subscribe', subscribed.code);

  const { data: secretId, error: secretError } = await db.rpc('upsert_platform_token', {
    secret_value: token, secret_name: `whatsapp_business_token:${phoneNumberId}`,
    secret_description: 'WhatsApp business token from Embedded Signup',
  });
  if (secretError || typeof secretId !== 'string') throw secretError ?? new Error('Vault did not return a secret id');

  const { data: saved, error: saveError } = await db.from('whatsapp_connections').upsert({
    business_id: input.businessId, phone_number_id: phoneNumberId, waba_id: input.wabaId, display_phone: displayPhone,
    is_test: false, status: 'active', disconnected_at: null, connected_at: new Date().toISOString(),
    onboarded_via: 'embedded_signup', token_secret_id: secretId, sync_requested_at: null, sync_error: null,
  }, { onConflict: 'phone_number_id' }).select('id').single();
  if (saveError) throw saveError;

  // Contacts first, then history (Meta's order). Each can be requested only once per onboarding.
  let syncError: string | null = null;
  for (const syncType of ['smb_app_state_sync', 'history'] as const) {
    const sync = await graph(deps, `${phoneNumberId}/smb_app_data`, { token, method: 'POST', json: { messaging_product: 'whatsapp', sync_type: syncType } });
    if (!sync.ok) { syncError = `${syncType} failed${sync.code ? ` (Meta ${sync.code})` : ''}`; break; }
  }
  const { error: syncSaveError } = await db.from('whatsapp_connections')
    .update(syncError ? { sync_error: syncError } : { sync_requested_at: new Date().toISOString() }).eq('id', saved.id);
  if (syncSaveError) throw syncSaveError;
  return { connectionId: saved.id, displayPhone, synced: syncError === null };
}

/** `account_update` PARTNER_REMOVED: stop recording for every number on those accounts. */
export async function disconnectWhatsAppAccounts(db: SupabaseClient<Database>, wabaIds: string[]): Promise<number> {
  const ids = wabaIds.filter(isMetaId);
  if (ids.length === 0) return 0;
  const { data, error } = await db.from('whatsapp_connections')
    .update({ status: 'disconnected', disconnected_at: new Date().toISOString() })
    .in('waba_id', ids).eq('status', 'active').select('id');
  if (error) throw error;
  return data.length;
}
