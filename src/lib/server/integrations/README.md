# Meta integration and synchronization

For the cross-system sequence and entry points, start with
[Flows](../../../../docs/FLOWS.md#1-meta-connection-and-synchronization).
This module owns OAuth, connection/token lifecycle, account discovery and selection.
Sync orchestration lives in `../sync`; privileged advertising writes live in
[`../advertising`](../advertising/README.md). Connecting or syncing never authorizes
advertising execution.

## Connection and selection contracts

- [`service.ts`](service.ts): `createOAuthState`, atomic `consumeOAuthState`,
  `upsertPlatformIntegration`, `resolveIntegrationAccessToken`, account listing,
  primary selection, connection health/error updates.
- [`adapters/meta.ts`](adapters/meta.ts): OAuth URL, token exchange/validation and
  account discovery transport. Configuration uses `META_APP_ID`, `META_APP_SECRET`
  and optional `META_BUSINESS_CONFIG_ID`; default requested scopes are read-oriented.
  Read the adapter before changing Graph version or permission behavior.
- [`metaSelection.ts`](metaSelection.ts): `syncSelectedMetaAdAccount` saves primary
  selection and creates/reuses the correct durable job. `applyAppSelectionCookies`
  writes `platform_integration_id` and `ad_account_row_id`.
- [`MetaIntegrationFlow`](../../../components/integrations/MetaIntegrationFlow.tsx)
  drives the callback/account-picker UX. Callback flags include
  `requires_account_selection`, `auto_sync`, `integrationId` and `externalAccountId`.

OAuth callback discovers accessible accounts once. Discovery registers metadata,
not successful sync timestamps. The account picker and selection route read saved
`ad_accounts`; they do not broadly rediscover accounts from Meta. Requests validate
integration/business/platform/account relationships before selection. Exactly one
primary external account is stored per integration in `integration_details`:
`primary_ad_account_external_id`, `primary_ad_account_name`,
`account_selection_completed_at`. Cookies are selection hints, not authorization.

For an uninitialized account, selection creates/reuses `initial_historical`; an
initialized account receives queued follow-up work. The selection route processes
the targeted job and checks actual completion before success. Its contract differs
from manual refresh's 202/job-polling response. Older `seed_recent` compatibility
modes remain in sync code, but are not the current selection orchestration.

## Sync and persistence ownership

[`processMetaBackfillJobs`](../sync/meta/processBackfillJobs.ts) atomically claims
`initial_historical`, `backfill`, `incremental` and `manual_refresh` jobs.
Initial history uses [`processMetaFirstSyncJob`](../sync/meta/processFirstSyncJob.ts):
read dimensions/creatives, then recent-to-older 30-day windows bounded by advertiser
timezone, known entity history and business data policy, then summaries/analysis
and completion. Other jobs use [`syncBusinessPlatform`](../sync/syncBusinessPlatform.ts)
and [`syncMetaBusinessPlatform`](../sync/meta/syncMetaBusinessPlatform.ts).
Only the scoped account enters its dimension/performance synchronization.

[`syncMetaPerformance`](../sync/meta/syncMetaPerformance.ts) reads levels/breakdowns
through bounded concurrency, with optional audience/hourly work governed by policy
and cadence. Meta read transport retries/timeouts belong to
[`client.ts`](../sync/meta/client.ts); do not reuse read retry behavior for writes.
Manual refresh explicitly rereads 30 advertiser-local days including partial today;
automatic jobs preserve their saved seven-day attribution window. Incremental
coverage does not prove fresh attribution or completed decision evaluation.

| Data | Writers/owner |
| --- | --- |
| Discovered account metadata and selection | Integration service, `sync/meta/discoverMetaAdAccounts`, `repositories/ad_accounts` |
| Queue, progress and coverage | `repositories/ad_accounts/syncState.ts`; `account_sync_jobs`, `ad_account_sync_state`, account successful-sync timestamp |
| Dimensions and unified hierarchy | `syncMetaCampaigns`, `syncMetaAdsets`, `syncMetaAds`; legacy dims plus `ad_entities` repositories |
| Creatives and saved media | `syncMetaAdCreatives`; `ad_creatives`, creative feature snapshot repository |
| Daily/summary/hourly/audience facts | `syncMetaPerformance` and corresponding repositories; preserve entity level, account currency/timezone and missingness |
| Account Insights metadata | `updateAdAccountMetadataFromInsights`; despite the old filename, this does not persist separate daily account metrics |
| Assessments, signals and trends | Existing `intelligence` services, including `ai.business_assessments` |
| Versioned decisions | Separately gated post-sync enqueue and Review/Shadow workers; [decision contracts](../decisions/README.md) |

Creative sync performs bounded video-poster reads through the existing Meta client;
`videoPosters.ts` chooses verified HTTPS assets and preserves fallback media on denied
access/timeouts. No media-provider request runs on Overview load. Do not log signed
URLs or substitute an unrelated preview. See [exploration](../campaigns/exploration/README.md).

## Manual, automatic and internal workers

- `/api/sync/refresh` validates the authenticated selected scope, enqueues/reuses work,
  and returns job state. `dispatchAccountSync` uses `after()` for targeted processing.
  The GET status path validates business/account/integration; unchanged-statistics
  fingerprints cover the selected 30-day ad-set facts, not every creative/status field.
- `AutomaticMetaSync` in the authenticated shell calls `/api/sync/automatic-refresh`
  on visit/focus and observes durable state. First advertiser-local daily checks use
  successful-sync age; a success within 90 minutes prevents unnecessary refresh.
  Automatic work never changes manual cooldown state.
- `enqueueScheduledAccountSyncJobs` shares atomic eligibility/deduplication and
  bounded dates. Disconnected/expired credentials and ineligible synthetic accounts
  are skipped. Backoff and recovery use persisted state, not browser timers.
- `/api/integrations/meta/process-backfill-jobs` requires `INTERNAL_API_KEY`; its
  `maxDuration` is 300 seconds. It schedules independent Review/Shadow draining and
  outcome measurement even on idle ticks. Selection/manual routes have their own
  execution budgets; actual hosting limits still apply.
- Edge `process_account_sync_jobs` forwards authenticated work. The old
  `process_meta_backfill_jobs` name remains an alias. Edge handlers require
  `CRON_SECRET`, `APP_BASE_URL` and `INTERNAL_API_KEY` and fail closed.

A unique active-account queue constraint and existing claim/recovery RPCs arbitrate
concurrency. Never clear running claims as a retry shortcut. Partial failures may
already have persisted observations; UI polling timeout is neither cancellation
nor completion. See [`supabase/cron/README.md`](../../../../supabase/cron/README.md)
for deployment/activation procedures. Historical deployment notes must be checked
against the actual target before any activation; this documentation update neither
verifies nor changes hosted schedules.

## Credential and simulation boundaries

Vault token and mutation RPCs are service-role-only after the access-hardening
migration. Browser clients cannot modify token references. Server callers resolve
business ownership before privileged token access. Never pass provider tokens to
UI or accept them as user-supplied execution authority.

`deepvisor-beta-v1` imports have no credentials; triggers reject credential
assignment, marker removal and queued/running sync jobs. A fixture import is not a
Meta fetch. [`scripts/beta-fixtures`](../../../../scripts/beta-fixtures/README.md)
contains the explicit isolated-data workflow.

`deepvisor-meta-phase2` is a distinct, gated development/test provider. It exercises
the real queue with controlled responses while preserving Auth/RLS. Untargeted
workers skip its integrations; simulated credentials cannot enter live execution.
See [Phase 2 scenarios](../../../../scripts/beta-phase2/README.md). Organizer name
simulation is separate and described in its own runbook.

## Verification

Use mocked transport and existing scoped fixtures first:

```sh
npm test -- src/lib/server/sync src/lib/server/integrations src/app/api/integrations/meta src/app/api/sync
npm run typecheck
npm run lint
npm run build
```

Live tests remain explicit opt-ins. Do not treat repository implementation, passed
mock tests, configured credentials, deployed code and enabled schedules as equivalent.


## Resource-aware refresh (server feature gate)

`DEEPVISOR_RESOURCE_REFRESH=true` selects the existing queue's resource-aware path.
Keep the gate off until migrations and the hosted worker/app have been released
together. See [`resources/README.md`](../sync/resources/README.md) for freshness,
shared quota admission, fenced publication, validation and activation requirements.
This does not enable advertising actions or activate cron.
