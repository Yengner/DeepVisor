# DeepVisor

DeepVisor is an ad account intelligence system for ecommerce brands and lead-service businesses.

It connects to an ad account, preserves useful history, explains what is working and what is not, and turns recommendations into reviewable work across a dashboard, calendar, reports, and campaign views.

DeepVisor is not meant to be another analytics wall. The product direction is simple: help operators and owners understand performance quickly, decide what to do next, and keep that work organized in one place.

## What DeepVisor Does

- `Dashboard`: a daily account read with spend, outcomes, strongest campaigns, weak spots, and the next thing to review
- `Calendar`: queued work that can be approved, modified, scheduled, or ignored
- `Reports`: owner-ready summaries of what changed, what worked, what failed, and what should happen next
- `Campaigns`: a fuller table view for scanning campaign health without losing context
- `Integrations`: connect platforms, choose the primary account, and control sync state

## Who It Is For

- ecommerce businesses that want a clearer view of revenue-driving campaigns, creatives, and trends
- lead-service businesses such as dental, roofing, tiling, home services, and other consult or quote-driven operators
- founder-led or lean marketing teams that need one operating surface instead of jumping between ad platforms, spreadsheets, and reports

## Current Product Scope

- Meta is the primary live integration today
- one primary ad account is selected per connected platform
- the first sync is recent-first, then full history is backfilled in the background
- recommendations are explainable and review-first
- the product is being shaped around ecommerce and lead-service operators rather than agencies

## Stack

- `Next.js` + `React` + `TypeScript`
- `Supabase` for auth, database, and server-side data access
- `Mantine` and shared marketing/UI primitives for the product and public site
- internal sync, repository, and assessment layers under `src/lib/server`

## Local Development

Node.js 24 is required. With nvm, use the checked-in `.nvmrc`:

```bash
nvm install
nvm use
npm ci
npm run dev
```

Useful scripts:

- `npm run build`: production build check
- `npm run types:supabase`: regenerate typed Supabase schema bindings

## Tests And CI

Use Node.js 24 (the CI version) and install dependencies with `npm ci`.

```bash
npm test             # Run all unit tests once
npm run test:watch   # Re-run affected tests while editing
npm run typecheck    # Generate Next.js route types and check TypeScript
npm run build       # Check the production build
```

Unit tests use [Vitest](https://vitest.dev/guide/) in a Node environment. Place
tests beside the code as `*.test.ts` under `src`; the existing `@/` import alias
works in tests. The initial tests cover currency formatting and recurring calendar
items without network access, credentials, or application logic changes. Browser
and E2E tests are not part of this baseline.

GitHub Actions runs installation, type checking, unit tests, and the production
build on pushes and pull requests in a single job. It caches npm downloads and
cancels superseded runs. Build-only Supabase and Stripe placeholders are defined
in `.github/workflows/ci.yml`; no repository secrets or live services are needed.
The resulting CI build is for validation, not deployment.

The existing `npm run lint` script uses `next lint`, which is unavailable in
Next.js 16. Lint migration and existing application lint errors are not included
in this test baseline or the CI gate.

## Repo Pointers

- Root marketing and app routes: [src/app]()
- Meta integration and sync flow: [src/lib/server/integrations/README.md](https://github.com/Yengner/DeepVisor/blob/main/src/lib/server/integrations/README.md)
- Sync orchestration: [src/lib/server/sync]()
- Assessments and account intelligence: [src/lib/server/intelligence]()

## Product Direction

DeepVisor should become the place where an operator can answer:

- What changed in the account?
- Which campaigns or ad sets are strongest right now?
- What needs attention?
- What should be approved or queued next?

The long-term goal is durable account memory, better recommendations over time, and a cleaner operating workflow for businesses that rely on paid acquisition.
