# DeepVisor

DeepVisor is a Meta-first advertising intelligence and decision product. It connects
an ad account, preserves history, explains observed performance, and presents
reviewable decisions. Primary surfaces are Overview, AI Agency, Decisions,
Campaigns, Connections and Settings. Reports, Calendar and campaign draft workflows
remain available through existing navigation or compatibility routes.

The core architecture is **Meta data → versioned features → provider-neutral
decisions → deterministic policy → separately authorized actions → measured
outcomes**. Approval does not execute an ad change. Missing evidence, HOLD and
insufficient-data results remain explicit states.

## Start here

- [Documentation index](docs/INDEX.md): handbook structure and maintenance.

- [Architecture](docs/ARCHITECTURE.md): responsibilities, data models and security boundaries.
- [Codebase map](docs/CODEBASE_MAP.md): directory ownership, entry points and compatibility code.
- [Workflow traces](docs/FLOWS.md): connection/sync, intelligence, decisions, execution, organizer and Agency.
- [Development guide](docs/DEVELOPMENT_GUIDE.md): setup, conventions, tests and migrations.
- [Architecture audit](docs/ARCHITECTURE_AUDIT.md): improvements, retained debt and verification scope.
- [AGENTS.md](AGENTS.md): shared operational instructions and agent roles; [CLAUDE.md](CLAUDE.md) (lead engineer) and the [Codex release-review skill](.agents/skills/deepvisor-release-review/SKILL.md) (review, docs, Jira).

The handbook provides navigation; module READMEs linked from it own detailed
provider, execution and reconciliation contracts. Historical deployment notes do
not establish current enablement.

## Local development

Stack: Next.js App Router, React, TypeScript, Mantine, Supabase, Meta and optional
inference adapters. Use Node.js **24** and the existing lockfile:

```sh
nvm install
nvm use
npm ci
npm run dev
```

Obtain approved development credentials for ignored `.env.local`; see the
[setup guide](docs/DEVELOPMENT_GUIDE.md#setup-and-safe-defaults). Default tests use
mocks and isolated in-memory database fixtures and require no live credentials.

```sh
npm run typecheck
npm test
npm run lint
npm run test:architecture
npm run check:architecture
npm run build
```

CI runs these gates without deployment credentials. ESLint uses the installed flat
Next/TypeScript configuration. A file/rule/count baseline retains existing lint
errors; `npm run lint:strict` exposes that debt. See the guide before running
remote fixture/browser scripts or `npm run types:supabase`.

Live advertising writes and Limited Auto remain independently gated and off by
default. This repository's presence does not imply a deployed worker or active
schedule. Do not enable execution, run operator SQL, or deploy as a setup shortcut.

## Development previews

While signed in locally, `/dashboard?preview=decisions` and
`/decisions?preview=decisions` show explicitly fictional decision presentation.
Review controls are disabled; no approval, persistence or execution occurs. Normal
Dashboard account/performance requirements still apply. Production ignores this
parameter. See [development and compatibility surfaces](docs/CODEBASE_MAP.md#active-compatibility-and-development-surfaces).
