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

## Connecting a number (until Embedded Signup exists)

```sh
DEEPVISOR_WHATSAPP_ADMIN=gkdyyjqepzayjdpvqnja node --env-file=.env.local scripts/whatsapp/connect-number.mjs \
  --business <business uuid> --phone-number-id <id from WhatsApp > API Setup> --display "+1 555 0100" --test
```

`--disconnect` stops recording for that number. End-to-end check on a local server with fixtures:
`scripts/whatsapp/demo.mjs seed|clean` (see the script header).

## Limits and follow-ups

- Real numbers owned by another business need Meta Tech Provider approval (Business
  Verification + App Review for `whatsapp_business_management`/`whatsapp_business_messaging`).
- Embedded Signup v4 with coexistence ("Connect WhatsApp"), history import, and the send/template
  feature for App Review videos are stage 2b.
- Leads are business-wide; with several ad accounts, a lead from another account's ad shows as
  "Ad <id>" without spend.
- Rotating `META_APP_SECRET` makes returning customers look new (contact keys change).
- Conversions API "booked" events back to Meta are a later stage.
