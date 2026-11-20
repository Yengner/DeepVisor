# Core workflows

These sequences describe the checked-in call paths. They do not imply that hosted
schedules, inference providers or live execution are enabled. Authentication and
selected-account validation occur before privileged account reads; worker entry
points use their independent internal credentials and persisted job scope.

## 1. Meta connection and synchronization

```mermaid
sequenceDiagram
  participant U as Browser
  participant R as Integration routes
  participant M as Meta
  participant DB as Supabase
  participant W as Existing sync worker
  U->>R: Connect Meta
  R->>DB: Store one-time OAuth state
  R-->>U: Redirect to Meta
  M-->>R: Callback code and state
  R->>DB: Consume state; persist integration/token reference
  R->>M: Exchange/validate token; discover accounts
  R->>DB: Save accessible accounts
  R-->>U: Select account or continue single-account path
  U->>R: Select saved business-owned account
  R->>DB: Save primary selection; enqueue first history job
  R->>W: Process targeted job
  W->>M: Read dimensions, creatives and insights
  W->>DB: Persist observations and durable coverage/progress
  R-->>U: Return actual job/coverage state
```

Entry points: [`connect/[platform]`](../src/app/api/integrations/connect/[platform]/route.ts),
[`callback/[platform]`](../src/app/api/integrations/callback/[platform]/route.ts),
[`select-ad-account`](../src/app/api/integrations/meta/select-ad-account/route.ts).
[`integrations/service.ts`](../src/lib/server/integrations/service.ts) owns
`createOAuthState`, `consumeOAuthState`, `upsertPlatformIntegration`, token access,
account listing and primary selection. [`syncSelectedMetaAdAccount`](../src/lib/server/integrations/metaSelection.ts)
uses discovered server state, not an arbitrary browser account ID. The selection
route attempts the first targeted job and returns its actual status.

[`processMetaBackfillJobs`](../src/lib/server/sync/meta/processBackfillJobs.ts)
claims durable jobs. Initial history uses `processMetaFirstSyncJob`; other supported
types use `syncBusinessPlatform` → `syncMetaBusinessPlatform`. First history reads
recent data before older history. Queue/coverage operations live in
[`ad_accounts/syncState.ts`](../src/lib/server/repositories/ad_accounts/syncState.ts).

Refresh has three existing triggers sharing this infrastructure:

| Trigger | Entry and distinction |
| --- | --- |
| Manual | [`/api/sync/refresh`](../src/app/api/sync/refresh/route.ts) → `runManualBusinessSync`; selected account validation and separate manual cooldown. |
| App visit/focus | [`AutomaticMetaSync`](../src/components/integrations/AutomaticMetaSync.tsx) → [`automatic-refresh`](../src/app/api/sync/automatic-refresh/route.ts) → `enqueueAutomaticAccountSync`; durable account-local day/staleness checks. |
| Scheduled | [`scheduled-refresh`](../src/app/api/sync/scheduled-refresh/route.ts) → `enqueueScheduledAccountSyncJobs`; internal authorization, existing SQL eligibility/deduplication. |

[`dispatchAccountSync`](../src/lib/server/sync/dispatch.ts) performs targeted
post-response work and invalidates visible data. The authenticated
[`process-backfill-jobs` route](../src/app/api/integrations/meta/process-backfill-jobs/route.ts)
also schedules `drainShadowJobs` and `processActionOutcomes` with `after()`, even on
idle ticks. Edge [`processAccountSyncJobs.ts`](../supabase/functions/_shared/processAccountSyncJobs.ts)
forwards to it; `process_meta_backfill_jobs` is a compatibility function name.
Browser `router.refresh()` only reloads persisted views. Existing cron SQL is an
operator deployment procedure, not a setup command for this refactor.

### Webhook-triggered status reads and refresh

