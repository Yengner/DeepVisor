# System relationships

> November 2026 cleanup: sync no longer runs the older assessment, signal or trend
> engines, and the calendar, Organizer, billing and legacy dashboard code were removed.
> Parts of this diagram, and `system-overview.drawio`, predate that. [Flows](FLOWS.md) is current.

Purpose: locate runtime boundaries before following a workflow or changing a contract.
The [editable draw.io overview](system-overview.drawio) contains **System context**
and **Runtime containers** pages. The runtime page follows the Mermaid below; the
context page is a curated native-shape overview. Edit those sources together.
[Database relationships](DATABASE_RELATIONSHIPS.md) distinguish enforced references;
[Flows](FLOWS.md) traces synchronization and intelligence.

```mermaid
---
config:
  layout: elk
---
flowchart TB
  User[Owner or organization member] --> Browser[React browser UI]
  Browser -->|session cookies| App[Next.js Server Components, routes and actions]
  Browser -->|session client| Auth[Supabase Auth and RLS Data API]
  App -->|validated business and selected account| Services[Server workflows and repositories]
  App --> Auth
  Services -->|scoped persistence| DB[(PostgreSQL: public, ai, intelligence)]
  Cron[Hosted pg_cron] -->|HTTP with Vault credential| Edge[Supabase Edge forwarders]
  Edge -->|internal credential| App
  Services -->|reads and separately gated writes| Meta[Meta Graph API and Insights]
  Services -->|inference| Models[Jev and OpenAI]
  Services --> Storage[Supabase Storage: report artifacts]
  Meta -.->|signed status triggers| App
  DB -.->|private Realtime hint| Browser
  classDef app fill:#eef4ff,stroke:#9db8f2,color:#1b1f24
  classDef data fill:#f3eeff,stroke:#b9a6f0,color:#1b1f24
  class App,Browser,Services app
  class Auth,DB,Storage data
```

Arrows are calls/data dependencies, not foreign keys or proof of deployment.
Next.js owns the worker implementation; Edge functions forward to authenticated
Next.js routes. There is no separate continuously running worker container in this
source. Browser refresh reloads saved data; the sync API initiates Meta reads.

| Boundary / source of truth | Implementation and consistency concern |
| --- | --- |
| Identity: Supabase Auth; tenant role: PostgreSQL membership | [Context](../src/lib/server/actions/app/context.ts), [selection](../src/lib/server/actions/app/selection.ts), [proxy](../src/proxy.ts). Proxy excludes APIs; handlers authorize independently. |
| Delivery and attribution: Meta; app observations: PostgreSQL | [Fetch](../src/lib/server/sync/meta/fetch.ts), [worker](../src/lib/server/sync/meta/processBackfillJobs.ts). Saved observations can lag current delivery and revised attribution. |
| Application authorization versus RLS | [Session client](../src/lib/server/supabase/server.ts), [admin client](../src/lib/server/supabase/admin.ts). Service-role access bypasses RLS; callers/RPCs must preserve tenant scope. |
| Durable queue versus response lifecycle | [Dispatch](../src/lib/server/sync/dispatch.ts), [Edge forwarder](../supabase/functions/_shared/processAccountSyncJobs.ts). `after()` work can be interrupted; claims/recovery live in PostgreSQL. |
| Inference versus authority to act | [DecisionEngine](../src/lib/server/decisions/DecisionEngine.ts), [review](../src/lib/server/decisions/review/service.ts), [executor](../src/lib/server/advertising/ReviewExecutor.ts). Provider output and approval cannot directly write to Meta. |

## Verification ledger — 2026-11-13

Source baseline: `ef313aff8f23ebbe20211006969a1ff05ae18f9e`, current Codex documentation
worktree. No other worktree or uncommitted Campaigns implementation was inspected.
Read-only MCP inspection targeted the project identified by the existing
[cron runbook](../supabase/cron/README.md): `gkdyyjqepzayjdpvqnja` (development,
PostgreSQL 17, us-east-1). Metadata only; no customer rows, credentials or cron
command payloads were retrieved.

