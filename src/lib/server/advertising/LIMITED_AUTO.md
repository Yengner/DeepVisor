# LIMITED_AUTO execution

This capability is **off by default**. It does not change existing business
policies, `.env.local`, cron registrations, Review Mode approvals, or Shadow
Mode scheduling. Apply `20261010000000_add_limited_auto_execution.sql` only after
the preceding V2, Review, Shadow and outcome migrations are deployed. Regenerate
Supabase bindings after deployment; local types already describe this migration.

## Explicit enablement

All of these independent gates must be open:

1. Existing server environment `DEEPVISOR_META_EXECUTION_ENABLED=true`, with the
   business UUID in `DEEPVISOR_META_EXECUTION_BUSINESSES`.
2. New server environment `DEEPVISOR_LIMITED_AUTO_ENABLED=true`.
3. `ai.execution_controls.limited_auto_enabled=true`. This singleton is created
   **false**; changing it to false is the live global database kill switch.
4. The business explicitly opts in through trusted administrative configuration:
   policy `mode='autonomous'`, explicit allowed action classes, full evidence,
   cooldown, daily-count and entity-budget settings; `executionEnabled=true` and
   `exclusiveWriterConfirmed=true`. Obtain owner consent before configuring it.
5. Additional `budget_boundaries_json.limitedAuto` settings, without defaults:

```ts
limitedAuto: {
  enabled: true,
  killSwitch: false,
  adAccountId: '<internal account UUID>',
  allowedEntityIds: ['<external Meta ad-set ID>'],
  minAccountBudgetMinor: 10000,
  maxAccountBudgetMinor: 100000,
  maxPauseBudgetMinor: 1000,
  maxPauseAccountPercent: 2,
}
```

These numbers illustrate the shape, not recommended business thresholds. Values
are integer account-currency minor units except percentage. Each business's V1
configuration identifies one account explicitly. Business kill switch:
set `limitedAuto.killSwitch=true`, `limitedAuto.enabled=false`,
`executionEnabled=false`, or change mode away from `autonomous`. Browser roles
cannot edit either switch or execution records. No opt-in UI is added here.

## Invocation and lineage

Trusted workers can call `runLimitedAuto(client, {businessId, sourceSnapshotId,
provider})`. The production entry point is
`POST /api/internal/decisions/limited-auto`, authenticated with
`Authorization: Bearer <INTERNAL_API_KEY>`. Its strict JSON body contains only
`businessId` and `sourceSnapshotId`; clients cannot supply an action, budget,
token, policy, or provider response. It instantiates the existing configured Jev
provider; missing credentials or provider outages mean HOLD. No LLM fallback.

No automatic schedule is installed. A trusted caller must supply a freshly
persisted FeatureSnapshot. Existing Shadow Mode remains read-only and continues
to schedule only `observe` policies.

The workflow reserves the source, reads Meta, calls the unchanged DecisionEngine
with a fresh provider evaluation, persists the new run and proposal, then checks
PolicyEngine with complete persisted history. Approved low-risk *policy classes*
are distinct from human-approved Review proposals: automatic proposals have
`requires_approval=false` and a separate `automaticAuthorization` fingerprint.
Review approvals can never be reused as automatic authorization.

Provider-selected classes are limited to reduction/pause. The server computes
the integer budget reduction, rounded down, capped at the smaller of the policy
percentage and 5%. A zero reduction, increase, medium/high-risk proposal, locked
entity, missing evidence, low confidence, inadequate tracking, cooldown, exhausted
daily count or stale data blocks. Creative review remains recommendation-only.
Pausing additionally requires the explicit entity allowlist, configured pause
budget cap and allocation share, with a hard maximum share of 5%.

## State and audit safety

- Only daily ad-set-owned target budgets are supported. Shared campaign targets,
  lifetime targets and scheduled ad-set budgets block.
- Account allocation reads fully paginate configured campaigns/ad sets and sum
  active daily budget owners once. Active lifetime/scheduled ad-set or ambiguous
  allocations, invalid data and incomplete pagination block. This is configured
  allocation, **not a hard guarantee of Meta spend**. Relevant Meta fields follow
  [Meta's account ad-set endpoint](https://www.postman.com/meta/facebook-marketing-api/request/i3u5n9r/getadsetdetailsforaccount)
  and [campaign fields](https://www.postman.com/meta/facebook-marketing-api/request/45f5yj7/getcampaignsdetails).
- Current and post-action account allocation, and entity budget, must remain
  within configured boundaries. Read the target and whole account again before
  writing; any observed external changes block and require new evaluation.
- Sources must be persisted within six hours and pass FeatureSnapshot freshness
  checks. The fresh decision must be at most two minutes old at execution.
- Exact source-content hashes prevent repeat evaluation even if a snapshot is
  cloned with a new ID. Failed or crashed evaluations are never auto-replayed.
- Automatic and Review executions share the same non-expiring per-business lock
  and permanent per-proposal claim. Complete history is reloaded under this lock,
  so concurrent executions cannot bypass cooldown or daily count limits.
- Fingerprints bind the proposal, run, snapshot and policy. Claim, checkpoint and
  the final authorization RPC all fail closed on revocation or changed context.
- The checkpoint persists exact entity/account before-state and request metadata
  before one field is written. The final pre-write gate checks the environment
  and database kill switches again. Pre-write work exceeding 15 seconds blocks.
- Read back the target and whole account. Only the requested change and target
  update timestamp may differ. Persist verified after-state in `executed_actions`.
  Existing outcome processing measures successful automatic executions normally.
- Failures after checkpoint retain the business lock for operator reconciliation.
  Missing readback is an uncertain failure, never success. No write retry,
  automatic rollback, budget increase, targeting/creative edit, creation or
  deletion exists. A failed HTTP request is not permission to repeat the action.

The same external-writer limitation as Review Mode remains: these Meta GET/POST
calls are not atomic. There is a narrow race between the final reads/checks and
the write, and a kill switch cannot retract an already dispatched request. The
exclusive-writer attestation is mandatory; if other tools or people can change
managed state concurrently, keep live execution disabled. See
[operator reconciliation](./README.md#operator-reconciliation). Do not clear a
claim or evaluation reservation to replay uncertain work.

## Validation

`npm test -- src/lib/server/advertising src/lib/server/decisions/policy
src/app/api/internal/decisions/limited-auto` exercises mocked Meta HTTP, provider
failures, exact boundaries, authorization, migrations, idempotency, shared locks
and kill switches. No tests execute live advertising changes.
