# Architecture audit — 2026-11-02

Scope: repository structure, routes/import graph, installed dependencies and tooling,
schema bindings and migration history, module contracts, and the core workflow call
paths. This is a source audit, not certification of every line or of deployed services.
The working tree was clean at entry. No remote configuration or customer data was
queried or changed. Deployment statements in older notes are historical evidence,
not current runtime verification.

## Strengths

- Feature snapshots are deterministic and versioned. DecisionProvider, DecisionEngine,
  PolicyEngine, approval persistence and advertising execution have distinct contracts.
- The executor and organizer use durable claims, fingerprints, fresh reads, readback,
  immutable audit history and explicit enablement. These are substantive boundaries.
- Authenticated business context and account selection have established entry points.
  Modern repositories and migrations preserve business/account lineage.
- Tests exercise mocked HTTP, tenant boundaries and real migration SQL in PGlite.
  Baseline: **98 test files passed, 8 skipped; 958 tests passed, 18 skipped**.
- Overview already separates persisted reads from inference and execution. Agency
  composes existing selected-account data and review actions rather than adding an executor.

## Findings and changes in this pass

| Finding | Evidence | Treatment |
| --- | --- | --- |
| Feature domain depends on repository/assessment locations | `features/buildFeatureSnapshot.ts`, `features/types.ts` | Move unchanged aggregation, rates and signal heuristics to `shared/performance`; keep compatibility exports. No feature version/formula changes. |
| Two pagination loops with different null semantics | `repositories/utils.ts`, `dashboard/overview/load.ts` | One implementation in `repositories/pagination.ts`; retain strict unavailable errors and legacy null-as-empty semantics separately. Add boundary/failure/batching regression tests. |
| Cross-domain services import generic pagination from Overview | Campaigns table/explorer and Organizer | Import pagination from persistence infrastructure; keep old Overview exports for compatibility. |
| Overview loader mixes session context and bulk decision lineage | `dashboard/overview/load.ts` was 380 lines | Extract `decisionRecords.ts`; preserve query scope, selected columns, batching, ordering, optional failures and public exports. |
| Report metric types depend on server DTO ownership | Reports shared helpers and intelligence type imports | Extract independent `shared/reports/types.ts`; keep the larger report/dashboard DTO migration as follow-up. |
| Client toast handler imports its own barrel | `client/toasts/index.ts` ↔ `toast-handlers.ts` | Import implementation directly, eliminating the runtime cycle. |
| Campaign form interfaces imported as runtime values | Four Meta creation steps | Use explicit `import type`; no UI changes. |
| Unsupported lint command, no lint CI gate | `next lint`, legacy `.eslintrc.json` | Use installed ESLint 9 flat Next/TS configs and CI gate; preserve pre-existing errors in ESLint's built-in suppression file. Strict lint exposes all debt. |
| No repeatable import/cycle gate | Runtime graph inspection | TypeScript AST check plus tests; exact baseline for two retained exceptions. No new package. |
| Stale and fragmented navigation/docs | Root README, data-layer README, unused strategy examples, ignored `/docs` | Add architecture/map/flows/development handbook; correct module navigation and track only maintained docs. |

## Retained debt and risks

Prioritize these as separately scoped work, with characterization tests first:

1. **Large active modules.** Reports `buildReportPayload.ts` (~2,878 lines), Meta
   `sync/meta/fetch.ts` (~1,368), intelligence assessments/trends (~1,300 each),
   campaign reuse (~1,236), `ad_accounts/syncState.ts` (~1,008), integration service
   (~905), and the draft builder (~2,941) combine multiple responsibilities. Extract
   pure query construction/calculations before changing orchestration or transactions.
2. **Presentation/domain coupling.** Calendar (~3,496 lines), Settings (~1,216),
   and the draft builder still mix form state, normalization and business choices.
   Overview/exploration/Organizer share Overview context and media models. Generic
   pagination was removed from that coupling; account-context extraction needs its
   own authorization/cache tests.
3. **Overlapping data namespaces.** `server/data` is a compatibility facade: repositories, normalizers
   and analytics query modules mostly re-export `server/repositories` implementations.
   Do not introduce a third repository layer or assume the old directory is obsolete.
4. **Contracts still cross server folders.** Larger Reports, Dashboard and intelligence
   DTOs retain type-only dependencies. The extracted metric contracts break the direct
   Reports/intelligence type cycle; future DTO moves should preserve compatibility exports.
5. **Uneven error/config patterns.** Legacy routes use varying response envelopes,
   raw exception messages, `any`, and broad barrels. Shared `utils/guards.ts` even
   imports Node crypto. Keep new domain imports narrow; don't mechanically normalize
   old routes or expose server helpers through client barrels.
