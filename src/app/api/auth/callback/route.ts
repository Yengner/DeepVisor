import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@/lib/server/supabase/server';

function safeNextPath(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return '/onboarding';
  }

  return value;
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = safeNextPath(requestUrl.searchParams.get('next'));
  const oauthError = requestUrl.searchParams.get('error');

  if (oauthError) {
    const loginUrl = new URL('/sign-up', requestUrl.origin);
    loginUrl.searchParams.set('error', 'google_oauth_failed');
    return NextResponse.redirect(loginUrl);
  }

  if (!code) {
    const loginUrl = new URL('/sign-up', requestUrl.origin);
    loginUrl.searchParams.set('error', 'auth_callback_missing_code');
    return NextResponse.redirect(loginUrl);
  }

  const supabase = await createServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const loginUrl = new URL('/sign-up', requestUrl.origin);
    loginUrl.searchParams.set('error', 'auth_callback_failed');
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin));
}
