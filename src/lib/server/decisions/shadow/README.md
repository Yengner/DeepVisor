# Scheduled Meta shadow evaluation

This pipeline observes synchronized Meta data. It never imports the advertising
executor, sends Meta requests, approves proposals, or enables LIMITED_AUTO.

## Enablement

Apply `20261008000000_add_shadow_evaluation_jobs.sql` after V2 decision persistence.
Local Supabase bindings include the new table and RPCs; regenerate them from the
deployed database through the usual process after migration deployment.

Set server-only `DEEPVISOR_SHADOW_ENABLED=true` and explicitly choose
`DEEPVISOR_SHADOW_PROVIDER=mock` or `jev`. Jev uses the existing server credentials,
model pin, timeouts and bounded transport retries. There is no provider fallback.
The mock provider is a deterministic development fixture, not a calibrated model.
Its existing rules produce HOLD, INSUFFICIENT_DATA or REVIEW_CREATIVE; unit tests
also inject budget-reduction and pause results through the same provider interface.

The business must have an `autonomy_policies` row with `mode='observe'` (SHADOW).
OFF, REVIEW and autonomous policies are not scheduled by this pipeline. No
environment variables, remote policy rows or live Meta settings are changed by
this implementation.

Use the existing policy JSON contract from `../../advertising/README.md` for
currency, timezone, budget period/boundaries, locked entities, cooldown, daily
limits and evidence thresholds. Execution enablement and single-writer settings
are not needed for shadow observation. Missing settings fail policy checks closed.

## Sync integration

After incremental/manual/backfill or initial-history sync commits completion,
the sync path makes one bounded enqueue RPC (five-second timeout). Errors are
logged and swallowed, never changing sync success. The existing authorized
`/api/integrations/meta/process-backfill-jobs` worker schedules `after()` work
independently of its response, including on idle ticks and sync failures. The
Supabase Edge worker already forwards to that endpoint, so no new cron is needed.
One shadow job is drained per tick; monitor queue age and worker cadence.

Only completed sync jobs less than six hours old, active Meta ad sets and accounts
with coverage through the last completed account-local day are eligible. The
cutoff is yesterday in the account timezone, not a partial current day. No
missing daily rows are synthesized. Snapshot construction uses the existing
Feature Engine with up to 60 days of normalized, unsplit facts.

## Idempotency and failure handling

An enqueue statement captures immutable normalized rows, entity budget/status
configuration and business policy into `source_json`. The SHA-256 source hash
excludes refresh timestamps and includes meaningful inputs and the completed-day
cutoff. Evaluation version includes Feature Engine, pipeline and question versions
plus provider/model identity. Unchanged syncs do not create another evaluation;
late attribution corrections, changed policy configuration, a new completed day
or a new evaluation version create a new job.

Claims use row locks, an advisory claim lock and a unique running entity/version
index. Every job reserves snapshot, run and proposal UUIDs before any inference.
DecisionEngine's optional persistence IDs preserve its normal behavior for other
callers; database primary keys prevent accidental replay from starting a second
inference. Reserved IDs are provenance pointers and may not have rows yet when
a job fails before persistence. Actual decision/snapshot/proposal rows keep the
existing foreign-key lineage.

Jobs terminally fail on invalid/stale inputs, policy changes, provider errors or
invalid responses. Abandoned running jobs expire after ten minutes on a worker
tick. They are NOT automatically reclaimed: a crashed inference can have an
unknown outcome, and replaying it would violate same-source deduplication. Known
transient Jev errors use the adapter's bounded retries within the single run.
Fresh source data or an explicitly revised evaluation version creates future
work; do not reset terminal jobs to queued. This is at-most-once inference
attempt semantics, not a claim of exactly-once external service delivery.

The worker rechecks six-hour freshness, account-local cutoff, configured provider
version and current SHADOW policy before inference. PolicyEngine independently
enforces evidence freshness and its stricter entity-age threshold. A queue delay
can therefore produce a blocked result even within the six-hour source window.

## Persisted comparison evidence

FeatureSnapshots and decision runs are persisted by DecisionEngine. One
transaction finalizes the shadow job, adds policy results to `decision_json.shadow`
and inserts a pending, non-executable proposal for action/recommendation decisions.
HOLD and insufficient-data decisions are retained without an action proposal.
Actual shadow outcomes are limited to SHADOW_ONLY, BLOCK and HOLD. The same input
is also assessed in hypothetical REVIEW mode to record whether human approval
would be required. `allowedBySafetyChecks` means eligible for shadow consideration,
not permission to execute; LIMITED_AUTO is never evaluated or enabled here.

For REDUCE_BUDGET, V1 constructs an explicit 5% candidate (integer minor units,
rounding the reduction down). PolicyEngine may block it due to limits, shared
campaign budgets, insufficient evidence, tracking, locks or cooldown. Blocked
candidates remain stored so evaluation quality can be analyzed rather than only
retaining favorable recommendations. REVIEW_CREATIVE remains recommendation-only.

The retained record includes source-sync ID/time/hash, provider versions, entity
state, policy configuration/input, recent and previous baseline windows, action
history, actual shadow policy and counterfactual REVIEW result.
Policy checks use `policyAsOf`, the atomic history-claim time, rather than claiming
to know about actions that happened while inference was running. Planned comparison
horizons are 24/72/168 hours from `evaluatedAt`. These permit future joins to the
same ad-set performance and execution history without rewriting the baseline.
No outcome measurement job or synthetic executed action is introduced in this task.

Logs are structured JSON with `shadow.*` event names, business/account/entity/job
and run IDs, source hash, duration, provider and sanitized error code. No tokens,
provider exception text, raw Meta payloads or personal targeting data are logged.
Monitor `failed`, `expired`, queue age and `shadow.audit_failed` events.

Run `npm test -- src/lib/server/decisions/shadow`. PGlite tests apply the real
migration against test-only source tables. HTTP/provider calls are mocked; tests
neither migrate the remote database nor call Jev or Meta.
