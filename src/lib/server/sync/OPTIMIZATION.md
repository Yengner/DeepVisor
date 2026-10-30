# Sync efficiency and normalization v2

Local implementation; hosted deployment and schedule activation remain pending.
The nullable-metrics migration was applied to development project
`gkdyyjqepzayjdpvqnja` on 2026-10-29; existing rows and RLS are preserved.

- Performance fetch stages use three concurrent operations. The Graph HTTP client
  also bounds requests to three per process, including creative fetches. It honors
  bounded Retry-After delays and stops request retries when a longer delay requires
  a later queue attempt. Cursor pagination remains sequential. Started work settles
  before errors return; unstarted operations stop after failure. Limits are per
  process, not a distributed Meta quota guarantee.
- Initial history requests audience snapshots once, outside subsequent history
  windows. Successful snapshot batches are identified by policy/version in existing
  completed-job metadata. Automatic incremental refresh reuses them for 24 hours;
  manual refresh and full backfill force refresh. Meta measurement dates stay in
  the rows; completion timestamps are used only for cache eligibility. Unknown
  snapshot failures fail the job; explicitly unsupported breakdowns stay absent.
- Daily attribution lookback is unchanged. Fallback and hourly windows use advertiser
  dates. Existing entity IDs, parent relationships and account scope remain intact.
- Scheduler discovers accounts in paged batches, maps by business/platform/external
  account, and enqueues at most three concurrently without exceeding its job limit.
- Worker drains up to five jobs with two consumers. It stops admitting additional
  jobs after 45 seconds; already admitted jobs still finish under existing request/
  host limits. This is an admission budget, not a hard runtime guarantee. Existing
  database claims and recovery leases remain authoritative. Hosted cron still has
  limit 1 until the reviewed SQL configuration is applied; cadence stays ten minutes.
- Manual refresh queues without scanning daily rows in the HTTP request. The worker
  captures its baseline before writes (preserved on recovery), computes the final
  comparison once and saves it with completion. Old completed jobs without that
  result report unavailable, rather than recomputing against later data.
- Ingestion v2 rejects missing/malformed required spend/impressions/click totals.
  Optional reach stays NULL. Zero denominators produce unavailable ratios. Explicit
  zero link clicks are preserved. Action aliases use priority rather than summing
  overlapping representations; supported omitted action types retain Meta's
  no-reported-actions zero semantics. Placement requests omit conversions, so these
  are NULL. Rows retain their original source/measurement coverage.
- Legacy account aggregation no longer sums daily reach into unique period reach.
  Account-level insight fetching still supports coverage detection, but its metadata
  update is named explicitly and no longer reports nonexistent persisted daily rows.
  Legacy read adapters still exist; this is not a rewrite of every historical API.

## Database verification and remaining deployment

1. Applied `supabase/migrations/20261029185835_allow_unknown_meta_metrics.sql` to the
   existing development project. It relaxes null constraints/defaults only, without rewriting
   historical values or changing RLS. Existing default zeros cannot reliably be
   reclassified as missing without refetching source data.
2. Real persisted synthetic sync passed with DEEPVISOR_AUTO_SYNC_TEST and
   DEEPVISOR_META_SIMULATION set to the project ref: six completed days totaled
   480 spend / 48 results; deduplication, completion, cooldown preservation and
   authenticated-client isolation/privileged RPC denial passed. External Meta was
   simulated; no advertising writes. Nullable-metrics migration regression passed.
   Public schema types were regenerated from the deployed database and typecheck
   passed; existing catalog-derived ai/intelligence RPC contracts were retained
   because the CLI omits their nullable argument annotations.
3. Approve/deploy the application and corrected worker Edge handlers; verify auth
   rejection. Then separately approve/apply `supabase/cron/automatic_meta_refresh.sql`
   (Vault credentials, two-hour enqueue, existing ten-minute worker with limit 5).

## Measurement

The deterministic concurrency test executes eight 30ms operations in 90ms of
virtual time versus a 240ms sequential model (62.5% shorter scheduling time).
This is not a live Meta benchmark. Snapshot call reduction is proportional to the
number of initial history windows. Overall normalization still requires O(rows)
work; concurrency improves elapsed time, not the asymptotic amount of work.
Enable server-only `META_SYNC_METRICS=1` to log stage durations without credentials
or payloads and compare account sizes/rate-limit behavior before claiming a live
percentage improvement.
