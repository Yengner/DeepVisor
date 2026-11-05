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
