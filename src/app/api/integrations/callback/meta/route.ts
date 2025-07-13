import {
  redirectWithError,
  storeMetaIntegration,
  fetchMetaAdAccounts,
  fetchMetaPageAccounts,
  storeAdAccounts,
  storePageAccounts,
  updateUserConnectedAccounts,
  needsAccountSelection,
  triggerMetaSync
} from '@/lib/actions/sync/ad_accounts/utils';
import { getUserSubscriptionTier } from '@/lib/utils/subscription';
import { createSupabaseClient } from '@/lib/utils/supabase/clients/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const returnPath = searchParams.get('return') || '/integration';
  const isOnboarding = returnPath.includes('/onboarding');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  console.log('searchParams: in callback', searchParams.toString());


  if (error) {
    return redirectWithError(request, isOnboarding, error);
  }
  if (!code || !state) {
    return redirectWithError(request, isOnboarding, 'missing_code_or_state');
  }

  try {
    const supabase = await createSupabaseClient();

    // Verifying the state parameter to prevent CSRF attacks
    const { data: stateData, error: stateError } = await supabase
      .from('oauth_states')
      .select('user_id')
      .eq('state', state)
      .eq('platform', 'meta')
      .single();

    if (stateError || !stateData) {
      console.error('Invalid OAuth state:', stateError);
      return redirectWithError(request, isOnboarding, 'invalid_state');
    }

    const userId = stateData.user_id;

    // Clean the state from the database
    await supabase.from('oauth_states').delete().eq('state', state);

    // Exchange code for access token
    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;
    const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL}/api/integrations/callback/meta?return=${encodeURIComponent(returnPath)}`;

    const tokenUrl = `https://graph.facebook.com/v21.0/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${appSecret}&code=${code}`;
    const response = await fetch(tokenUrl);

    if (!response.ok) {
      const errorDetails = await response.json();
      throw new Error(errorDetails.error?.message || 'Failed to fetch access token');
    }

    const tokenData = await response.json();
    if (!tokenData.access_token) {
      throw new Error('Access token is missing in the response');
    }

    // Get user's subscription tier
    const userTier = await getUserSubscriptionTier(userId);
    // Store platform integration
    const platformIntegrationId = await storeMetaIntegration(
      supabase,
      userId,
      tokenData.access_token
    );

    // Fetch ad accounts and page accounts
    const adAccountsData = await fetchMetaAdAccounts(tokenData.access_token);
    const pageAccountsData = await fetchMetaPageAccounts(tokenData.access_token);

    // Check if user needs to select an account (tier1/free with multiple accounts)
    if (needsAccountSelection(userTier, adAccountsData.data, isOnboarding)) {
      // Redirect to account selection page
      const accountsEncoded = encodeURIComponent(JSON.stringify(adAccountsData.data));
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL}/integration/meta/select-account?accounts=${accountsEncoded}&platformIntegrationId=${platformIntegrationId}&tier=${userTier}`
      );
    }

    // Store ad accounts with tier limits applied
    const { accounts: savedAdAccounts, accountIdMap } = await storeAdAccounts(
      supabase,
      userId,
      platformIntegrationId,
      adAccountsData.data,
      userTier
    );

    // Store page accounts
    await storePageAccounts(
      supabase,
      userId,
      platformIntegrationId,
      pageAccountsData.data
    );

    // Update user's connected accounts
    await updateUserConnectedAccounts(supabase, userId, savedAdAccounts, accountIdMap);

    // Trigger sync function
    await triggerMetaSync(userId);

    // Redirect based on flow
    if (isOnboarding) {
      // If coming from onboarding, redirect back to onboarding with success status
      const redirectUrl = new URL(`${process.env.NEXT_PUBLIC_BASE_URL}/onboarding`);
      redirectUrl.searchParams.append('platform', 'meta');
      redirectUrl.searchParams.append('status', 'success');

      // Include the first ad account ID for reference
      if (savedAdAccounts.length > 0) {
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
