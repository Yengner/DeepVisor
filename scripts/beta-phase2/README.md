# Phase 2: real Auth and database, simulated Meta

Use Node.js 24 and the existing development project `gkdyyjqepzayjdpvqnja`.
No live Meta credentials are needed. `.env.local` must contain the project's URL,
anonymous key and server-only service-role key. Never copy these into reports.
Phase 1's media seed and all three Phase 2 migrations must already be applied.

The adapter replaces provider responses only. Normal OAuth state consumption,
account discovery/selection, durable jobs, worker claims, normalization, writes,
coverage, authenticated loading and browser polling still run. Shared untargeted
workers exclude simulated integrations. No schedules are installed or enabled.
Account Insights use the existing account metadata writer; no new account-daily
fact table is introduced. Dashboard KPIs use ad-set facts.

## Run

The browser harness uses Playwright with installed Google Chrome on macOS. It is
kept outside the project dependency/lockfile graph for this one-off readiness work:

```sh
npm install --prefix /tmp/deepvisor-phase2-tools playwright@1.64.1
NEXT_PUBLIC_BASE_URL=http://localhost:3011 DEEPVISOR_META_SIMULATION=gkdyyjqepzayjdpvqnja npm run dev -- --port 3011
```

The explicit simulator uses `.next/beta-phase2` so an ordinary dev server can
remain running. In another terminal, run these **sequentially**:

```sh
DEEPVISOR_META_SIMULATION=gkdyyjqepzayjdpvqnja node --env-file=.env.local scripts/beta-phase2/browser.mjs
DEEPVISOR_META_SIMULATION=gkdyyjqepzayjdpvqnja node --env-file=.env.local node_modules/vitest/vitest.mjs run src/lib/server/betaPhase2.live.test.ts
DEEPVISOR_META_SIMULATION=gkdyyjqepzayjdpvqnja node --env-file=.env.local scripts/beta-phase2/browser-reliability.mjs
```

The first command signs up two users through the actual application. It uses an
Auth Admin-generated verification link to exercise the real verification callback;
email delivery is not tested. Only the Admin API assigns the simulation designation
in `app_metadata`. Browser-supplied `user_metadata` cannot opt into simulation.
Credentials and generated IDs stay in ignored `.env.beta-phase2.json` (0600).
Reruns reuse these identities. To exercise fresh signup again, clean first.
Do not run the browser and database mutation tests concurrently.

Screenshots and sanitized evidence are written under
`docs/beta-readiness/phase2-browser/`. Login credentials, tokens and callback URLs
must not be included in committed evidence. Next's local request logs can contain
consumed verification tokens; do not publish those logs.

## Safety and scenarios

Simulation requires all of: development/test runtime, exact project opt-in,
matching Supabase URL, and a server-managed user or integration designation.
Production rejects simulation even if the flag is present. Synthetic integration
markers cannot be removed or supplied with real Vault credentials. Synthetic IDs
are rejected by the real Meta transport. The execution SDK cannot resolve a
simulated credential. Simulated sync skips external assessments and Shadow enqueue;
it does not fabricate decisions or enable advertising actions.

Supported provider scenarios: `single`, `multiple`, `none`, `permissions`,
`expired`, `connection_failure`, `rate_limit`, `timeout`, `partial`. Revision 1
changes October 19 attribution (+$4 spend, +1 lead on account 1); revision 2 also
pauses the active ad set and changes creative metadata. The live suite compares
revision 0 twice, then revision 1, and checks recoverable worker failures.

## Expected data and time

Fixed source coverage is **July 23–October 20, 2026**, USD, America/New_York.
Each account has one campaign, two ad sets, four ads and four creatives. Account 2
has twice account 1's performance. The paused ad set retains history through
October 10. October 20 contains explicit zero delivery; later dates have no rows.
Hourly coverage is limited; audience rows are coverage-labeled summaries, not
fabricated daily records. Period reach is not a sum of overlapping daily reach.

Account 1, October 13–19: **$280 spend, 28 leads, $10 CPR, 2% CTR** at revision 0;
revision 1: **$284 / 29 leads**. The browser compares its current account-local 7D
spend with actual database rows. It must show missing Today data as unavailable
after October 20. These fixtures age naturally; do not change the production clock
or represent dates beyond source coverage as observed zeros. Fixed-date loader
assertions remain deterministic. The paused-history browser assertion will need
a new reviewed fixture window after that history leaves the rolling 30D period.

## Cleanup / reseed

```sh
DEEPVISOR_META_SIMULATION=gkdyyjqepzayjdpvqnja node --env-file=.env.local scripts/beta-phase2/clean.mjs
# Repeat browser.mjs above to create fresh users and populate data via sync.
```

Cleanup checks manifest identities, server-managed designation, sole membership,
synthetic names and credential-free integrations before deleting scoped rows and
using the supported Auth Admin delete API. It refuses policy/action history and
additional members. A missing manifest is a no-op; missing users and an organization
already removed by a previous cleanup are recoverable. Stop local fixture workers
before cleanup. Phase 1 fixtures/media and other businesses are preserved.
The final Phase 2 pass retained its evidence users; this cleanup/reseed cycle was
not destructively rerun. Phase 1's separate cleanup/reseed was verified.

Live Google OAuth, live Meta OAuth/API, email transport, and hosting scheduler
configuration require separate manual validation. Passing this harness does not
verify those services or authorize production deployment.
