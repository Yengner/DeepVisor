# Phase 4 focused verification

Node 24; existing project `gkdyyjqepzayjdpvqnja`; Phase 1 users/media and
`20261022061347_review_evaluation_pipeline.sql` must exist. No Jev credits or Meta
credentials are used. Run with the existing server-only `.env.local`:

```sh
DEEPVISOR_FIXTURES=gkdyyjqepzayjdpvqnja node --env-file=.env.local node_modules/vitest/vitest.mjs run src/lib/server/betaPhase4.live.test.ts
```

The test creates one clearly labeled numeric-ID fixture account under Phase 1's
synthetic Business A. Its credential-free fixture integration cannot resolve a
live Meta token. It imports 60 completed days at a run-relative UTC anchor, then
uses the actual evaluation queue, Feature Engine, DecisionEngine, PolicyEngine,
approval service, execution claim/checkpoint/finalize RPCs and outcome worker.
The import is labeled as an import, not a Meta synchronization test. The fake
adapter changes only memory. A seven-day window is always $140 / 21 results;
CPR is 140/21 and the approved 5% budget change is 10000 → 9500 minor units.
Normal authenticated A/B clients verify read isolation and denied worker access.
Policy execution permission is disabled again in `finally` (or the prior policy
is restored). No autonomous mode, schedules or live execution gates are enabled.

Evidence remains in `docs/beta-readiness/phase4/flow.json`. Pending 1/6/24/72-hour
outcomes are honest: this fixture has no post-action hourly observations.
For a fresh rerun, execute `clean.sql` through the authorized development SQL/MCP
connection first. The test refuses to overwrite an existing audit chain. Cleanup
preserves users, original accounts and the business policy. No screenshots are retained.

Focused browser check (running development server on port 3011, existing external
Playwright tools): `node scripts/beta-phase4/browser.mjs`. It checks branding,
icons, login and persisted Decisions at 1440/390px without taking screenshots by
default. Local Review is enabled with the deterministic mock provider; production
requires explicit real-provider configuration, independently of execution gates.
