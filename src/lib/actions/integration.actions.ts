'use server';

import { createSupabaseClient } from '@/lib/utils/supabase/clients/server';

export async function initiateOAuthConnection(platform: string) {
  const supabase = await createSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User not authenticated');
  }

  // Here you would generate the proper OAuth URL based on the platform
  // This is just a placeholder - you would replace with actual OAuth logic
  let redirectUrl: string;

  switch (platform) {
    case 'meta': 
      // Example Meta (Facebook) OAuth URL
      redirectUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${process.env.FACEBOOK_APP_ID}&redirect_uri=${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/callback/meta&scope=ads_management,business_management&state=${user.id}`;
      break;
      
    case 'google':
      // Example Google OAuth URL
      redirectUrl = `https://accounts.google.com/o/oauth2/auth?client_id=${process.env.GOOGLE_CLIENT_ID}&redirect_uri=${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/callback/google&scope=https://www.googleapis.com/auth/adwords&response_type=code&access_type=offline&include_granted_scopes=true&state=${user.id}`;
      break;
      
    case 'tiktok':
      // Example TikTok OAuth URL
      redirectUrl = `https://ads.tiktok.com/marketing_api/auth?app_id=${process.env.TIKTOK_APP_ID}&redirect_uri=${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/callback/tiktok&state=${user.id}`;
      break;
      
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }

  return redirectUrl;
}