import { NextResponse, type NextRequest } from 'next/server';
import { resolvePostAuthRedirectPath } from '@/lib/server/auth/postAuthRedirect';
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL('/login', requestUrl.origin);
    loginUrl.searchParams.set('error', 'auth_callback_failed');
    return NextResponse.redirect(loginUrl);
  }

  const fallbackNext = safeNextPath(requestUrl.searchParams.get('next'));
  const redirectPath = await (async () => {
    if (fallbackNext !== '/dashboard') {
      return fallbackNext;
    }

    try {
      return await resolvePostAuthRedirectPath(user.id);
    } catch (redirectError) {
      console.error('Failed to resolve OAuth post-auth redirect:', redirectError);
      return '/onboarding';
    }
  })();

  return NextResponse.redirect(new URL(redirectPath, requestUrl.origin));
}
