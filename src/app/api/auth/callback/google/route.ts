import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { createSupabaseClient } from '@/lib/utils/supabase/clients/server';
import { getLoggedInUser } from '@/lib/actions/user.actions';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.json({ error: 'Authorization code is missing' }, { status: 400 });
  }

  try {
    // Initialize OAuth2 Client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/callback`
    );

    // Exchange authorization code for tokens
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token) {
      throw new Error('Access token is missing in response');
    }

    // Get the Supabase client
    const supabase = await createSupabaseClient();

    // Simulate getting user_id from session or authenticated context
    const loggedIn = await getLoggedInUser();
    const userId = loggedIn.id;
    
    const expiresAt = tokens.expiry_date
    ? new Date(tokens.expiry_date).toISOString() // ISO datetime format
    : null;    // Ensure the necessary fields for Supabase

    const upsertData = {
      user_id: userId,
      platform: 'google',
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || null, // Ensure null if not provided
      expires_at: expiresAt, // Adjusted based on column type
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Insert or update the tokens in Supabase
    const { error } = await supabase
      .from('access_tokens')
      .upsert(upsertData); // Corrected to a string

    if (error) {
      console.error('Supabase upsert error:', error);
      throw new Error('Failed to save tokens to Supabase');
    }

    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/websites`);
  } catch (error) {
    console.error('Error during token exchange:', error);
    return NextResponse.json({ error: 'Failed to exchange tokens' }, { status: 500 });
  }
}
