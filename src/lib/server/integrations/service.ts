import type { SupabaseClient } from '@supabase/supabase-js';
import { asRecord } from '@/lib/shared';
import { generateState } from '@/lib/shared/utils/guards';
import type { Database, Json } from '@/lib/shared/types/supabase';
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

export function sanitizeReturnTo(value: string | null): IntegrationReturnTo {
  if (value && ALLOWED_RETURN_TO.has(value)) {
    return value as IntegrationReturnTo;
  }
  return '/integration';
}

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

export function getBaseUrl(requestUrl: string): string {
  return process.env.NEXT_PUBLIC_BASE_URL || new URL(requestUrl).origin;
}

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

function mergeDetails(
  details: Json | Record<string, unknown> | null | undefined,
  patch: Record<string, unknown>
): IntegrationDetails {
  return {
    ...asRecord(details),
    ...patch,
  };
}

function sanitizeIntegrationDetails(details: Record<string, any>): Record<string, any> {
  const copy = { ...details };

  delete copy.access_token;
  delete copy.refresh_token;
  delete copy.access_token_secret_id;
  delete copy.refresh_token_secret_id;

  return copy;
}

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

export type RefreshBusinessAdAccountsResult = {
  refreshedCount: number;
  failedCount: number;
  syncedAccountCount: number;
};

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

export async function resolveIntegrationAccessToken(
  supabase: AppSupabaseClient,
  integration: BusinessIntegration
): Promise<string | null> {
  const tokenOrSecretId = extractAccessToken(integration.integrationDetails, integration.accessToken);
  if (!tokenOrSecretId) {
    return null;
  }

  const { data, error } = await (supabase as any).rpc('get_platform_token', {
    secret_id: tokenOrSecretId,
  });

  if (!error && typeof data === 'string' && data.length > 0) {
    return data;
  }

  // Fallback for legacy rows where raw token may still exist.
  return tokenOrSecretId;
}

/**
 * @deprecated Prefer `syncConnectedBusinessPlatforms` / `syncBusinessPlatform`
 * from `@/lib/server/sync` for business-platform sync orchestration.
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
 */
export async function syncMetaAdAccountsSnapshot(
  supabase: AppSupabaseClient,
  input: {
    businessId: string;
    platformId: string;
    accessToken: string;
  }
): Promise<number> {
  const now = new Date().toISOString();
  const snapshots = await fetchMetaAdAccountSnapshots(input.accessToken);

  if (snapshots.length === 0) {
    return 0;
  }

  const rows = snapshots.map((snapshot) => ({
    business_id: input.businessId,
    platform_id: input.platformId,
    external_account_id: snapshot.externalAccountId,
    name: snapshot.name,
    status: snapshot.status,
    aggregated_metrics: snapshot.aggregatedMetrics,
    time_increment_metrics: snapshot.timeIncrementMetrics,
    last_synced: now,
    updated_at: now,
    created_at: now,
  }));

  const { error } = await supabase
    .from('ad_accounts')
    .upsert(rows, { onConflict: 'business_id,platform_id,external_account_id' });

  if (error) throw error;
  return rows.length;
}

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

export async function markIntegrationHealthy(
  supabase: AppSupabaseClient,
  integrationId: string
): Promise<void> {
  await markIntegrationSynced(supabase, integrationId);
}

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
