# Resource-aware Meta refresh

Implemented and verified against existing development project `gkdyyjqepzayjdpvqnja`.
**Not deployed or enabled on hosted infrastructure.** Server gate:
`DEEPVISOR_RESOURCE_REFRESH=true` (off by default).

## Behavior

- Existing `account_sync_jobs`, manual endpoint, scheduled endpoint and worker remain
  authoritative. One active job per account; compatible demand coalesces, incompatible
  demand persists behind it. Manual refresh behind narrow work creates a genuine
  30-day follow-up, with scoped polling following that job and unchanged cooldown rules.
- Visible browser checks every five minutes; hot performance eligibility is 15 minutes,
  covering today and yesterday in advertiser time. Scheduled eligibility is 90 minutes
  and covers seven days. Completion, not queue acceptance, changes the data revision,
  invalidates Dashboard data and offers the assistant a new-data notice. No paid model
  rerun is automatic. Hidden/unmounted clients stop polling; active jobs poll at five seconds.
- Maintenance reuses incremental sync for hierarchy, hourly data and creatives, with
  one-hour active / six-hour background eligibility. Daily older-attribution correction
  covers up to 30 days, subject to policy. Recent unchanged creatives are reused;
  missing, changed, expired or older-than-24-hour media is fetched again.
- Audience requests use explicit dimension and date keys, 12-hour freshness, eight new
  query keys/account/day, and immutable complete batches. Exact-period data is preferred;
  historical fallback retains its actual coverage. Unsupported data is negative-cached.
- Meta HTTP reads share database admission (six globally, three/account), observed quota
  headers and provider cooldowns. At 80% observed usage, admission pauses for five minutes.
  This is conservative backpressure, not knowledge of a guaranteed Meta quota. Contention
  and HTTP 429 defer work; inaccessible accounts stop; ordinary repeated failures open
  the circuit after three attempts. Reconnection or a successful covered manual job can
  recover it. No automatic advertising execution is added.
- Light jobs stage rows then publish the entire queried window and revision atomically.
  Empty successful responses remove obsolete window rows without inventing zero facts.
  Claim generations reject late workers. Existing full writers also carry database lease
  headers; these are internal fencing, never authorization. All new mutation RPCs are
  service-role-only; read policies retain account membership. Browser credentials stay normal.
- Dashboard optional publisher/daily-demographic/hourly/learning observations persist in
  `account_insight_snapshots` under the same worker and quota controls. Page renders no
  longer fetch Meta in this mode. Combined Dashboard and assistant use canonical daily facts.

## Provider events (webhooks)

Resource kind `events` (`events:v2`, migration `20261114002047_meta_webhook_events`) is a status
re-read requested by a verified Meta webhook. It uses this queue's single-job-per-account rule,
leases, admission budget and failure handling, is never skipped as fresh, and never reads or
replaces performance rows. Details: [webhooks README](../../webhooks/README.md).

## Database and rollout

Applied migrations (local names match remote history):

1. `20261107032518_resource_aware_meta_refresh.sql`
2. `20261107221150_resource_refresh_recovery.sql`
3. `20261107221814_sync_worker_fencing.sql`
4. `20261108044833_sync_resource_completion_guards.sql`
5. `20261108044834_persisted_dashboard_insights.sql`
6. `20261108045250_resource_quota_deferral.sql`

Adds `account_sync_resources`, private staging/quota/lease tables, audience batch/row
tables and optional insight snapshots; extends existing jobs/state with leases and
resource scheduling fields. `claim_next_account_sync` fairly selects across the existing
queue using priority plus aging. Publication/claims/retention RPCs are service-only.
Staging expires after one day; audience cache after 90 days through existing worker
maintenance. Decision/approval audit history is not pruned. Generated public bindings
match development; existing catalog-derived nullable ai/intelligence RPC types remain.

Before activation, separately approve application/Edge deployment and hosted configuration.
Verify missing/invalid cron/internal credentials are rejected. Use the existing reviewed
`supabase/cron/automatic_meta_refresh.sql`: `0 */2 * * *`, Vault credentials, preserve
the ten-minute worker cadence and use bounded worker limit 5. Then enable the server flag
and verify one real read-only account end to end. No deployment, secret or cron changes
were made by this implementation. Current inspected enqueue job remains inactive/hourly;
the existing worker remains active every ten minutes. Never describe this as live yet.

