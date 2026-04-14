import { fetchMetaAdAccounts } from '@/lib/server/services/platforms/meta/ad_accounts/fetch';
import type { AdAccountDetails } from '@/lib/server/services/platforms/meta/types';
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

/**
 * Exchanges a Meta OAuth authorization code for an access token payload.
 *
 * @param input - The provider authorization code plus the exact redirect URI used for the flow.
 * @returns The normalized Meta OAuth token response.
 * @throws When Meta rejects the exchange or does not return an access token.
 */
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

/**
 * Verifies that a Meta access token can still successfully call the Graph API.
 *
 * @param accessToken - Meta access token returned from the OAuth exchange.
 * @returns A resolved promise when the token is valid.
 * @throws When Meta reports that the token is invalid or unusable.
 */
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

/**
 * Fetches the Meta ad accounts accessible to the current token and normalizes them for app storage.
 *
 * @param accessToken - Meta access token used to read accessible ad accounts.
 * @param options - Optional account filter used when the caller wants a single external account.
 * @returns A normalized list of ad account snapshots suitable for integration setup and discovery.
 */
export async function fetchMetaAdAccountSnapshots(
  accessToken: string,
  options: {
    externalAccountId?: string;
  } = {}
): Promise<MetaAdAccountSnapshot[]> {
  const raw = await fetchMetaAdAccounts(accessToken, options.externalAccountId);
  const accounts = Array.isArray(raw) ? raw : [raw];

  return accounts
    .map((account) => {
      if (!account || typeof account.id !== 'string') return null;

      return {
        externalAccountId: account.id,
        name: typeof account.name === 'string' ? account.name : null,
        status: normalizeMetaStatus(account.account_status),
        currencyCode: typeof account.currency === 'string' ? account.currency : null,
        timezone: typeof account.timezone_name === 'string' ? account.timezone_name : null,
      } satisfies MetaAdAccountSnapshot;
    })
    .filter((row): row is MetaAdAccountSnapshot => row !== null);
}
