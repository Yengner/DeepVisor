# Phase 3 analytics verification

Use Node 24 and the existing development project `gkdyyjqepzayjdpvqnja`.
Reuse the Phase 1 fixtures and Phase 2 simulated connections. Their ignored
`.env.beta-fixtures.json` and `.env.beta-phase2.json` files contain private Auth
credentials; never attach them to evidence. No live Meta credentials are needed.

The browser scripts use Playwright from `/tmp/deepvisor-reports-tools` and the
installed macOS Google Chrome. This follows the existing Reports acceptance
harness without changing the repository dependencies or lockfile. Adjust those
local tool paths on another workstation. Install with the version used here:

```sh
npm install --prefix /tmp/deepvisor-reports-tools --no-package-lock playwright@1.64.1 esbuild @axe-core/playwright
NEXT_PUBLIC_BASE_URL=http://localhost:3011 DEEPVISOR_META_SIMULATION=gkdyyjqepzayjdpvqnja npm run dev -- --port 3011
```

In another terminal:

```sh
# Authenticated Supabase queries through the real Campaigns loaders, including RLS.
DEEPVISOR_FIXTURES=gkdyyjqepzayjdpvqnja node --env-file=.env.local node_modules/vitest/vitest.mjs run src/lib/server/betaPhase3.live.test.ts

# Dashboard/database reconciliation, hierarchical explorer APIs, both exports,
# cross-business denial, all seven Reports sections and six viewport widths.
DEEPVISOR_FIXTURES=gkdyyjqepzayjdpvqnja node --env-file=.env.local scripts/beta-phase3/browser.mjs
DEEPVISOR_FIXTURES=gkdyyjqepzayjdpvqnja node --env-file=.env.local scripts/beta-phase3/periods.mjs

# One clearly labeled historical observation; does not invoke AI or any executor.
DEEPVISOR_FIXTURES=gkdyyjqepzayjdpvqnja node --env-file=.env.local scripts/beta-phase3/findings.mjs seed
DEEPVISOR_FIXTURES=gkdyyjqepzayjdpvqnja node --env-file=.env.local scripts/beta-phase3/interactions.mjs
DEEPVISOR_FIXTURES=gkdyyjqepzayjdpvqnja node --env-file=.env.local scripts/beta-phase3/findings.mjs clean
```

Always run `findings.mjs clean` after the interactions journey, including after a
failed test. Cleanup matches its stable ID, business and source; it never deletes
other findings. Seed and cleanup are repeatable. The interaction runner uses the
existing manual sync endpoint only for the designated Phase 2 simulated business.
It makes no live advertising writes. A mocked cooldown HTTP response and aborted
media downloads exercise UI errors; actual successful sync uses the durable queue.

Evidence lives in `docs/beta-readiness/phase3/`. `expected.json` derives current
Dashboard Today/7D/30D expectations from normal authenticated persisted rows and
records the account-local observation date. Fixed October 13–19 exports remain
deterministic. The fixture dates naturally age; do not move them to today or invent
new daily coverage to make a later run green. Campaigns tables show saved lifetime
history; compare selected-period metrics through the existing exploration endpoint.
Distinct audience snapshot windows are August 21–September 19 and October 13–19.

`browser.json` is the broad authenticated run; `interactions.json` verifies the
subsequent repaired UI and saved finding. Files named `*-failure.png` are debugging
evidence, not passing screenshots. PDF exports are real generated files; rendered
page samples and extracted text are included. The independent Reports harness
uses isolated payloads and is supplementary, not proof of authentication or RLS:

```sh
REPORTS_REVIEW_TOOLS=/tmp/deepvisor-reports-tools CHROME_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node scripts/reports-review/validate.mjs
npm test -- --maxWorkers=2
npm run typecheck
npm run build
```

Do not enable the simulation environment in production. No live Meta OAuth,
expiring Meta media URL, provider permissions or live advertising action is
established by these synthetic checks.
