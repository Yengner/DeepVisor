# DeepVisor beta readiness

Updated: 2026-10-21. **Phases 1 and 2 complete for the development simulation scope.**
Real Auth/onboarding and real queued sync with a scoped simulated Meta provider are
exercised. Phase 2 typecheck, production build and eight real-database checks pass.
The final browser reliability journey also passed with no JavaScript page errors.
This is not approval to admit external users or deploy. Phase 3 has not started.

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