| Observed metadata | What it establishes / does not establish |
| --- | --- |
| `pg_constraint`, column nullability, indexes, selected triggers | Physical ERD edges and uniqueness. Does not certify every function or every permitted write. |
| All 71 base tables across public/ai/intelligence have RLS enabled | Selected entity/job/feature policies use business membership. Does not prove all grants, function privileges, views or tenant cases are safe. |
| Legacy dimension/performance views have `security_invoker=true` | Compatibility names are views over normalized storage, not duplicate physical tables. |
| `process_account_sync_jobs` v5, alias `process_meta_backfill_jobs` v16, `queue_account_sync_jobs` v4, `process_calendar_queue` v16: ACTIVE, JWT verification false | Functions exist. Custom cron authentication is visible in local handlers; remote code parity, secrets and successful forwarding were not verified. |
| Worker job 66 active, `*/10 * * * *`; calendar job 61 active, `* * * * *` | Actual cadence differs from job names. No run health or completed sync was verified. |
| Enqueue job 13 inactive, `0 */1 * * *`; jobs 54–58 inactive | Recurring enqueue is not active. Proposed two-hour cadence is only an operator procedure. |
| Maintenance jobs 69 hourly and 70 daily active | Operational maintenance is configured; no changes made. |

Deployment host/project, hosted Next.js revision, external Meta subscriptions,
provider credentials, resource/Insights feature flags and live execution gates remain
**unverified**. Local resource and Insights implementations are gated; schema existence
is not enablement. CI checks/builds the app in [ci.yml](../.github/workflows/ci.yml);
that workflow does not deploy it. Installed libraries do not establish an enabled
integration. The earlier webhook absence finding is superseded by the
committed implementation described in [Flows](FLOWS.md#webhook-triggered-status-reads-and-refresh)
and the addendum below.

Architecture risks are recorded separately in the [audit](ARCHITECTURE_AUDIT.md#phase-2-relationship-review--2026-11-13).


## Documentation validation — Phase 2

- All 14 Mermaid blocks in Architecture, Flows, Database relationships and this page
  converted successfully with draw.io Desktop; exported PNGs were visually inspected.
  Crowded ERDs were split/simplified, with omitted FKs documented beside each view.
- Both native draw.io pages parse as XML; context and runtime exports were inspected
  for clipped labels and connector routing. Native shapes remain editable.
- 147 local file/heading links checked; `git diff --check` passed. Rendered previews
  remain local under `/tmp/dv-phase2-render`, not a second maintained diagram set.
- Application tests, typecheck, lint and build were not run: no application, schema,
  dependency or runtime configuration changed. No application UI screenshots or live
  integration tests were performed. No deployment or migration is required.


## Webhook verification addendum

Source revision: `e9bf2cd1bcc441a3b2ea9ad5c4cb3b5909640b02`, read-only inspection of
Claude's committed branch, with focused tests in an isolated `/tmp` snapshot. No
uncommitted application changes were included. Source links for this addition are
commit-pinned because its application files are newer than this docs worktree.

| Evidence | Result / limit |
| --- | --- |
| Development migration `20261114002047_meta_webhook_events` | Present in remote migration history; both webhook tables exist with RLS enabled. No migrations applied by this review. |
| Subscription FKs | Account PK/FK and separate business FK confirmed; delivery account/object IDs remain logical external references. |
| Realtime policy `account_signal_members` | Restrictive SELECT predicate checks `can_access_ad_account` for private account topics; browser delivery was not tested. |
| Cron metadata recheck | Worker 66 still active every ten minutes; enqueue 13 still inactive/hourly. No schedule changes. |
| Focused Node 24 tests at source revision | 5 files / 30 tests passed: parser, signature/ingestion, route, PGlite queue/persistence and targeted lifecycle merge. Mocked/local only. |
| Hosted state | App deployment, webhook flag, callback registration, subscribed fields/account, real delivery and browser Realtime remain unverified. Source contract says not deployed/registered/subscribed at its verification point. |

The endpoint creates status-read demand; `events:v2` completion never establishes
fresh performance metrics or a completed decision evaluation. The module contract
owns activation steps. This update does not activate anything. Full application
checks/build and UI screenshots were not run for this documentation update.

Webhook documentation checks: all 15 current Mermaid blocks have matching rendered
previews; the changed sequence, webhook ERD, container view and native context page
were visually inspected. All 235 local file/heading links across the seven affected
handbook pages resolve; native XML references and `git diff --check` pass.
