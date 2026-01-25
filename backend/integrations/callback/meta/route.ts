import { storeAdAccounts, storeIntegration, storePageAccounts } from '@/lib/actions/store';
import { triggerMetaCampaignSync } from '@/lib/actions/sync/campaigns/triggerMetaCampaignSync';
import { getLoggedInUser, updateUserConnectedAccounts } from '@/lib/actions/user';
import { fetchMetaAdAccounts } from '@/lib/api/platforms/meta/ad_accounts/fetch';
import { fetchMetaPageAccounts } from '@/lib/api/platforms/meta/page/fetch';
import { redirectWithError } from '@/lib/utils/error-handling';
import { createSupabaseClient } from '@/lib/utils/supabase/clients/server';
import { NextResponse } from 'next/server';


export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const returnPath = searchParams.get('return') || '/integration';
  const isOnboarding = returnPath.includes('/onboarding');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const platformName = 'meta';

  if (error) {
    return redirectWithError(request, isOnboarding, error);
  }
  if (!code || !state) {
    return redirectWithError(request, isOnboarding, 'missing_code_or_state');
  }

  try {
    const supabase = await createSupabaseClient();
    const user = await getLoggedInUser();
    const userId = user?.id;
    const userTier = user?.plan_tier

    // Verifying the state parameter to prevent CSRF attacks
    const { data: stateData, error: stateError } = await supabase
      .from('oauth_states')
      .select('*')
      .eq('state', state)
      .eq('user_id', userId)
      .single();

    if (stateError || !stateData) {
      console.error('Invalid OAuth state:', stateError);
      return redirectWithError(request, isOnboarding, 'invalid_state');
    }

    // Clean the state from the database
    await supabase.from('oauth_states').delete().eq('state', state).eq('user_id', userId);

    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;
    const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL}/api/integrations/callback/meta?return=${encodeURIComponent(returnPath)}`;

    const tokenUrl = `https://graph.facebook.com/v23.0/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${appSecret}&code=${code}`;
    const response = await fetch(tokenUrl);

    if (!response.ok) {
      const errorDetails = await response.json();
      throw new Error(errorDetails.error?.message || 'Failed to fetch access token');
    }

    const tokenData = await response.json();
    if (!tokenData.access_token) {
      throw new Error('Access token is missing in the response');
    }

    const platformIntegrationId = await storeIntegration(
      supabase,
      userId,
      tokenData.access_token,
      platformName
    );

    const adAccountsData = await fetchMetaAdAccounts(true, tokenData.access_token);
    const pageAccountsData = await fetchMetaPageAccounts(tokenData.access_token);

    // Check if user needs to select an account (tier1/with multiple accounts)
    if (needsAccountSelection(userTier, adAccountsData, isOnboarding)) {
      const accountsEncoded = encodeURIComponent(JSON.stringify(adAccountsData));
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL}/integration/meta/select-account?accounts=${accountsEncoded}&platformIntegrationId=${platformIntegrationId}&tier=${userTier}`
      );
    }

    const adAccountsResult = await storeAdAccounts(
      supabase,
      userId,
      platformIntegrationId,
      adAccountsData,
      false,
      userTier
    );
    if (!adAccountsResult) {
      throw new Error('Failed to store ad accounts');
    }
    const { accounts: savedAdAccounts, accountIdMap } = adAccountsResult;

    await storePageAccounts(
      supabase,
      userId,
      platformIntegrationId,
      pageAccountsData
    );

    await updateUserConnectedAccounts(supabase, userId, savedAdAccounts, accountIdMap);

    // Just learned Fire-and-Forget 
    triggerMetaCampaignSync(userId).catch(console.error);

    if (isOnboarding) {
      const redirectUrl = new URL(`${process.env.NEXT_PUBLIC_BASE_URL}/onboarding`);
      redirectUrl.searchParams.append('platform', platformName);
      redirectUrl.searchParams.append('status', 'success');

      if (Array.isArray(savedAdAccounts) && savedAdAccounts.length > 0) {
        redirectUrl.searchParams.append('account_id', savedAdAccounts[0].id);
      }

      return NextResponse.redirect(redirectUrl);
    } else {
      const successUrl = new URL(`${process.env.NEXT_PUBLIC_BASE_URL}${decodeURIComponent(returnPath)}`);
      successUrl.searchParams.append('success', 'true');

      return NextResponse.redirect(successUrl);
    }
  } catch (error) {
    console.error('Error during Meta OAuth callback:', error);
    return redirectWithError(request, isOnboarding, 'unexpected_error');
  }
}


/**
 * Check if user needs account selection based on tier and accounts
 */
function needsAccountSelection(
  userTier: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adAccounts: any,
  isOnboarding: boolean
): boolean {
  // During onboarding we'll just use the first account for simplicity
  if (isOnboarding) {
    return false;
  }

  // If tier1 or free and has multiple accounts
  return (userTier === 'tier1' || userTier === 'free') && Array.isArray(adAccounts) && adAccounts.length > 1;
}
