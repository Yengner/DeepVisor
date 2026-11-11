# Development guide

## Setup and safe defaults

Use Node.js **24** (`.nvmrc`, `package.json`, CI) and the checked-in npm lockfile:

```sh
nvm install
nvm use
npm ci
npm run dev
```

Obtain approved development configuration from the project owner and place it in
ignored `.env.local`. Never copy production credentials into tests or output them.
The application uses `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_ANON_KEY` for session access, `SUPABASE_SERVICE_ROLE_KEY` only
on the server, and `NEXT_PUBLIC_BASE_URL` for relevant local callback flows.
Meta OAuth configuration is owned by
[`integrations/adapters/meta.ts`](../src/lib/server/integrations/adapters/meta.ts).
`INTERNAL_API_KEY` authenticates app worker routes; Edge forwarding additionally
uses `CRON_SECRET` and `APP_BASE_URL`. Consult those adapters/runbooks for the
specific workflow rather than enabling every integration during setup.

Ask DeepVisor setup, private persistence, usage limits and draft-only capabilities are documented in
[the assistant guide](../src/lib/server/intelligence/assistant/README.md).

Optional provider configuration belongs to its adapter: [Jev contract and variables](../src/lib/server/decisions/README.md),
[`openai/config.ts`](../src/lib/server/openai/config.ts) and
[`openai/structured.ts`](../src/lib/server/openai/structured.ts). `JEV_API_KEY`
remains server-only; the default pinned Jev model is `jev-1.13.0`. Keep all execution,
Limited Auto and organizer-write flags unset during ordinary development. Starting
the app must not be treated as authorization to run fixture scripts or activate cron.

The migrations are incremental and assume existing database objects. Do not run
`supabase db reset` expecting this repository to reconstruct a complete environment.
Pure tests need neither a remote DB nor Docker. CI uses build-only placeholders in
[its workflow](../.github/workflows/ci.yml); those are not usable application accounts.

## Validation workflow

```sh
npm test -- src/lib/server/features       # Narrow behavior checks while editing
npm run test:architecture                 # Checker regression tests (Node test runner)
npm run check:architecture                # Imports, domain boundaries, runtime cycles
npm run typecheck                         # next typegen, then tsc --noEmit
npm test                                 # Vitest unit/mocked integration/PGlite suites
npm run lint                             # ESLint, existing-debt baseline applied
npm run build                            # Production bundle and route generation
```

