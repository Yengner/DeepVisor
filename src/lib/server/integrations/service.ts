import type { SupabaseClient } from '@supabase/supabase-js';
import { asRecord, toSupportedIntegrationPlatform } from '@/lib/shared';
import { generateState } from '@/lib/shared/utils/guards';
import type { Database, Json } from '@/lib/shared/types/supabase';
import { upsertAdAccounts } from '@/lib/server/repositories/ad_accounts/upsertAdAccounts';
import type {
  IntegrationDetails,
  IntegrationPlatform,
  IntegrationReturnTo,
  IntegrationStatus,
  OAuthStateRecord,
  SupportedIntegrationPlatform,
  UpsertIntegrationInput,
} from '@/lib/server/integrations/types';
import { toIntegrationStatus } from '@/lib/server/integrations/normalizers';
import {
  fetchMetaAdAccountSnapshots,
  validateMetaAccessToken,
} from '@/lib/server/integrations/adapters/meta';

type AppSupabaseClient = SupabaseClient<Database>;
type PlatformIntegrationStorageRow = {
  id: string;
  business_id: string;
  platform_id: string;
  access_token_secret_id: string | null;
  refresh_token_secret_id: string | null;
  status: IntegrationStatus;
  connected_by_user_id: string | null;
  connected_at: string | null;
  disconnected_at: string | null;
  token_expires_at: string | null;
  scopes: string[];
  integration_details: Json;
  last_synced_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
  platforms?: { key: string } | { key: string }[] | null;
};

const ALLOWED_RETURN_TO: ReadonlySet<string> = new Set(['/onboarding', '/integration']);

/**
 * Narrows a route segment down to a supported integration platform key.
 *
 * @param platform - Raw platform segment from a route or query string.
 * @returns A supported platform key when recognized, otherwise `null`.
 */
export function parseSupportedIntegrationPlatform(
  platform: string
): SupportedIntegrationPlatform | null {
  return toSupportedIntegrationPlatform(platform);
}

/**
 * Sanitizes the `returnTo` query param so redirects can only land on approved app surfaces.
 *
 * @param value - Raw `returnTo` value from a request.
 * @returns A safe integration return target, defaulting to `/integration`.
 */
export function sanitizeReturnTo(value: string | null): IntegrationReturnTo {
  if (value && ALLOWED_RETURN_TO.has(value)) {
    return value as IntegrationReturnTo;
  }
  return '/integration';
}

/**
 * Builds the in-app redirect path used after an integration connect attempt completes.
 *
 * @param returnTo - The app surface that initiated the connect flow.
 * @param platform - The platform being connected.
 * @param status - Whether the result should be treated as success or error.
 * @returns A relative path with normalized integration status query params.
 */
export function buildIntegrationResultPath(
  returnTo: IntegrationReturnTo,
  platform: SupportedIntegrationPlatform,
  status: 'connected' | 'error'
): string {
  const url = new URL(returnTo, 'http://localhost');
  url.searchParams.set('integration', platform);
  url.searchParams.set('status', status);
  return `${url.pathname}${url.search}`;
}

/**
 * Resolves the absolute base URL used when the app needs to build callback or redirect URLs.
 *
 * @param requestUrl - The current request URL as received by Next.js.
 * @returns The configured public base URL when available, otherwise the request origin.
 */
export function getBaseUrl(requestUrl: string): string {
  return process.env.NEXT_PUBLIC_BASE_URL || new URL(requestUrl).origin;
}

/**
 * Extracts the stored access-token reference from integration details.
 *
 * In Vault-backed rows this is the secret id, but the helper stays tolerant of either
 * `access_token` or `access_token_secret_id` keys so older shapes can still be parsed.
 *
 * @param details - Raw integration details JSON from storage.
 * @param fallback - Optional fallback token reference from the row-level access token column.
 * @returns The stored token reference when present, otherwise `null`.
 */
export function extractAccessToken(details: Json | null | undefined, fallback?: string | null): string | null {
  const tokenObject = asRecord(details);
  const token =
    (typeof tokenObject.access_token === 'string' && tokenObject.access_token) ||
    (typeof tokenObject.access_token_secret_id === 'string' && tokenObject.access_token_secret_id) ||
    null;
  if (typeof token === 'string' && token.length > 0) return token;
  if (typeof fallback === 'string' && fallback.length > 0) return fallback;
  return null;
}

/**
 * Removes token-bearing fields from integration details before writing them back to JSON storage.
 *
 * @param details - Raw integration details that may still contain token material.
 * @returns A copy of the details object without access or refresh token fields.
 */
