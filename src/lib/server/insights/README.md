# Insights & Events

One account-scoped presentation combines completed-day catch-ups, lifecycle changes,
and evidence-backed attention issues. No AI provider or advertising executor is used.

## Local preview

- Set the **server-only** `DEEPVISOR_INSIGHTS_EVENTS=true` in `.env.local`.
- Sign in on `localhost:3000` and choose **Insights preview** (flask icon) in the desktop
  sidebar, or open `/insights/preview` directly. That sidebar item is development-only.
- The workbench lists 39 synthetic scenarios in six categories, each with a note on what it
  covers. Pick one from the list (or ↑/↓, J/K), switch Desktop/390px/320px, light/dark, or
  **Gallery** to see a whole category side by side. **Open as real modal** uses the Mantine
  modal as owners see it. State is in the URL (`?scenario=stale&width=390&view=gallery`) so a
  view can be shared. The same content renderer/CSS as real updates is used; actions/exports,
  automatic sync and review acknowledgements are disabled. Hot reload works.
- Add scenarios in `src/lib/shared/insights/preview.ts` (registry + `previewScenarioNotes`).
- The preview route requires authentication and returns 404 outside development.
  The billing scenario is a visual fixture, not a claim of production billing detection.
- `/insights` contains saved account/user history. GETs do not create reports. It is **not**
  a sidebar destination: owners reach it from the bell notification (`/insights?id=…` or
  `/insights?day=YYYY-MM-DD`), the Overview entry chip, the popup's "All updates" link, or by
  direct link. It has a Back control for that reason.
- `scripts/insights/preview-browser.mjs` checks every scenario, width, gallery, dark mode and
  that the preview makes no API requests.

## Persistence and delivery

Applied development migrations: `20261109161829_insights_events`,
`20261109164530_insights_delivery_hardening`, `20261109170109_insights_unknown_evidence`.
Target: existing `gkdyyjqepzayjdpvqnja` project. No hosted deployment/schedule changes.

`insight_issues` retains issue episodes. Source watermarks reject old observations;
missing/unknown entity states retain the previous evidence timestamp, not a false
resolution. `insight_presentations` stores immutable payloads, exact windows and
source revisions. `insight_reviews`, `insight_receipts`, and `insight_seen_sources`
record per-user delivery and review. RLS restricts account access and user history;
mutating RPCs are service-only and validate current organization membership.

POST prepare performs saved-data reads only, then atomically claims a presentation
for five minutes. The active tab renews its claim. Other tabs cannot claim it.
Dismissal acknowledges only that presentation's source keys, never resolves issues.
New urgent issues can appear after today's recap was reviewed. An already-open
modal is not replaced; additional sources stay unread. Pending source queries are
bounded in PostgreSQL; history uses keyset pagination.

Catch-ups exclude today in the advertiser timezone, stop at published coverage,
start after the reviewed day, and cap absences at 30 days (initial view: seven).
Sparse observations remain sparse. Totals use ad-set rows; ratios use summed
numerators/denominators. Comparisons require complete, compatible observations.
One-day recaps chart saved advertiser-local hourly ad-set observations; weekly
recaps retain seven daily bars. Missing hourly data is unavailable, never inferred
from daily totals. Old saved reports remain immutable. Hourly observations are
saved alongside daily KPIs and included in exports; they may not reconcile due
to different source coverage. No new Meta requests or schema changes are required.
Later publication corrections create another saved recap revision without a popup;
the original remains available. CSV/PDF export the chosen immutable presentation.

Lifecycle captures reuse existing sync work and preserve reconstructed provenance.
The November 8 AlexaStyles interruption remains explicitly reconstructed; its exact
pause time is unverified. A parent pause is not an account-problem alert.

## Read state, notifications and entry points

- **Read state.** An update is read when the person reviewed it in the popup
  (`insight_receipts`) or opened it from history (`insight_history_views`, migration
  `20261113191554_insight_history_views`, service-role writes via `POST /api/insights/seen`).
  History views never acknowledge sources, advance `reviewed_through` or resolve issues.
- **Daily bell bundle.** `notifyDaily()` keeps one notification per account per account-local
  day (`dedupe_key insights:<account>:<day>`). A later update that day joins the bundle
  (`payload_json.presentationIds`), marks it unread again, stays `warning` once any member
  needed attention, and links to the day (`?day=`) once it holds more than one update.
  Wording lives in `src/lib/shared/insights/notification.ts`.
