# WhatsApp number setup

Chooses the number a business's ads send chats to (`business_profiles.whatsapp_number`, used for
ad drafts). Recording chats is a separate, optional step: see `../leads/README.md`.

## Flow

1. Meta connection and ad account selection, then the Facebook Page step
   (`/api/integrations/meta/page-setup`, which saves Page fields only).
2. The WhatsApp screen (`src/components/whatsapp/WhatsAppSetupModal.tsx`) opens the first time, and
   again when the saved number is not one the selected account's ads send chats to. `/leads` opens
   the same screen at any time.
3. One match is preselected; with several, only an obvious one is (the single number with running
   ad sets). No match shows how to set one up, **Check again**, manual entry and skip.
4. After saving, the screen shows "Number selected" and "Tracking chats" separately and offers
   Embedded Signup when it is configured.

## Where numbers come from (`detect.ts`, reads only)

| Source | What it proves |
| --- | --- |
| `promoted_object.whatsapp_phone_number` on the selected account's ad sets | the ads send chats there |
| WhatsApp accounts owned by the portfolio that owns that ad account | the number is in that portfolio |

- The account comes from the saved selection, never from the browser.
- Other portfolios the login can see are never read: they may belong to other businesses.
  A portfolio with more than 10 WhatsApp accounts is skipped for the same reason.
  A portfolio shared by several businesses can still list another one's number, so
  portfolio-only matches are labelled as such and the person confirms.
- If the live ad set read fails, the last sync's `adset_dims.raw` is used and labelled. With
  neither, the screen says the ads could not be read, not that there is no number.
- Facebook Page WhatsApp fields returned nothing when tested (2026-11-26), so they are not used.
  The Page phone is only offered to fill in the manual field.
- Finding nothing does not mean the business has no WhatsApp: a new number shows once an ad uses it.

## Saving

`POST /api/integrations/meta/whatsapp` takes `{ number }`; `null` clears it. Owners and admins
only; the business comes from the session. `whatsapp_number_source` is `page_phone_confirmed` when
the number equals the Page phone, otherwise `manual` (the table allows no "detected" value);
clearing stores `skipped` or `not_available`. A cleared number is not replaced by the Page phone.

The number is one per business, not per ad account. `lib/server/actions/meta/whatsapp/actions.ts`
is an older, unused lookup that merges every portfolio; do not use it for this screen.