function stripTokens(details: Json | Record<string, unknown> | null | undefined): IntegrationDetails {
  const {
    access_token: _a,
    refresh_token: _r,
    access_token_secret_id: _as,
    refresh_token_secret_id: _rs,
    ...rest
  } = asRecord(details);
  return rest as IntegrationDetails;
}

/**
 * Merges a shallow patch into integration details while tolerating `null` or malformed input.
 *
 * @param details - Existing integration details JSON.
 * @param patch - Fields that should override the current details.
 * @returns A merged integration-details object.
 */
function mergeDetails(
  details: Json | Record<string, unknown> | null | undefined,
  patch: Record<string, unknown>
): IntegrationDetails {
  return {
    ...asRecord(details),
    ...patch,
  };
}

/**
 * Removes raw token values from an integration-details payload before it is persisted.
 *
 * @param details - Integration-details object that may include raw OAuth token fields.
 * @returns A sanitized copy safe to store in `integration_details`.
 */
function sanitizeIntegrationDetails(details: Record<string, any>): Record<string, any> {
  const copy = { ...details };

  delete copy.access_token;
  delete copy.refresh_token;
  delete copy.access_token_secret_id;
  delete copy.refresh_token_secret_id;

  return copy;
}

/**
 * Upserts a token value into Vault and returns the resulting secret id.
 *
 * @param supabase - Server Supabase client used to call the Vault RPC.
 * @param value - Raw secret value that should be stored.
 * @param name - Stable Vault name used for the secret record.
 * @param description - Optional human-readable description for operators.
 * @returns The secret id returned by the Vault RPC.
 */
async function upsertSecret(
  supabase: AppSupabaseClient,
  value: string,
  name: string,
  description?: string | null
): Promise<string> {
  const { data, error } = await (supabase as any).rpc('upsert_platform_token', {
    secret_value: value,
    secret_name: name,
    secret_description: description ?? null,
  });

  if (error) throw error;
  if (!data) throw new Error('Failed to upsert secret in Vault');

  return data as string;
}

/**
 * Loads the platform record backing a supported integration key.
 *
 * @param supabase - Server Supabase client used to query platform metadata.
 * @param platformKey - Supported platform identifier such as `meta`.
 * @returns The matching platform row normalized for integration workflows, or `null` when missing.
 */
export async function resolvePlatformByKey(
  supabase: AppSupabaseClient,
  platformKey: SupportedIntegrationPlatform
): Promise<IntegrationPlatform | null> {
  const { data, error } = await supabase
    .from('platforms')
    .select('id, key, name')
    .eq('key', platformKey)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    id: data.id,
    key: data.key as SupportedIntegrationPlatform,
    name: data.name,
  };
}

/**
 * Creates and stores an OAuth state token for a pending integration handshake.
 *
 * @param supabase - Server Supabase client used to insert the OAuth state row.
 * @param input - User, business, and platform context that the state should be bound to.
 * @returns The generated opaque state token that should be sent to the provider.
 */
export async function createOAuthState(
  supabase: AppSupabaseClient,
  input: { userId: string; businessId: string; platformId: string }
): Promise<string> {
  const state = generateState();

  const { error } = await supabase.from('oauth_states').insert({
    user_id: input.userId,
    business_id: input.businessId,
    platform_id: input.platformId,
    state,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  });

  if (error) throw error;
  return state;
}

/**
 * Consumes a stored OAuth state token and validates that it still belongs to the user/platform pair.
 *
 * @param supabase - Server Supabase client used to load and delete the state record.
 * @param input - The state token and identity fields expected for this callback.
 * @returns The consumed OAuth state record, or `null` when it is missing or expired.
 */
