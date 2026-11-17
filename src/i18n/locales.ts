/**
 * Supported interface languages and how a request picks one. Pure: no I/O.
 *
 * Order: the `dv_locale` cookie (set from the user's saved preference) → the browser's
 * Accept-Language → English. The cookie value `auto` means "no saved preference; follow
 * the browser" and lets the session proxy skip the database on later requests.
 */
export const LOCALES = ['en', 'es'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';
export const LOCALE_COOKIE = 'dv_locale';
export const AUTO_LOCALE = 'auto';
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
/** Which signed-in user the locale cookie was synced for, so a shared browser re-syncs per person. */
export const LOCALE_USER_COOKIE = 'dv_locale_user';
export const LOCALE_COOKIE_OPTIONS = { path: '/', maxAge: LOCALE_COOKIE_MAX_AGE, sameSite: 'lax', httpOnly: true } as const;

export const LOCALE_NAMES: Record<Locale, string> = { en: 'English', es: 'Español' };

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/** Best supported language from an Accept-Language header (q-values respected). */
export function negotiateLocale(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;
  const ranked = acceptLanguage.split(',').flatMap((part, index) => {
    const [tag, ...params] = part.trim().split(';');
    const q = params.map(p => p.trim()).find(p => p.startsWith('q='));
    const quality = q ? Number(q.slice(2)) : 1;
    const base = tag.trim().toLowerCase().split('-')[0];
    return Number.isFinite(quality) && quality > 0 && base ? [{ base, quality, index }] : [];
  }).sort((a, b) => b.quality - a.quality || a.index - b.index);
  return ranked.map(r => r.base).find(isLocale) ?? DEFAULT_LOCALE;
}

export function resolveLocale(cookieValue: string | null | undefined, acceptLanguage: string | null | undefined): Locale {
  return isLocale(cookieValue) ? cookieValue : negotiateLocale(acceptLanguage);
}
