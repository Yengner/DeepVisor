# Observed decision outcomes

Apply `20261009000000_add_action_outcome_measurements.sql` after the V2 and
shadow-job migrations. No existing production tables are recreated. Local
database bindings include the new fields; regenerate from the deployed schema
after applying migrations through the normal release process.

The authenticated internal Meta sync-worker endpoint schedules
`processActionOutcomes` using `after`, including idle ticks. Keep that existing
worker schedule running. No extra cron or provider credentials are required.
Measurement runs independently of whether new shadow evaluations are enabled.
Errors are isolated from sync and logged as `outcomes.failed`; successful ticks
log seeded/processed counts as `outcomes.processed`.

The service-role-only `ai.process_action_outcomes` RPC seeds and measures up to
100 outcomes per tick (maximum configurable batch 500). It uses a transaction
advisory lock plus unique source/horizon keys, so retries and overlapping ticks
cannot create duplicate measurements. A failed transaction can be retried on
the next scheduled tick. It performs database reads/writes only, never Meta
actions, inference, or training.

## Sources and timing

- Successful executions link through `executed_action_id` to the original
  proposal, decision and snapshot. Anchor: execution confirmation time.
- Completed shadow evaluations link directly through `shadow_decision_run_id`.
  They have no executed action. Proposal ID (when present) and the immutable
  reference snapshot are retained in the baseline JSON. HOLD decisions can
  also be observed without manufacturing an action proposal.
- Each source gets separate 1, 6, 24 and 72-hour horizons.
- Hourly facts are keyed in advertiser-local time. Compare equal-length full
  hourly windows before/after the event, excluding its partial hour. For an
  event at 12:30, the 1-hour comparison is 11:00-12:00 versus 13:00-14:00, not
  the exact following 60 minutes. An event on the hour needs no gap. Exact
  boundaries, timezone and capture time are stored with each measurement.
- Missing timezone/currency or a daylight-saving offset change across the
  comparison window makes it `unavailable`. Existing hourly keys cannot
  disambiguate repeated DST hours; we do not invent UTC precision.

## Measurement semantics

`metrics_before_json` preserves the source snapshot as decision-time evidence
and the first complete, equal-horizon comparison baseline. Hourly baseline
data is captured when the worker first has complete data, so it can include
attribution revisions since the decision; the capture timestamp is retained.
An incomplete baseline may be retried, but a complete baseline is never revised.
Completed outcomes are immutable to this worker, including legacy outcomes.

Metrics are summed spend, impressions, clicks and results (leads + messages +
calls). CPR, CTR (percent), CPC and CPM are recomputed from totals. Delivery is
observed active hours (spend or impressions above zero) and impressions/hour,
not a claim about Meta's delivery status. Undefined ratios and percentage
changes from zero are null. CTR differences are percentage points.

Every hour must be present, nonnegative, in the expected currency and synced
after the window ended. Missing rows are **not zero delivery**, even after a
pause. Outcomes remain `pending` and retry hourly; seven days after the horizon
ends, missing/stale/invalid coverage becomes `insufficient_data`. Hourly sync
coverage/retention determines which horizons can be measured; daily summaries
are never substituted for hourly data.

`calculated_change_json.interpretation` is `observational_correlation`, with
`causalEffectEstimated: false`. Shadow data shows what happened without the
proposed action, not a simulated effect. Executed data is also not causal proof:
other edits, attribution delays, seasonality and campaign-level budget sharing
can affect the measured ad set. Campaign-owned budget changes are measured on
the evaluated ad set, not presented as a whole-campaign impact estimate.

Existing authenticated business-only read policies remain in effect. Browser
sessions cannot run measurement functions or write outcomes. Legacy execution
outcome inserts retain their completed default.

## Tests

`npm test -- src/lib/server/decisions/outcomes` runs worker isolation tests and
the actual migrations/calculations against an in-memory PostgreSQL fixture.
No live Meta or production database connections are used.
