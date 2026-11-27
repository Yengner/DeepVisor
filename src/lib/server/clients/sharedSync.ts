import 'server-only';
import { createAdminClient } from '@/lib/server/supabase/admin';
import { resolvePlatformByKey, softDisconnectIntegration } from '@/lib/server/integrations/service';
import { syncSelectedMetaAdAccount } from '@/lib/server/integrations/metaSelection';
import { discoverMetaAdAccounts } from '@/lib/server/sync/meta/discoverMetaAdAccounts';
import { dispatchAccountSync } from '@/lib/server/sync/dispatch';
import { releaseIntegrationWebhooks } from '@/lib/server/webhooks/subscription';
import type { MetaAdAccountSnapshot } from '@/lib/server/integrations/types';
import type { Json } from '@/lib/shared/types/supabase';
import { SHARED_FROM_KEY, sharedFromBusiness } from '@/lib/shared/integrations/sharedConnection';
import { accountNumber } from '@/lib/shared/clients/model';
import { asRecord } from '@/lib/shared';
import type { Operator } from './operator';

/**
 * Syncing a client's linked ad account with the operator's Meta connection. Callers authorize first:
 * the operator, their own active client, and an account linked to that client. The client's
 * connection row stores the same Vault secret id as the operator's; the token is never read or
 * copied here.
 */

/** `error` values are message keys under `clients.error`. */
export type StartSyncResult = { ok: true } | { ok: false; error: 'noConnection' | 'account' | 'ownConnection' };

const RUNNING = ['connected', 'error', 'needs_reauth'];

type SourceConnection = {
  id: string; access_token_secret_id: string | null; token_expires_at: string | null; scopes: string[] | null;
  status: string; integration_details: Json;
};

/** The operator's own working Meta connection, or null when it can't be lent. */
async function sourceConnection(operatorBusinessId: string, platformId: string): Promise<SourceConnection | null> {
  const { data, error } = await createAdminClient().from('platform_integrations')
    .select('id,access_token_secret_id,token_expires_at,scopes,status,integration_details')
    .eq('business_id', operatorBusinessId).eq('platform_id', platformId).maybeSingle();
  if (error) throw error;
  if (!data || !['connected', 'error'].includes(data.status) || !data.access_token_secret_id) return null;
  if (sharedFromBusiness(data.integration_details)) return null;
  if (data.token_expires_at && Date.parse(data.token_expires_at) <= Date.now()) return null;
  return data;
}

/** What the lent connection takes from its source. */
function lentDetails(source: SourceConnection, operatorBusinessId: string) {
  const details = asRecord(source.integration_details);
  return {
    [SHARED_FROM_KEY]: operatorBusinessId,
    // Lets Meta's data deletion request reach this connection too.
    ...(typeof details.meta_user_id === 'string' ? { meta_user_id: details.meta_user_id } : {}),
    ...(typeof details.token_type === 'string' ? { token_type: details.token_type } : {}),
  };
}

