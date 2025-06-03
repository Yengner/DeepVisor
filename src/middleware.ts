import { type NextRequest } from 'next/server'
import { updateSession } from './lib/utils/supabase/clients/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - The root path `/` (represented by `$|$`)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - Specific asset file types like .svg, .png, etc.
     */
    '/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$|contact-us|about-us|services|how-it-works|blog|investor-relations|estimate|proposal|$).*)',
  ],
};