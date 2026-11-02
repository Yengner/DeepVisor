# Approved renaming and safe restoration

Implemented locally at `/campaigns/organize`. **Live writes remain disabled.**
No production deployment, permissions, autonomy settings or real Meta data changed.

## Workflow and files

- Existing organizer inspection, immutable baseline, templates, families and saved
  versions remain the source. `shared/organizer/renamePlan.ts` extracts only selected,
  changed names (one to five per approval); exact whitespace is preserved.
- `organizer/renaming.ts` handles preview, approve, execute, history, reconciliation
  and restoration through the existing authenticated server-actions pattern in
  `app/(root)/campaigns/organize/actions.ts`. No parallel REST or decision pipeline.
- `RenamePanel.tsx` displays exact before/after names, explicit confirmation,
  separate execution, individual readbacks, immutable events and restoration drafts.
- `advertising/organizer/provider.ts` reuses business/account authorization and
  existing integration/Vault token access. Owners/admins alone approve and execute;
  original approver membership is checked again before writes.
- `advertising/organizer/adapter.ts` exposes only GET and name-only POST, pinned to
  existing Graph v24.0. Account, parent, entity type, creative association, current
  name and update timestamp must match. No retries, redirects or raw provider errors.
- `advertising/organizer/execute.ts` persists intent before each write, checks fresh
  state, verifies readback, and records each result independently. Uncertain results
  retain the business lock. A completed request is not necessarily a successful run.

## Persistence and approval controls

Applied on development project `gkdyyjqepzayjdpvqnja`:

- `20261031152423_organizer_renaming.sql`: previews, approvals, runs, events,
  isolated simulation state; restoration lineage on existing proposal versions;
  service-only `organizer_assert_owner`, `organizer_approve`, `organizer_claim`.
- `20261031154143_organizer_immutable_preview_approval.sql`: approval reads immutable
  previews without an UPDATE lock; the unique version constraint arbitrates races.

Previews/approvals/events are immutable, authenticated users have business-scoped
SELECT only, and simulation state is service-only. Business/account/version foreign
keys prevent mixed ownership. Audit records intentionally prevent cascading business
or advertising-account deletion; a future explicit retention/purge policy must address
these records rather than silently discarding them. No delete path is added here.

Exact changes, source version, business/account, fresh observations, provider mode,
expiry and contract version are fingerprinted. Approval expires after 15 minutes.
A version can be approved once. Claim creation is transactional and duplicate
submissions return the original run without replaying it. The durable business lock
also excludes existing Review/Limited Auto execution claims in both directions.

Executions have a three-minute deadline, checked immediately before live POSTs;
individual HTTP requests time out after ten seconds. Interrupted runs do not resume
writes. After the deadline plus 30 seconds, explicit read-only reconciliation records
unattempted entities or observed target names. Ambiguous results stay locked. Never
clear a claim or retry an uncertain POST manually. Reconciliation can read with the
write kill switches off, after current owner/account/connection authorization.

Restoration requires an inactive run and verified prior results. Current state must
match that exact verified readback; external edits, missing/moved entities and altered
creative associations block the proposal. It creates a new, unselected saved version
with lineage, requiring selection, save, fresh preview, approval and separate execution.
It reverses only supported names, never deleted entities or unrelated changes.
History displays the latest 100 previews; all underlying events are paginated and
retained. Browsing older preview headers is a future UI extension.

## Local demonstration

Use existing `.env.local` and `.env.beta-fixtures.json` (never commit credentials).
Node.js 24, no live execution flags:

```bash
NEXT_PUBLIC_BASE_URL=http://localhost:3013 \
DEEPVISOR_META_SIMULATION=gkdyyjqepzayjdpvqnja \
DEEPVISOR_ORGANIZER_SIMULATION=gkdyyjqepzayjdpvqnja \
npm run dev -- --port 3013
```

Sign in with synthetic business A and select its salon or Phase 4 fixture account.
Open `/campaigns/organize`, inspect, select/edit up to five names, save, review the
exact changes, confirm, approve, then execute the **SIMULATED** run. Open history and
preview restoration; select names and repeat approval. Simulation is restricted to
development/test, this project and two hardcoded synthetic accounts. It changes only
`organization_rename_simulation`; native advertising rows and Meta remain untouched.

Checks:

```bash
npm test -- src/lib/server/advertising src/lib/server/organizer src/lib/shared/organizer
DEEPVISOR_ORGANIZER_TEST=gkdyyjqepzayjdpvqnja \
DEEPVISOR_ORGANIZER_SIMULATION=gkdyyjqepzayjdpvqnja \
node --env-file=.env.local node_modules/vitest/vitest.mjs run src/lib/server/organizer/renaming.live.test.ts
node --env-file=.env.local scripts/organizer/renaming-browser.mjs
```

The browser script uses the existing temporary Playwright installation and Chrome,
port 3013, real synthetic authentication and persistence. It restores the previous
synthetic primary account in `finally`. `--restore-only` can finish a prior verified
synthetic rename, reconciling an interrupted run first after its deadline. Audit
history remains. Screenshots: `/tmp/deepvisor-organizer-renaming/`.

## Before real-account enablement

Separate deployment and real-write authorization are required. Validate real token
`ads_management` permission, assigned account access and read contracts for each
entity type; only mocked Meta transport and persisted synthetic execution have been
verified. Confirm the host supports the execution window.

Keep all these server-only gates off until approval:
`DEEPVISOR_META_EXECUTION_ENABLED`, `DEEPVISOR_META_EXECUTION_BUSINESSES`,
`DEEPVISOR_ORGANIZER_RENAMES_ENABLED`, `DEEPVISOR_ORGANIZER_BUSINESSES`, and
`DEEPVISOR_ORGANIZER_EXCLUSIVE_WRITER`. The latter attests an operationally enforced
exclusive editing window. Meta has no atomic compare-and-set for these updates;
external edits between GET and POST remain a residual risk. Do not enable writes
without that coordination and a separately authorized controlled rename/restoration
smoke test. Limited Auto stays disabled.
