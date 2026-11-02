# Account organizer

Open `/campaigns/organize` through Campaigns → Organize Account. Select a Meta
account first. Explicit `organizer-v1` consent precedes inspection. Inspection reads synchronized Supabase data only; approval and execution are separate
owner/admin operations with independent gates. Every server
action reauthorizes business and selected-account scope.

Applied `20261031034606_account_organizer.sql` to development project
`gkdyyjqepzayjdpvqnja`. RLS permits normal members to read their business history;
browser DML is denied. Service-only append operations preserve the first baseline
and every proposal's own source snapshot. Update triggers reject history rewriting.
Unique baseline/version constraints arbitrate concurrent requests. Business/account
deletion cascades remain the retention boundary. This is not executable approval.
Public schema types were regenerated; existing ai/intelligence nullable RPC contracts
were preserved. No advertising permissions, production deployment or schedules changed.

Reinspection creates a new version without replacing the baseline. Saving compares
current synchronized names, IDs, hierarchy and creative associations with the
selected source version. Changed evidence blocks saving and requests reinspection.
Active sync jobs or a sync completion during capture block inspection. These checks
are not an atomic Meta read: The Phase 2 executor revalidates directly before every name write.
Sources older than 24 hours or lacking sync timestamps show a stale warning. Saving
an unchanged stale source is permitted only as a read-only draft, never approval.

Naming uses deterministic known metadata and user-confirmed fields. Dates are never
inferred from creation or delivery coverage; manual date inputs require valid ISO
calendar dates. Shared creative IDs suggest reuse, never prove shared concepts.
Semantic AI inference is not implemented. No provider activity or confidence is
fabricated. Creative URLs can expire; native IDs remain authoritative.

Tree editors mount lazily. Reads are paginated; accounts reaching 5,000 entities are
explicitly rejected rather than partially captured. History lists the latest 100
version headers and loads only the chosen version body. Earlier history remains
stored, but browsing beyond 100 headers is not yet exposed in the UI.

## Repeatable checks

- `npm test -- src/lib/shared/organizer src/lib/server/organizer`
- `DEEPVISOR_ORGANIZER_TEST=gkdyyjqepzayjdpvqnja node --env-file=.env.local node_modules/vitest/vitest.mjs run src/lib/server/organizer/organizer.live.test.ts`
- With the local app on port 3000 and the existing temporary Playwright install:
  `node --env-file=.env.local scripts/organizer/browser.mjs`

Live test requires `.env.beta-fixtures.json`, targets only the synthetic Phase 4
account, saves auditable history, and temporarily changes/restores one synthetic
source name to prove stale rejection. Normal A/B clients verify isolation and
mutation denial. Browser test temporarily selects the synthetic salon account,
restores the previous synthetic primary selection in finally, and tests consent,
inspection, naming, families, saving/reload, and 1440/390 layouts. No Meta calls.
Screenshots are outside the repository at `/tmp/deepvisor-organizer/`.

Implemented approval/execution/restoration, safeguards, commands and enablement requirements:
[PHASE2.md](./PHASE2.md). All live writes remain disabled; the synthetic provider is separately gated.
