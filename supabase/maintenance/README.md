# Operational log storage maintenance

Development project `gkdyyjqepzayjdpvqnja`; measured 2026-10-28 UTC.

## Findings and reclamation

| Object | Before | After |
| --- | ---: | ---: |
| Entire database | 509,275,283 bytes | ~33,033,363 bytes |
| `cron.job_run_details` including indexes | 371,064,832 bytes | ~2,121,728 bytes |
| `net._http_response` including indexes | 108,003,328 bytes | ~663,552 bytes |

Cron had **938,442** records dating back to December 2024; **927,354** were older
than seven days. Most came from old minute-frequency jobs, including disabled and
removed jobs. pg_cron does not automatically prune execution history.

pg_net's six-hour TTL was working: only **396** current response rows remained.
Its 103 MiB allocation was table/index bloat from prior churn, rather than 103 MiB
of live responses. Deleting rows alone need not release allocated disk space.

`reclaim_operational_logs.sql` briefly locks each diagnostic table, saves recent
rows to a temporary table, truncates the bloated table, and reinserts those rows.
It preserves seven days of cron diagnostics, unfinished runs, and all current HTTP
responses (up to 24 hours). Sequence values continue; no Auth, advertising data,
queue jobs, decisions or execution history are touched. A three-second lock
limit aborts instead of waiting indefinitely. The completed maintenance reclaimed
approximately **476 MB** and left the database around **94% smaller**.

## Recurrence prevention

Applied migration `20261028001536_operational_log_retention.sql` adds:

- Hourly `maintenance-prune-operational-logs` at `17 * * * *`: delete up to 5,000
  completed cron runs older than seven days and up to 5,000 HTTP responses older
  than 24 hours, then analyze both tables. pg_net's normal six-hour TTL remains.
- Daily `maintenance-vacuum-operational-logs` at `47 3 * * *`: regular
  `VACUUM (ANALYZE)` on both diagnostic tables. It is one top-level command, not a
  function or transaction containing VACUUM. This reuses dead pages without a
  blocking `VACUUM FULL` rewrite. A direct run completed successfully.

The prune routine is owner-only: anon, authenticated and service_role callers are
not granted execute permission. Application APIs cannot erase operational history.
Five focused retention tests cover boundaries, recent/running preservation, bounded
batches, schedule commands and access denial. The hourly cron has also succeeded
on the real project.

## Cron authentication repair

Approved Edge deployments: queue v2, canonical worker v2, compatibility worker v13.
Missing/invalid credentials return 403. The existing Vault credential is now the
Edge `CRON_SECRET`; legacy `SKIP_CRON_SECRET` is false. The temporary CLI secret file
used by `scripts/automatic-sync/configure-edge-auth.mjs` is mode 0600 and deleted in
finally; no secret value is printed or passed as a shell argument.

Migration `20261028003426_cron_vault_authentication.sql` updates the existing worker
command and calendar invocation helper to read Vault. Their **ten-minute** and
**one-minute** cadences, respectively, are preserved. Both Meta Edge queue/worker
forwarding probes returned HTTP 200 using Vault, scoped to nonexistent IDs so no
real account was queued or processed. Subsequent scheduled HTTP responses include
200/202; all four Edge endpoints, including calendar, reject missing credentials.
The calendar binary is still its existing version; its shared bypass flag is now
explicitly disabled.

The new two-hour enqueue remains inactive until the updated hosted Next.js app is
deployed and verified. The public automatic-refresh endpoint still returns 404.
See `supabase/cron/README.md` for activation and verification after that prerequisite.

References: [pg_cron history](https://github.com/citusdata/pg_cron#viewing-job-run-details),
[Supabase deletion and reclamation](https://supabase.com/docs/guides/database/postgres/data-deletion).