- **Overview chip.** `InsightsEntry` reads `GET /api/insights/summary` (read-only counts, latest
  headline, newest open issue title). It never prepares or claims a presentation.

## Account causes

`src/lib/shared/insights/health.ts` maps Meta's explicit ad-account codes (Marketing API
ad-account reference) to causes: `account_status` 3 → unpaid balance; 8/9 → payment pending;
7 → under review; 100/101 → closed; status 2 with `disable_reason` 3 → payment risk,
1/6/11/12 → policy, 2/5/14 → review, 15 → compromised, 7 → closed. Other disable reasons stay
the generic "unavailable account" notice; an unknown status makes no claim. Saved codes keep the
`ACCOUNT_STATUS_<status>_REASON_<reason>` format and `causeFromCode()` reads them back.

## Before-the-change comparison

Lifecycle cards show `leadUp()` (`src/lib/shared/insights/leadUp.ts`): the 7 completed days
before the change day against the 7 before those, paired by offset, counting only days with
both spend and results, and only with at least 3 matched days. Saved briefs contain no days
after a change, so "after" comparisons are not shown in the immutable card.

The ad report page (`/lifecycle/[eventId]`) adds a live **Before and after** section from
`GET /api/lifecycle/[eventId]/outcome` (`src/lib/server/lifecycle/outcome.ts`, model in
`src/lib/shared/lifecycle/outcome.ts`). The change day is excluded; day k after pairs with day
k before, up to 7 days, counting only days with spend and results on both sides (minimum 3).
States: `too-early` (fewer than 3 completed days since), `compared`, `no-delivery-after`
(the ads have no rows after the change **and** the account has saved ad-set rows on at least
3 of those days, so absence is evidence of no spend), and `insufficient`. Read-only; the saved
brief is never rewritten.

## Evidence and limits

- Explicit DISAPPROVED/WITH_ISSUES, expired authorization, and known disabled-account
  status codes are supported. Unknown status/permission failures do not prove health.
- Billing/restriction causes come only from Meta's explicit `account_status`/`disable_reason`
  codes (see Account causes). Nothing is described as a failed payment.
- Billing and Account Quality links add `asset_id=<ad account number>` (`metaAccountLink()`).
  Meta does not document this parameter; if it is ignored the link still opens the right page.
  Issues saved before this change keep the generic link until Meta's status is observed again.
- Delivery is as current as the existing worker/sync publication. With `DEEPVISOR_META_WEBHOOKS`
  a verified Meta webhook queues a status re-read within seconds and clients are signalled live
  (see [webhooks](../webhooks/README.md)); without it, behavior is unchanged. No cron, continuous
  Meta polling, or live advertising actions are added.
- Creative fatigue is shown only as Meta flags it (notice level, navy). DeepVisor computes no
  fatigue score. Delivery/rejection issues quote Meta's notice text when a webhook supplied it.
- Audience breakdowns retain original snapshot windows and entity scope in reports.
  No unique period reach, verified bookings, or causal outcomes are fabricated.

## Presentation colors

The modal follows the status color rules in
[Development guide › Status colors](../../../../docs/DEVELOPMENT_GUIDE.md#status-colors):
attention issues use the red band, lifecycle cards use one navy-banded card (status from
`lifecycleKind()` — e.g. Paused, Now active, Delivery interrupted — matched to the fixed
explanations in `lifecycle/model.ts`,
`N ads affected` and the budget owner's name in the band, then the ad, then metrics),
and amber is reserved for real data gaps (unavailable hours, missing metrics, currency or
creative). A scheduled end is classified for display only by `lifecycleStatus()` in
`src/lib/shared/insights/model.ts`. Ended cards replace the amber "details aren't
available" notice with the reporting-window timeline, and hide the metrics row only when
all three metrics are unavailable.

## Focused verification

`npm test -- src/lib/shared/insights src/lib/server/insights src/lib/shared/lifecycle/model.test.ts src/lib/server/lifecycle/persistence.test.ts --maxWorkers=2`

Authenticated browser helpers use the existing local synthetic credential files:
`node scripts/insights/preview-browser.mjs` checks every visual fixture without writes.
`DEEPVISOR_INSIGHTS_TEST=gkdyyjqepzayjdpvqnja node --env-file=.env.local scripts/insights/browser.mjs`
creates a labeled synthetic lifecycle observation for the first combined presentation.
After daily review, use `--review-only` to inspect saved history without reseeding.
Artifacts are written under `/tmp/dv-insights*`, not committed.
