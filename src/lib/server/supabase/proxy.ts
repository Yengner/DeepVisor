import 'server-only'

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { AUTO_LOCALE, isLocale, LOCALE_COOKIE, LOCALE_COOKIE_OPTIONS, LOCALE_USER_COOKIE } from '@/i18n/locales'

const PUBLIC_ROUTES = new Set([
    '/',
    '/features',
    '/privacy-policy',
    '/terms-of-service',
]);

function normalizePathname(pathname: string): string {
    if (pathname.length > 1 && pathname.endsWith('/')) {
        return pathname.slice(0, -1);
    }

    return pathname;
}

function redirectWithSupabaseCookies(
    request: NextRequest,
    supabaseResponse: NextResponse,
    pathname: string
) {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    const response = NextResponse.redirect(url);

    supabaseResponse.cookies.getAll().forEach((cookie) => {
        response.cookies.set(cookie.name, cookie.value, cookie);
    });

    return response;
}

export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
                    supabaseResponse = NextResponse.next({
                        request,
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    // Do not run code between createServerClient and
    // supabase.auth.getUser(). A simple mistake could make it very hard to debug
    // issues with users being randomly logged out.

    // IMPORTANT: DO NOT REMOVE auth.getUser()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    // Mirror the signed-in user's saved language into the cookie each request reads. Runs only
    // when the cookie is missing or belongs to another user; a failed read leaves it unset.
    // Language is cosmetic: any failure here must never affect authentication or routing.
    if (user && request.cookies.get(LOCALE_USER_COOKIE)?.value !== user.id) {
        try {
            const { data, error } = await supabase.from('users').select('preferred_locale').eq('id', user.id).maybeSingle()
            if (!error) {
                const options = { ...LOCALE_COOKIE_OPTIONS, secure: process.env.NODE_ENV === 'production' }
                supabaseResponse.cookies.set(LOCALE_COOKIE, isLocale(data?.preferred_locale) ? data.preferred_locale : AUTO_LOCALE, options)
                supabaseResponse.cookies.set(LOCALE_USER_COOKIE, user.id, options)
            }
        } catch {
            // Leave the cookie unset; the next request retries and the browser language applies meanwhile.
        }
    }

    const pathname = normalizePathname(request.nextUrl.pathname);
    const isLoginPage = pathname.startsWith('/login');
    const isSignUpPage = pathname.startsWith('/sign-up');
    const isPublicRoute = PUBLIC_ROUTES.has(pathname);

    // Handle unauthenticated user trying to access protected routes
    if (!user && !isLoginPage && !isSignUpPage && !isPublicRoute) {
        return redirectWithSupabaseCookies(request, supabaseResponse, '/login');
    }

    // Keep auth pages out of the way for signed-in users, but allow public marketing pages.
    if (user && (isLoginPage || isSignUpPage)) {
        return redirectWithSupabaseCookies(request, supabaseResponse, '/api/auth/redirect');
    }



    // IMPORTANT: You *must* return the supabaseResponse object as it is.
    // If you're creating a new response object with NextResponse.next() make sure to:
    // 1. Pass the request in it, like so:
    //    const myNewResponse = NextResponse.next({ request })
    // 2. Copy over the cookies, like so:
    //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
    // 3. Change the myNewResponse object to fit your needs, but avoid changing
    //    the cookies!
    // 4. Finally:
    //    return myNewResponse
    // If this is not done, you may be causing the browser and server to go out
    // of sync and terminate the user's session prematurely!

    return supabaseResponse
}
