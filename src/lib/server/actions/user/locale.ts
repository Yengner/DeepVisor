'use server';
import { cookies } from 'next/headers';
import { unstable_rethrow } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import { fail, ok, ErrorCode, type ApiResponse } from '@/lib/shared';
import { createServerClient } from '@/lib/server/supabase/server';
import { AUTO_LOCALE, isLocale, LOCALE_COOKIE, LOCALE_COOKIE_OPTIONS, LOCALE_USER_COOKIE } from '@/i18n/locales';

/**
 * Sets the interface language: 'en', 'es', or null to follow the browser.
 * Signed-in users: saved on their own profile (RLS: own row; column grant: preferred_locale
 * only) and mirrored into the cookie each request reads. Visitors: the cookie only.
 */
export async function setPreferredLocaleAction(locale: unknown): Promise<ApiResponse<null>> {
  const t = await getTranslations('language');
  if (locale !== null && !isLocale(locale)) {
    return fail('Unsupported language', ErrorCode.VALIDATION_ERROR, { userMessage: t('unsupported') });
  }
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    const store = await cookies();
    const options = { ...LOCALE_COOKIE_OPTIONS, secure: process.env.NODE_ENV === 'production' };
    if (user) {
      const { data, error } = await supabase.from('users').update({ preferred_locale: locale }).eq('id', user.id).select('id').maybeSingle();
      if (error) throw error;
      if (!data) return fail('Profile not found', ErrorCode.NOT_FOUND, { userMessage: t('noProfile') });
      store.set(LOCALE_USER_COOKIE, user.id, options);
    } else {
      store.delete(LOCALE_USER_COOKIE);
    }
    store.set(LOCALE_COOKIE, locale ?? AUTO_LOCALE, options);
    revalidatePath('/', 'layout');
    return ok(null);
  } catch (error) {
    unstable_rethrow(error);
    console.error('Saving language failed', { code: (error as { code?: string })?.code });
    return fail('Saving language failed', ErrorCode.DATABASE_ERROR, { userMessage: t('error') });
  }
}