Purpose: distinguish webhook demand from authoritative Meta observations and performance
refresh. This addition is source-verified at `e9bf2cd`; the documentation branch's
application baseline remains older. See the [webhook contract](https://github.com/Yengner/DeepVisor/blob/e9bf2cd1bcc441a3b2ea9ad5c4cb3b5909640b02/src/lib/server/webhooks/README.md) at that pinned revision.
Hosted endpoint activation, Meta dashboard registration and real account subscription
are unverified; the source contract records local/synthetic verification only.

```mermaid
sequenceDiagram
  participant M as Meta
  participant A as Next.js routes
  participant D as PostgreSQL
  participant W as Existing resource worker
  participant B as Authorized browser
  M->>A: GET challenge / POST signed changes at /api/meta/webhooks
  A->>A: Feature gate, raw-body HMAC, size and JSON checks
  A->>D: Record deduplicated signal; resolve selected account scopes
  alt Refresh-triggering field and eligible account
    A->>D: Request events:v2 in existing account queue
    A-->>M: 200 after recording and queue request
    Note over A,W: after() dispatch; busy-account follow-up; existing worker fallback
    W->>D: Claim account job with lease generation
    W->>M: Re-read affected ads or full hierarchy
    M-->>W: Current status and issue evidence
    W->>D: Publish lifecycle / issues; complete event resource
    D-->>B: Private Realtime change signal
    B->>A: Re-read saved data through authorized APIs
  else Other field or ineligible account
    A-->>M: 200; stored-only or skipped demand
  end
  Note over A,D: Invalid signature: 401, no storage. Storage/queue error: 503; retry deduplicated
  Note over M,W: Event jobs do not fetch or replace performance metrics
```

| Signal | Implemented effect |
| --- | --- |
| `with_issues_ad_objects`, `in_process_ad_objects`, `creative_fatigue` | App-dashboard subscription field list; enqueue status/issue re-read. Fatigue is a notice, not an urgent issue on its own. |
| `effective_status`, `field_changed` | Parser also treats these as refresh triggers if delivered; this is not proof they are offered/configured as subscriptions. |
| Other fields | Stored only; no refresh/card from the delivery itself. |
| Budget, name, targeting and ordinary pause changes | Detected by subsequent observation diffs; no guaranteed immediate webhook coverage. Source contract says effective_status is not offered to this app. |

`DEEPVISOR_META_WEBHOOKS`, resource refresh and Insights gates must be configured
for the complete path. The endpoint uses the app secret for raw-body HMAC and a
separate verify token for GET; it does not rely on a browser session. Account matching
resolves business-owned selected accounts before queue admission. Deliveries contain
signals/short provider notices, never authoritative metrics.

One queued events job coalesces demand; arrivals during running work remain pending.
At most 25 known ads can use a targeted merge; unknown objects, parent-dependent
status, missing baseline or larger/mixed sets require a hierarchy read. Events
completion is lease-fenced and bypasses performance staging/publication. More than
20 event reads/account/hour defer further demand five minutes. Failure-backoff demand
can be skipped; later normal refresh remains necessary for reconciliation.

Manual, app-visit and scheduled performance refresh still use the existing queue
and their original eligibility/windows. A webhook is an additional **status** trigger,
not a new cron or a metrics-refresh guarantee. Subscription checks run within the
worker at most daily; disconnect preserves the subscription while another business
uses the same account. These routing writes are separate from advertising execution.

Realtime emits a private account-scoped change hint, not advertising facts. Clients
re-read through normal authorization; polling remains fallback and an open modal is
not replaced. Browser Realtime delivery and real Meta delivery remain unverified.
Events reads do not update `ad_entities.status`, so Campaigns can lag saved lifecycle
information until normal hierarchy maintenance. No inference or advertising executor
is invoked by the receiver.

Sources: [receiver](https://github.com/Yengner/DeepVisor/blob/e9bf2cd1bcc441a3b2ea9ad5c4cb3b5909640b02/src/app/api/meta/webhooks/route.ts),
[parser and field lists](https://github.com/Yengner/DeepVisor/blob/e9bf2cd1bcc441a3b2ea9ad5c4cb3b5909640b02/src/lib/shared/webhooks/meta.ts),
[ingestion](https://github.com/Yengner/DeepVisor/blob/e9bf2cd1bcc441a3b2ea9ad5c4cb3b5909640b02/src/lib/server/webhooks/meta.ts),
[resource worker](https://github.com/Yengner/DeepVisor/blob/e9bf2cd1bcc441a3b2ea9ad5c4cb3b5909640b02/src/lib/server/sync/resources/worker.ts),
[targeted/full observation logic](https://github.com/Yengner/DeepVisor/blob/e9bf2cd1bcc441a3b2ea9ad5c4cb3b5909640b02/src/lib/server/lifecycle/service.ts),
[subscriptions](https://github.com/Yengner/DeepVisor/blob/e9bf2cd1bcc441a3b2ea9ad5c4cb3b5909640b02/src/lib/server/webhooks/subscription.ts),
[Realtime hook](https://github.com/Yengner/DeepVisor/blob/e9bf2cd1bcc441a3b2ea9ad5c4cb3b5909640b02/src/lib/client/hooks/useAccountSignals.ts).
The [infrastructure ledger](SYSTEM_DIAGRAM.md#webhook-verification-addendum)
records current development schema/schedule evidence without asserting activation.

## 2. Ingestion through account intelligence

```mermaid
flowchart TD
  M[Meta hierarchy, creative and Insights reads] --> F[(Normalized entities and performance facts)]
  F --> A[Account assessment and trends]
  A --> S[(Assessments, signals and findings)]
  A -.->|optional summary| O[OpenAI structured adapter]
  S --> Q[Calendar queue, notifications and report context]
  F --> V[Overview, Campaigns and Reports read models]
  S --> V
  F --> L[Observed lifecycle and health evidence]
  L --> I[(Issues, lifecycle events and briefs)]
  I --> P[Immutable per-user Insights presentations]
  F --> P
  F --> J[Eligible sync completion: gated evaluation enqueue]
  J --> E[(Captured source rows, hash and evaluation job)]
  E --> B[Pure versioned feature calculation]
  B --> D[DecisionEngine and validated provider result]
  D --> JE[Jev DecisionProvider]
  D --> PO[Deterministic PolicyEngine via orchestration]
  PO --> R[(Proposal and policy audit)]
  R --> X[Separate approval and gated executor]
  X --> U[(Execution audit and observed outcomes)]
  classDef data fill:#f3eeff,stroke:#b9a6f0,color:#1b1f24
  class F,S,I,E,R,U data
```

[`sync/meta/fetch.ts`](../src/lib/server/sync/meta/fetch.ts) and
[`normalization.ts`](../src/lib/server/sync/meta/normalization.ts) handle provider
reads and shapes. `syncMetaCampaigns`, `syncMetaAdsets`, `syncMetaAds`,
`syncMetaAdCreatives` and `syncMetaPerformance` write normalized records; legacy
repository names/views retain compatibility contracts. Creative media follows Meta response → `ad_creatives`
→ [`exploration/model.ts`](../src/lib/server/campaigns/exploration/model.ts) / shared
media helpers → presentation. Ad-set card metrics remain ad-set metrics.

[`syncBusinessPlatform`](../src/lib/server/sync/syncBusinessPlatform.ts) invokes
`runMetaAdAccountAssessment`, `syncMetaAccountIntelligenceArtifacts`,
`syncMetaTrendIntelligenceArtifactsForQueueState` and `runBusinessAssessment` on its
eligible non-simulation path. Initial-history orchestration has its own completion
path in [`processFirstSyncJob.ts`](../src/lib/server/sync/meta/processFirstSyncJob.ts).
Assessment/trend code owns persisted digests/findings and existing queue artifacts;
it is distinct from versioned Feature Engine/DecisionEngine evaluations.

Account-level read composition starts at
[`intelligence/service.ts`](../src/lib/server/intelligence/service.ts). Current
Overview reads normalized persisted facts through
[`overview/load.ts`](../src/lib/server/dashboard/overview/load.ts), with decision
lineage in [`decisionRecords.ts`](../src/lib/server/dashboard/overview/decisionRecords.ts).
No provider is called by those Overview loaders. Optional missing evidence is
reported unavailable; a successful sync is not a completed decision evaluation.

The assessment branch and Jev branch have different ownership: assessment/trend
services own digests and workflow suggestions; versioned features and validated
runs own decision evidence. OpenAI summary failure can fall back to deterministic
assessment text; Jev failure produces a failed decision run, never a fallback HOLD.
[Assessment service](../src/lib/server/intelligence/assessments/service.ts),
[evaluation orchestration](../src/lib/server/decisions/shadow/service.ts).

Insights & Events is a third, deterministic saved-evidence path: no inference provider
or advertising executor. [Issue capture](../src/lib/server/insights/issues.ts) and
[lifecycle capture](../src/lib/server/lifecycle/service.ts) run within existing sync
work; failures preserve prior evidence instead of asserting resolution. Per-user
presentation receipts/reviews do not resolve underlying issues. Its
[contract](../src/lib/server/insights/README.md) owns flags, claims and delivery rules.
These arrows indicate derivation/calls, not FKs; physical lineage is in the
[ERDs](DATABASE_RELATIONSHIPS.md). Rates require compatible coverage and currency;
Feature V1 frequency uses summed daily reach, not unique period reach.

## 3. Features → decisions → policy

```mermaid
flowchart LR
  S[Completed Meta sync] --> Q[Opt-in evaluation enqueue and durable claim]
  Q --> F[buildFeatureSnapshot]
  F --> E[DecisionEngine]
  E --> P[DecisionProvider]
  P --> V[Identity and result validation]
  V --> D[Persist decision run]
  D --> R[Review or Shadow evaluator]
  R --> Y[PolicyEngine]
  Y --> A[Persist policy result and eligible proposal]
```

The historical name [`enqueueShadowAfterSync`](../src/lib/server/decisions/shadow/service.ts)
coordinates both separately gated Shadow and Review modes. Enqueue RPCs snapshot
source facts/policy, source hash, cutoff and evaluation version. Claims reserve
snapshot/run/proposal IDs before inference; unchanged sources are deduplicated.
`drainShadowJobs` dispatches mode-specific workers. `runShadowJob` and
[`runReviewJob`](../src/lib/server/decisions/review/service.ts) recheck source freshness,
provider version and policy consistency, and append saved business objectives through
[`agencyQuestions`](../src/lib/server/agency/objectives.ts).

[`buildFeatureSnapshot`](../src/lib/server/features/buildFeatureSnapshot.ts) uses
explicit account-day input and 7/30-day windows plus prior comparisons. It does not
fetch, persist or infer. Shared calculations preserve V1 formulas and missing-data
handling. [`DecisionEngine.evaluate`](../src/lib/server/decisions/DecisionEngine.ts)
persists a pending run, invokes the injected provider, validates identity/JSON/result,
and persists completion or failure. Jev and the deterministic development provider
implement the same [`DecisionProvider`](../src/lib/server/decisions/types.ts).

[`evaluateShadowPolicy`](../src/lib/server/decisions/shadow/evaluate.ts) records
actual SHADOW and counterfactual REVIEW outcomes without Meta writes.
[`evaluateReviewPolicy`](../src/lib/server/decisions/review/evaluate.ts) uses read-only
current Meta state for action recommendations. [`PolicyEngine.evaluate`](../src/lib/server/decisions/policy/PolicyEngine.ts)
checks evidence, scope, freshness, budget ownership/limits, locks and action history.
It does not perform persistence or HTTP. HOLD and INSUFFICIENT_DATA are valid
decisions; malformed/provider failures cannot be converted into either.

## 4. Recommendation → approval → execution → outcome

```mermaid
sequenceDiagram
  participant U as Owner/admin
  participant R as Review action
  participant DB as Persisted lineage/policy
  participant X as Executor
  participant M as Meta adapter
  U->>R: Approve exact displayed fingerprint
  R->>DB: Revalidate scope, policy, evidence and pending version
  R->>DB: Save review only
  U->>X: Separate explicit execute request
  X->>DB: Atomic claim and history
  X->>M: Fresh before-state reads
  X->>X: Revalidate fingerprint and PolicyEngine
  X->>DB: Durable pre-write checkpoint
  X->>M: Single authorized field write
  X->>M: Readback
  X->>DB: Verified result or unresolved audit/claim
  DB-->>DB: Later worker measures observed outcomes
```

[`reviewDecisionAction`](../src/app/(root)/decisions/actions.ts) calls
[`reviewProposal`](../src/lib/server/decisions/reviewProposal.ts), which rechecks
owner/admin role, business, snapshot target, policy and execution absence. Its
optimistic pending/updated-at update binds the review to
[`approvalFingerprint`](../src/lib/server/decisions/approval.ts). Approval does not
enqueue execution.

[`POST /api/decisions/proposals/[proposalId]/execute`](../src/app/api/decisions/proposals/[proposalId]/execute/route.ts)
validates session/origin/role and calls `executeMetaProposal` → `ReviewExecutor` →
`MetaActionAdapter`. It accepts proposal identity, not browser credentials or an
arbitrary budget payload. All environment/business policy gates, claim/idempotency,
locks, cooldowns, before-state and readback checks remain required. Unknown writes
are not replayed; use the [operator reconciliation contract](../src/lib/server/advertising/README.md).
Limited Auto has a separate internal route and independent gates; normal Review
and Shadow processing never enables it.

[`processActionOutcomes`](../src/lib/server/decisions/outcomes/service.ts) invokes
`ai.process_action_outcomes`. Successful executions and completed Shadow runs have
distinct source lineage. Measurements use equal completed hourly windows for
1/6/24/72-hour horizons. Missing coverage remains pending/insufficient/unavailable,
and completed observations are immutable. See [outcome semantics](../src/lib/server/decisions/outcomes/README.md)
for DST, currency and attribution limitations.

## 5. Organize → preview → approve → rename → restore

[`campaigns/organize/actions.ts`](../src/app/(root)/campaigns/organize/actions.ts)
is the existing server-action boundary. Every workflow reauthorizes selected-account
and business scope through `organizerScope`.

```mermaid
flowchart LR
  C[Consent and inspect] --> B[Immutable baseline and source snapshot]
  B --> D[Deterministic naming draft]
  D --> S[Save version after stale-state check]
  S --> P[Fresh rename preview]
  P --> A[Exact fingerprint approval]
  A --> E[Separate execute and readback]
  E --> H[Immutable events/history]
  H --> R[Verified restoration draft with lineage]
  R --> S
```

[`organizer/service.ts`](../src/lib/server/organizer/service.ts) owns `inspect`,
`history`, `save` and synchronized capture. Active sync or a changed sync completion
blocks capture; saving compares source names/hierarchy/creative associations.
The first baseline remains preserved; each version retains its own source snapshot.
[`shared/organizer/model.ts`](../src/lib/shared/organizer/model.ts) owns naming and
validation; dates and conceptual similarities are not invented by AI.

[`renaming.ts`](../src/lib/server/organizer/renaming.ts) owns `previewRename`,
`approveRename`, `executeRename`, `reconcileRename`, `restoreRename` and history.
[`renamePlan.ts`](../src/lib/shared/organizer/renamePlan.ts) builds the exact selected
changes; approvals cover one to five names and expire after 15 minutes. Fresh
observations, source version, account/business and provider mode are fingerprinted.
The service-only `organizer_approve` and `organizer_claim` RPCs protect immutable
approvals, duplicate submissions and business locks shared with advertising execution.

[`advertising/organizer/execute.ts`](../src/lib/server/advertising/organizer/execute.ts)
records intent before each name-only write and verifies each readback. Uncertain
results stay locked; explicit reconciliation is read-only. Restoration requires
verified prior results and a current state matching that readback. It creates a new
unselected proposal with lineage, then repeats save/preview/approval/execution;
it never blindly overwrites later external edits. Details and residual Meta
compare-and-set limitations live in [PHASE2.md](../src/lib/server/organizer/PHASE2.md).

## 6. Agency requests and available capabilities

[`/agency`](../src/app/(root)/agency/page.tsx) composes selected-account Overview
facts and persisted Decisions. It does not start inference, a sync job or an ad
write on page load. Its review controls call the existing Decisions action.
[`loadBusinessObjectives`](../src/lib/server/agency/loadObjectives.ts) and
`agencyQuestions` add known profile preferences to Review/Shadow questions; goals
are intent, not policy authorization or verified bookings.

The existing [`AiAssistantDrawer`](../src/components/layout/AiAssistantDrawer.tsx)
has its launcher removed in this checkout. Its backend
[`/api/intelligence/assistant`](../src/app/api/intelligence/assistant/route.ts)
uses authorized, quota-reserved conversation turns and the OpenAI Responses loop
in [`openai/conversation.ts`](../src/lib/server/openai/conversation.ts).
Typed tools read selected-account saved data; evidence references are validated
before rendering. Explicit save requests create review-required paused drafts
through the existing draft repository. Tools do not publish or execute Meta writes.
Eligible analytics requests can request a gated background refresh through
[`assistant/freshness.ts`](../src/lib/server/intelligence/assistant/freshness.ts);
the current answer still uses saved evidence dates, not promised fresh measurements.
The older keyword-based `service.ts` is compatibility code, not this route's handler.
See the [assistant contract](../src/lib/server/intelligence/assistant/README.md).

No autonomous live campaign creation or arbitrary conversational account edits
are implied by either surface. Add future capabilities through
existing authorization/domain/adapter boundaries described in the
[development guide](DEVELOPMENT_GUIDE.md).