6. **Lint debt.** Initial installed-rule inventory: 94 errors in 43 files (82 explicit
   `any`, 10 effect-state errors, 2 prefer-const), plus 46 warnings. Existing inline
   disables also remain. The suppression baseline is a migration aid, not a clean-lint
   claim; counts can mask a replacement violation in the same file/rule. Shrink it as
   affected modules are improved. Do not regenerate it to accept new debt.
7. **Architecture exceptions.** Deprecated marketing Benefits components retain a
   circular animation constant import; report fixtures import the server demo builder.
   The exact edges live in `scripts/architecture/baseline.json`. Type-only cycles and
   computed imports/transitive client bundles are outside this lightweight check.
8. **Schema bootstrap is incomplete.** Migrations assume pre-existing organizations,
   businesses, integrations, Vault helpers and schemas. Generated bindings describe
   contracts, not a database reconstruction plan. Local PGlite fixtures intentionally
   supply minimal prerequisites; they are not a production baseline.
9. **Compatibility is not removal proof.** `LegacyDashboard.tsx` is not the current
   route and owns the 5,349-line `DashboardClient`. Calendar/Reports and campaign
   creation still have routes. `(unused)` is a Next route group, not a route-disable
   mechanism. The older `useCampaignSubmit` still references a missing
   `/api/meta/create-campaign` route; current draft flows must not be conflated with
   an implemented publish pipeline. No compatibility code is deleted here.
10. **Legacy assistant semantics.** Its keyword-based response service includes
    hard-coded USD and older missing-data/ranking assumptions. It is not the Jev
    decision pipeline. Correcting those outputs would change behavior and needs a
    separate product/data-correctness task.

High-risk areas deliberately retained: OAuth/Vault token access, queue claims and
recovery, policy gates, canonical approval hashes, executor state machines, renaming
and restoration lineage, RLS and migration RPCs. No migrations, dependency changes,
new schedules, advertising writes, commits or deployments are part of this pass.

## Final verification

| Check | Result |
| --- | --- |
| Focused feature/assessment/Overview/Campaigns/Organizer/repository/report tests | 251 passed, 2 opt-in tests skipped |
| Full `npm test` after refactor | 99 files passed, 8 skipped; **966 tests passed, 18 skipped** |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed with the existing suppression baseline; 46 warnings |
| `npm run lint:strict` | Expected failure exposing 94 existing errors and 46 warnings; no clean-lint claim |
| `npm run test:architecture` | 6 tests passed |
| `npm run check:architecture` | Passed with 2 exact documented exceptions |
| `npm run build` | Passed; compiled and generated 62 static pages. Initial sandboxed build stalled; stopped only this task's build processes and reran with approved unsandboxed access. |
| Local handbook/source links and `git diff --check` | Passed |

The moved rate formulas, aggregation implementation and decision-history query
body were also compared to their original source and are unchanged. Build output
retains existing Browserslist-age and Node type-stripping warnings; no dependency
update was made to silence them. No browser/screenshots or live Meta/Jev/database
integration tests were performed. This pass changes no visual layout; UI runtime
behavior beyond the automated checks remains unverified. No deployment or migration
is required to review these local changes.

See [Architecture](ARCHITECTURE.md), [Codebase map](CODEBASE_MAP.md),
[Flows](FLOWS.md), and [Development guide](DEVELOPMENT_GUIDE.md).


## Phase 2 relationship review — 2026-11-13

