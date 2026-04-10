import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/server/supabase/server';
import { requireUserId } from '@/lib/server/actions/user/session';
import { getOrCreateOrganizationBusinessContext } from '@/lib/server/actions/business/context';
import { buildMetaOAuthUrl } from '@/lib/server/integrations/adapters/meta';
import {
  buildIntegrationResultPath,
  createOAuthState,
  getBaseUrl,
  parseSupportedIntegrationPlatform,
  resolvePlatformByKey,
  sanitizeReturnTo,
} from '@/lib/server/integrations/service';

function buildErrorRedirect(requestUrl: string, returnTo: '/onboarding' | '/integration') {
  const baseUrl = getBaseUrl(requestUrl);
  const path = buildIntegrationResultPath(returnTo, 'meta', 'error');
  return NextResponse.redirect(new URL(path, baseUrl));
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ platform: string }> }
) {
  const { platform } = await context.params;
  const returnTo = sanitizeReturnTo(request.nextUrl.searchParams.get('returnTo'));
  const platformKey = parseSupportedIntegrationPlatform(platform);
  if (!platformKey) {
    return buildErrorRedirect(request.url, returnTo);
  }

  try {
    const supabase = await createServerClient();
    const userId = await requireUserId();
    const businessContext = await getOrCreateOrganizationBusinessContext(userId);

    const integrationPlatform = await resolvePlatformByKey(supabase, platformKey);
    if (!integrationPlatform) {
      return buildErrorRedirect(request.url, returnTo);
    }

    const state = await createOAuthState(supabase, {
      userId,
      businessId: businessContext.businessId,
      platformId: integrationPlatform.id,
    });

    const baseUrl = getBaseUrl(request.url);
    const callbackUrl = new URL(`/api/integrations/callback/${platformKey}`, baseUrl);
    callbackUrl.searchParams.set('returnTo', returnTo);

    const oauthUrl = buildMetaOAuthUrl({
      state,
      redirectUri: callbackUrl.toString(),
    });

    return NextResponse.redirect(oauthUrl);
  } catch (error) {
    console.error('Error initiating integration OAuth:', error);
    return buildErrorRedirect(request.url, returnTo);
  }
}
