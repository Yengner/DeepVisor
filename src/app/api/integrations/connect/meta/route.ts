import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/utils/supabase/clients/server';
import { generateState } from '@/lib/utils/utils';

// API route to initiate Meta (Facebook) OAuth connection
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        console.log('Search Params:', searchParams.toString());
        // Fix parameter naming to match what components are sending
        const returnPath = searchParams.get('returnPath') || '/integration';
        console.log('Return Path:', returnPath);
        const isOnboarding = returnPath.includes('/onboarding');

        // Get authenticated user
        const supabase = await createSupabaseClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            console.error('Authentication error:', authError);
            return NextResponse.redirect(new URL('/login', request.url));
        }

        // Generate a secure state parameter
        const state = generateState();

        // Store the state parameter in the database
        const { error: stateError } = await supabase.from('oauth_states').insert({
            user_id: user.id,
            platform: 'meta',
            state,
            created_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 3600000).toISOString() // 1 hour expiry
        });

        if (stateError) {
            console.error('Failed to store OAuth state:', stateError);
            // Handle error based on flow type
            if (isOnboarding) {
                return NextResponse.redirect(
                    new URL('/onboarding?platform=meta&status=error&error=server_error', request.url)
                );
            } else {
                return NextResponse.redirect(
                    new URL(`${returnPath}?platform=meta&status=error&error=server_error`, request.url)
                );
            }
        }

        // Construct the Meta OAuth URL
        const oauthUrl = new URL('https://www.facebook.com/v21.0/dialog/oauth');

        // Add required parameters
        oauthUrl.searchParams.append('client_id', process.env.META_APP_ID!);
        oauthUrl.searchParams.append('redirect_uri', `${process.env.NEXT_PUBLIC_BASE_URL!}/api/integrations/callback/meta?return=${encodeURIComponent(returnPath)}`);
        oauthUrl.searchParams.append('state', state);

        // Response type and display
        oauthUrl.searchParams.append('response_type', 'code');

        // For business integrations
        if (process.env.META_BUSINESS_CONFIG_ID) {
            oauthUrl.searchParams.append('config_id', process.env.META_BUSINESS_CONFIG_ID);
        }

        // Scopes - add all needed permissions
        oauthUrl.searchParams.append('scope', 'ads_management,ads_read,business_management,pages_read_engagement');

        // Redirect the user to the Meta OAuth URL
        return NextResponse.redirect(oauthUrl);

    } catch (error) {
        console.error('Error initiating Meta OAuth connection:', error);
        // Get return path again to handle errors properly
        const { searchParams } = new URL(request.url);
        const returnPath = searchParams.get('return') || '/integrations';
        const isOnboarding = returnPath.includes('/onboarding');

        // Redirect based on the flow
        if (isOnboarding) {
            return NextResponse.redirect(
                new URL('/onboarding?platform=meta&status=error&error=server_error', request.url)
            );
        } else {
            return NextResponse.redirect(
                new URL(`${returnPath}?status=error&error=server_error`, request.url)
            );
        }
    }
}