# Lead log (WhatsApp)

Real customer conversations from ads, linked to the ad that started them, with the owner's
"booked / didn't book / spam" answer. Page: `/leads`. No AI and no message text.

## Data flow

1. Meta sends WhatsApp Business webhooks (`object: whatsapp_business_account`) to the existing
   `/api/meta/webhooks` endpoint (same gate `DEEPVISOR_META_WEBHOOKS=true`, same
   `META_APP_SECRET` signature check). Subscribe the WhatsApp product to the fields
   `messages` and, for numbers that keep the WhatsApp Business app, `smb_message_echoes`.
2. `parseWhatsAppWebhook` (`src/lib/shared/webhooks/whatsapp.ts`) keeps only: phone number id,
   message id, direction, the customer's WhatsApp id, profile name, time, and the ad referral
   (`source_type: "ad"` → `source_id` = ad id, `ctwa_clid` when present). Statuses,
   `request_welcome`, system messages and all message text/media are dropped.
3. `ingestWhatsAppMessages` (`ingest.ts`) hashes the message id, derives the contact key
   (HMAC-SHA256 with `META_APP_SECRET`, per phone number), keeps the last 4 digits, and calls
   `record_whatsapp_message` once per message, oldest first.
4. `record_whatsapp_message` (migration `20261118034046_whatsapp_lead_log.sql`, service role
   only) does everything atomically per customer (advisory lock):
   - unknown or disconnected `phone_number_id` → `unknown_number` (acknowledged, nothing stored)
   - message already seen → `duplicate` (Meta retries never double count)
   - customer message → new lead if no conversation in the last 30 days or it came from a
     different ad; otherwise joins the open lead. `source` is `ad` only when the referral names an ad.
   - business reply → updates the open lead (first reply time, count); a conversation the
     business starts is `ignored` (not a lead)
   - out-of-order deliveries keep the earliest first message and the earliest reply after it
   - receipts older than 60 days are pruned inline (bounded), so no schedule is needed

## Tables

| Table | Who can read | Notes |
| --- | --- | --- |
| `whatsapp_connections` | business members | one active business per `phone_number_id`; `is_test` for Meta's test number |
| `leads` | business members | owner/admin changes go through server actions; `outcome` null = not marked |
| `whatsapp_message_receipts` | server only | hashed message ids for de-duplication |

All three carry `business_id`, so account deletion removes them.

## Numbers on the page (`service.ts`, `src/lib/shared/leads/summary.ts`)

- Window: last 7 or 30 days in the ad account's timezone, **clipped to the day WhatsApp was
  connected** ("Counting from …") so Meta's numbers and the log cover the same days.
- Per ad: leads, booked, ad-level spend, cost per booked customer (null until something is booked).
- Spend total = ads that brought leads or that Meta says started conversations.
- Unmarked leads are never counted as "didn't book"; spam is excluded from counts.
- "Meta counted N · M reached your WhatsApp": Meta's messaging-conversations metric for those
  ads next to WhatsApp leads from ads. Shown, not reconciled (Meta also counts Messenger/Instagram).
- Phone calls are logged by hand ("Log a phone call"), optionally tagged to an ad with spend
  in the period; Meta's call counts and WhatsApp calls are not captured.

## Connecting a number

**In the app ("Connect WhatsApp", stage 2b).** Shown on `/leads` to owners/admins when
`META_APP_ID` and `META_WHATSAPP_CONFIG_ID` are set (a Facebook Login for Business
configuration of the *WhatsApp Embedded Signup* variation; neither value is secret).
`ConnectWhatsApp.tsx` launches Embedded Signup v4 with `featureType:
whatsapp_business_app_onboarding` (coexistence: the owner keeps the WhatsApp Business app). The
browser passes Meta's 30-second code and the ids from the `WA_EMBEDDED_SIGNUP` message event to
`connectWhatsAppAction`; the business always comes from the session. `connect.ts` then:

1. exchanges the code for a business token (`GET /oauth/access_token`);
2. lists the account's numbers with that token and requires the number to be on it and
   `is_on_biz_app: true` (if Meta's event named only the account, the single app number is used);
3. refuses a number another business has active; subscribes the app (`POST /{waba}/subscribed_apps`);
4. stores the token in Vault (`upsert_platform_token`, name `whatsapp_business_token:<phone id>`) and
   saves `whatsapp_connections` (`onboarded_via = embedded_signup`, `token_secret_id`);
5. requests the contact sync then the history sync (`POST /{phone}/smb_app_data`), which Meta
   requires **within 24 hours** of onboarding or it offboards the number. A failure is kept in
   `sync_error` and shown on the page ("reconnect within 24 hours"). Each sync can run once.

Registration is skipped (an app number is already registered) and nothing is sent to customers.
Members can read the connection but not `token_secret_id` or `sync_error` (column grants).

Webhook fields for the app: `messages`, `smb_message_echoes`, `account_update`, `history`,
`smb_app_state_sync`. `history` and `smb_app_state_sync` are acknowledged and not stored (no old
message text or contact lists). `account_update` with `PARTNER_REMOVED` (the owner tapped
Disconnect in the WhatsApp Business app) marks that account's numbers disconnected.

A first message from an ad to an app number can arrive as an `unsupported` placeholder (error
131060) seconds before the real message with the referral. `record_whatsapp_message` upgrades an
organic lead opened in the previous 10 minutes to the ad instead of opening a second lead.

Meta requires Tech Provider status for Embedded Signup with other businesses; in Development mode
only people with an admin/developer role on the app can complete the flow.

**By script (test numbers, numbers on DeepVisor's own portfolio).**

```sh
DEEPVISOR_WHATSAPP_ADMIN=gkdyyjqepzayjdpvqnja node --env-file=.env.local scripts/whatsapp/connect-number.mjs \
  --business <business uuid> --phone-number-id <id from WhatsApp > API Setup> --display "+1 555 0100" --test
```

`--disconnect` stops recording for that number. Signed end-to-end check on a local server with
fixtures, including the placeholder, sync and disconnect cases: `scripts/whatsapp/demo.mjs seed|clean`
(see the script header).

## Limits and follow-ups

- Real numbers owned by another business need Meta Tech Provider approval (Business
  Verification + App Review for `whatsapp_business_management`/`whatsapp_business_messaging`).
- Importing past chats as leads (from `history`) and the send/template feature needed for App
  Review videos are not built.
- The business token is stored but not yet used after onboarding; Disconnect inside DeepVisor is
  not built (the owner disconnects from the WhatsApp Business app).
- Leads are business-wide; with several ad accounts, a lead from another account's ad shows as
  "Ad <id>" without spend.
- Rotating `META_APP_SECRET` makes returning customers look new (contact keys change).
- Conversions API "booked" events back to Meta are a later stage.
