# Automatic Meta refresh deployment

Existing development project: `gkdyyjqepzayjdpvqnja`. The application implementation
and queue migration are verified against this project. **Edge deployments were
approved and completed; hosted automatic enqueue is not active because the updated
Next.js app is not deployed yet (its automatic-refresh endpoint returns 404).**

## Behavior

- First authenticated visit/focus on each advertiser-local day checks the selected
  account in a service-only RPC. A persisted successful job less than 90 minutes old
  prevents another refresh. Day checks persist in `ad_account_sync_state`.
- Only initialized, selected, connected/error-state Meta accounts are eligible.
  Known expired/missing credentials, disconnected/reauth-required accounts, and
  global synthetic accounts are skipped. Targeted simulations require the existing
  explicit development opt-in.
- Automatic jobs are `incremental`, with seven account-local calendar days including
  today, rereading recent attribution. The worker uses those exact stored dates;
  these jobs cannot silently expand into historical backfills.
- A partial unique index permits one queued/running job per account across all
  triggers. Existing atomic worker claims and the 15-minute recovery lease remain.
  Three exhausted worker claims mark a crashed read as failed. Automatic failures
  back off 90 minutes and stop after three failures since success/reconnection;
  manual refresh remains independent and can recover the account.
- Failed/reauthentication-required integrations retain authorized access to saved
  analytics. Reconnect guidance and an attention badge replace misleading connected
  status; automatic enqueue still skips accounts requiring reauthentication.
- Automatic work never changes `manual_sync_rate_limit`. The shell displays durable
  state and actual successful time, polls visible tabs, and reloads analytics after
  persisted completion. A queue response does not claim updated data.
- Sync uses the existing Meta read adapter and worker, never the advertising executor.

## Approval and activation order

1. Deploy the updated Next.js app through the existing hosting workflow. The queue
   migration `20261027022659_automatic_meta_refresh.sql` is already applied. Confirm
   the hosted internal route uses the new atomic enqueuer before enabling cron.
2. Deploy the repository's fail-closed handlers for `queue_account_sync_jobs`,
   `process_account_sync_jobs`, and compatibility alias `process_meta_backfill_jobs`.
   Approved deployments are now versions 2, 2, and 13; the bypass code is removed. Their custom `CRON_SECRET` authentication supports `verify_jwt=false`;
   missing configuration and the obsolete skip flag must never permit a request.
3. Verified: requests with no credential and a wrong credential return 403 without
   forwarding. Verify `APP_BASE_URL` points to the deployed app and the server-only
   `INTERNAL_API_KEY` matches. Match Edge `CRON_SECRET` to Vault's existing
   `CRON_SECRET`; never print either value.
4. Execute `automatic_meta_refresh.sql` once approval and the checks above are
   satisfied. It idempotently reuses legacy enqueue job `cron_sync_ad_metrics`
   (currently inactive), changes it to **`0 */2 * * *`**, and submits `limit=100`,
   `lookbackDays=7`, `staleAfterMinutes=90` through `queue_account_sync_jobs`.
   Invocation credentials are read from Vault at execution time, not embedded.
5. The same script retains worker job ID 66 / name
   `process-meta-backfill-jobs-every-minute` and its actual **`*/10 * * * *`** cadence.
   It updates only its command to the canonical `process_account_sync_jobs` endpoint
   using Vault. It creates no second worker or independent synchronization path.
6. Observe an authorized enqueue, worker claim, completed queue row and successful
   timestamp. Check `cron.job_run_details` together with `net._http_response` status
   codes and application job records. A successful cron dispatch is not proof of a
   completed sync. Inspect sanitized metadata, not request headers/secret payloads.

Rollback of the new recurring enqueue is `cron.alter_job(13, active := false)` after
confirming the current job ID. Preserve the worker and queued work. Do not clear a
running claim merely to retry it.

## Focused reproduction

Use Node 24. Unit tests cover staleness/day rollover, two-hour eligibility, cross-type
deduplication, failure backoff/limits, worker recovery, RLS/RPC denial and route scope:

```sh
npm test -- src/lib/server/sync/automaticRefresh.persistence.test.ts src/app/api/sync/automatic-refresh/route.test.ts src/app/api/sync/scheduled-refresh/route.test.ts src/app/api/sync/refresh/route.test.ts src/lib/server/sync/manualRefresh.test.ts src/lib/server/sync/meta/incrementalWindow.test.ts src/lib/server/phase5Security.test.ts
```

The opt-in real-database test uses the existing Phase 5 synthetic business. It
requires `.env.local` and the ignored `.env.beta-phase5.json`. It temporarily extends
the existing mock's measurement clock, retains truthful success timestamps and job
history, then restores the provider controls. Run only when that fixture is stale;
it deliberately refuses to fake a successful sync's age to force another run.

```sh
DEEPVISOR_META_SIMULATION=gkdyyjqepzayjdpvqnja DEEPVISOR_AUTO_SYNC_TEST=gkdyyjqepzayjdpvqnja node --env-file=.env.local node_modules/vitest/vitest.mjs run src/lib/server/sync/automaticRefresh.live.test.ts
```

`scripts/automatic-sync/browser.mjs` checks the persisted timestamp and KPIs, repeat
visit, manual button, authorization and 1440/390px layouts. It uses temporary
Playwright tools at `/tmp/deepvisor-auto-tools` and a simulator server on port 3011.
No screenshots are retained. Local evidence lives under the ignored
`docs/beta-readiness/automatic-sync/` directory.

## Approved deployment progress (2026-10-28 UTC)

- Three Edge deployments completed. Vault and Edge `CRON_SECRET` are aligned,
  `SKIP_CRON_SECRET=false`, and all four existing Edge endpoints reject missing auth.
- Queue/worker forwarding with Vault returned HTTP 200, scoped to nonexistent IDs.
  This proves authentication/forwarding, not completion of a real hosted sync.
- Migration `20261028003426_cron_vault_authentication.sql` secured the existing
  ten-minute worker and calendar callers without changing cadence.
- Enqueue job 13 remains inactive pending the updated hosted app. No Vercel project
  link, CLI login or deployment token was available locally; deployment path was
  requested. Do not activate the old hosted enqueuer under the new schedule.
- [Operational log reclamation and retention](../maintenance/README.md) reduced
  database size from approximately 509 MB to 33 MB. Hourly pruning and daily regular
  vacuum are active; no advertising/Auth/application history was removed.
