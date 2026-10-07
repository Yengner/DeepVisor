# V2 decision persistence

## Provider-neutral evaluation

`DecisionProvider.evaluate(snapshot, questions)` returns a `DecisionResult` using
the shared decision vocabulary. Adapters expose their provider/model identity and
versions; results must match that identity. Confidence is nullable when unknown.
Optional distributions must contain only supported decisions, sum to one (within
1e-6), and include the selected decision. Confidence is not assumed to equal the
selected decision's probability. Evidence and raw responses must be finite,
acyclic JSON. Adapters must redact secrets before returning them.

`new DecisionEngine(authorizedClient, provider).evaluate({ businessId,
platformIntegrationId, snapshot, questions })` accepts a typed Feature Engine
snapshot. It persists that snapshot and a pending decision run, evaluates a copy,
validates the response, marks the run completed, and returns its IDs and result.
Questions, explanation, distribution and evidence are stored in `decision_json`;
the optional raw response uses `provider_response_json`.

Invalid responses and provider exceptions mark the run failed and throw a typed
`DecisionEngineError`; no fallback decision is returned. Failure records contain
only a generic error code, not untrusted response bodies or exception messages.
Persistence failures also throw; a failed completion write can leave a pending
run, and a failed run insert can leave an unreferenced snapshot. No retries or
background recovery are introduced in this pass.

The deterministic development provider returns INSUFFICIENT_DATA for insufficient
seven-day evidence, REVIEW_CREATIVE for elevated frequency, and HOLD otherwise.
Its confidence of 1 expresses rule certainty, not calibrated outcome probability;
questions are recorded but do not change its fixed rules. The interface also
supports REDUCE_BUDGET and PAUSE_DELIVERY_UNIT. These are decision labels only:
the engine does not create proposals or invoke execution. The optional Jev adapter
below uses the same interface. No application route or automatic action is connected.

## Jev adapter

