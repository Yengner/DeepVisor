/**
 * The live site (www.deepvisor.com) uses this Supabase project. Until local development gets its
 * own project, `npm run dev` may point at it too, and then anything done locally changes real
 * data. Not a secret: the project URL is public in the site's browser code.
 */
const PRODUCTION_SUPABASE_REF = 'gkdyyjqepzayjdpvqnja';

/** Runs once when a server starts. Only warns: it never changes configuration. */
export function register() {
  if (process.env.NODE_ENV !== 'development' || process.env.NEXT_RUNTIME !== 'nodejs') return;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  if (!url.includes(`${PRODUCTION_SUPABASE_REF}.supabase.co`)) return;
  console.warn([
    '',
    '⚠️  Local dev is using the PRODUCTION database (the one www.deepvisor.com uses).',
    '   Sign-ins, syncs, saved plans and deletes here change real data.',
    '   Keep execution and cron flags off locally. See docs/DEVELOPMENT_GUIDE.md.',
    '',
  ].join('\n'));
}
