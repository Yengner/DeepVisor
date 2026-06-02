import { NextResponse, type NextRequest } from 'next/server';
import { resolvePostAuthRedirectPath } from '@/lib/server/auth/postAuthRedirect';
import { createSupabaseClient } from '@/lib/server/supabase/server';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const supabase = await createSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.redirect(new URL('/login', requestUrl.origin));
  }

  try {
    const redirectPath = await resolvePostAuthRedirectPath(user.id);
    return NextResponse.redirect(new URL(redirectPath, requestUrl.origin));
  } catch (redirectError) {
    console.error('Failed to resolve post-auth redirect:', redirectError);
    return NextResponse.redirect(new URL('/onboarding', requestUrl.origin));
  }
}