Rollback application behavior by disabling the flag; allow running jobs to settle first.
Do not remove migrations, reset claims or discard pending work as a rollback shortcut.

## Verification and preview (Node 24)

```sh
npm test -- src/lib/server/sync src/lib/server/dashboard/insights src/lib/server/intelligence/assistant src/app/api/sync
npm run typecheck
DEEPVISOR_RESOURCE_TEST=gkdyyjqepzayjdpvqnja DEEPVISOR_META_SIMULATION=gkdyyjqepzayjdpvqnja DEEPVISOR_RESOURCE_REFRESH=true node --env-file=.env.local node_modules/vitest/vitest.mjs run src/lib/server/sync/resourceRefresh.live.test.ts
DEEPVISOR_META_SIMULATION=gkdyyjqepzayjdpvqnja DEEPVISOR_RESOURCE_REFRESH=true NEXT_PUBLIC_BASE_URL=http://localhost:3016 npm run dev -- --port 3016
DEEPVISOR_META_SIMULATION=gkdyyjqepzayjdpvqnja node --env-file=.env.local scripts/resource-refresh/browser.mjs
```

Requires existing gated Phase 5 synthetic users in `.env.beta-phase5.json`; do not
publish that credential file. The live test contacts real Supabase and forbids Graph
requests; it preserves audit records and restores synthetic provider settings. It
requires no recent covering full sync, because freshness eligibility must not be falsified
to force a test. Browser testing exercises actual authenticated manual handoff, normal-user
RLS, and desktop/mobile rendering; `--visual-only` skips enqueue/manual work. No Jev/OpenAI
credits or real Meta advertising requests are used.

Final checks: 1,103 Vitest tests passed, 19 opt-in tests skipped; separate real-database
resource test passed; 22 SQL persistence tests passed; typecheck, targeted lint, production
build and architecture check passed (two existing documented architecture exceptions).
Real saved fixture: seven-day spend 480 USD, 48 leads, CPR 10 USD. Twenty concurrent
requests produced one job; repeat processing did not duplicate facts. Two audience windows
remained separate. Authenticated second-business access was empty. Manual follow-up
`10e49f42-4c0c-4141-87f2-c4d866d96dca` completed Oct 9–Nov 7; its parent resource job is
`85d2dd1b-6d65-47d0-9dd6-96e2dddb4f8f`. Four optional datasets persisted. Desktop 1440px
and mobile 390px screenshots were inspected; no page errors or horizontal overflow.

## Performance expectations and remaining limits

- Page-render Meta requests: **zero in new mode**, versus four initial collections plus
  pagination/fallbacks on a five-minute read-through miss. Rendering still includes Auth,
  database and application work; no production latency multiplier has been measured.
- Hot performance transfers `O(entities × 2 days)` rather than repeatedly fetching a
  broad history window. Seven versus two days is approximately 71% fewer daily rows at
  equal entity density, not a promised 71% reduction in latency or Meta quota use.
  Normalization remains linear in returned rows. Coalescing makes provider jobs independent
  of viewer count per account/resource/freshness window.
- Freshness target is roughly 15–20 minutes for an actively viewed account plus queue/Meta
  delay; Meta attribution itself can still lag. Optional breakdowns intentionally refresh
  more slowly and show their own observation/retrieval dates. Unsupported dimensions stay
  unavailable. The assistant's daily publisher-filtered analytics tool is still limited;
  its snapshot breakdown tool and Dashboard publisher views remain distinct.
- Atomic publication applies to new resource jobs, not all legacy full-history stages.
  Existing initial backfill still processes bounded history windows in one invocation;
  very large accounts need future resumable-window work under real hosting limits. New
  jobs cap staged rows at 100,000, provider requests at 200 and processing at three minutes;
  legacy worker budget is four minutes. Durable recovery handles interrupted claims.
- Shared admission has not been load-tested against live Meta. Browser-driven active leases
  do not add a new background schedule. Cross-page multi-request reads are not a single
  database transaction; avoid promising a globally frozen analytics snapshot during a full
  legacy sync. Measure real API latency, quota headers and large-account behavior before
  widening rollout. Existing Supabase security-advisor findings remain outside this change;
  no new warnings target the added insight/claim functions.

Final suite rerun with `npm test -- --maxWorkers=4` passed all 1,103 tests
(19 opt-in skipped). A concurrent build/full-suite run had timed out an existing
onboarding PGlite test; no timeout threshold or application behavior was changed.
