# Insights & Events

One account-scoped presentation combines completed-day catch-ups, lifecycle changes,
and evidence-backed attention issues. No AI provider or advertising executor is used.

## Local preview

- Set the **server-only** `DEEPVISOR_INSIGHTS_EVENTS=true` in `.env.local`.
- Sign in on `localhost:3000` and choose **Insights preview** (flask icon) in the desktop
  sidebar, or open `/insights/preview` directly. That sidebar item is development-only.
- The workbench lists 46 synthetic scenarios in eight categories, each with a note on what it
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
Later publication corrections create a saved recap revision without a popup; the
original remains available. Rules (`shared/insights/revision.ts`):
- Only material corrections count: any change in reported results, or spend moving by
  at least 5% **and** $1 against what the owner last saw. Cent-level drift is ignored.
- At most one revision per original (fingerprint `revision:<original id>`); a later
  correction updates it in place and `revisionOf` always names the original.
- A spend-only correction is saved already read (history view row), so it stays in
  history without an unread dot; a results change is unread. Revisions never notify.
- Recaps whose last day is more than 7 days old are settled and no longer re-checked.
CSV/PDF export the chosen presentation.

**Quiet when idle.** When no ad is on a complete active delivery chain now (saved hierarchy,
`activeDeliveryKeys`, the same rule as Campaigns) and the recap period spent exactly $0, no recap
is prepared and the "recap not yet available" / "sync more than a day old" notes are omitted: no
performance was expected. A period that spent money is still recapped after the ads stop;
unknown delivery or spend is never treated as idle; issues (e.g. unpaid balance) and lifecycle
changes still present. Rule: `idleRecap` in `shared/insights/model.ts`.

**Ads-off suggestion** (`server/suggestions/idle.ts`, rules in `shared/suggestions/idle.ts`). When
nothing runs, the last day with spend is 7+ days ago and no suggestion was shown in this idle
stretch within 14 days, the popup carries `payload.suggestion` (source key `suggestion:<day>`):
- an open ad account issue (e.g. unpaid balance) → "fix your ad account first", no ad suggested;
- otherwise the Quick ad source choice (WhatsApp first, lowest cost per result with 3+ results in
  90 days, else most recent) at its own daily budget (ad set, else campaign) for 7 days, with an
  estimate from the best and worst weekly cost per result (needs 2 weeks with 3+ results; else
  no number). The card shows the ad like Overview does: the latest ad's picture or video poster
  (`mediaFor`, fallbacks on broken links), the ad set name, and its last-90-day totals
  (`aggregate`, `QuickStats`). "Prepare this ad again" opens the plan page
  `/campaigns/rerun?adSet=<id>` (`loadRerunPlan`, `RerunPlanForm`). It shows what the ad did last
  time (`lastRun`: latest spending stretch, quiet gaps of ≤2 days joined; and its daily or lifetime
  budget and schedule, `sourceBudgetSetup`) and starts the plan from it (`rerunDefaults`, first rule
  that applies). Days: scheduled run length → days it actually ran → the owner's usual run length →
  7. Daily budget: its daily budget → lifetime ÷ scheduled days → actual spend per day → the
  account's average per spending day. The popup's "If you run it again" line uses the same start.
  The owner can change the daily budget (− / +) and days (3/7/14/other, 1–90); the page shows the dates (starting tomorrow, account
  timezone), "about <total>", the live estimate (`rerunPlan` → `restartForecast`, same chart), a note
  when the budget is over 2× last time, and the saved-monthly-budget limit (`profileSpendLimit`, the
  draft builder's own rule) before the button. "Save plan" (`savePlanAction`, re-validated, owner/
  admin) stores it in `ad_set_plans`, **one plan per ad set** (unique account + ad set): saving
  again updates the same row with an optimistic `version`, and "Discard plan" deletes it. The page
  opens with the saved plan when there is one. Saved plans and new-ad drafts are listed at the top
  of Campaigns (`components/campaigns/SavedPlans.tsx`, `/campaigns#saved-plans`). Kept in DeepVisor
  only: nothing is published or sent to Meta. When Meta writes are allowed later, a plan for the
  same ad set is meant to update that ad set in place (budget, end date) instead of creating a
  copy. Rules only, no AI. "Try a new photo or video" opens Quick ad with `?budget=&days=`
  prefilled.

**First look (welcome).** A person's first popup for an ad account (no `insight_reviews` row yet;
`present_insights` creates it) carries `payload.welcome` (source key `welcome:<kind>`), chosen by
`chooseWelcome` in `shared/insights/model.ts` from the active-ad count and last spend day:
`running` (greeting + the first 7-day recap), `off` (the ads-off suggestion is offered at once,
skipping the 7-day idle wait; an open account issue still comes first), or `new` (never spent:
offers a first Quick ad). Unknown delivery after earlier spend gets no greeting. No popup is prepared
while the account's first full sync (account setup) is incomplete, and a first look also waits
until the setup job itself has finished (the account is marked set up a few seconds earlier), so the
welcome always carries the recap. While waiting, `POST /api/insights` answers
`{ presentation: null, retryInSeconds: 5 }` (`FIRST_LOOK_WAITING` in the service); the popup asks
again every 5 seconds for up to about three minutes, and the "Setting up your account" screen fires
`deepvisor:data-updated` the moment setup finishes, so the welcome appears right after it.
Card: `components/insights/WelcomeCard.tsx` (EN/ES `welcome.*`); preview group **First Look**.

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
- DISAPPROVED/WITH_ISSUES count only while the ad (or ad set), its ad set and its campaign are
  all switched on (`configured` ACTIVE). Meta keeps those statuses on switched-off objects; an
  open issue resolves once a read observes the chain switched off. An unobserved parent is not
  assumed off.
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
