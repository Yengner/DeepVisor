import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/server/supabase/server';
import { requireUserId } from '@/lib/server/actions/user/session';
import { getOrCreateOrganizationBusinessContext } from '@/lib/server/actions/business/context';
import {
  exchangeMetaCodeForToken,
  fetchMetaAdAccountSnapshots,
  validateMetaAccessToken,
} from '@/lib/server/integrations/adapters/meta';
import {
  buildIntegrationResultPath,
  consumeOAuthState,
  getBaseUrl,
  markIntegrationError,
  parseSupportedIntegrationPlatform,
  resolvePlatformByKey,
  setPrimaryMetaAdAccount,
  sanitizeReturnTo,
  upsertPlatformIntegration,
} from '@/lib/server/integrations/service';
import { discoverMetaAdAccounts } from '@/lib/server/sync/meta/discoverMetaAdAccounts';
import type { SupportedIntegrationPlatform } from '@/lib/shared/types/integrations';

/**
 * Redirects the OAuth callback back into the app with a normalized integration result state.
 *
 * @param requestUrl - The absolute callback URL received from the provider.
 * @param returnTo - The in-app surface that initiated the OAuth flow.
 * @param platform - The supported integration platform being resolved.
 * @param status - Whether the callback completed successfully or failed.
 * @returns A redirect response to the integration result URL inside the app.
 */
function redirectWithStatus(
  requestUrl: string,
  returnTo: '/onboarding' | '/integration',
  platform: SupportedIntegrationPlatform,
  status: 'connected' | 'error'
) {
  const baseUrl = getBaseUrl(requestUrl);
  const path = buildIntegrationResultPath(returnTo, platform, status);
  return NextResponse.redirect(new URL(path, baseUrl));
}

/**
 * Redirects the user into the post-connect account-selection flow for Meta.
 *
 * @param input - Redirect context including the selected return surface, integration id, and optional account hints.
 * @returns A redirect response to the integration page with account-selection query params applied.
 */
function redirectWithAccountSelection(input: {
  requestUrl: string;
  returnTo: '/onboarding' | '/integration';
  platform: SupportedIntegrationPlatform;
  integrationId: string;
  externalAccountId?: string | null;
  autoSync?: boolean;
}) {
  const baseUrl = getBaseUrl(input.requestUrl);
  const path = buildIntegrationResultPath(input.returnTo, input.platform, 'connected');
  const url = new URL(path, baseUrl);
  url.searchParams.set('requires_account_selection', '1');
  url.searchParams.set('integrationId', input.integrationId);
  if (input.externalAccountId) {
    url.searchParams.set('externalAccountId', input.externalAccountId);
  }
  if (input.autoSync) {
    url.searchParams.set('auto_sync', '1');
  }
  return NextResponse.redirect(url);
}

/**
 * Completes an OAuth callback for a supported advertising platform.
 *
 * The handler validates the callback payload, exchanges the provider code for a token,
 * creates or updates the platform integration record, discovers accessible Meta ad
 * accounts, and finally redirects the user into either the success or account-selection flow.
 *
 * @param request - The Next.js request carrying the provider callback query params.
 * @param context - Route params containing the platform segment from the callback URL.
 * @returns A redirect response back into the app for either the happy path or an error state.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ platform: string }> }
) {
  const { platform } = await context.params;
  const returnTo = sanitizeReturnTo(request.nextUrl.searchParams.get('returnTo'));
  const platformKey = parseSupportedIntegrationPlatform(platform);

  if (!platformKey) {
    return redirectWithStatus(request.url, returnTo, 'meta', 'error');
  }

  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const providerError = request.nextUrl.searchParams.get('error');

  if (providerError || !code || !state) {
    return redirectWithStatus(request.url, returnTo, platformKey, 'error');
  }

  let integrationId: string | null = null;

  try {
    const supabase = await createServerClient();
    const userId = await requireUserId();
    const businessContext = await getOrCreateOrganizationBusinessContext(userId);

    const integrationPlatform = await resolvePlatformByKey(supabase, platformKey);
    if (!integrationPlatform) {
      return redirectWithStatus(request.url, returnTo, platformKey, 'error');
    }

    const oauthState = await consumeOAuthState(supabase, {
      state,
      userId,
      platformId: integrationPlatform.id,
    });

    if (!oauthState || oauthState.business_id !== businessContext.businessId) {
      return redirectWithStatus(request.url, returnTo, platformKey, 'error');
    }

    const baseUrl = getBaseUrl(request.url);
    const redirectUri = new URL(`/api/integrations/callback/${platformKey}`, baseUrl);
    redirectUri.searchParams.set('returnTo', returnTo);

    const token = await exchangeMetaCodeForToken({
      code,
      redirectUri: redirectUri.toString(),
    });
    
    await validateMetaAccessToken(token.access_token);
    integrationId = await upsertPlatformIntegration(supabase, {
      businessId: businessContext.businessId,
      platformId: integrationPlatform.id,
      userId,
      status: 'connected',
      connectedAt: new Date().toISOString(),
      disconnectedAt: null,
      lastError: null,
      integrationDetails: {
        access_token_secret_id: token.access_token,
        refresh_token_secret_id: token.refresh_token,
        token_type: token.token_type,
        expires_in: token.expires_in,
        issued_at: new Date().toISOString(),
      },
    });

    const accessibleAccounts = await fetchMetaAdAccountSnapshots(token.access_token);
    if (accessibleAccounts.length === 0) {
      throw new Error('No accessible Meta ad accounts were found for this integration');
    }

    // Run discovery for every successful Meta callback so both the multi-account
    // and single-account paths start from the same registered account state.
    await discoverMetaAdAccounts({
      supabase,
      businessId: businessContext.businessId,
      platformId: integrationPlatform.id,
      snapshots: accessibleAccounts,
    });

    if (accessibleAccounts.length > 1) {
      return redirectWithAccountSelection({
        requestUrl: request.url,
        returnTo,
        platform: platformKey,
        integrationId,
      });
    }

    const selectedAccount = accessibleAccounts[0];
    await setPrimaryMetaAdAccount(supabase, {
      integrationId,
      externalAccountId: selectedAccount.externalAccountId,
      name: selectedAccount.name,
    });

    return redirectWithAccountSelection({
      requestUrl: request.url,
      returnTo,
      platform: platformKey,
      integrationId,
      externalAccountId: selectedAccount.externalAccountId,
      autoSync: true,
    });
  } catch (error) {
    console.error('Integration callback failed:', error);

    if (integrationId) {
      try {
        const supabase = await createServerClient();
        await markIntegrationError(
          supabase,
          integrationId,
          error instanceof Error ? error.message : 'Integration callback failed'
        );
      } catch (markError) {
        console.error('Failed to persist integration error:', markError);
      }
    }

    return redirectWithStatus(request.url, returnTo, platformKey, 'error');
  }
}