Documentation-only independent review of committed `ef313aff8f23ebbe20211006969a1ff05ae18f9e`.
Read-only development catalog/Edge/schedule inspection supplements source evidence;
[verification scope](SYSTEM_DIAGRAM.md#verification-ledger--2026-11-13) is explicit.
No application fixes, Jira changes, Supabase writes or deployments were performed.
The older audit above remains historical; its test counts are not Phase 2 results.

| Finding | Evidence and consequence | Assessment / follow-up for lead engineer |
| --- | --- | --- |
| Hierarchy FKs establish existence, not parent scope/level | `ad_entities_parent_id_fkey`, `campaign_id_fkey`, `adset_id_fkey` reference only `id`; catalog and [migration](../supabase/migrations/20260510000100_account_intelligence_schema.sql). Composite fact FKs protect metrics but not hierarchy ancestry. | Confirmed constraint gap; no corrupt row or exploit demonstrated. Validate writer invariants and tenant/level negative cases before considering a separate constraint change. |
| Job business/account/integration are separately referenced | `account_sync_jobs` has three independent FKs. [Worker](../src/lib/server/sync/meta/processBackfillJobs.ts) resolves integration by business; one account read uses ID only. Existing queue scope and privileged writers therefore matter. | Confirmed structural dependency on trusted enqueue paths, not proof of cross-tenant access. Review all service-role enqueue/RPC boundaries with mismatched scopes. Snapshot scope is stronger: its trigger validates the combined scope. |
| Creative and decision targets are logical references | `creative_external_id` matches scoped `platform_creative_id`; feature `entity_id` and proposal `target_entity_id` are text. [Explorer](../src/lib/server/campaigns/exploration/load.ts), [V2 schema](../supabase/migrations/20261006000000_add_v2_decision_persistence.sql). | No FK guarantees current media or target existence. Existing resolvers/executor fresh reads are essential; retain missing-media and stale-target behavior. |
| Multiple freshness/state contracts | Integration status/time, account coverage, jobs, per-resource revision, lifecycle observations and saved presentations are distinct. [Resource contract](../src/lib/server/sync/resources/README.md) limits atomic publication to resource windows; legacy full sync spans stages. | Confirmed consistency boundary. A completed read can coexist with stale optional datasets or failed inference. Do not label every downstream artifact fresh from one timestamp. |
| Sync and intelligence completion are coupled unevenly | [syncBusinessPlatform](../src/lib/server/sync/syncBusinessPlatform.ts) awaits assessments/trend artifacts before marking integration synced; [evaluation enqueue](../src/lib/server/decisions/shadow/service.ts) catches failures; lifecycle capture logs failures while preserving facts. | Different failure propagation can leave saved facts without matching derived artifacts. Review partial-success observability; no production incident established. |
| Privileged workflows bypass tenant RLS | [Admin client](../src/lib/server/supabase/admin.ts), worker/Insights mutation RPCs. All inspected base tables enable RLS, and sampled policies restrict business/member reads, but service-role calls bypass those policies. | Residual review risk, not a discovered RLS exploit. Full grants, SECURITY DEFINER bodies, deployed schema exposure and cross-tenant runtime tests were not audited here. |
| Hosted topology can be misread from names/docs | Catalog: worker job named every-minute actually runs every ten minutes; calendar job named every-five-minutes runs every minute; enqueue inactive. Edge versions differ from older runbook versions. | Confirmed metadata/documentation drift. Names and ACTIVE function status do not establish successful forwarding or source parity. Deployment owner must verify hosted app revision and gates before activation. |
| Shared queue tick also drains decision/outcome work | [Internal route](../src/app/api/integrations/meta/process-backfill-jobs/route.ts) schedules sync, evaluations and outcomes; [dispatch](../src/lib/server/sync/dispatch.ts) uses response-lifetime work. | Tight operational coupling: slow/failed app hosting affects multiple pipelines. Durable jobs help recovery, but no hosting-duration/load test was performed. |

**Corrected documentation assumption:** legacy dimension/performance names are
security-invoker views in inspected development, and writers delegate to unified
storage. They are not evidence of duplicated physical metric state. Saved feature
snapshots, assessment digests and presentation payloads are intentional derived
copies with different revision/immutability contracts.

**Historical absence finding, superseded below:** no Meta webhook path was present
at the Phase 2 baseline. External subscription settings were unverified. Resource refresh, Insights, Shadow/Review
and execution gates have implementation/schema evidence, not hosted enablement
proof. No live provider calls, advertising writes or UI behavior tests were run.

Phase 2 verification results are recorded in [System diagram](SYSTEM_DIAGRAM.md).
No application test/typecheck/build claim is made for this documentation-only review.


## Webhook follow-up — source `e9bf2cd`

The earlier no-webhook finding is superseded: a gated receiver, delivery deduplication,
events resource, subscription lifecycle and private Realtime hints are implemented.
Read-only development metadata confirms the migration/tables and restrictive account
signal policy. [Flow](FLOWS.md#webhook-triggered-status-reads-and-refresh) and
[verification addendum](SYSTEM_DIAGRAM.md#webhook-verification-addendum) record scope.

| Remaining risk | Evidence / limitation |
| --- | --- |
| Status and metrics can diverge in freshness | Events jobs capture lifecycle/issues but do not refresh performance or `ad_entities.status`; Campaigns may lag until maintenance. |
| Incomplete notification coverage | Parsed refresh fields exceed the dashboard subscription list. Ordinary pauses, budgets, names and targeting have no guaranteed immediate webhook path. |
| Recovery remains dependent on existing work | Busy accounts retain follow-up demand and the worker remains fallback; failure-backoff demand may be skipped. Deduplication and a 200 acknowledgement do not certify a completed read. |
| Live integration unverified | Focused mocked/PGlite tests passed (30); no real Meta delivery, hosted callback/subscription verification or authenticated browser Realtime test was performed. |

No new defect issue or duplicate feature backlog was created. Existing documentation
work KAN-5 and environment-inventory work KAN-4 receive evidence updates; neither is
certified Done by this bounded documentation follow-up. No application, database,
schedule, deployment or advertising changes were made.
