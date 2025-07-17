import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/utils/supabase/clients/server';
import { generateState } from '@/lib/utils/utils';
import { redirectWithError } from '@/lib/utils/error-handling';
import { getLoggedInUser } from '@/lib/actions/user.actions';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);

        const returnPath = searchParams.get('returnPath') || '/integration';
        const isOnboarding = returnPath.includes('/onboarding');

        const supabase = await createSupabaseClient();
        const loggedIn = await getLoggedInUser();
        const userId = loggedIn?.id;

        const state = generateState();
        const { error: stateError } = await supabase.from('oauth_states').insert({
            user_id: userId,
            platform: 'meta',
            state,
            created_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 3600000).toISOString() // 1 hour expiry
        });

        if (stateError) {
            console.error('Failed to store OAuth state:', stateError);
            return redirectWithError(request, isOnboarding, 'state_storage_error');
        }

        const oauthUrl = new URL('https://www.facebook.com/v23.0/dialog/oauth');

        oauthUrl.searchParams.append('client_id', process.env.META_APP_ID!);
        oauthUrl.searchParams.append('redirect_uri', `${process.env.NEXT_PUBLIC_BASE_URL!}/api/integrations/callback/meta?return=${encodeURIComponent(returnPath)}`);
        oauthUrl.searchParams.append('state', state);
        oauthUrl.searchParams.append('response_type', 'code');
        oauthUrl.searchParams.append('config_id', process.env.META_BUSINESS_CONFIG_ID!);

        return NextResponse.redirect(oauthUrl);

    } catch (error) {
        console.error('Error initiating Meta OAuth connection:', error);

        // Get return path again to handle errors properly
        const { searchParams } = new URL(request.url);
        const returnPath = searchParams.get('return') || '/integrations';
        const isOnboarding = returnPath.includes('/onboarding');

        redirectWithError(request, isOnboarding, 'server_error');
    }
}