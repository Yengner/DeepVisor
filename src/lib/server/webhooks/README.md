# Meta webhooks and live updates

Implemented and verified against the development project `gkdyyjqepzayjdpvqnja` with synthetic
deliveries. **Not deployed, not registered with Meta, and no real ad account is subscribed.**

A verified webhook is a *trigger* into the existing account sync queue. It is never a source of
facts: the worker re-reads Meta before any event or issue is shown.

```
Meta POST /api/meta/webhooks → signature check → meta_webhook_events (once per delivery)
  → request_account_resource(kind 'events')  ← same queue as manual / visit / scheduled refresh
  → existing worker → captureMetaEvents (status re-read) → lifecycle events + insight issues
  → DB triggers → Realtime signal `account:<id>` → clients re-read through their normal APIs
```

## Flags and configuration (server-only)

| Name | Purpose |
| --- | --- |
| `DEEPVISOR_META_WEBHOOKS=true` | Enables the endpoint, notices, subscription checks and the live signal. Off: endpoint returns 404. |
| `DEEPVISOR_RESOURCE_REFRESH=true` | Required. Webhook demand is a resource job; without it requests are skipped (`disabled`). |
| `DEEPVISOR_INSIGHTS_EVENTS=true` | Required for issues/events to be recorded and shown. |
| `META_APP_SECRET` | Existing. Signs deliveries (`X-Hub-Signature-256`, HMAC-SHA256 of the raw body). |
| `META_APP_ID` | Existing. Used for the per-account `subscribed_apps` call. |
| `META_WEBHOOK_VERIFY_TOKEN` | New, at least 16 characters. Echo check for Meta's subscription handshake. |

## Receiver (`src/app/api/meta/webhooks/route.ts`)

- `GET`: handshake. Wrong/missing token → 403.
- `POST`: body capped at 256 KB; missing, malformed or wrong signature → 401 and nothing stored.
  A signed delivery for another object type is acknowledged (200) so Meta does not retry it.
  A storage/queue failure → 503 (Meta retries for up to 36 hours); rows whose demand did not reach
  the queue are removed first, so the retry is processed instead of dropped as a duplicate.
- No Meta request is made in the request. Jobs are started with `after()` through the existing
  `dispatchAccountSync`; the ten-minute worker remains the fallback.
- Parsing is pure (`src/lib/shared/webhooks/meta.ts`). Stored per delivery: account id, field,
  object id/level, send time and Meta's short notice text (trimmed to 240 characters). No metrics.

## Fields

| Field | Effect |
| --- | --- |
| `effective_status`, `in_process_ad_objects` | Re-read status. Lifecycle events come from the existing before/after diff. |
| `with_issues_ad_objects` | Re-read status. If the read finds `WITH_ISSUES`/`DISAPPROVED`, the issue quotes Meta's summary. |
| `creative_fatigue` | Re-read status. While the ad is active and the flag is under 14 days old: a **notice** ("Meta flags creative fatigue"). |
| anything else (e.g. `ad_recommendations`) | Stored only. No read, no card. |

Meta's documentation does not confirm webhooks for budget, name or targeting edits. Those are
still detected by the diff on every read (webhook-triggered or scheduled), not within seconds.

## Queue rules (migration `20261114002047_meta_webhook_events`)

- New resource kind `events` (`events:v2`), priority 40. One active job per account as before.
- Never "fresh": a delivery always results in a read. Deliveries that arrive while a read is
  **queued** join it; while a read (or any other job) is **running** they stay pending and run next.
- Affected objects travel with the job. Up to 25 ads → only those ads are re-read and merged into
  the previous observation (`mergeAds`). Anything else — a campaign or ad set, an unknown object,
  an ad whose status is inherited from a paused parent, a missing baseline — reads the hierarchy.
- More than 20 event reads for one account in an hour → further demand waits five minutes (kept).
- `complete_account_events` finishes the job under the same lease fencing. No performance rows are
  fetched, staged, replaced or deleted by an events read.
- Reauthentication, initial-sync, simulation and connection guards are the existing ones.
- `meta_webhook_events` / `meta_webhook_subscriptions`: service role only, RLS enabled with no
  browser policy. Deliveries older than 30 days are pruned as new ones are recorded.

## Issues and severity (`src/lib/shared/insights/model.ts`)

- `issueLevel()`: `CREATIVE_FATIGUE` is a **notice** (navy card, "Worth a look", never a popup on
  its own after the day's review, never counted in the Overview chip's issue count). Everything
  else stays **urgent**.
- Notices only add Meta's wording to a state the read observed; they never create a state.
- Issue source `fatigue` resolves when Meta's flag ages out or the ad is no longer active.

## Live signal

`signal_account()` broadcasts `{kind:'insights'|'data'}` on the private Realtime topic
`account:<ad account uuid>` from triggers on `ad_lifecycle_events`, `insight_issues` and
`account_sync_resources`, so every trigger (not only webhooks) pushes. A restrictive RLS policy on
`realtime.messages` limits each topic to members of that account (`can_access_ad_account`). The
payload has no advertising data. `useAccountSignals` turns it into the existing
`deepvisor:data-updated` event; polling remains as the fallback, and an open modal is not replaced.

## Subscriptions (`subscription.ts`)

`ensureAccountWebhooks` runs inside the existing refresh worker, at most once a day per account:
it checks `act_<id>/subscribed_apps` and adds this app if absent (Meta removes subscriptions when
an account is disabled or closed). `releaseAccountWebhooks` runs on disconnect unless another
business still has the account selected. This changes notification routing only; it is not an
advertising write. Simulated accounts (non-numeric ids) are never sent to Meta.

## Activation (each step needs approval)

1. Deploy the app with the flags and `META_WEBHOOK_VERIFY_TOKEN`.
2. In the Meta app: subscribe object `ad_account`, callback `https://<host>/api/meta/webhooks`,
   fields `with_issues_ad_objects,in_process_ad_objects,creative_fatigue` (the dashboard does not offer `effective_status` to this app, so pauses and other status changes without an issue are picked up by the next scheduled or visit refresh, not within seconds).
3. Confirm one real account end to end before widening.

## Verification

```sh
npm test -- src/lib/shared/webhooks src/lib/server/webhooks src/app/api/meta/webhooks src/lib/server/lifecycle/events.test.ts
node --env-file=.env.local scripts/webhooks/send.mjs --account <numeric id> --field with_issues_ad_objects --object <ad id>
```

The script signs a synthetic delivery for a **local** server started with the flags above.

## Not verified / limits

- No real Meta delivery has been received; the `subscribed_apps` request shape and the exact
  `effective_status` payload follow Meta's documentation and are untested against live Meta.
- Private-channel Realtime delivery to a signed-in browser has not been observed end to end.
- The Campaigns table reads `ad_entities.status`, which an events read does not update; it can
  lag the modal until the next maintenance sync.
- Deliveries during a failure back-off are not queued; the scheduled refresh reconciles them.
