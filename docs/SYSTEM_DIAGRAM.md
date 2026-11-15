# System diagram and verification evidence

[Open the editable draw.io diagram](system-overview.drawio).

Source-verified on 2026-11-12. Arrows show logical control/data dependencies,
not deployment topology or immediate execution. Supabase owns persistence/auth;
Next.js owns UI and application workflows.

| Path | Source evidence |
| --- | --- |
| Business/account authorization | [Context](../src/lib/server/actions/app/context.ts), [selection](../src/lib/server/actions/app/selection.ts); APIs authorize independently |
| Sync → Meta observations | [Dispatch](../src/lib/server/sync/dispatch.ts), [worker](../src/lib/server/sync/meta/processBackfillJobs.ts), [fetch](../src/lib/server/sync/meta/fetch.ts) |
| Persisted facts → read models | [Overview](../src/lib/server/dashboard/overview/load.ts), [decision lineage](../src/lib/server/dashboard/overview/decisionRecords.ts) |
| Features → engine → policy | [Builder](../src/lib/server/features/buildFeatureSnapshot.ts), [engine](../src/lib/server/decisions/DecisionEngine.ts), [Review workflow](../src/lib/server/decisions/review/service.ts), [policy](../src/lib/server/decisions/policy/PolicyEngine.ts) |
| Jev inference | [Adapter](../src/lib/server/decisions/providers/JevDecisionProvider.ts); engine validates identity and persists failures |
| Approval → separate execution | [Approval](../src/lib/server/decisions/approval.ts), [entry](../src/lib/server/advertising/executeMetaProposal.ts), [executor](../src/lib/server/advertising/ReviewExecutor.ts) |
| Audit → observational outcomes | [Processor](../src/lib/server/decisions/outcomes/service.ts), [contract](../src/lib/server/decisions/outcomes/README.md) |
| Assistant → saved evidence / paused drafts | [Route](../src/app/api/intelligence/assistant/route.ts), [tools](../src/lib/server/intelligence/assistant/tools.ts), [draft save](../src/lib/server/intelligence/assistant/draft.ts) |
| Assistant → gated background refresh | [Freshness](../src/lib/server/intelligence/assistant/freshness.ts); current answers retain saved evidence dates |
| Organizer → name-only execution | [Orchestration](../src/lib/server/organizer/renaming.ts), [executor](../src/lib/server/advertising/organizer/execute.ts) |

## Limits

DecisionEngine evaluates/persists; orchestration invokes policy and stores proposals.
Inference and approval do not execute advertising changes. The diagram summarizes
Review; Shadow and Limited Auto retain separate contracts/gates. Organizer
restoration creates a new proposal, omitted here for readability.

The assistant launcher is removed in
[AiAssistantDrawer](../src/components/layout/AiAssistantDrawer.tsx); its implemented
backend is not proof of reachable UI. The old keyword service is compatibility
code. Separate assessment inference and Reports/Calendar compatibility paths are
covered in [Flows](FLOWS.md).

No live provider calls, database inspection, deployment inspection or advertising
writes verified this diagram. Hosted schedules, provider configuration, deployed
RLS and enabled gates remain unverified. Historical audit results are dated evidence,
not this pass's test results. This documentation-only pass validates local links,
diagram generation and whitespace; application tests/typecheck/build are not rerun.