export async function consumeOAuthState(
  supabase: AppSupabaseClient,
  input: { state: string; userId: string; platformId: string }
): Promise<OAuthStateRecord | null> {
  const { data, error } = await supabase
    .from('oauth_states')
    .select('id, state, user_id, business_id, platform_id, created_at, expires_at')
    .eq('state', input.state)
    .eq('user_id', input.userId)
    .eq('platform_id', input.platformId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  await supabase.from('oauth_states').delete().eq('id', data.id);

  if (new Date(data.expires_at).getTime() < Date.now()) {
    return null;
  }

  return data;
}

/**
 * Creates or updates the single integration row for a business/platform pair.
 *
 * The function persists token secrets into Vault, merges sanitized integration details,
 * and returns the active integration id that downstream sync flows should use.
 *
 * @param supabase - Server Supabase client used for Vault RPCs and row updates.
 * @param input - Business, platform, user, status, and token metadata for the integration.
 * @returns The id of the created or updated `platform_integrations` row.
 */
export async function upsertPlatformIntegration(
  supabase: AppSupabaseClient,
  input: UpsertIntegrationInput
): Promise<string> {
  const now = new Date().toISOString();

  const { data: existing, error: existingError } = await supabase
    .from('platform_integrations')
    .select('*')
    .eq('business_id', input.businessId)
    .eq('platform_id', input.platformId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) throw existingError;
  const existingRow = (existing ?? null) as unknown as PlatformIntegrationStorageRow | null;

  const rawAccessToken =
    typeof input.integrationDetails.access_token_secret_id === 'string'
      ? input.integrationDetails.access_token_secret_id
      : null;

  const rawRefreshToken =
    typeof input.integrationDetails.refresh_token_secret_id === 'string'
      ? input.integrationDetails.refresh_token_secret_id
      : null;

  const accessTokenSecretId =
    rawAccessToken
      ? await upsertSecret(
        supabase,
        rawAccessToken,
        `platform:${input.platformId}:business:${input.businessId}:access_token`,
        'OAuth access token'
      )
      : existingRow?.access_token_secret_id ?? null;


  const refreshTokenSecretId =
    rawRefreshToken
      ? await upsertSecret(
        supabase,
        rawRefreshToken,
        `platform:${input.platformId}:business:${input.businessId}:refresh_token`,
        'OAuth refresh token'
      )
      : existingRow?.refresh_token_secret_id ?? null;

  if (input.status === 'connected' && !accessTokenSecretId) {
    throw new Error('Missing access token secret id for integration upsert');
  }

  const sanitizedDetails = sanitizeIntegrationDetails(input.integrationDetails);

  const nextDetails = mergeDetails(existingRow?.integration_details, {
    ...sanitizedDetails,
    status: input.status,
    connected_at: input.connectedAt ?? existingRow?.connected_at ?? now,
    disconnected_at: input.disconnectedAt ?? null,
    last_error: input.lastError ?? null,
  });

  const expiresIn = input.integrationDetails.expires_in;
  const tokenExpiresAt =
    (typeof input.integrationDetails.token_expires_at === 'string' &&
      input.integrationDetails.token_expires_at) ||
    (typeof expiresIn === 'number' && Number.isFinite(expiresIn)
      ? new Date(Date.now() + expiresIn * 1000).toISOString()
      : existingRow?.token_expires_at ?? null);

  const scopes = Array.isArray(input.integrationDetails.scopes)
    ? input.integrationDetails.scopes.filter(
      (scope): scope is string => typeof scope === 'string'
    )
    : (existingRow?.scopes ?? []);

  const updatePayload = {
    status: input.status,
    connected_by_user_id: input.userId,
    connected_at:
      input.connectedAt ??
      existingRow?.connected_at ??
      (input.status === 'connected' ? now : null),
    disconnected_at:
      input.disconnectedAt ??
      (input.status === 'disconnected' ? now : null),
    access_token_secret_id: accessTokenSecretId,
    refresh_token_secret_id: refreshTokenSecretId,
    token_expires_at: tokenExpiresAt,
    scopes,
    integration_details: nextDetails as Json,
    last_error: input.lastError ?? null,
    updated_at: now,
  };

  if (existingRow?.id) {
    const { data, error } = await supabase
      .from('platform_integrations')
      .update(updatePayload as never)
      .eq('id', existingRow.id)
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  }

  const insertPayload = {
    business_id: input.businessId,
    platform_id: input.platformId,
    status: input.status,
    connected_by_user_id: input.userId,
    connected_at: input.connectedAt ?? (input.status === 'connected' ? now : null),
    disconnected_at: input.disconnectedAt ?? null,
    access_token_secret_id: accessTokenSecretId,
    refresh_token_secret_id: refreshTokenSecretId,
    token_expires_at: tokenExpiresAt,
    scopes,
    integration_details: nextDetails as Json,
    last_error: input.lastError ?? null,
    created_at: now,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from('platform_integrations')
    .insert(insertPayload as never)
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

/**
 * Soft-disconnects an integration without deleting its row or non-sensitive metadata.
 *
 * The function clears Vault secret ids and token expiry fields, marks the integration as
 * disconnected, and strips any token-bearing fields from the stored details payload.
 *
 * @param supabase - Server Supabase client used to load and update the integration row.
 * @param input - Business-scoped integration identifier to disconnect.
 * @returns A promise that resolves once the integration has been marked disconnected.
 */
export async function softDisconnectIntegration(
  supabase: AppSupabaseClient,
  input: { integrationId: string; businessId: string }
): Promise<void> {
  const now = new Date().toISOString();
  const { data: integration, error: fetchError } = await supabase
    .from('platform_integrations')
    .select('*')
    .eq('id', input.integrationId)
    .eq('business_id', input.businessId)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (!integration) throw new Error('Integration not found');
  const integrationRow = integration as unknown as PlatformIntegrationStorageRow;

  const disconnectedDetails = mergeDetails(stripTokens(integrationRow.integration_details), {
    status: 'disconnected',
    disconnected_at: now,
    last_error: null,
  });

  const { error: updateError } = await supabase
    .from('platform_integrations')
    .update({
      status: 'disconnected',
      disconnected_at: now,
      access_token_secret_id: null,
      refresh_token_secret_id: null,
      token_expires_at: null,
      integration_details: disconnectedDetails as Json,
      last_error: null,
      updated_at: now,
    })
    .eq('id', integrationRow.id)
    .eq('business_id', input.businessId);

  if (updateError) throw updateError;
}

export type BusinessIntegration = {
  id: string;
  platformId: string;
  platformKey: string;
  status: IntegrationStatus;
  isIntegrated: boolean;
  accessToken: string | null;
  integrationDetails: Json;
};

export type MetaIntegrationAccountOption = {
  externalAccountId: string;
  name: string | null;
  status: string | null;
};

export type RefreshBusinessAdAccountsResult = {
  refreshedCount: number;
  failedCount: number;
  syncedAccountCount: number;
};

/**
 * Lists every integration for a business and normalizes each row for app-layer consumption.
 *
 * @param supabase - Server Supabase client used to query the integration rows.
 * @param businessId - Business whose platform integrations should be listed.
 * @returns An array of normalized business-integration records.
 */
export async function listBusinessIntegrations(
  supabase: AppSupabaseClient,
  businessId: string
): Promise<BusinessIntegration[]> {
  const { data, error } = await supabase
    .from('platform_integrations')
    .select('*, platforms ( key )')
    .eq('business_id', businessId);

  if (error) throw error;

  return ((data ?? []) as unknown as PlatformIntegrationStorageRow[]).map((row) => {
    const platform = Array.isArray(row.platforms) ? row.platforms[0] : row.platforms;
    const details = asRecord(row.integration_details);
    const status = toIntegrationStatus(row.status ?? details.status);

    return {
      id: row.id,
      platformId: row.platform_id,
      platformKey: platform?.key ?? '',
      status,
      isIntegrated: status === 'connected',
      accessToken: row.access_token_secret_id,
      integrationDetails: row.integration_details,
    };
  });
}

/**
 * Resolves the live access token for an integration by reading the stored Vault secret.
 *
 * @param supabase - Server Supabase client used to call the Vault token RPC.
 * @param integration - Normalized integration record containing the token secret reference.
 * @returns The decrypted access token, or `null` when no token reference is stored.
 * @throws When the Vault lookup RPC fails.
 */
export async function resolveIntegrationAccessToken(
  supabase: AppSupabaseClient,
  integration: BusinessIntegration
): Promise<string | null> {
  const secretId = extractAccessToken(integration.integrationDetails, integration.accessToken);
  if (!secretId) {
    return null;
  }

  const { data: accessToken, error } = await (supabase as any).rpc('get_platform_token', {
    secret_id: secretId,
  });

  if (error) {
    throw error;
  }

  return typeof accessToken === 'string' && accessToken.length > 0
    ? accessToken
    : null;
}

/**
 * Reads the current primary ad-account selection from integration details.
 *
 * @param details - Raw integration details JSON stored on the integration row.
 * @returns The selected external account id, display name, and selection timestamp when available.
 */
export function getPrimaryAdAccountSelection(details: Json | null | undefined): { externalAccountId: string | null; name: string | null; selectedAt: string | null;} {
  const record = asRecord(details);

  return {
    externalAccountId:
      typeof record.primary_ad_account_external_id === 'string'
        ? record.primary_ad_account_external_id
        : null,
    name:
      typeof record.primary_ad_account_name === 'string'
        ? record.primary_ad_account_name
        : null,
    selectedAt:
      typeof record.account_selection_completed_at === 'string'
        ? record.account_selection_completed_at
        : null,
  };
}

/**
 * Loads one integration row for the active business and normalizes it for app workflows.
 *
 * @param supabase - Server Supabase client used to query the integration row.
 * @param input - Business id plus the target integration id.
 * @returns The normalized business integration, or `null` when the row does not exist.
 */
export async function getBusinessIntegrationById(
  supabase: AppSupabaseClient,
  input: { businessId: string; integrationId: string }
): Promise<BusinessIntegration | null> {
  const { data, error } = await supabase
    .from('platform_integrations')
    .select('*, platforms ( key )')
    .eq('business_id', input.businessId)
    .eq('id', input.integrationId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const row = data as unknown as PlatformIntegrationStorageRow;
  const platform = Array.isArray(row.platforms) ? row.platforms[0] : row.platforms;
  const details = asRecord(row.integration_details);
  const status = toIntegrationStatus(row.status ?? details.status);

  return {
    id: row.id,
    platformId: row.platform_id,
    platformKey: platform?.key ?? '',
    status,
    isIntegrated: status === 'connected',
    accessToken: row.access_token_secret_id,
    integrationDetails: row.integration_details,
  };
}

/**
 * Lists the Meta ad accounts currently accessible for an existing integration.
 *
 * @param supabase - Server Supabase client used to resolve the live access token.
 * @param integration - Normalized business integration record for the selected platform.
 * @returns A normalized list of accessible Meta ad account options.
 */
export async function listMetaAccessibleAdAccounts(
  supabase: AppSupabaseClient,
  integration: BusinessIntegration
): Promise<MetaIntegrationAccountOption[]> {
  if (integration.platformKey !== 'meta') {
    return [];
  }

  const accessToken = await resolveIntegrationAccessToken(supabase, integration);
  if (!accessToken) {
    throw new Error('Missing access token');
  }

  const snapshots = await fetchMetaAdAccountSnapshots(accessToken);
  return snapshots.map((snapshot) => ({
    externalAccountId: snapshot.externalAccountId,
    name: snapshot.name,
    status: snapshot.status,
  }));
}

/**
 * Stores the user's chosen primary Meta ad account on the integration record.
 *
 * @param supabase - Server Supabase client used to patch integration details.
 * @param input - Integration id plus the selected external ad account metadata.
 * @returns A promise that resolves once the integration details have been updated.
 */
export async function setPrimaryMetaAdAccount(
  supabase: AppSupabaseClient,
  input: {
    integrationId: string;
    externalAccountId: string;
    name: string | null;
  }
): Promise<void> {
  await patchIntegrationDetails(
    supabase,
    input.integrationId,
    {
      primary_ad_account_external_id: input.externalAccountId,
      primary_ad_account_name: input.name,
      account_selection_completed_at: new Date().toISOString(),
      last_error: null,
    },
    {
      last_error: null,
    }
  );
}

/**
 * @deprecated Prefer `syncConnectedBusinessPlatforms` / `syncBusinessPlatform`
 * from `@/lib/server/sync` for business-platform sync orchestration.
 *
 * Refreshes accessible Meta ad accounts for one business and records per-integration health.
 *
 * @param supabase - Server Supabase client used for integration lookups and updates.
 * @param input - Business id plus an optional platform filter.
 * @returns Aggregate counts describing how many integrations refreshed or failed.
 */
export async function refreshBusinessAdAccounts(
  supabase: AppSupabaseClient,
  input: { businessId: string; platform?: SupportedIntegrationPlatform }
): Promise<RefreshBusinessAdAccountsResult> {
  const integrations = await listBusinessIntegrations(supabase, input.businessId);

  let refreshedCount = 0;
  let failedCount = 0;
  let syncedAccountCount = 0;

  for (const integration of integrations) {
    if (!integration.isIntegrated) {
      continue;
    }

    if (input.platform && integration.platformKey !== input.platform) {
      continue;
    }

    if (integration.platformKey !== 'meta') {
      continue;
    }

    const accessToken = await resolveIntegrationAccessToken(supabase, integration);
    if (!accessToken) {
      failedCount += 1;
      await markIntegrationError(supabase, integration.id, 'Missing access token');
      continue;
    }

    try {
      await validateMetaAccessToken(accessToken);

      const syncedAccounts = await syncMetaAdAccountsSnapshot(supabase, {
        businessId: input.businessId,
        platformId: integration.platformId,
        accessToken,
      });

      await markIntegrationHealthy(supabase, integration.id);

      refreshedCount += 1;
      syncedAccountCount += syncedAccounts;
    } catch (error) {
      failedCount += 1;
      await markIntegrationError(
        supabase,
        integration.id,
        error instanceof Error ? error.message : 'Failed to refresh integration'
      );
    }
  }

  return {
    refreshedCount,
    failedCount,
    syncedAccountCount,
  };
}

/**
 * @deprecated Prefer `syncBusinessPlatform` from `@/lib/server/sync`.
 *
 * Syncs only the metadata snapshot of Meta ad accounts for an integration.
 *
 * @param supabase - Server Supabase client used to upsert ad-account rows.
 * @param input - Business/platform context plus the Meta access token to read from.
 * @returns The number of ad-account rows written during the snapshot sync.
 */
export async function syncMetaAdAccountsSnapshot(
  supabase: AppSupabaseClient,
  input: {
    businessId: string;
    platformId: string;
    accessToken: string;
  }
): Promise<number> {
  const snapshots = await fetchMetaAdAccountSnapshots(input.accessToken);

  if (snapshots.length === 0) {
    return 0;
  }

  // Deprecated path kept metadata-only so discovery does not imply a completed sync.
  const result = await upsertAdAccounts(supabase, snapshots.map((snapshot) => ({
    businessId: input.businessId,
    platformId: input.platformId,
    externalAccountId: snapshot.externalAccountId,
    name: snapshot.name,
    status: snapshot.status,
    currencyCode: snapshot.currencyCode,
    timezone: snapshot.timezone,
  })));

  return result.count;
}

/**
 * Applies a detail patch and optional row patch to an existing integration record.
 *
 * @param supabase - Server Supabase client used to read and update the integration row.
 * @param integrationId - The integration record to patch.
 * @param detailPatch - Fields to merge into the JSON `integration_details` payload.
 * @param rowPatch - Optional top-level row fields to update alongside the JSON payload.
 * @returns A promise that resolves once the patch has been written.
 */
async function patchIntegrationDetails(
  supabase: AppSupabaseClient,
  integrationId: string,
  detailPatch: Record<string, unknown>,
  rowPatch?: Record<string, unknown>
): Promise<void> {
  const { data: integration, error: fetchError } = await supabase
    .from('platform_integrations')
    .select('integration_details')
    .eq('id', integrationId)
    .single();

  if (fetchError) throw fetchError;

  const payload = {
    ...(rowPatch ?? {}),
    integration_details: mergeDetails(integration.integration_details, detailPatch) as Json,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('platform_integrations')
    .update(payload as never)
    .eq('id', integrationId);

  if (error) throw error;
}

/**
 * Marks an integration as healthy by forwarding to the synced-state updater.
 *
 * @param supabase - Server Supabase client used to patch the integration row.
 * @param integrationId - The integration record that should be marked healthy.
 * @returns A promise that resolves once the integration has been marked synced.
 */
export async function markIntegrationHealthy(
  supabase: AppSupabaseClient,
  integrationId: string
): Promise<void> {
  await markIntegrationSynced(supabase, integrationId);
}

/**
 * Marks an integration as successfully synced and clears any prior error state.
 *
 * @param supabase - Server Supabase client used to patch the integration row.
 * @param integrationId - The integration record that completed a successful sync.
 * @returns A promise that resolves once the synced state has been persisted.
 */
export async function markIntegrationSynced(
  supabase: AppSupabaseClient,
  integrationId: string
): Promise<void> {
  const now = new Date().toISOString();
  await patchIntegrationDetails(
    supabase,
    integrationId,
    {
      status: 'connected',
      disconnected_at: null,
      last_synced_at: now,
      last_error: null,
    },
    {
      status: 'connected',
      disconnected_at: null,
      last_synced_at: now,
      last_error: null,
    }
  );
}

/**
 * Marks an integration as failed and stores the latest error message for operator visibility.
 *
 * @param supabase - Server Supabase client used to patch the integration row.
 * @param integrationId - The integration record that encountered an error.
 * @param message - Human-readable error detail to persist on the integration.
 * @returns A promise that resolves once the error state has been written.
 */
export async function markIntegrationError(
  supabase: AppSupabaseClient,
  integrationId: string,
  message: string
): Promise<void> {
  await patchIntegrationDetails(
    supabase,
    integrationId,
    {
      status: 'error',
      last_error: message,
    },
    {
      status: 'error',
      last_error: message,
    }
  );
}
