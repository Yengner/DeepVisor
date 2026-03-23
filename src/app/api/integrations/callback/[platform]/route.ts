import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/server/supabase/server';
import { requireUserId } from '@/lib/server/actions/user/session';
import { resolveCurrentSelection } from '@/lib/server/actions/app/selection';
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
  resolvePlatformByKey,
  sanitizeReturnTo,
  setPrimaryMetaAdAccount,
  upsertPlatformIntegration,
} from '@/lib/server/integrations/service';
import { syncBusinessPlatform } from '@/lib/server/sync';
import type { SupportedIntegrationPlatform } from '@/lib/shared/types/integrations';

function toSupportedPlatform(platform: string): SupportedIntegrationPlatform | null {
  if (platform === 'meta') return 'meta';
  return null;
}

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

function redirectWithAccountSelection(input: {
  requestUrl: string;
  platform: SupportedIntegrationPlatform;
  integrationId: string;
}) {
  const baseUrl = getBaseUrl(input.requestUrl);
  const path = buildIntegrationResultPath('/integration', input.platform, 'connected');
  const url = new URL(path, baseUrl);
  url.searchParams.set('requires_account_selection', '1');
  url.searchParams.set('integrationId', input.integrationId);
  return NextResponse.redirect(url);
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ platform: string }> }
) {
  const { platform } = await context.params;
  const returnTo = sanitizeReturnTo(request.nextUrl.searchParams.get('returnTo'));
  const platformKey = toSupportedPlatform(platform);

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

    if (accessibleAccounts.length > 1) {
      return redirectWithAccountSelection({
        requestUrl: request.url,
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

    await syncBusinessPlatform({
      businessId: businessContext.businessId,
      platformId: integrationPlatform.id,
      trigger: 'integration',
    });

    const response = redirectWithStatus(request.url, returnTo, platformKey, 'connected');
    const selection = await resolveCurrentSelection(businessContext.businessId);

    if (selection.selectedPlatformId) {
      response.cookies.set('platform_integration_id', selection.selectedPlatformId, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
      });
    }

    if (selection.selectedAdAccountId) {
      response.cookies.set('ad_account_row_id', selection.selectedAdAccountId, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
      });
    }

    return response;
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
