import { type NextRequest } from 'next/server'
import { updateSession } from './lib/server/supabase/proxy';

export async function proxy(request: NextRequest) {
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
    "/((?!$|_next/|api/|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map)$).*)",
  ],
};