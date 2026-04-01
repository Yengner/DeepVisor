import type { Json } from '@/lib/shared/types/supabase';
import { fetchMetaAdAccounts } from '@/lib/server/services/platforms/meta/ad_accounts/fetch';
import type {
  AdAccountDetails,
  AdAccountWithMetrics,
} from '@/lib/server/services/platforms/meta/types';
import type {
  MetaAdAccountSnapshot,
  MetaExchangeCodeInput,
  MetaOAuthBuildInput,
  MetaOAuthToken,
} from '@/lib/server/integrations/types';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function buildMetaOAuthUrl(input: MetaOAuthBuildInput): URL {
  const oauthUrl = new URL('https://www.facebook.com/v23.0/dialog/oauth');

  oauthUrl.searchParams.set('client_id', requireEnv('META_APP_ID'));
  oauthUrl.searchParams.set('redirect_uri', input.redirectUri);
  oauthUrl.searchParams.set('state', input.state);
  oauthUrl.searchParams.set('response_type', 'code');

  const configId = process.env.META_BUSINESS_CONFIG_ID;
  if (configId) {
    oauthUrl.searchParams.set('config_id', configId);
  }

  return oauthUrl;
}

export async function exchangeMetaCodeForToken(input: MetaExchangeCodeInput): Promise<MetaOAuthToken> {
  const appId = requireEnv('META_APP_ID');
  const appSecret = requireEnv('META_APP_SECRET');

  const tokenUrl = new URL('https://graph.facebook.com/v23.0/oauth/access_token');
  tokenUrl.searchParams.set('client_id', appId);
  tokenUrl.searchParams.set('redirect_uri', input.redirectUri);
  tokenUrl.searchParams.set('client_secret', appSecret);
  tokenUrl.searchParams.set('code', input.code);

  const response = await fetch(tokenUrl);
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const message = typeof errorBody?.error?.message === 'string'
      ? errorBody.error.message
      : 'Failed to exchange Meta OAuth code';
    throw new Error(message);
  }

  const data = (await response.json()) as MetaOAuthToken;
  if (!data.access_token) {
    throw new Error('Meta OAuth response did not include an access token');
  }

  return data;
}

export async function validateMetaAccessToken(accessToken: string): Promise<void> {
  const url = new URL('https://graph.facebook.com/me');
  url.searchParams.set('fields', 'id');
  url.searchParams.set('access_token', accessToken);

  const response = await fetch(url);
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const message = typeof errorBody?.error?.message === 'string'
      ? errorBody.error.message
      : 'Meta token validation failed';
    throw new Error(message);
  }
}

function normalizeMetaStatus(status: string | number | null | undefined | unknown): string | null {
  const normalized = String(status ?? '');

  switch (normalized) {
    case '1':
      return 'active';
    case '2':
      return 'disabled';
    case '3':
      return 'disabled';
    default:
      return 'pending';
  }
}

function normalizeMetrics(value: unknown): Json | null {
  if (value == null) return null;
  return value as Json;
}

function isAdAccountWithMetrics(
  value: AdAccountWithMetrics | AdAccountDetails
): value is AdAccountWithMetrics {
  return 'details' in value;
}

export async function fetchMetaAdAccountSnapshots(
  accessToken: string,
  options: {
    externalAccountId?: string;
    includeMetrics?: boolean;
  } = {}
): Promise<MetaAdAccountSnapshot[]> {
  const raw = await fetchMetaAdAccounts(
    options.includeMetrics ?? false,
    accessToken,
    options.externalAccountId
  );
  const accounts = Array.isArray(raw) ? raw : [raw];

  return accounts
    .map((account) => {
      const details = isAdAccountWithMetrics(account) ? account.details : account;
      if (!details || typeof details.id !== 'string') return null;

      return {
        externalAccountId: details.id,
        name: typeof details.name === 'string' ? details.name : null,
        status: normalizeMetaStatus(details.account_status),
        currencyCode: typeof details.currency === 'string' ? details.currency : null,
        timezone: typeof details.timezone_name === 'string' ? details.timezone_name : null,
        aggregatedMetrics: isAdAccountWithMetrics(account)
          ? normalizeMetrics(account.maximumMetrics)
          : null,
        timeIncrementMetrics: isAdAccountWithMetrics(account)
          ? normalizeMetrics(account.incrementMetrics)
          : null,
      } satisfies MetaAdAccountSnapshot;
    })
    .filter((row): row is MetaAdAccountSnapshot => row !== null);
}
