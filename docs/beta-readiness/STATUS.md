# DeepVisor beta readiness

## Phase 5 — assessment complete: NO-GO for an external beta user, 2026-10-22

The controlled synthetic journey passes. Release configuration and security
prerequisites below remain; this is **not deployment approval**. Phases 1–4 evidence
was reviewed and reused. Phase 5 exposed and repaired two intelligence prerequisites
that their isolated fixtures had missed. No new project, deployment, live Meta
write, autonomous execution, secret exposure, or RLS bypass occurred.

- **Verified with real Supabase persistence:** fresh signup, rejected unverified login,
  verification callback, onboarding drafts/back navigation, skipping Meta, connecting
  later through the simulated provider, account selection, durable synchronization,
  Dashboard, campaign/ad hierarchy and creative previews, Reports and actual CSV/PDF,
  Shadow and Review evaluations, browser approve/reject, one fake execution,
  duplicate execution denial, pending outcomes, account switching and logout/login.
  The same fresh identity was resumed after fixes. Verification used an official
  Auth-admin token; external email transport was not verified.
- **Numbers:** account 1 completed-week features **$280 / 28 results / $10 CPR**.
  Account 2 Dashboard 7D **$480 / 48 / $10**, including today's recorded zero and
  six completed days. October 1–19 exports agree: **$960 / 96 / $10**, **96,000
  impressions**, **2% CTR**; unique reach/frequency remain unavailable. CSV has 43
  records; PDF has 29 pages with matching scope, dates and currency. Fake execution
  changed **5000 → 4750** minor units exactly once; 1/6/24/72-hour outcomes remain
  pending, without fabricated post-action performance.
- **Authorization:** normal authenticated clients could not read another business's
  account, creative, feature, decision, proposal or execution records or claim worker
  jobs. Foreign-account CSV/PDF returned 403; unauthenticated exports returned 401;
  protected-page logout and forbidden execution requests were rejected. Simulation
  requires an explicit development-project opt-in and server-managed designation.
  Live transport rejects synthetic IDs. Fixture execution permission is off again.
- **Browser/branding:** main journey and supplementary checks passed with zero page
  errors. Header and Dashboard agree after login without selection cookies. Brand
  images load at 1440/390px without overflow; favicon, Apple icon, metadata and
  light/dark assets resolve. Phase 4 visual review reused; no new screenshots taken.
  Real Meta OAuth initiation builds the redirect, but it was not followed; the local
  callback is `http://localhost:3011`. Live Meta/Google consent remains unverified.
- **Validation, Node 24:** **818 unit tests passed, 15 opt-in tests skipped**; both
  Phase 5 real-database stages passed separately. Final typecheck and production
  build passed. New/focused Phase 5 code lint passed; broader touched-file lint still
  reports **8 pre-existing explicit-any errors and 1 unused-function warning** in
  `buildReportPayload.ts`. The legacy `npm run lint` command remains incompatible
  with Next 16; checks used the documented temporary compatible ESLint config.
- **Reliability:** no queued/running sync jobs remained at final DB inspection. Existing
  backfill worker dispatch runs every ten minutes and returned HTTP 200/202 during
  inspection; older failed jobs remain historical. This verifies dispatch, not the
  deployed application's latest code or live-provider success. Local warm route
  observations were roughly Dashboard 1–1.3s, Campaigns 0.9–1s, Reports 1.5–1.7s;
  these are development timings, not a production load benchmark.

### Repairs and database changes

| Priority | Verified defect and correction |
| --- | --- |
| P0 | Evaluation SQL required uppercase `ACTIVE` although real sync stores lowercase. Migration `20261022220851_normalize_evaluation_delivery_status.sql` replaces only `ai.enqueue_meta_evaluation`; Shadow policy classification now accepts normalized casing while still rejecting paused/unknown delivery. Applied to `gkdyyjqepzayjdpvqnja`; RPC signatures/bindings unchanged. |
| P1 | Initial 30-day history included today and only 29 completed days, preventing adequate tracking evidence immediately after onboarding. Initial sync now includes 30 completed advertiser-local days plus today; the normal worker persisted the repaired coverage. |
| P0 | Edge worker source accepted missing CRON_SECRET / a skip flag. Three repository worker handlers now fail closed and omit secret fingerprints. **Deployed source still needs the correction; secret configuration/exploitability was not inferred or probed.** |
| P1 | Export routes swallowed authentication failures and exposed raw internal errors. Explicit 401/403 and sanitized failures now preserve authorization. Manual sync preserves framework authentication redirects. |
| P1 | Header defaulted to the first account while pages resolved the saved primary account; client state could retain a stale choice. Header now shares the page resolver, offers eligible primary accounts, and displays server-confirmed selection. Real browser regression passed. |
| P2 | Production output deleted the nested simulator cache. Separate `.next-beta-simulation` output; generated type paths updated. An invalid concurrently written dev type artifact was discarded before final typecheck. Settings now links to beta feedback via the existing contact address. |

Phase 5 files: `supabase/functions/_shared/{processAccountSyncJobs,queueAccountSyncJobs}.ts`,
`supabase/functions/process_calendar_queue/index.ts`, the migration above;
`src/lib/server/decisions/shadow/{evaluate,persistence.test,shadow.test}.ts`;
`src/lib/server/sync/meta/{client,processFirstSyncJob,historyWindow.test}.ts`;
`src/app/api/reports/{csv,pdf}/route.ts`, `src/lib/server/reports/{access,exportAccess.test,exportRoutes.test}.ts`,
`src/lib/server/repositories/reports/buildReportPayload.ts`, `src/app/api/sync/refresh/route.ts`;
`src/components/layout/topBar/{TopBar,PlatformAdAccountDropdownClient}.tsx` and `TopBar.test.ts`;
`src/app/(root)/settings/page.tsx`, `src/lib/server/advertising/types.ts`,
`src/lib/server/integrations/simulation/meta.ts`, `phase5Security.test.ts`,
`betaPhase5.live.test.ts`, `next.config.mjs`, `tsconfig.json`, `.gitignore`, and
[Phase 5 scripts/reproduction](../../scripts/beta-phase5/README.md).
Evidence: [browser](./phase5/evidence.json), [additional checks](./phase5/checks.json),
[intelligence](./phase5/intelligence.json), [CSV](./phase5/journey.csv), [PDF](./phase5/journey.pdf).
The fixture business is `8065c808-33f6-4ef4-9de3-8e8a8209034c`; existing fixture
businesses and unrelated uncommitted code are preserved. Its execution audit is
retained and the harness refuses replay. Current development server is stopped.

