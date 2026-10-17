# DeepVisor — Codex repository instructions

These instructions apply to the repository. Keep task-specific requirements in the user's prompt or an approved plan; do not turn this file into a feature backlog.

## Product and boundaries

DeepVisor is a Meta-first advertising intelligence and decision product. The primary surfaces are **Overview** (`/dashboard`), **Decisions** (`/decisions`), **Campaigns** (`/campaigns`), Connections, and Settings. Owners should be able to see which advertising is running, how it performs, what DeepVisor observed, and whether action is needed.

The operational architecture is **Meta data → versioned features → provider-neutral decisions → deterministic policy → separately authorized actions → measured outcomes**. The decision provider never directly changes advertising. `HOLD` and insufficient evidence are valid outcomes.

Existing Calendar, Reports, campaign-creation, and historical analytics code may remain for compatibility. Do not delete, revive, or redesign them unless specifically requested.

## How to work

1. **Inspect before editing.** Check `git status`, the relevant files and tests, and nearby implementations. Respect all existing user/uncommitted changes; never discard or reset them as a shortcut.
2. **Honor task scope.** A request for a plan means plan only. For implementation, make the smallest coherent change that fixes the requested behavior; avoid unrelated refactors, dependency upgrades, schema changes, and UI redesigns.
3. **Reuse existing paths.** Look for an existing endpoint, repository, media resolver, sync worker, policy rule, or UI component before introducing another one. Prefer a root-cause fix to a superficial workaround.
4. **Avoid speculative claims.** Distinguish implemented, configured, deployed, enabled, and verified behavior. Investigate the current code and evidence rather than trusting stale README text or previous task summaries.
5. **Keep consequential operations explicit.** Do not commit, push, deploy, apply remote migrations, change production configuration, rotate credentials, or perform live advertising writes unless the user specifically authorizes that operation. A request to implement code is not authorization to activate it.
6. **Stop when the task is complete.** Do not silently start the next roadmap item.

## Code map (read only what is relevant)

| Area | Primary location |
| --- | --- |
| Routes and server actions | `src/app/` |
| Overview/dashboard | `src/app/(root)/dashboard/`, `src/lib/server/dashboard/overview/` |
| Ad-set/ad explorer and creative media | `src/lib/server/campaigns/exploration/`, `src/components/campaigns/exploration/` |
| Meta account selection and sync | `src/lib/server/integrations/`, `src/lib/server/sync/`, `src/app/api/sync/` |
| Feature snapshots | `src/lib/server/features/` |
| Decisions, Jev, policy, Shadow, outcomes | `src/lib/server/decisions/` |
| Authorized Meta actions and execution | `src/lib/server/advertising/` |
| Supabase schema changes | `supabase/migrations/` |
| Test/CI commands | `package.json`, `.github/workflows/ci.yml` |

Read the applicable module's documentation **when changing that area**:

- Meta integration: `src/lib/server/integrations/README.md`
- Decisions and Jev configuration: `src/lib/server/decisions/README.md`
- Shadow evaluation: `src/lib/server/decisions/shadow/README.md`
- Advertising execution/reconciliation: `src/lib/server/advertising/README.md`
- Limited Auto: `src/lib/server/advertising/LIMITED_AUTO.md`
- Outcome measurement: `src/lib/server/decisions/outcomes/README.md`

The root README is introductory, not the authority for execution safety or current API behavior.

## Advertising data correctness

- **Scope all reads/writes to the authenticated business and selected ad account.** Preserve tenant boundaries, authorization, RLS, and server-only credentials. Never trust browser-supplied business/account IDs without validation.
- **Keep entity levels distinct:** account → campaign → ad set → ad/creative. A dashboard ad-set card uses **ad-set metrics**, even if its image depicts a representative ad. Individual ad metrics belong in the ad explorer.
- **Current delivery status is different from selected-period history.** An ad set can be paused now and have results in the last 7/30 days. Reuse the existing normalized effective-status logic; do not infer current Active status from historical spend alone.
- **Missing or failed data is not zero, healthy, or HOLD.** Avoid invented rankings, health scores, cost savings, revenue impact, or model certainty. Use evidence-backed labels and explicit unavailable/insufficient-data states.
- **Respect time, currency, and coverage.** Use advertiser/account timezone and correctly scoped Today/7D/30D windows; distinguish partial days and completed windows. Recompute ratios from aggregates. Do not sum daily reach/frequency into supposed unique multi-day values. CTR differences in percentage points must be labeled correctly.
- **A successful Meta sync is not a completed decision evaluation or a guarantee of fresh Meta attribution.** Keep sync timestamps, evaluation timestamps, and observed data freshness distinct.

