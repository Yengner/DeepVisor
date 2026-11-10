# Insights & Events

One account-scoped presentation combines completed-day catch-ups, lifecycle changes,
and evidence-backed attention issues. No AI provider or advertising executor is used.

## Local preview

- Set the **server-only** `DEEPVISOR_INSIGHTS_EVENTS=true` in `.env.local`.
- Sign in on `localhost:3000`. **Test event scenarios** opens `/insights/preview`.
- The development preview has 23 synthetic scenarios, width controls, light/dark
  switching, and the same content renderer/CSS as real updates. Actions/exports,
  automatic sync and review acknowledgements are disabled there. Hot reload works.
- The preview route requires authentication and returns 404 outside development.
  The billing scenario is a visual fixture, not a claim of production billing detection.
- `/insights` contains saved account/user history. GETs do not create reports.

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

## Evidence and limits

- Explicit DISAPPROVED/WITH_ISSUES, expired authorization, and known disabled-account
  status codes are supported. Unknown status/permission failures do not prove health.
- Detailed billing/restriction causes require provider evidence not currently in the
  stored contract. Disabled-account codes alone never become “payment failed.”
- Delivery is as current as the existing worker/sync publication; this adds no cron,
  webhook, continuous Meta polling, or live advertising actions.
- Audience breakdowns retain original snapshot windows and entity scope in reports.
  No unique period reach, verified bookings, or causal outcomes are fabricated.

## Focused verification

`npm test -- src/lib/shared/insights src/lib/server/insights src/lib/shared/lifecycle/model.test.ts src/lib/server/lifecycle/persistence.test.ts --maxWorkers=2`

Authenticated browser helpers use the existing local synthetic credential files:
`node scripts/insights/preview-browser.mjs` checks every visual fixture without writes.
`DEEPVISOR_INSIGHTS_TEST=gkdyyjqepzayjdpvqnja node --env-file=.env.local scripts/insights/browser.mjs`
creates a labeled synthetic lifecycle observation for the first combined presentation.
After daily review, use `--review-only` to inspect saved history without reseeding.
Artifacts are written under `/tmp/dv-insights*`, not committed.
