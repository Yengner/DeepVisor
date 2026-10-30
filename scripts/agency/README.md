# Preview the Meta Agency

Use Node 24, existing `.env.local`, existing Phase 1 synthetic users, and the same
development project `gkdyyjqepzayjdpvqnja`. No Jev credits or live Meta credentials.

```sh
npm run dev
# Sign in normally, then open http://localhost:3000/agency
```

The shared desktop/mobile navigation includes **AI Agency**. Goals and account
selection use existing settings and connection controls. Owners/admins review
eligible proposals inline using the existing Decisions action. Approval does not
execute an ad change. Missing/expired evidence remains explicit.

Development-only `/agency?preview=decisions` is a separate, fully labeled fictional
story using existing previews. Review buttons are disabled. It does not mix sample
decisions with customer metrics, persist anything or bypass authentication; the
parameter has no effect in production.

## Persisted salon demo (already generated during this implementation)

Business A is the existing `[SYNTHETIC] Aurora Salon & Aesthetics`. Account
`eeee4445-0000-4000-8000-000000000001` is the new isolated Agency fixture. Existing
Phase 4 evidence at `eeee4444…` is preserved. The generated fixture retains the
existing `[SYNTHETIC PHASE 4]` name because it reuses that fixture factory.

```sh
DEEPVISOR_FIXTURES=gkdyyjqepzayjdpvqnja node --env-file=.env.local scripts/agency/demo.mjs prepare
DEEPVISOR_FIXTURES=gkdyyjqepzayjdpvqnja DEEPVISOR_AGENCY_DEMO=1 node --env-file=.env.local node_modules/vitest/vitest.mjs run src/lib/server/betaPhase4.live.test.ts
DEEPVISOR_FIXTURES=gkdyyjqepzayjdpvqnja node --env-file=.env.local scripts/agency/demo.mjs select
```

`prepare` saves a local ignored backup and sets synthetic salon goals/ranges.
`select` selects only the credential-free fixture account. Sign in using the
existing local `.env.beta-fixtures.json` user A credentials (never commit them).
Refresh Agency if it was already open. The fixture exercises real snapshots,
Shadow/Review jobs, deterministic provider, policy, owner approval, in-memory Meta
execution and audit/outcome persistence. It restores the previous synthetic
business policy in `finally`; it never changes a real Meta account. Outcomes are
pending, not fabricated improvements. The fixture is a labeled data import, so
`last_synced` is intentionally absent rather than claiming a real Meta sync.

Seven completed days: $140 / 21 results, CPR $6.6667. Agency's seven-day window
includes today; on generation day it contains six observations: $120 / 18 results,
CTR 5%. Time-relative fixtures become stale honestly. Approval has already been
recorded by the end-to-end test; the preview shows the review interaction without
executing it. Existing real pending proposals remain reviewable through Agency.

Reruns refuse to overwrite an audit chain. To regenerate, first run
`scripts/agency/clean.sql` against the development project; it guards and removes
only this Agency fixture account/audit chain, then repeat the commands. To restore
the original synthetic profile and selection:

```sh
DEEPVISOR_FIXTURES=gkdyyjqepzayjdpvqnja node --env-file=.env.local scripts/agency/demo.mjs restore
```

## Browser check

Uses the existing external Playwright installation at `/tmp/deepvisor-auto-tools`
and macOS Chrome; no dependency changes. Requires the persisted demo and local dev
server. It signs in as A/B normally, checks auth protection, saved simulated history,
metrics, forged account selection rejection, disabled preview controls, and
1440/390 light/dark layouts. It does not submit approvals or call Meta.

```sh
node scripts/agency/browser.mjs
# Optional temporary screenshots:
DEEPVISOR_CAPTURE=1 node scripts/agency/browser.mjs
```

Screenshots go to `/tmp/deepvisor-agency`, not the repository. Run on generation day
for exact current-window assertions, or regenerate the time-relative fixtures.
