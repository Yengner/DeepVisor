# Final beta verification

Requires Node 24, the existing development project `gkdyyjqepzayjdpvqnja`, local
server credentials in `.env.local`, the Phase 4/5 migrations, and the existing
Playwright installation at `/tmp/deepvisor-phase2-tools` with Chrome on macOS.
No dependencies were added to the application.

Start the explicitly isolated simulator:

```sh
NEXT_PUBLIC_BASE_URL=http://localhost:3011 DEEPVISOR_META_SIMULATION=gkdyyjqepzayjdpvqnja npm run dev -- --port 3011
```

For a **new** journey, run:

```sh
DEEPVISOR_META_SIMULATION=gkdyyjqepzayjdpvqnja node --env-file=.env.local scripts/beta-phase5/browser.mjs
```

The ignored `.env.beta-phase5.json` contains random credentials and stable IDs for
that run. Signup uses the real UI. Verification consumes an official Auth-admin
generated token; inbox delivery is not tested. Meta responses and the decision
provider are deterministic, with the advertiser-local date recorded in server-owned
app metadata. The current fixture clock supports dates in 2026. External Meta/Jev
requests and live advertising writes are not needed.

The real sync worker persists the observations, then the opt-in live test uses the
actual feature/evaluation queue, policy, browser approvals, execution RPCs and
outcome persistence. The executor adapter changes memory only. Seven completed
days on account 1 are $280 / 28 results / $10 CPR; today's measured delivery is zero.
The fake budget change is 5000 → 4750 minor units, executed once. Outcome horizons
remain pending without sufficient post-action observations.

The harness resumes a partially completed signup, but refuses to replay an existing
execution audit. Keep the current private manifest and database audit as evidence.
For another independent run, archive the manifest under a new ignored `.env.*`
name without overwriting an existing file, then run again. This creates a new
isolated synthetic user/business; it does not reset the project or erase audits.
The Phase 1 fixture cleanup/reseed commands remain unchanged. Phase 2's cleanup
deliberately refuses businesses with decision history and must not be used here.

To recheck the current persisted workspace without repeating execution:

```sh
DEEPVISOR_META_SIMULATION=gkdyyjqepzayjdpvqnja node --env-file=.env.local scripts/beta-phase5/checks.mjs
```

This checks streamed KPIs against the expected account-2 totals, header consistency,
desktop/mobile asset loading, individual ads, creative previews, forbidden PDF
scope, and real OAuth URL construction without following the redirect. It briefly
removes and restores the synthetic designation to exercise OAuth initiation.
No screenshots are created. Stop the dev server before final type generation/build
to avoid concurrent writes to generated development route types.

Evidence: `docs/beta-readiness/phase5/`. The initial signup/onboarding and the final
journey ran on the same fresh identity, resumed after fixes. The final assessment
and remaining release prerequisites are in `docs/beta-readiness/STATUS.md`.