`providers/JevDecisionProvider.ts` implements TypeSafe's documented
[System One API](https://docs.typesafe.ai/api). It is marked `server-only` and
reads configuration when instantiated. Use only server environment variables:

| Variable | Default / requirement |
| --- | --- |
| `JEV_API_KEY` | Required; bearer credential, never `NEXT_PUBLIC_*` |
| `JEV_API_URL` | `https://api.typesafe.ai/v1/systemone`; HTTPS, no embedded credentials/query/fragment |
| `JEV_MODEL_ID` | `jev-1.13.0`; pinned `jev-X.Y.Z` version required |
| `JEV_TIMEOUT_MS` | `10000`; integer 100-30000, per attempt including body read |
| `JEV_MAX_RETRIES` | `1`; integer 0-2, in addition to the initial attempt |

```ts
import { DecisionEngine } from '@/lib/server/decisions/DecisionEngine';
import { JevDecisionProvider } from '@/lib/server/decisions/providers/JevDecisionProvider';

// authorizedClient is the existing server client authorized for this business.
const engine = new DecisionEngine(authorizedClient, new JevDecisionProvider());
const result = await engine.evaluate({
  businessId, platformIntegrationId, snapshot,
  questions: ['What should be reviewed for this delivery unit?'],
});
```

Request schema V1 uses one `choice` question, `delivery_decision_v1`, with the
five supported decisions as criteria. Caller questions become its considerations.
State includes feature windows, comparisons, evidence qualifiers, date, currency,
and schema versions; internal business/account/ad-set IDs are omitted. Canonical
key ordering makes identical inputs produce identical request bodies and hashes.
Bump `JEV_QUESTION_SCHEMA_VERSION` and the question ID when changing its semantics.

The response must report the configured pinned model, the expected choice answer,
all five finite probabilities in [0,1], a sum within 1e-6 of one, and a selected
maximum-probability option. Confidence is preserved separately from probability.
Model/version metadata matches the unchanged engine identity checks; provider
version `1` denotes our adapter release, not an undocumented upstream release.
See TypeSafe's [model version guidance](https://docs.typesafe.ai/models).

Audit data retains the validated model, answer, probabilities, confidence, token
usage, sanitized request ID, attempt count, request hash and schema versions.
Undocumented fields, request auth headers and upstream error bodies are discarded.
Jev does not supply free-text rationale in this contract; none is invented.

Transport failures, timeouts, HTTP 408/429/500/502/503/504/529 use bounded
exponential backoff starting at 250ms. Retry-After seconds/dates are respected;
delays over five seconds fail rather than retry early. Defaults allow at most
two 10-second attempts and a five-second delay. Retries may incur additional
provider inference charges. Redirects are disabled. Authentication failures,
malformed responses, unsupported decisions and invalid probabilities are not
retried. All exhausted/invalid calls throw, and the existing engine records a
failed run. There is no LLM fallback or advertising action path.

Run `npm test -- src/lib/server/decisions/providers/JevDecisionProvider.test.ts`.
These tests mock HTTP and credentials; they do not validate live account access
or model availability. Configure credentials before server-side use.

The six tables in `ai` store snapshots, provider decisions, proposed actions,
execution audit records, measured outcomes, and one autonomy policy per business.
`repository.ts` accepts the existing `SupabaseClient<Database>` and requires an
explicit business scope. It does not construct privileged clients, invoke Meta,
evaluate policies, approve work, or execute actions. Callers must authorize the
business before passing a service-role client. Lists are capped at 100 rows.

## Migration

Apply `supabase/migrations/20261006000000_add_v2_decision_persistence.sql` through
the normal reviewed deployment process. It requires the existing `ai` schema,
`public.business_profiles`, `public.platform_integrations`, `public.ad_accounts`,
and `public.is_org_member(uuid)`. This repository has no baseline migrations;
do not reset a production database or attempt to reconstruct its schema from
the generated TypeScript file. No remote migration is applied by these tests.

Foreign keys preserve audit lineage (no cascade deletes). Every child references
its parent's business and ID together. A snapshot trigger validates that its
integration and ad account belong to the business and share a platform. Entity
IDs are opaque platform IDs because entity types may expand beyond Meta ad sets.
The snapshot helper copies identity and schema version from `FeatureSnapshot`.

Authenticated organization members can read their business records through RLS.
Anonymous access and authenticated writes are denied. Writes require a trusted
server/service-role client. These permissions intentionally do not introduce a
browser approval endpoint. Redact credentials/tokens from provider responses,
request metadata and errors before storage; these records are member-readable.

Autonomy defaults to `off`, no allowed actions, and a zero budget-change limit.
Proposals default to requiring approval and unknown risk. Configuration JSON
remains flexible; saving a policy does not enable any execution behavior.
`upsertAutonomyPolicy` supplies the desired policy; omitted fields use database
defaults. Budget boundary currency/period and cooldown/evidence semantics will
be validated by future policy consumers. Confidence is nullable and otherwise
in [0, 1]. Each execution may have one outcome per positive horizon in hours.
Multiple execution records per proposal can record attempts; no execution
idempotency or state-transition engine is implied by these persistence helpers.

## Types and tests

`src/lib/shared/types/decisionPersistence.ts` provides additive local table
bindings composed into `Database.ai.Tables`. Existing generated schema contents
are preserved. After deploying, `npm run types:supabase` can regenerate the full
bindings from the real database; reconcile/remove the overlay only after the six
tables appear in generated output. Do not regenerate from test fixtures.

Run `npm test -- src/lib/server/decisions` for repository transport tests and
PGlite tests of the actual SQL migration. PGlite uses a small test-only fixture
for pre-existing dependencies; it is not a production schema migration. Tests
cover tenant boundaries, RLS/grants, defaults, constraints and error propagation.
They require neither Docker nor live Supabase/Meta credentials.
