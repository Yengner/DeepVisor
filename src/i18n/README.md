# Interface languages (English / Spanish)

DeepVisor's interface language is chosen **per person**: an owner can use Spanish while staff
use English. Built on `next-intl` (pinned `4.4.0`, the newest line without native install-time
dependencies) **without** locale URLs.

| Piece | Location |
| --- | --- |
| Supported locales, cookie names, Accept-Language negotiation (pure) | `src/i18n/locales.ts` |
| Request config (locale + messages per request) | `src/i18n/request.ts`, wired in `next.config.mjs` |
| Message catalogs | `messages/en.json`, `messages/es.json` |
| Typed keys (from the English catalog) | `src/i18n/global.d.ts` |
| Saved preference | `public.users.preferred_locale` (`en`/`es`/NULL), migration `20261117054602` |
| Save action | `src/lib/server/actions/user/locale.ts` (Settings → Language) |
| Cookie sync on sign-in / new device | `src/lib/server/supabase/proxy.ts` |

## How a request picks a language

1. `dv_locale` cookie: `en`, `es`, or `auto` (no saved preference).
2. Otherwise the browser's `Accept-Language` (q-values respected), else English.

The session proxy fills `dv_locale` from the database when the signed-in user differs from
`dv_locale_user` (new device, or another person on a shared browser), so it reads the
database at most once per user per browser. Failures never affect authentication. Saving in
Settings writes the database (own row via RLS; only `preferred_locale` is granted) and both
cookies. `<html lang>` follows the chosen locale.

## Writing UI text

- Add keys to **both** catalogs. `src/i18n/messages.test.ts` fails if keys, placeholders or
  rich-text tags differ, if a message is not valid ICU, or if Spanish is left identical to
  English (except brand names, CTR/CPM).
- Client components: `useTranslations`. Non-async server components: `useTranslations`. Async
  server components, actions and route handlers: `getTranslations`.
- Pure/shared modules return **codes**, not sentences (e.g. `basis: { code: 'typical', count }`,
  `reason: 'cheapest'`); components word them.
- Money and dates use `en-US` / `es-US` so Tampa Spanish speakers see `$20.00`.
- Spanish is neutral Latin American, informal "tú", gender-neutral where possible.

## Coverage today

Translated: app frame (navigation, top bar, mobile menu), Overview KPIs/trend/ad-set cards,
weekly check-in, Agency KPIs, Settings language and ad-facts cards, Quick ad, and the errors
of those actions. Older screens (Reports, Calendar, Decisions, Connections, legacy dashboard,
public site) are still English and move over gradually. Drafts' stored review notes stay
English while the draft builder is English.

**Trade-off:** reading a cookie in the root layout makes every route dynamic, including the
public marketing pages, which were static before. Static public pages would need locale URLs
(`/es/...`) or separate root layouts.

Tests: `npm test -- src/i18n src/lib/server/userPreferredLocaleMigration.test.ts src/lib/server/supabase/proxy.test.ts`.