### Remaining release prerequisites

- **P0:** authorize and deploy the reviewed Edge authentication fix and application
  changes; confirm deployed secrets/gates and reject unauthorized worker requests.
  No deployment was performed under the current task authorization.
- **P1:** public signup is currently enabled. Configure invitation-only admission
  (including OAuth) and verify a genuinely invited user's unassisted flow.
- **P1:** confirm hosted origin/callback allowlists, email delivery, live Meta consent
  and read-only sync, Google login, production decision-provider configuration, and
  deployed worker/outcome observability. No live Meta/Jev verification is claimed.
- **P1:** address Supabase's [Postgres security patch advisory](https://supabase.com/docs/guides/platform/upgrading)
  before external access; enable/evaluate [leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
  These managed configuration changes were not performed.
- **P2:** confirm `info@deepvisor.com` is monitored and receives beta feedback; finish
  legacy lint cleanup and review legacy function search-path/definer advisories.
  RLS is enabled throughout public/ai/intelligence; internal service-only AI tables
  intentionally have no client policies. No new privilege exposure was found.

## Phase 4 — complete for the controlled synthetic scope, 2026-10-22

- **Implemented:** fresh Review evaluations use the existing post-sync queue,
  Feature Engine, DecisionEngine and PolicyEngine. Only permitted recommendations
  create actionable proposals with current Meta state, evidence, risk and
  fingerprint-bound owner/admin approval. Shadow proposals stay non-executable.
  Review state reads cannot perform writes; existing execution gates remain intact.
- **Database:** applied `20261022061347_review_evaluation_pipeline.sql` to existing
  development project **`gkdyyjqepzayjdpvqnja`**. Added service-only
  `enqueue_meta_evaluation`, `claim_meta_evaluation`, `enqueue_meta_review`,
  `claim_meta_review`, `finish_meta_review`; updated Shadow wrappers/finalizer and
  `process_action_outcomes`. Existing queue and RLS retained; bindings reconciled.
- **Verified:** actual Supabase Auth/RLS and persisted Feature → Shadow → Review →
  owner approval → fake execution → pending outcomes. The isolated Phase 4 account
  belongs to existing synthetic Business A. Seven-day spend **$140**, results **21**;
  fake budget **10000 → 9500** minor units, one write only. Duplicate execution and
  cross-business access were denied. Four execution horizons remain honestly
  pending; no post-action observations or causal improvement were fabricated.
- **Fixed:** missing normal Review proposal generation; expired approvals; Review
  evaluations being eligible for Shadow outcome classification; missing Decisions
  outcome display; simulated execution labels across Decisions and Overview.
- **Branding:** integrated the four supplied designs through `Brand.tsx`, public
  header/footer, app header/sidebar/mobile navigation, auth and onboarding. Cropped
  and combined supplied symbol/type into a horizontal wordmark; dark surfaces use
  a monochrome treatment. Added optimized transparent assets, favicon, Apple icon
  and metadata; removed unused legacy assets. No logos were generated. Removed
  169 prior captures plus the two temporary Phase 4 verification captures.
- **Validation:** Node 24; **227 targeted tests passed**, **one real-database flow
  passed**, typecheck passed. Targeted ESLint: zero errors, two pre-existing
  onboarding warnings, using a temporary compatible flat config. Four browser
  checks at **1440/390px** passed with zero browser errors/overflow; temporary desktop
  Decisions/mobile branding captures visually reviewed and deleted. Browser tested
  login and persisted Decisions display; approve/reject services were exercised
  separately, not through browser button clicks. Full suite/build deferred as requested.
- **Configuration:** local Review worker enabled with the deterministic `mock`
  provider; production requires explicit Review enablement and `jev` selection.
  Existing Shadow configuration preserved. Live Jev/Meta were not exercised.
  Fixture business execution permission was disabled after verification. No live
  advertising writes, LIMITED_AUTO, schedules, RLS bypass or deployment enabled.
- **Files:** `decisions/review/`, shared Shadow coordinator/policy inputs, approval
  presentation/loaders, `advertising/MetaActionAdapter.ts`, Overview model, brand
  components/assets/metadata, focused regression tests, migration above and
  [Phase 4 reproduction/cleanup](../../scripts/beta-phase4/README.md).
  [Database evidence](./phase4/flow.json), [browser evidence](./phase4/browser.json).
- **P0/P1:** none found in the verified synthetic scope. Live provider behavior,
  delayed outcome measurement and browser approval/rejection remain unverified.
  **P2:** existing onboarding lint warnings and legacy ESLint configuration.
- **Phase 5 focus:** fresh-proposal approve/reject browser journey; delayed outcome
  observations and provider/read-only connection checks; then full regression,
  production build and final release configuration/security review. Not started.

## Phase 3 — complete for the development fixture scope, 2026-10-21

Implementation, authenticated analytical verification and the production build
passed. Phases 1–2 remain complete for their documented
simulation scope. This is not production deployment approval. Phase 4 results are recorded above.

Existing Supabase development project: **`gkdyyjqepzayjdpvqnja`**, URL
`https://gkdyyjqepzayjdpvqnja.supabase.co`. MCP SQL and actual authenticated clients
confirmed connectivity and persisted data. Both Phase 1 businesses and both Phase 2
simulated businesses remain available. No new project, schema migration, index,
Auth configuration, secret, schedule, RLS bypass or live Meta action was introduced.

Reproduction: [Phase 3 scripts](../../scripts/beta-phase3/README.md).
Evidence: [phase3](./phase3/), especially `expected.json`, `browser.json`,
`interactions.json`, `periods.json`, actual CSV/PDF downloads. Prior screenshots were removed at the user’s request.

### Phase 3 defects repaired

| Priority | Root cause and repair |
| --- | --- |
| P0 | Campaigns lifetime tables omitted calls from results and treated summed daily reach as unique period reach. Include calls at every entity level, recompute CPR, and withhold unverified reach/frequency. Actual authenticated loader results match persisted summaries. |
| P1 | Missing observations/costs/currency appeared as zero or assumed USD, and entity creation dates appeared as measurement dates. Preserve observation availability, render unavailable values, use measured dates, and remove invented attribution labels. Empty nested table summaries no longer imply recorded zero spend. |
| P1 | Campaigns refresh treated queue acceptance as completed sync. Reuse Overview's existing durable-job polling control, clear caches only after confirmed completion, and retain truthful unchanged/cooldown/failure messages. |
| P1 | Campaigns row/tab selection triggered redundant server navigations alongside drilldown actions and repeatedly stalled the browser journey. Update the selection URL with native history, retaining scoped server actions; direct ad-page loads also load parent ad-set context. Actual click-through and reload now pass. |
| P1 | Changing a Reports date preset from the default URL discarded the cookie-resolved account and broadened scope to the business. Seed filter changes with the resolved scope before applying explicit clearing/switching; retain the selected account and its timezone. |
| P1 | Ads table read media from raw ad JSON rather than persisted creative records. Batch by the actual `platform_creative_id`, scope to the account, and reuse the existing resolver and image error/dimension fallback. No synthetic Meta calls. |
| P1 | Dimension/daily queries could stop at the PostgREST row cap. Add stable ordered paging; later-page failures propagate. A 1,201-row regression verifies completeness without loading thousands of remote fixtures. |
| P2 | CSV lacked the business's synthetic label. Add `business_name` to every record while retaining record type, coverage and data-source fields. Campaigns now labels saved history rather than implying a selected-period scope. |

During implementation, the real database test caught an incorrect creative column
name; it was corrected and covered by a regression. Browser/build inspection also
caught a misplaced client directive, corrected before final validation.

### Phase 3 database and analytical evidence

Both ordinary authenticated users read their own campaign/ad-set/ad summaries and
receive no foreign rows. Foreign CSV/PDF, explorer account IDs and forged parent IDs
were rejected. Normal RLS clients cannot read the other business's creatives,
performance, dimensions or the temporary saved finding. Public synthetic Storage
images are intentionally public test media; catalog ownership is enforced by RLS.

Fixed comparable scope: **ad-set performance, October 13–19, USD,
America/New_York**. MCP SQL, normal-client rows, Reports and CSV agree:

| Business | Spend | Results | Impressions | Clicks | CTR | CPR |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| A, Aurora | 994 | 109 | 99,400 | 2,982 | 3% | 9.119266055 |
| B, Birch | 780 | 94 | 78,000 | 2,340 | 3% | 8.297872340 |

On October 21, A's Dashboard 7D is **646 / 75 / 8.613333 CPR / 3% CTR**;
30D is **3,730 / 404 / 9.232673 CPR / 3% CTR**. Today has no observation and remains
unavailable. B's corresponding expectations are recorded in `expected.json`.
Campaigns tables show saved lifetime history, not the Dashboard window; the same
period's explorer metrics were separately reconciled. Parent and child totals are
not added together. One currently active ad set is shown once; paused historical
advertising remains separate. Ad-set cards retain ad-set metrics with representative
creative imagery.

All seven Reports sections rendered from persisted Supabase records. Audience
age/gender/combined views, independent geography and delivery dimensions, unsupported
conversion and missing DMA states, keyboard snapshot inspection, mobile hourly
selection, observed totals and historical finding evidence were exercised.
Snapshot windows **August 21–September 19** and **October 13–19** remain distinct;
they are not relabeled with the report dates. Unsupported comparisons remain absent.

Actual A/B CSV exports contain 353/338 records. Actual PDF downloads contain
120/114 pages; extracted text and rendered cover/middle/final samples were inspected.
The PDF preserves hourly contexts and snapshot windows, without silently truncating
records. A's final CSV additionally verifies the new synthetic business label.
Large-pagination behavior has automated coverage; these are small fixture accounts,
not a production-scale load test.

### Phase 3 validation

Node **24.2.0**, no dependency or lockfile changes.

| Check | Result |
| --- | --- |
| Initial focused analytics suite | 218 passed |
| Full final Vitest suite | **788 passed, 13 opt-in live checks skipped**, 66 passing files; `npm test -- --maxWorkers=2` |
| Actual authenticated Phase 3 database loader/isolation suite | **2 passed**, actual network/database reads; only the server cookie-client factory is replaced with normal signed-in clients |
| Final focused table/loader regressions | 11 passed before the last export assertion, which is included in the full final suite |
| Broad authenticated browser harness | **68 checks passed**, no page errors; both businesses, Dashboard periods/hierarchy, exports/isolation and six requested widths |
| Post-repair authenticated interaction journey | **11 checks passed**, no page errors; table navigation/reload, creative success/failure, findings, snapshot controls, hourly interaction, RLS and real simulated-provider manual sync |
| Reports date presets | **5 checks passed** in the actual authenticated app: default 30 days, 7D/30D/90D retain the selected account and end October 20 in America/New_York; custom October 21 explicitly shows Partial day |
| Isolated Reports acceptance harness | Final rerun passed: 35 section/viewport renders, seven data states, numerical/history/filter/export assertions and 14 accessibility scans; supplementary isolated payloads, not an authenticated E2E substitute |
| TypeScript | **Passed**, exit 0 |
| Targeted ESLint | **Passed**, no remaining warnings/errors in changed/new TypeScript files; used Next's flat presets because the existing `next lint` command is incompatible with Next 16 |
| Production build | **Passed**, exit 0; Next 16.1.6 compiled, typechecked and generated routes. Browserslist age and experimental type-stripping warnings only. No deployment. |

One concurrent full-suite attempt hit the existing PGlite test's 5-second timeout
while browser, typecheck and lint were running. The full suite passed with two
workers without changing test assertions or timeouts. Failed intermediate browser
runs exposed selectors that matched hidden sections; final evidence includes only
the successful journey. `*-failure.png` files are explicitly debugging artifacts.

Screenshots cover **320, 390, 430, 768, 1280, 1440 px**. Visual inspection included
Dashboard desktop, Reports narrow mobile/Audience, repaired Ads desktop/mobile,
saved evidence, and PDF pages. Creative proportions and table-first layout are
preserved. No page-level horizontal overflow was detected; wide desktop tables
retain their own horizontal scrolling. The stable final desktop capture is
`ads-final-1440.png`; resize settling avoids transient screenshot paint artifacts.

### Phase 3 database objects modified

- Temporary row in `ai.trend_findings`, ID
  `43f28003-0709-4886-a79d-a149fdf70016`, source `deepvisor-beta-phase3`, was seeded
  reproducibly, displayed with its actual historical dates, tested for RLS isolation,
  then **deleted**. MCP confirmed zero remaining rows for that source. It was clearly
  marked manually authored, with no AI evaluation or recommended action.
- Existing simulated refresh infrastructure created/completed job
  `6ce892e3-7f75-463f-9691-fe3383e0a425` in `public.account_sync_jobs` and performed
  ordinary idempotent writes through the Phase 2 provider to its synthetic account's
  `ad_entities`, `ad_creatives`, `ad_entity_performance_daily`,
  `ad_entity_performance_summary`, `ad_entity_performance_hourly`,
  `ad_audience_breakdowns_summary`, `ad_accounts.last_synced`, `ad_account_sync_state`,
  `platform_integrations` freshness and `ai.creative_feature_snapshots`.
  No real Meta account was touched. The worker's saved status
  was independently confirmed as `completed` through MCP.
- **No Phase 3 DDL or migration was warranted.** Prior-phase migrations remain as
  listed below. Nothing was deployed.

### Phase 3 performance and remaining issues

- **Resolved:** paged dimension/daily reads prevent silent row-cap truncation;
  creative queries are batched, not one request per ad. Campaign selection no longer
  issues two redundant full RSC requests (observed approximately 1.3–1.6 seconds
  each in development) before its drilldown. The corrected browser journey completes.
- An actual 30-day ad-set query used
  `ad_entity_performance_daily_account_level_day_idx`: 120 rows, 22.362 ms execution,
  129 shared-buffer hits, no disk reads. This supports retaining the existing index;
  it is not a large-account latency guarantee.
- **P0:** no unresolved Phase 3 security/data-correctness defect established by these
  checks. This does not override the pre-beta configuration prerequisites below.
- **P1, inherited external-beta prerequisites:** review PostgreSQL security updates,
  leaked-password protection, and deployed Edge Function/scheduler authentication;
  verify real Google/Meta OAuth and live read-only media/permissions separately.
  Those provider/configuration steps were not simulated into a passing claim.
- **P1, portability:** the missing complete local schema baseline still prevents a
  claimed clean-stack rebuild; see Phase 1 record.
- **P2:** exhaustive PDFs are verbose (120/114 pages for these fixtures). Consider
  a compact paginated layout without dropping data. Large-account end-to-end load
  testing remains future work. Foreign export requests are denied but currently
  return a generic server-error status; improve error classification separately.
- **Limitations:** no live Meta media expiry, OAuth permission or video playback
  was verified. Fixtures contain posters and controlled images. Empty/loading/error
  states combine isolated harness coverage with actual missing-day/missing-media,
  missing-dimension, foreign-access and cooldown checks; not every outage was induced
  in the real database. Fixed fixture dates age naturally.

### Exact Phase 3 files changed

- `src/app/(root)/campaigns/page.tsx`
- `src/app/(root)/dashboard/components/OverviewControls.tsx`
- `src/app/(root)/reports/components/ReportsClient.tsx`
- `src/app/(root)/reports/components/layout/reportNavigation.ts`
- `src/app/(root)/reports/components/layout/reportNavigation.test.ts`
- `src/components/campaigns/{CampaignDashboard,CampaignTable,AdSetTable,AdsTable}.tsx`
- `src/components/campaigns/metrics.ts`
- `src/components/campaigns/AdsTable.test.ts`
- `src/lib/server/repositories/utils.ts`
- `src/lib/server/repositories/campaigns/{getCampaignSummaries,getCampaignsMetrics}.ts`
- `src/lib/server/repositories/adsets/getAdSetsMetrics.ts`
- `src/lib/server/repositories/ads/getAdsMetrics.ts`
- `src/lib/server/reports/csv.ts`
- `src/lib/shared/reports/exports.test.ts`
- `src/lib/server/campaigns/lifetimeMetrics.test.ts`
- `src/lib/server/betaPhase3.live.test.ts`
- `scripts/beta-phase3/{README.md,browser.mjs,interactions.mjs,periods.mjs,findings.mjs}`
- `docs/beta-readiness/STATUS.md` and `docs/beta-readiness/phase3/` evidence files

The exact evidence filenames are listed in `phase3/artifact-manifest.json`; final
test/build results are retained in `phase3/validation.json` and accompanying logs.

Unrelated user image files were preserved. No commit or push was made.

### Recommended Phase 4 order — not started

1. Resolve/review the inherited external-beta security and configuration gates.
2. Exercise Decisions/Shadow evidence freshness, insufficient-data outcomes and
   tenant isolation using explicit controlled providers; preserve all execution gates.
3. Verify approval/policy/reconciliation failure paths without live advertising writes.
4. Address PDF density and measured large-account performance after correctness gates.

## Phase 2 implementation and evidence

Existing development project: **`gkdyyjqepzayjdpvqnja`**, verified again through
MCP migration queries and actual authenticated Supabase HTTP requests. The two
Phase 1 fixtures remain. Two additional `[SIMULATED] Phase 2 Salon A/B` businesses
were created through actual browser signup/onboarding. Their private identity
manifest is `.env.beta-phase2.json`; no credentials belong in this record.

Setup, expected values, scenarios and cleanup commands:
[scripts/beta-phase2/README.md](../../scripts/beta-phase2/README.md).
Browser artifacts: [phase2-browser](./phase2-browser/), including desktop and mobile
screenshots, `evidence.json`, `errors.json` and `reliability.json`. Earlier failure
screenshots are debugging artifacts, not passing assertions.

### Phase 2 database changes

Applied migrations, confirmed in the remote ledger on October 21:

| Migration | Objects changed |
| --- | --- |
| `20261021014607_atomic_onboarding_workspace.sql` | `public.ensure_onboarding_workspace()` and authenticated-only EXECUTE grant; JWT identity, per-user advisory lock, organization lock and idempotent workspace creation |
| `20261021014803_simulated_meta_boundary.sql` | `public.guard_simulated_meta_integration()` and same-named trigger on `platform_integrations`; modified `public.claim_account_sync_job(uuid,text[])` to exclude simulations from untargeted claims |
| `20261021021332_sync_job_deduplication.sql` | Unique partial index `account_sync_jobs_one_active_type`; pending-job index `account_sync_jobs_pending_created` |

No new tables, projects, RLS bypasses, secret changes, Auth configuration changes
or schedules. Public TypeScript bindings regenerated from MCP; unchanged
AI/intelligence bindings reconciled using the Phase 1 catalog. Simulated sync writes
the existing organization/profile/integration/account/job/entity/creative/daily,
summary, hourly, audience and creative-feature structures. OAuth state is temporary.
Auth identities are managed through signup and supported Admin APIs.

### Phase 2 defects fixed

| Priority | Root cause and correction |
| --- | --- |
| P0 | Internal privileged business-context helpers were exposed as server actions accepting IDs. They are now server-only; normal onboarding uses the authenticated workspace RPC. |
| P0 | Non-atomic onboarding creation could duplicate workspaces. Workspace creation is now locked/idempotent; normal-user concurrent context checks pass. |
| P0 | Auth return-path validation accepted backslashes. Reject backslashes/control characters to prevent external redirects. OAuth state consumption now uses one atomic delete-return operation, rejecting replay and concurrent reuse. |
| P1 | Integration routes required completed onboarding, blocking connection during onboarding. They now permit incomplete setup while preserving business/account authorization. |
| P1 | Cached context survived onboarding writes and caused incorrect redirects; progress validation also accepted invalid completion. Expire per-user context tags and validate required saved fields and step transitions. |
| P1 | Missing verification parameters used a relative response redirect; weak-password 422 errors lost their specific message. Correct absolute redirect and error mapping. |
| P1 | Follow-up account selection could report success for queued work. Selection now processes its targeted job and checks completion; first sync updates integration freshness. |
| P1 | Coverage dates could exclude historical attribution corrections. Incremental sync rereads its requested lookback, retaining longer catch-up gaps. |
| P1 | Concurrent check-then-insert enqueues could create duplicate jobs. Unique active account/type index plus conflict reselect; five simultaneous requests return one job ID. |
| P1 | General Meta HTTP reads lacked a deadline. Add a 30-second per-attempt timeout, preserving existing retries/caller cancellation. |
| P2 | Browser fixture reruns raced account discovery and deselected an already-selected Mantine option. Wait for the enabled field before inspecting/choosing. Compare rolling-period KPIs with actual date-scoped rows rather than a stale hard-coded amount. |

### Phase 2 validation results

Node **24.2.0**. Reused completed checks instead of rerunning the entire suite, as
requested. No repository dependency or lockfile changes for browser automation.

| Check | Evidence/result |
| --- | --- |
| Real browser signup, verification callback, login, onboarding reload/back, A multiple-account selection, B skip Meta then single-account connection, Dashboard reload and logout protection | Passed in the preceding run; verification link came from Auth Admin, email delivery untested |
| Auth/proxy/onboarding/selection/simulation/Meta HTTP/incremental regression tests | Included in preceding full suite: **779 passed, 10 live tests skipped by default**; not rerun in final pass |
| Real Supabase Phase 2 suite, final pass | **8 passed**, 32.43 seconds; actual Auth refresh/errors, normal-client isolation, OAuth-state race, progress persistence, queue race, repeated/incremental sync and worker failure/recovery |
| Final browser reliability journey | **Pass**, exit 0, zero page errors: forged/malformed IDs rejected, real manual refresh 202 + polling + completion, duplicate refresh reused job, account switch/reload, Today missing data, paused history, four connection error scenarios, disconnect/reconnect, logout and protected-route rejection |
| Final browser KPI comparison | Account 2 current 7D **$400 / 40 results / $10 CPR / 2% CTR** on October 21; 30D **$3,000 / 300 / $10 / 2%**; screenshot review confirmed clear ad-set metrics and controlled media |
| Expected persisted metrics | Account 1 October 13–19: revision 0 twice **$280 / 28 leads**, revision 1 **$284 / 29**; entity IDs unchanged; foreign Overview load empty |
| Phase 1 fixture verification | Previously rerun successfully; its three real loader tests remain separate |
| Final TypeScript typecheck | **Pass**, exit 0, including generated RPC bindings |
| Production build | **Pass**, exit 0, no deployment. Browserslist age and experimental type-stripping warnings only |
| Targeted ESLint | Prior Phase 2 files pass. Final sync-state check reports one pre-existing `any` at the RPC wrapper, outside changed enqueue logic; existing project lint limitations below remain |
| Final harness/config ESLint and whitespace check | **Pass**, exit 0 |

Final MCP query confirms seven entities per account. Daily facts currently span
September 21–October 20 for both A accounts (180 rows each), and September 22–
October 20 for B (173 rows), reflecting the existing sync/data-policy windows.
The adapter can serve 90 days; this is not a claim that the worker persisted all
90 days. At the end of browser recovery all accounts are at revision 0: A1/B1
October 13–19 totals are $280/28, A2 $560/56. Phase 1 retains its separate 90-day
fixture coverage.

Reviewed `dashboard-mobile.png`, `account-2-dashboard.png` and
`30-day-paused-history.png`. Mobile KPIs and creative preview are readable.
The account-switch capture includes streamed lower-section skeletons; the 30D
capture shows the rendered creative/ad-set card. No cosmetic redesign was made.

The browser uses the actual Next.js application, Auth sessions and database. Only
Meta provider responses are simulated. API-contract, expired-session, Google
callback and route failure tests use explicit mocks where appropriate. No live
Google or Meta OAuth, Meta Graph, Jev or advertising execution was exercised.
Missing observations remain unavailable; no fake decision/HOLD records were added.

### Performance and remaining limitations

- **P0:** No known unresolved core Auth/onboarding/sync/isolation defect from the
  completed checks; this is not a security certification.
- **P1 before external beta:** Real Google/Meta OAuth configuration, email delivery,
  and scheduler authentication still need live/manual validation. Phase 1 database
  security patches, password protection and Edge JWT configuration concerns remain.
- **P1 portability:** The complete historical schema baseline is still absent.
  No fresh Supabase reset was claimed. Existing development migrations are applied;
  deploy corresponding application changes only through the approved process.
- **P2:** Phase 2 cleanup was made repeatable but not destructively exercised in the
  final pass; evidence users remain populated. Phase 1 cleanup/reseed was exercised.
- **P2:** Fixed October 2026 data ages naturally. Today after October 20 is missing,
  not observed zero; see fixture README for rolling browser-test limits.
- **P2:** Active-job uniqueness is per account/type. Different job types are not
  serialized by this index. Shared untargeted workers skip simulations; an existing
  scheduler may still enqueue their jobs. No schedule was enabled or modified.
- **P2:** Added queue indexes address a verified race and bounded pending scans;
  no speculative caching rewrite or load-test performance claim. Existing bulk
  normalization/upserts and scoped loaders are reused. Scale findings below remain.
- The explicitly enabled local simulator now uses `.next/beta-phase2` to coexist
  with an ordinary dev server. Production retains `.next`. This dev-only config
  addition followed the passing production build and does not change its config.

### Recommended Phase 3 tasks (not started)

1. Resolve pre-beta external Auth/Edge security prerequisites and manually validate
   real OAuth/email steps with approved test accounts.
2. Review Overview/Campaigns/Connections desktop/mobile UX, missing coverage,
   paused history, creative fallbacks and error/loading messages using these fixtures.
3. Exercise Decisions/Shadow with explicit mocked provider inputs, policy/review
   conflicts and outcomes; retain independent live-action gates.
4. Address measured scale bottlenecks, full migration baseline and reusable browser
   CI. Keep real provider validation separate from simulated evidence.

### Exact Phase 2 file changes

Phase 1 changes below and unrelated pre-existing work are preserved.

- `next.config.mjs`, `tsconfig.json` (isolated simulator output/type paths)
- `src/app/api/auth/callback/route.ts`
- `src/app/api/auth/verification/route.ts`
- `src/app/api/integrations/connect/[platform]/route.ts`
- `src/app/api/integrations/callback/[platform]/route.ts`
- `src/app/api/integrations/meta/ad-accounts/route.ts`
- `src/app/api/integrations/meta/pages/route.ts`
- `src/app/api/integrations/meta/select-ad-account/route.ts`
- `src/app/api/integrations/meta/select-ad-account/route.test.ts`
- `src/app/api/integrations/meta/sync-jobs/[jobId]/route.ts`
- `src/app/api/integrations/meta/sync-jobs/[jobId]/dispatch/route.ts`
- `src/lib/server/actions/business/context.ts`
- `src/lib/server/actions/business/onboarding.ts`
- `src/lib/server/actions/meta/pages/actions.ts`
- `src/lib/server/auth/authentication.test.ts`
- `src/lib/server/betaOnboardingMigration.test.ts`
- `src/lib/server/betaPhase2.live.test.ts`
- `src/lib/server/integrations/README.md`
- `src/lib/server/integrations/adapters/meta.ts`
- `src/lib/server/integrations/metaSelection.ts`
- `src/lib/server/integrations/service.ts`
- `src/lib/server/integrations/simulation/meta.ts`
- `src/lib/server/integrations/simulation/meta.test.ts`
- `src/lib/server/repositories/ad_accounts/syncState.ts`
- `src/lib/server/supabase/authError.ts`
- `src/lib/server/supabase/proxy.test.ts`
- `src/lib/server/sync/meta/client.ts`
- `src/lib/server/sync/meta/client.test.ts`
- `src/lib/server/sync/meta/incrementalWindow.ts`
- `src/lib/server/sync/meta/incrementalWindow.test.ts`
- `src/lib/server/sync/meta/processFirstSyncJob.ts`
- `src/lib/server/sync/meta/syncMetaBusinessPlatform.ts`
- `src/lib/server/sync/syncBusinessPlatform.ts`
- `src/lib/shared/types/supabase.ts`
- The three Phase 2 migrations listed above under `supabase/migrations/`
- `scripts/beta-phase2/state.mjs`
- `scripts/beta-phase2/browser.mjs`
- `scripts/beta-phase2/browser-reliability.mjs`
- `scripts/beta-phase2/clean.mjs`
- `scripts/beta-phase2/README.md`
- `docs/beta-readiness/STATUS.md`
- `docs/beta-readiness/phase2-browser/`: `signup.png`, `a-dashboard.png`,
  `b-dashboard.png`, `b-disconnected.png`, `manual-refresh.png`,
  `account-2-dashboard.png`, `today.png`, `30-day-paused-history.png`,
  `dashboard-mobile.png`, `disconnected-after-sync.png`, `failure.png`,
  `reliability-failure.png`, `errors.json`, `evidence.json`, `reliability.json`

## Project and connectivity

- Modified existing development project **`gkdyyjqepzayjdpvqnja`**:
  `https://gkdyyjqepzayjdpvqnja.supabase.co`.
- MCP project URL matched `.env.local` before any writes. SQL runs as `postgres`;
  database is PostgreSQL 17.4. Auth admin, Storage, and normal authenticated REST
  clients all connected successfully. `public`, `ai`, and `intelligence` are
  reachable. No new project was created.
- Inspected columns, defaults, constraints, indexes, views, functions/RPC signatures,
  RLS/grants, Auth profile trigger, migration history, Storage, Edge metadata,
  cron metadata, security/performance advisors and aggregate logs.
- Core advertising schema is normalized into `ad_entities` and
  `ad_entity_performance_*`; campaign/ad-set/ad legacy names are invoker-security
  compatibility views. No duplicate campaign/reporting architecture was introduced.
- Existing two Auth users and the original business were preserved. No Vault
  contents, Auth configuration, credentials, live Meta data or budgets were changed.

## Schema repairs and migrations

Applied through Supabase MCP; filenames match the actual recorded remote versions:

| Version | Migration | Result |
| --- | --- | --- |
| 20261020231659 | `beta_access_hardening` | Applied and tested |
| 20261020231922 | `beta_scope_integrity` | Applied and tested |

The five repository migrations dated October 6–10 already existed in the database
but were missing from its ledger. A local PGlite reconstruction matched the live
catalog: **10 tables, 63 constraints, 17 function definitions/signatures, 31 indexes,
7 policies; zero differences**. Column nullability/defaults also matched. Recorded
these five original versions/names and exact SQL in
`supabase_migrations.schema_migrations`; did not replay their DDL:

- `20261006000000_add_v2_decision_persistence`
- `20261007000000_add_review_execution_claims`
- `20261008000000_add_shadow_evaluation_jobs`
- `20261009000000_add_action_outcome_measurements`
- `20261010000000_add_limited_auto_execution`

Public bindings were regenerated by MCP after changes. AI/intelligence bindings
were generated from live columns, FK/unique keys and RPC metadata. This removes
reliance on manually narrowed table definitions. CLI generation now includes all
three schemas and preserves the existing file on failure. Local config now matches
PostgreSQL 17 and exposes ai/intelligence, matching the remote API.

The historical `20260510000100_account_intelligence_schema` migration remains in
the remote ledger only. A complete fresh local database/reset baseline is not
present in the repository; additive migration tests use explicit test dependencies.
No fresh-stack reset or complete historical migration replay is claimed.

## Bugs fixed

| Priority | Verified cause | Repair / evidence |
| --- | --- | --- |
| P0 | Vault token read/write RPCs granted to anon/authenticated without caller authorization | Restricted token RPCs to service role; real anonymous/authenticated calls now fail. Authorized server callers use admin only after business-scoped integration lookup. |
| P0 | Calendar approval and sync mutation RPCs were publicly executable | Restricted to service role; real client rejection and local migration tests pass. |
| P0 | Browser writers could modify integration token references used by later server reads | Revoked browser integration mutations; real client UPDATE fails. |
| P0 | `intelligence.ad_account_signals` had RLS disabled | Enabled RLS with organization-scoped SELECT, server-only writes; positive/negative SQL role tests pass. |
| P0 | `report-archive-pdfs` was public despite private-download application design | Bucket made private; Storage API verifies private. Existing archive content preserved. |
| P1 | Independent FKs allowed entity/account/business combinations that disagreed | Added composite scope FKs; no inconsistent existing rows found; real service-role invalid inserts now fail. |
| P1 | Reports campaign/ad-set/ad dimension queries could silently stop at the API row cap | Stable ID ordering and 500-row pagination; 1,201-row and failed-page regression tests pass. |
| P1 | Migration ledger missing already-deployed decision changes | Verified full additive contracts, then repaired ledger without DDL replay. |
| P1 | Fixture cleanup initially hit non-cascading sync-job FKs | Delete scoped sync imports first; cleanup/reseed actually exercised. |

## Synthetic fixtures

See [fixture commands and interpretation](../../scripts/beta-fixtures/README.md).
All dates/numbers/IDs are deterministic; random passwords stay in ignored local
`.env.beta-fixtures.json` (0600). Auth users were created with supported admin APIs,
including stable IDs. No direct Auth table insertion was used.

| | Business A | Business B |
| --- | --- | --- |
| Business | `[SYNTHETIC] Aurora Salon & Aesthetics` | `[SYNTHETIC] Birch Beauty Studio` |
| Business ID | `f6f96cff-bde3-4627-a613-4f16bfdc1d7c` | `ff73ea93-7aaa-4d62-afc4-b98fe206f657` |
| Organization ID | `151d18bd-98e3-40df-a372-2b7ca8ef3b67` | `4576aad3-aeaf-45a9-a2e9-18735c599ef2` |
| Account ID | `7e365a93-b133-4574-aa86-89deb51030bf` | `98de1118-7867-4d20-aea2-1f1a92df6630` |
| Owner email | `deepvisor-beta-a@example.test` | `deepvisor-beta-b@example.test` |
| Owner Auth ID | `5efb0bcd-3ac9-4d42-ad28-00bad6a42610` | `cfd21931-3866-4c60-a458-7ace7279388a` |
| Campaigns / ad sets / ads | 3 / 5 / 12 | 1 / 2 / 4 |
| Ad-set daily observations | 354 | 180 |
| Last completed 7D spend / results | $994 / 109 | $780 / 94 |
| Full observed-history spend / results | $10,942 / 1,301 | $7,428 / 1,064 |

Both accounts use USD / America/New_York. Fixed as-of: October 20, 2026.
Across both tenants: **27 entities, 16 creatives, 2,126 daily facts, 27 entity
summaries, 1,008 hourly facts, 112 audience summary facts, two completed synthetic
import jobs and two sync-state rows**. Coverage spans 90 calendar days with
intentional sparse and low-data exceptions. One A ad set is active now; three have
paused historical performance; the fifth is paused with insufficient observations.
No observed delivery today; missing days are not backfilled with invented zeros.

Audience summary coverage mixes October 13–19 and August 21–September 19. Age,
gender, age×gender, geography, placement and device use supported dimensions;
hourly rows cover October 14–20 only. Reports labels mixed snapshots and partial
hourly coverage. Results are leads + messages + calls. Derived rates are coherent;
undefined cost-per-result is null. No daily reach is summed into unique period reach.

Six controlled SVG assets live in the existing public business-media bucket under
`beta-fixtures/deepvisor-beta-v1/`; they contain only synthetic promotions. They
cover portrait, landscape, square, video-poster, missing-media and small-thumbnail
cases. Public placeholder media is intentionally shared; creative metadata and
performance remain tenant-isolated.

The fixture integration is selectable by the existing app, but has no credentials.
Database triggers reject adding tokens, removing its marker, or creating queued or
running Meta sync jobs. Autonomy/evaluations are not enabled or seeded. Decision
and execution rows used for RLS tests were uncommitted and rolled back. No live
Meta/Jev operation was performed. Real cron schedules were not changed.

## Verified behavior and validations

Node **24.2.0**; dependencies and lockfile unchanged.

| Check | Actual result |
| --- | --- |
| MCP SQL + real REST/Auth/Storage connectivity | Pass |
| Fixture seed → reseed | Same IDs/counts/metrics; pass |
| Cleanup → reseed → verify | Pass; fixture data remains populated |
| Normal user A/B reads | Own business/account/entities/creatives/metrics visible; foreign rows invisible |
| Invalid account / organization membership | Rejected by application loaders/RPC checks/RLS |
| Anonymous access and token/approval RPCs | Protected reads empty; privileged RPCs denied |
| Composite scope and synthetic guards | Invalid creative/performance inserts, credential assignment and runnable sync jobs rejected through actual API |
| Decision/signals RLS SQL test | Both users see only own temporary rows; browser writes denied; all test rows rolled back |
| Real Overview + Reports loader tests | **3 passed**; actual Supabase data, authenticated client; no mocked HTTP |
| `npm run typecheck` | **Pass**, exit 0 |
| `npm test` | **737 passed**, 3 live tests skipped by default; live tests separately passed |
| `npm run build` | **Pass**, exit 0; production build, no deployment |
| Targeted ESLint | New/other modified files pass; Reports loader has **8 pre-existing any errors + 1 unused-function warning**, none on changed pagination lines |

The legacy ESLint config cannot load under installed ESLint 9/Next 16 (circular
config error); `npm run lint` also still uses unavailable `next lint`. Targeted
checking used a temporary flat config importing the installed Next presets; no
repository lint infrastructure was redesigned. Build warnings: old Browserslist
data and Node's experimental type-stripping notice. Initial sandboxed build stalled;
the rerun outside that restriction compiled and completed successfully.

Evidence: [fixture-verification.json](./fixture-verification.json),
[database-audit.json](./database-audit.json), and
[rollback-only SQL RLS test](../../supabase/tests/beta_fixture_rls.sql).
No rendered desktop/mobile browser screenshots were taken in this infrastructure
phase. Media URLs/MIME types were checked; full visual and interactive review remains
Phase 2. Passing loaders is not a claim that complete browser E2E has passed.

## Initial performance inspection

The selected account/ad-set/date query uses
`ad_entity_performance_daily_account_level_day_idx`: 120 input rows, 30 grouped
rows, **0.542 ms execution** in the recorded database plan. The full report RPC's
first measured call took **122.938 ms**, including function work/initial planning.
These are single development observations, not a load-test SLA.

Fixed dimension pagination. Existing fact/surface loaders already batch or paginate;
Overview uses scoped ID batches and bounded date windows. Reports rebuilds filter
context across requests, and Overview reads historical decision headers before
selecting detailed records; larger-scale caching/pagination work remains P2.
Initial advisors reported 40 unindexed FKs, 23 per-row auth-policy checks,
10 multiple-permissive-policy findings, 42 unused indexes and one bloat finding.
No evidence justified dropping indexes or broad rewrites on this small dataset.
The two new unique indexes support scope integrity; existing account/date indexes
serve the verified hot read. Review advisor findings with realistic volume later.

## Remaining issues and prerequisites

- **P0: no known unresolved blocker for Phase 1 fixture/database testing.** This
  is not a general security certification or permission for live execution.
- **P1, before external beta:** Supabase reports outstanding PostgreSQL security
  patches and disabled leaked-password protection. Engine upgrades/shared Auth
  settings were not changed in this task. Schedule/review those operations first.
  [Postgres upgrade guidance](https://supabase.com/docs/guides/platform/upgrading)
- **P1, before external beta:** Four deployed Edge Functions are ACTIVE with
  `verify_jwt=false`. Source has optional CRON_SECRET enforcement; deployed secret
  presence and end-to-end scheduler authentication were not verifiable from the
  metadata tools. Validate those gates; do not infer them from deployment status.
  Existing backfill and calendar cron jobs remain active at their existing cadences.
- **P1, environment portability:** Complete baseline migration absent locally;
  no `supabase db reset` is supported/claimed. Capture a reviewed secret-free
  baseline before requiring fresh-stack CI. CLI full type regeneration requires
  `supabase login`/`SUPABASE_ACCESS_TOKEN` and project link; MCP supplied types here.
- **P2:** Twelve legacy functions have mutable search paths. Eleven remaining
  browser-executable security-definer functions include membership helpers and
  trigger/legacy functions. Review unused functions and least privilege separately;
  sensitive token/job/approval functions were restricted in this phase.
  [Database security/performance linter](https://supabase.com/docs/guides/database/database-linter)
- **P2:** Existing lint errors/config incompatibility, scale diagnostics noted above,
  and lack of browser screenshots. The three internal execution tables intentionally
  have RLS without browser policies; those advisor notices are expected deny-all.
- **Operational:** Database grants are already live. Deploy the accompanying
  authorized-server token-call changes through the normal approved process before
  testing Meta page/WhatsApp reads on a separately deployed old application. No app
  or Edge Function deployment was performed.
- **Fixture limits:** Fixed dates become stale naturally. Seed is recoverable via
  rerun, not transactional across API batches; run one operator at a time. Media
  contains posters only. No stored decisions/HOLD outcomes were fabricated.

## Historical Phase 1 handoff recommendations

1. Resolve the external-beta security/configuration prerequisites above; exercise
   signup/login/logout, account selection, unauthorized URL/cookie manipulation,
   errors and loading states through a real browser with both fixture users.
2. Verify Overview, Decisions, Campaigns and Reports on desktop/mobile with the
   controlled clock, sparse history, media fallbacks, snapshots and exports.
3. Exercise explicit mock decision/Shadow evaluation, policy/review conflicts and
   outcomes against isolated fixtures. Keep all live advertising execution off.
4. Only after separate authorization, verify real Meta **read/sync** and real Jev
   availability. Fixture results do not verify those integrations.

## Exact repository changes

- `.gitignore`
- `package.json`
- `supabase/config.toml`
- `supabase/migrations/20261020231659_beta_access_hardening.sql`
- `supabase/migrations/20261020231922_beta_scope_integrity.sql`
- `supabase/tests/beta_fixture_rls.sql`
- `scripts/generate-supabase-types.mjs`
- `scripts/beta-fixtures/fixture.ts`
- `scripts/beta-fixtures/run.mjs`
- `scripts/beta-fixtures/audit-contract.mjs`
- `scripts/beta-fixtures/reconcile-types.mjs`
- `scripts/beta-fixtures/README.md`
- `src/lib/shared/types/supabase.ts`
- `src/lib/server/actions/common/accessToken.ts`
- `src/lib/server/actions/common/accessToken.test.ts`
- `src/lib/server/actions/meta/pages/actions.ts`
- `src/lib/server/actions/meta/whatsapp/actions.ts`
- `src/lib/server/integrations/README.md`
- `src/lib/server/repositories/reports/buildReportPayload.ts`
- `src/lib/server/repositories/reports/correctness.test.ts`
- `src/lib/server/betaFixtures.test.ts`
- `src/lib/server/betaAccessMigration.test.ts`
- `src/lib/server/betaFixtures.live.test.ts`
- `docs/beta-readiness/STATUS.md`
- `docs/beta-readiness/database-audit.json`
- `docs/beta-readiness/fixture-verification.json`

## Exact database objects modified

- Grants on public functions `get_platform_token(uuid)`,
  `store_platform_token(text,text,text)`, `upsert_platform_token(text,text,text)`,
  `claim_account_sync_job(uuid,text[])`, `invoke_process_calendar_queue_cron()`,
  `invoke_process_meta_backfill_job(uuid)`, `invoke_process_meta_backfill_jobs_cron()`,
  `accept_calendar_queue_workflow(uuid,uuid)`; browser grants removed, service kept.
- Grants on `public.platform_integrations`; RLS/grants plus
  `signals_business_read` policy on `intelligence.ad_account_signals`; schema
  intelligence USAGE for authenticated/service_role.
- `storage.buckets`: only `report-archive-pdfs.public=false`. Synthetic objects
  added to existing `business-media` under the dedicated fixture prefix.
- `public.ad_accounts`: unique `ad_accounts_business_id_id_key` (and backing index).
- `public.ad_entities`: unique `ad_entities_scope_key` (and backing index),
  FK `ad_entities_business_account_fkey`.
- `public.ad_creatives`: FK `ad_creatives_business_account_fkey`.
- `public.ad_entity_performance_daily`, `ad_entity_performance_summary`,
  `ad_entity_performance_monthly`, `ad_entity_performance_hourly`,
  `ad_audience_breakdowns_summary`: respective `<table>_scope_fkey` constraints.
- `public.guard_synthetic_integration()` / trigger on `platform_integrations`;
  `public.guard_synthetic_sync_job()` / trigger on `account_sync_jobs`.
- `supabase_migrations.schema_migrations`: two new migrations and five repaired entries.
- Synthetic rows only in `organizations`, `organization_memberships`,
  `business_profiles`, `platform_integrations`, `ad_accounts`, `ad_account_sync_state`,
  `account_sync_jobs`, `ad_entities`, `ad_creatives`, `ad_entity_performance_daily`,
  `ad_entity_performance_summary`, `ad_entity_performance_hourly`,
  `ad_audience_breakdowns_summary`; Auth users created/deleted using the Auth API,
  with `public.users` populated by the existing Auth trigger.
- AI decision/audit tables and signals had temporary SQL-test inserts only;
  all were rolled back. No persistent fixture execution records or policies remain.