## Creative previews and dashboard UX

- Favor **recognizable real creative media** over decorative placeholders. Check the entire path: Meta request → normalized creative → `ad_creatives` → media resolver → component → CSS.
- Prefer a verified higher-resolution image or video poster when available. Inspect actual dimensions, aspect ratio, expiry, and fallback ordering; do not simply upscale a tiny thumbnail or substitute an unrelated image. Never log signed image URLs with sensitive query parameters.
- Preserve a clear **Active now** versus **selected-period Highlights** distinction. The same ad set should not look like several active entities just to fill a grid.
- Keep Overview visual and concise: strong KPI/chart hierarchy, actual ad imagery, clear attention state, readable contrast, minimal repeated text. Keep Campaigns table-first unless the task explicitly changes that decision.
- Use honest states (`No change` is not automatically `Healthy`), visible loading/errors, keyboard focus, responsive touch controls, and reduced-motion support. Never present fabricated fixtures as live account data.
- For UI tasks, review **rendered desktop and mobile states** when the environment permits; component presence alone does not establish visual quality. If screenshots or browser validation were unavailable, say so.

## Meta sync and live-action safety

- For manual testing, **reuse the existing manual Meta sync path** (`/api/sync/refresh` and server sync services). A browser `router.refresh()` alone does not fetch Meta data. Keep manual refresh distinct from automatically scheduled work; do not add schedules/timers unless explicitly requested.
- Meta **read/sync** work must never implicitly authorize Meta **write/execution** work.
- Keep `DecisionProvider`, `DecisionEngine`, `PolicyEngine`, approval persistence, and the Meta executor separated. Invalid provider outputs, insufficient evidence, outdated observations, policy failures, or uncertain write results must fail closed.
- Live execution is off by default and requires its documented independent gates. Never bypass policy, entity locks, budgets, cooldowns, idempotency, approval fingerprints, before/after readback, audit, or kill switches to make a demo work.
- Never repeat an uncertain Meta write or clear a durable execution claim as a retry shortcut. Follow the operator-reconciliation documentation.
- Mocked behavior and Shadow evaluation must not invoke the live advertising executor. Use synthetic/mock inputs and explicitly isolated fixtures for tests.

## Configuration, database, and dependencies

- Use **Node.js 24**, as specified by `package.json`/`.nvmrc`.
- Store local secrets in `.env.local`; keep Jev/TypeSafe, Meta, Supabase service-role, and internal API credentials **server-side only**. Never introduce a `NEXT_PUBLIC_*` secret, check in credentials, or print them in logs/reports.
- Follow the **actual provider contract in the code and module README** (including pinned Jev model and the current `JEV_API_KEY` naming). Don't rename environment variables or provider interfaces as a drive-by cleanup.
- Schema changes require narrowly scoped reviewed migrations; do not reset or reconstruct a production Supabase database. Generated types should track the deployed schema, not overwrite it prematurely.
- Keep dependencies and lockfile stable unless the approved change needs them.

## Verification

Use the narrowest useful checks while iterating, then run the relevant available gates before declaring completion:

```bash
npm test -- <relevant-test-path>
npm run typecheck
npm test
npm run build
```

Use `npm ci` when dependencies need installing. Use targeted ESLint where applicable; `npm run lint` currently calls `next lint`, which is unavailable in Next.js 16, so report that limitation rather than unrelatedly rewriting lint infrastructure.

For changes affecting external services, use mocked Meta/Jev HTTP and isolated database fixtures first. Verify failure, missing-data, stale-state, tenant isolation, and duplicate-request cases—not only the happy path. Never claim a live integration test was run when it was not.

## Completion handoff

In the final report, briefly state:

1. What changed and why (notable file paths).
2. What behavior was verified, and the actual test/typecheck/build results.
3. Any screenshot/manual verification performed or unavailable.
4. Risks, data limitations, deployment/migration requirements, or unverified assumptions.
5. What remains, **without beginning unrelated work**.

For a plan-only task, return the proposed files, approach, acceptance criteria, and risks; **do not edit code** until the plan is approved.