CI runs all these gates except the illustrative narrow test command. A CI build
validates code; it does not deploy. Next build does not replace ESLint. The
[flat config](../eslint.config.mjs) uses the installed Next and TypeScript rules
through the ESLint CLI, as required after [Next 16 removed `next lint`](https://nextjs.org/docs/app/api-reference/config/eslint).
No package upgrade was needed.

`npm run lint:fix` applies supported fixes. `npm run lint:strict` uses an empty
suppression file and exposes all remaining errors. Normal lint retains **94
pre-existing errors** in [`eslint-suppressions.json`](../eslint-suppressions.json),
scoped by file/rule/count; warnings remain visible. Existing inline disables also
remain. The baseline makes new-file/new-rule/increased-count errors fail CI, but
cannot distinguish replacement errors within an unchanged file/rule count. Review
changed code and run strict targeted lint when improving a baselined module:

```sh
npx eslint src/lib/shared/performance --suppressions-location scripts/architecture/empty-eslint-suppressions.json
```

Do not run `--suppress-all` to approve new errors. After fixing existing debt,
`npx eslint src --prune-suppressions` removes stale entries. The scope of `npm run
lint` is `src`; archive and generated schema bindings are ignored. App typecheck
also has explicit compatibility exclusions in `tsconfig.json`. Deno Edge functions
are outside those two gates and need their own runtime validation when changed.

### Tests without customer writes

- Colocate `*.test.ts` under `src`; Vitest uses Node and the `@/` alias. The current
  include pattern does not discover `*.test.tsx`. Use `npm run test:watch` locally.
- Mock HTTP at the transport boundary for Meta/Jev tests. Inject providers/adapters,
  clocks and clients using existing seams; don't bypass authorization to make tests pass.
- PGlite suites apply actual migrations against minimal test prerequisite schemas.
  Cover business isolation, missing/stale evidence, conflicts and duplicate claims.
- `*.live.test.ts` suites are opt-in and may mutate isolated remote fixtures. Read
  [`scripts/beta-fixtures/README.md`](../scripts/beta-fixtures/README.md) and the
  applicable module's runbook before enabling one. Default `npm test` must remain
  credential-free; never use a real customer's account as a fixture.
- Browser scripts under `scripts` may change synthetic selection/history. Review
  guards and restoration behavior first. UI work requires desktop/mobile rendered
  review when available; report missing browser coverage honestly.

## Coding and placement conventions

1. Read `AGENTS.md`, check `git status`, inspect neighboring code/tests and the
   relevant module README. Reuse an existing route, repository, resolver or worker.
2. Keep features cohesive. Pages/actions validate and authorize, services orchestrate,
   repositories persist, adapters call external services, pure modules calculate.
   A directory name is not sufficient proof of purity; inspect imports.
3. Use PascalCase for React components and classes, camelCase for functions/local
   variables and ordinary TS filenames, and descriptive names such as `load.ts`,
   `service.ts`, `repository.ts`, `types.ts` where the feature folder supplies context.
   Keep Next's reserved filenames and existing SQL snake_case unchanged. Don't rename
   whole directories just to normalize historical style.
4. Put `import 'server-only'` on credential/I/O infrastructure. `'use server'`
   designates an action boundary, not arbitrary internal code. Every exported action
   must reauthorize its input; client-importability is not proof of safety.
5. Domain DTOs describe business inputs/results; generated `Database` types describe
   storage. Map deliberately. Use `import type` for erased contracts and direct module
   imports to avoid barrel cycles. Retain old exports when moving an internal contract
   with compatibility callers; document its canonical owner.
6. Validate unknown input at the application boundary using existing Zod/manual
   validation contracts. Preserve existing API envelope/status semantics. New APIs
   should have explicit request/response types, bounded limits and scope checks.
7. Accept an authorized client and explicit business/account scope in repositories.
   For pagination use [`repositories/pagination.ts`](../src/lib/server/repositories/pagination.ts)
   with stable ordering and complete filters on **every** page. `allPages` rejects
   null data; `readAllPages` preserves legacy null-as-empty semantics. Don't silently
   switch contracts while refactoring.
8. Throw/return stable domain error codes and map them at the route boundary. Preserve
   Next redirect/not-found control flow (use `unstable_rethrow` where existing handlers
   require it). Log structured operation IDs and sanitized codes; never raw tokens,
   signed media URLs or untrusted provider bodies.
9. Keep date/currency/coverage and entity-level semantics explicit. A generic metric
   helper's zero defaults do not override Feature Engine's unknown-data checks.
   Changing a feature meaning requires version review, not a silent helper edit.
10. Keep dependencies/lockfile stable unless needed by the task. No broad miscellaneous
    utilities, new repository facades, speculative framework or tiny one-use abstractions.

### Architectural checks

[`scripts/architecture/check.mjs`](../scripts/architecture/check.mjs) uses the installed
TypeScript parser to inspect literal imports/re-exports/dynamic imports/requires.
It rejects new runtime shared→server, server→presentation, and direct
Client Component→server imports (except explicit server actions), feature imports
outside Features/shared, and runtime cycles. Type-only imports are excluded from
runtime edges. Feature type dependencies are also checked.

Two exact exceptions are recorded in [the baseline](../scripts/architecture/baseline.json)
and explained in [the audit](ARCHITECTURE_AUDIT.md). Both new violations and resolved
but unremoved baseline entries fail. `--inventory` prints findings for review; it
does not rewrite the baseline. This is not a complete bundler/security analysis:
computed imports, package internals, type-only cycles, transitive client reachability
and Edge functions require review/Next build. Do not mistake passing it for full
tenant or secret-safety verification.

### Status colors

Status color carries meaning; pick it from what the evidence says, not from how
the card should feel. Tokens live in [`src/globals.css`](../src/globals.css) as
`--dv-*` custom properties, with light values on `:root` and dark overrides on
`:root[data-mantine-color-scheme='dark']`. (Don't use `light-dark()` on `:root`:
`postcss-preset-mantine` can't rewrite it there. It works in CSS modules.)

| Meaning | Use for | Tokens (light) |
| --- | --- | --- |
| **Navy: expected / finished** | Scheduled end reached, paused, activated, other lifecycle updates | `--dv-status-navy` `#243556` band, `--dv-status-navy-text` white |
| **Red: needs action** | Rejected ads, expired connection, account restriction | `--dv-urgent` `#B42318`, `--dv-urgent-border` `#F1B5AE`, `--dv-urgent-soft`, `--dv-urgent-shadow` |
| **Amber: real data gap only** | Missing hours/days, unknown currency, unavailable metrics or creative | `--dv-gap-bg` `#FFF8E1`, `--dv-gap-border` `#EBCB7A`, `--dv-gap-text` `#7A4B00`, dashed empty strip |
| **Primary action** | The single primary button of a surface (e.g. *Got it*) | `--dv-action` `#3A67DB`, white text, `--dv-action-radius` 10px, `--dv-action-min-height` 44px |
| **Neutral card** | Card container and inner panels | `--dv-card-radius` 16px, `--dv-card-border` `#C3CBD9`, `--dv-card-panel` white, `--dv-card-inset` |

Token sources, in order of authority: `--dv-*` in `src/globals.css` is the single
source of color, radius and action values. `DesignSurface`'s `--ui-*` variables alias
`--dv-*` for light mode (dark values remain local to that surface). The Mantine theme in
`src/theme.ts` mirrors the brand tuple for Mantine components. Add new values to
`--dv-*` first; don't introduce new hex values in component CSS.

Type and radius scales are tokens too: `--dv-text-2xs` (11px, the floor for chart axes
and labels), `--dv-text-xs` (12px, the floor for body text), `--dv-text-sm/md/lg/xl`, and
`--dv-radius-sm` (6px), `--dv-radius-md` (10px), `--dv-radius-lg` (16px), `--dv-radius-pill`.
Use weights 500/700/800 only. Primary buttons use `.app-platform-page-action-primary`
(the `--dv-action` color); Mantine's default filled `Button` still uses the brand tuple
in `src/theme.ts`.

Page-level status (sync progress, refresh failures, unavailable updates) uses
`src/components/ui/states/StatusBanner.tsx` with the same tones: `info` (navy/neutral,
expected), `gap` (amber), `action` (red, not dismissible). Banners render in the layout's
`.app-status-region`, above page content.

Rules: never use amber for an expected state (an ad reaching its scheduled end is
navy, not a warning). Red is reserved for something the owner must act on, and its
primary button stays red. Status bands use 12px/800 uppercase text with 0.12em
letter spacing and an icon (`Flag` for ended, `AlertTriangle` for urgent). All text
pairs meet 4.5:1 (white on navy ≈ 12:1, white on red ≈ 6.6:1, white on primary ≈ 5:1,
amber text on amber background ≈ 7:1). Typography is Manrope (the `--font-body`
variable font; use weights 500/700/800).

## Extending the product

For a new feature, start from the [map](CODEBASE_MAP.md), add pure rules/contracts
in its domain, reuse authorized loaders/repositories, then wire a thin route/action
and presentation. Add regression coverage for unavailable data and tenant boundaries.
Document the workflow entry point and any new configuration. Read-only Agency work
should compose existing facts and decision surfaces; it must not call an executor.

For a new platform, implement discovery/OAuth/token handling under `integrations`,
its read/normalization adapter under `sync/<platform>`, and feed existing scoped
persistence. Update supported-platform contracts and orchestration explicitly.
Feature V1 is Meta-adset-specific; do not relabel unsupported facts as Meta or imply
provider neutrality makes ingestion universal. A write adapter is a separate,
explicitly authorized task behind `AdvertisingPlatformAdapter`, policy and execution
claims. Preserve external/internal IDs, timezone/currency and coverage contracts.

## Database changes and handoff

Inspect the linked project and remote schema/history before a necessary migration.
Use the Supabase CLI's supported migration workflow; review SQL, RLS/grants, tenant
foreign keys, immutable records and service-only RPC access. Test actual SQL with
PGlite where possible, then apply only to the authorized development target. Never
rewrite applied history or derive a production schema from test fixtures.

After schema deployment, `npm run types:supabase` regenerates bindings from the linked
project for all three schemas. Review the diff and any
[`decisionPersistence.ts`](../src/lib/shared/types/decisionPersistence.ts) compatibility
overlay before removing it. Do not generate from synthetic fixtures. Production
migrations/configuration, deployments, commits and advertising writes require
explicit authorization.

Handoff should name changed behavior/files, test/typecheck/lint/build results,
browser coverage, remaining risks and any deployment/migration need. Stop at the
authorized task boundary; record larger refactors as follow-ups.