export async function startClientSync(input: {
  operator: Operator; userId: string; businessId: string; accountNumber: string;
}): Promise<StartSyncResult> {
  const { operator, businessId } = input;
  if (businessId === operator.businessId) return { ok: false, error: 'account' };
  const db = createAdminClient();
  const platform = await resolvePlatformByKey(db, 'meta');
  if (!platform) return { ok: false, error: 'noConnection' };
  const source = await sourceConnection(operator.businessId, platform.id);
  if (!source) return { ok: false, error: 'noConnection' };

  const saved = await db.from('ad_accounts').select('external_account_id,name,status,currency_code,timezone')
    .eq('business_id', operator.businessId).eq('platform_id', platform.id)
    .in('external_account_id', [input.accountNumber, `act_${input.accountNumber}`]).limit(1).maybeSingle();
  if (saved.error) throw saved.error;
  if (!saved.data) return { ok: false, error: 'account' };

  const existing = await db.from('platform_integrations').select('id,status,access_token_secret_id,integration_details')
    .eq('business_id', businessId).eq('platform_id', platform.id).maybeSingle();
  if (existing.error) throw existing.error;
  // A business that signed in with its own Facebook keeps that connection.
  if (existing.data?.access_token_secret_id && !sharedFromBusiness(existing.data.integration_details)) {
    return { ok: false, error: 'ownConnection' };
  }

  // Only this account is registered for the client. No Meta request: the details are already saved.
  await discoverMetaAdAccounts({
    supabase: db, businessId, platformId: platform.id,
    snapshots: [{
      externalAccountId: saved.data.external_account_id,
      name: saved.data.name,
      status: saved.data.status as MetaAdAccountSnapshot['status'],
      currencyCode: saved.data.currency_code,
      timezone: saved.data.timezone,
    }],
  });

  const now = new Date().toISOString();
  const resumed = existing.data && RUNNING.includes(existing.data.status);
  const { data: connection, error } = await db.from('platform_integrations').upsert({
    business_id: businessId,
    platform_id: platform.id,
    status: 'connected',
    connected_by_user_id: input.userId,
    ...(resumed ? {} : { connected_at: now }),
    disconnected_at: null,
    access_token_secret_id: source.access_token_secret_id,
    refresh_token_secret_id: null,
    token_expires_at: source.token_expires_at,
    scopes: source.scopes ?? [],
    integration_details: {
      ...asRecord(existing.data?.integration_details),
      ...lentDetails(source, operator.businessId),
      status: 'connected', disconnected_at: null, last_error: null,
    } as Json,
    last_error: null,
    updated_at: now,
  }, { onConflict: 'business_id,platform_id' }).select('id').single();
  if (error) throw error;

  const result = await syncSelectedMetaAdAccount({
    supabase: db, businessId, integrationId: connection.id, platformId: platform.id,
    externalAccountId: saved.data.external_account_id, name: saved.data.name, trigger: 'manual_refresh',
  });
  if (result.syncJobId && result.firstSyncJob?.status !== 'completed') dispatchAccountSync(result.syncJobId, businessId);
  return { ok: true };
}

/** The account a client is syncing through the operator's connection, as digits. Null when none. */
export async function syncedClientAccount(businessId: string): Promise<string | null> {
  const { data, error } = await createAdminClient().from('platform_integrations').select('status,integration_details')
    .eq('business_id', businessId).in('status', RUNNING);
  if (error) throw error;
  const connection = data.find((row) => sharedFromBusiness(row.integration_details));
  const external = asRecord(connection?.integration_details).primary_ad_account_external_id;
  return typeof external === 'string' ? accountNumber(external) : null;
}

async function stopConnection(businessId: string, integrationId: string) {
  await releaseIntegrationWebhooks(integrationId, businessId).catch(() => console.warn('Meta webhook subscription could not be released.'));
  // The database keeps the secret while the operator's connection still uses it. Saved data stays.
  await softDisconnectIntegration(createAdminClient(), { businessId, integrationId });
}

/** Stops one client's shared syncing. A business's own connection is left alone. */
export async function stopClientSync(businessId: string): Promise<void> {
  const { data, error } = await createAdminClient().from('platform_integrations').select('id,integration_details')
    .eq('business_id', businessId).in('status', RUNNING);
  if (error) throw error;
  for (const row of data) {
    if (sharedFromBusiness(row.integration_details)) await stopConnection(businessId, row.id);
  }
}

async function lentConnections(sourceBusinessId: string) {
  const { data, error } = await createAdminClient().from('platform_integrations').select('id,business_id,integration_details')
    .eq(`integration_details->>${SHARED_FROM_KEY}`, sourceBusinessId).in('status', RUNNING);
  if (error) throw error;
  return data;
}

/**
 * Call before the operator disconnects or deletes Meta data. Otherwise the token would stay stored
 * and in use by clients, because they still point at it.
 */
export async function stopSharedConnections(sourceBusinessId: string): Promise<void> {
  for (const row of await lentConnections(sourceBusinessId)) await stopConnection(row.business_id, row.id);
}

/** After the operator signs in again: give running client connections the new expiry and scopes. */
export async function refreshSharedConnections(sourceBusinessId: string, platformId: string): Promise<void> {
  const rows = await lentConnections(sourceBusinessId);
  if (!rows.length) return;
  const source = await sourceConnection(sourceBusinessId, platformId);
  if (!source) return;
  const now = new Date().toISOString();
  for (const row of rows) {
    const { error } = await createAdminClient().from('platform_integrations').update({
      status: 'connected', connected_at: now, access_token_secret_id: source.access_token_secret_id,
      token_expires_at: source.token_expires_at, scopes: source.scopes ?? [], last_error: null, updated_at: now,
      integration_details: {
        ...asRecord(row.integration_details), ...lentDetails(source, sourceBusinessId), status: 'connected', last_error: null,
      } as Json,
    }).eq('id', row.id).eq('business_id', row.business_id);
    if (error) throw error;
  }
}
