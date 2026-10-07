# REVIEW-mode advertising execution

This layer is separate from decision providers. It reads an existing approved
proposal, validates its DecisionEngine lineage and fresh PolicyEngine result,
then invokes an `AdvertisingPlatformAdapter`. The Review Mode entry point never
calls a model, creates a decision, or enables LIMITED_AUTO. The separately gated
[LIMITED_AUTO entry point](./LIMITED_AUTO.md) reuses the executor and durable lock.

## Supported operations

- Reduce an ad set's existing daily or lifetime budget, in integer minor units.
- Pause the single approved ad set, never its parent campaign.

The adapter reads the ad set, its parent campaign, and its ad account from Meta
Graph v24.0. Exactly one positive daily/lifetime budget must resolve an owner.
Campaign-owned, ambiguous and scheduled budgets are not writable by this V1
executor. The existing PolicyEngine deliberately blocks shared campaign-budget
reductions: one ad set's evidence and approval cannot authorize changing sibling
ad sets. Campaign-owned budgets are resolved and audited; pausing the approved
ad set is still supported. No budget increase, deletion, audience edit, creative
edit is supported. Review Mode never executes automatically.

Field and status references: [Meta's ad-set SDK definition](https://github.com/facebook/facebook-nodejs-business-sdk/blob/main/src/objects/ad-set.js)
and [campaign SDK definition](https://github.com/facebook/facebook-nodejs-business-sdk/blob/main/src/objects/campaign.js).

## Deployment and explicit enablement

1. Apply `20261007000000_add_review_execution_claims.sql` after the existing V2
   persistence migration. This adds only V2 execution claims and service-only RPCs.
2. Set server-only `DEEPVISOR_META_EXECUTION_ENABLED=true` and
   `DEEPVISOR_META_EXECUTION_BUSINESSES=<comma-separated-business-UUIDs>`.
   Neither variable is set by this implementation; default is disabled.
3. The business policy must be `approval_required`, allow the exact action, and
   contain complete policy settings. No implicit evidence/budget defaults apply.
4. Use a connected Meta integration whose token can manage the relevant account.
   Credentials are obtained through the existing Vault integration service, never
   accepted from the browser. Missing Meta permissions fail closed.

Policy JSON contract:

```ts
budget_boundaries_json: {
  executionEnabled: true, exclusiveWriterConfirmed: true,
  lockedEntityIds: [], // Meta ad-set or campaign IDs; required even when empty
  currency: 'USD', timeZone: 'America/New_York', budgetPeriod: 'daily',
  minBudgetMinor: 1000, maxBudgetMinor: 10000,
}
cooldown_config_json: { cooldownHours: 24, maxDailyChanges: 2 }
minimum_evidence_json: {
  spend: 100, impressions: 1000, results: 5, activeDays: 7,
  decisionConfidence: 0.9, trackingConfidence: 'high',
  maxSnapshotAgeDays: 1, maxEntityAgeMinutes: 5,
}
```

These numbers illustrate the schema, not recommended business settings.
`max_budget_change_percent` and `allowed_action_classes` remain policy columns.
The operational lock list has to be maintained by trusted settings/admin code.

## Proposal and approval contract

The proposal's `current_state_json.metaState` must contain the Meta adapter's
complete validated read result (ad set, campaign and account, including budget
strings, statuses, IDs and update timestamps). Budget reductions also require
`current_state_json.budgetMinor` to match that state for the approval display.
Proposed budget reductions use
`proposed_state_json.targetBudgetMinor`; pauses need no new value. Targets are
external Meta ad-set IDs, while snapshot ad-account IDs are internal DB IDs.

The existing Approve action now stores a SHA-256 fingerprint of the exact
proposal, decision, snapshot and business policy. Changing any of those invalidates
approval. Approval must be at most one hour old. Previously approved rows without
this fingerprint or an explicit Meta before-state are intentionally not executable;
create and review a new proposal with fresh evidence instead of bypassing checks.

An owner/admin can explicitly POST to
`/api/decisions/proposals/<proposalId>/execute` from the same origin using their
authenticated session. No business/account/token/request payload is accepted.
Approval alone still does not execute anything; no execute button or background
scheduler is introduced. The endpoint returns an execution ID on verified success,
or a generic conflict on failure. Disabled execution makes no Meta calls.

## Audit, locking and failures

- Claiming is atomic: a database advisory lock and unique active-business index
  serialize executors. A permanent proposal claim prevents replay even after a
  successful execution or known pre-write failure. Existing execution history also
  prevents duplicate execution.
- The claim captures current policy/lineage and business-wide action history for
  cooldown/daily limits. It includes unresolved attempts and at least a year of
  terminal history, with a fail-closed 10,000-row safety limit.
- Meta is read twice. Both reads must match the state approved by the owner.
  PolicyEngine must still return `REQUIRE_APPROVAL` / `REVIEW_MODE`.
- Immediately before the write, a DB checkpoint rechecks the complete persisted
  context and stores the exact requested before-state, HTTP field metadata,
  resolved budget owner, fingerprint and start time. A read/checkpoint taking
  over 15 seconds aborts. A failed checkpoint never authorizes a write.
- One POST changes one field. There are no write retries, redirect following or
  automatic rollbacks. Each HTTP request has a 10-second timeout.
- Readback must match the exact intended change with other inspected fields
  unchanged (apart from the ad-set update timestamp). The observed after-state is
  stored, including mismatches. HTTP status, Meta code/subcode, trace ID and type
  are retained; arbitrary messages/bodies and credentials are excluded.
- All failures after the checkpoint retain the active business lock and are
  marked as needing reconciliation. Timeouts, worker termination, lost DB responses
  and failed readback never cause a second advertising write.

## Operator reconciliation

Keep execution disabled for an affected business until an operator reviews the
execution row, claim, before-state, intended field and current Meta state. Never
delete a claim or reset a proposal to retry it. A crashed pending/running execution
is unresolved even without a stored error. Verify Meta independently, preserve
the observed after-state and resolution notes in the audit, and only then release
the business claim through a reviewed service-role maintenance operation. The
proposal's permanent claim must remain. Further changes require a new evaluation,
proposal and human approval. No automatic/manual-web unlock endpoint is provided.

Meta provides no compare-and-swap contract used here, so a person or another tool
can still modify advertising state between the final GET and POST. Local locking
only serializes this executor, not Ads Manager, legacy systems or external tools.
An absolute budget update cannot guarantee a reduction relative to a concurrent
external edit. Operate with a single writer for managed entities; if that cannot
be ensured, leave live execution disabled. `exclusiveWriterConfirmed` must be
explicitly true in the business settings; it is an operator attestation, not a
Meta-side lock. Readback detects inspected mismatches
but cannot eliminate this external race. Do not describe this as exactly-once
delivery or a distributed transaction.

Tests: `npm test -- src/lib/server/advertising`. HTTP tests use mocked Meta
responses. PGlite exercises the real claim/checkpoint/finalization migration,
privileges, duplicate prevention and uncertain-state locks. No live advertising
changes or remote migrations are performed by tests.
