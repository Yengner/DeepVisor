import { getLoggedInUser } from '@/lib/actions/user.actions';
import { createSupabaseClient } from '@/lib/utils/supabase/clients/server';
import { NextResponse } from 'next/server';

interface AdAccount {
  id: string;
  name: string;
  account_status: number;
  amount_spent?: string;
}

interface PageAccount {
  id: string;
  name: string;
  access_token: string;
  instagram_business_account: {
    id: string;
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.json({ error: 'Authorization code is missing' }, { status: 400 });
  }

  try {
    // Exchange code for access token
    const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
    const appSecret = process.env.FACEBOOK_APP_SECRET;
    const redirectUri = process.env.NEXT_PUBLIC_FACEBOOK_REDIRECT_URI;

    const tokenUrl = `https://graph.facebook.com/v20.0/oauth/access_token?client_id=${appId}&redirect_uri=${redirectUri}&client_secret=${appSecret}&code=${code}`;
    const response = await fetch(tokenUrl);

    const date = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });

    if (!response.ok) {
      const errorDetails = await response.json();
      throw new Error(errorDetails.error?.message || 'Failed to fetch access token');
    }

    const tokenData = await response.json();

    if (!tokenData.access_token) {
      throw new Error('Access token is missing in the response');
    }

    // Extract additional token details
    const integrationDetails = {
      access_token: tokenData.access_token,
      token_type: tokenData.token_type || null,
      issued_at: date,
    };

    const supabase = await createSupabaseClient();

    const loggedIn = await getLoggedInUser();
    const userId = loggedIn.id;

    // Upsert into the platform_integration table
    const upsertData = {
      user_id: userId,
      platform_name: 'meta',
      access_token: tokenData.access_token,
      is_integrated: true,
      integration_details: integrationDetails,
      created_at: date,
      updated_at: date,
    };

    const { data, error } = await supabase
      .from('platform_integrations')
      .upsert(upsertData)
      .select('id')
      .single();

    if (error || !data) throw new Error('Failed to save platform integration');

    const platformIntegrationId = data.id; // Dynamically use this

    const adAccountsUrl = `https://graph.facebook.com/v21.0/me/adaccounts?fields=id,name,account_status,amount_spent,users`;
    const pageAccountUrl = `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,account,access_token,instagram_business_account`;

    // Fetch ad accounts
    const adAccountsResponse = await fetch(adAccountsUrl, {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    if (!adAccountsResponse.ok) {
      const errorDetails = await adAccountsResponse.json();
      throw new Error(errorDetails.error?.message || 'Failed to fetch ad accounts');
    }

    const pageAccountResponse = await fetch(pageAccountUrl, {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    if (!pageAccountResponse.ok) {
      const errorDetails = await pageAccountResponse.json();
      throw new Error(errorDetails.error?.message || 'Failed to fetch page accounts');
    }

    const adAccountsData: { data: AdAccount[] } = await adAccountsResponse.json();
    const pageAccountsData: { data: PageAccount[] } = await pageAccountResponse.json();

    // Save ad accounts in the database
    const adAccounts = adAccountsData.data.map((account) => ({
      user_id: userId,
      platform_integration_id: platformIntegrationId,
      ad_account_id: account.id,
      platform_name: 'meta',
      name: account.name,
      account_status: account.account_status,
      spend_amount: account.amount_spent,
      created_at: date,
      updated_at: date,
    }));

    // Save page accounts in the database
    const pageAccounts = pageAccountsData.data.map((account) => ({
      user_id: userId,
      platform_integration_id: platformIntegrationId,
      page_id: account.id,
      name: account.name,
      access_token: account.access_token,
      instagram_account_id: account.instagram_business_account?.id || null,
      created_at: date,
    }));


    // Upsert ad accounts and page accounts into the database
    const { error: pageAccountsError } = await supabase
      .from('meta_pages')
      .upsert(pageAccounts);

    if (pageAccountsError) {
      console.error('Supabase page account upsert error:', pageAccountsError);
      throw new Error('Failed to save page accounts to Supabase');
    }

    const { error: adAccountsError } = await supabase
      .from('ad_accounts')
      .upsert(adAccounts);

    if (adAccountsError) {
      console.error('Supabase ad account upsert error:', adAccountsError);
      throw new Error('Failed to save ad accounts to Supabase');
    }

    const syncResponse = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/sync_user_meta_posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, 
      },
      body: JSON.stringify({ userId }),
    });
    
    if (!syncResponse.ok) {
      console.error('❌ Failed to invoke sync_user_meta_posts function:', await syncResponse.text());
    } else {
      console.log('✅ Successfully triggered sync_user_meta_posts for user:', userId);
    }
    
    // Redirect to the success page with a query parameter for the ad accounts
    const adAccountsEncoded = encodeURIComponent(JSON.stringify(adAccountsData.data));
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL}/integration/meta/success?adAccounts=${adAccountsEncoded}`
    );

  } catch (error) {
    console.error('Error during Meta OAuth callback:', error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL}/integration/meta/unsuccessful`
    );
  }
}
