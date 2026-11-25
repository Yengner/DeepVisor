# Codebase map

Start with [Architecture](ARCHITECTURE.md) for boundaries, [Flows](FLOWS.md) for
call chains, and [Development](DEVELOPMENT_GUIDE.md) for safe local verification.
Source links below are relative to this checkout except explicitly commit-pinned additions.

## Repository ownership

| Directory/file | Contents and placement rule |
| --- | --- |
| [`src/app`](../src/app) | Next layouts, pages, route handlers and route-owned actions/components. Route groups such as `(root)` do not appear in URLs. |
| [`src/components`](../src/components) | Reusable presentation grouped by product area: campaigns, integrations, layout, product, design, brand, UI and marketing. Keep calculations out of large components. |
| [`src/lib/client`](../src/lib/client) | Browser Supabase/auth, notifications, hooks and toasts. No service-role clients or provider credentials. |
| [`src/lib/shared`](../src/lib/shared) | Stable DTOs, naming rules, report models, media utilities and pure performance calculations. Prefer narrow imports over the root barrel. |
| [`src/lib/server/actions`](../src/lib/server/actions) | App/business/user context, selection, onboarding/settings and explicit server actions. Not every file here is a client-callable action. |
| [`src/lib/server/supabase`](../src/lib/server/supabase) | Request-cookie, privileged and proxy session clients. |
| [`src/lib/server/auth`](../src/lib/server/auth) | Post-auth redirect decisions and authentication regression tests. |
| [`src/lib/server/integrations`](../src/lib/server/integrations) | OAuth, connection/token lifecycle, account discovery/selection, Meta adapter and explicitly gated simulation. |
| [`src/lib/server/sync`](../src/lib/server/sync) | Manual/visit/scheduled enqueue, dispatch, Meta reads, normalization and workers. |
| [`src/lib/server/repositories`](../src/lib/server/repositories) | Active entity/performance persistence, sync state, report loading; shared pagination lives here. |
| [`src/lib/server/services/platforms`](../src/lib/server/services/platforms) | Existing provider read helpers, still referenced by integration/action paths. |
| [`src/lib/server/features`](../src/lib/server/features) | Versioned snapshot contract and pure builder; runtime inputs supplied by caller. |
| [`src/lib/server/intelligence`](../src/lib/server/intelligence) | Assistant, notification/report records, and dormant legacy assessment, signal, trend and calendar engines. Read its README first. |
| [`src/lib/server/agency`](../src/lib/server/agency) | Business objectives/context added to evaluations; Agency composition documentation. |
| [`src/lib/server/decisions`](../src/lib/server/decisions) | Provider-neutral engine, validation, persistence, read surfaces, approval, Review/Shadow workers, policy and outcomes. |
| [`src/lib/server/advertising`](../src/lib/server/advertising) | Explicit execution, Meta write adapters and Limited Auto. No UI or inference ownership. |
| [`src/lib/server/organizer`](../src/lib/server/organizer) | Retired. Only the tests that protect the preserved Organizer tables and a note remain. |
| [`src/lib/server/campaigns`](../src/lib/server/campaigns) | Draft and reuse workflows, budget guardrails, table delivery and visual exploration. |
| [`src/lib/server/dashboard`](../src/lib/server/dashboard) | Current `overview` and insight read models, cached account/platform identity loaders and report breakdown builders. |
| [`src/lib/server/reports`](../src/lib/server/reports) | Request/access handling, report DTO compatibility, demo data, CSV/PDF rendering and archived exports. |
| [`src/lib/server/openai`](../src/lib/server/openai) | Structured assessment/provider transport and its server configuration; separate from Jev. |
| [`src/lib/server/sdk`](../src/lib/server/sdk) | Existing Meta SDK client setup; not the decision/execution abstraction. |
| [`src/lib/shared/performance`](../src/lib/shared/performance) | Rate derivation, daily aggregation and assessment signal heuristics reused by Features and compatibility repositories. |
| [`src/lib/shared/reports`](../src/lib/shared/reports) | Report metrics/types, coverage, time analysis, comparison and export models. Fixture dependency exception is documented in the audit. |
| [`supabase/migrations`](../supabase/migrations) | Incremental schema/RLS/RPC changes. Existing remote schema has prerequisites absent from this history. |
| [`supabase/functions`](../supabase/functions) | Deno queue/worker/calendar forwarding functions; excluded from application TypeScript checks. |
| [`supabase/cron`](../supabase/cron), [`supabase/maintenance`](../supabase/maintenance), [`supabase/tests`](../supabase/tests) | Operator SQL/runbooks and RLS verification. Do not execute them as ordinary setup. |
| [`scripts`](../scripts) | Type generation, isolated fixture/browser verification, reporting/design tools, and architecture checks. Inspect each script's side effects before running. |
| [`public`](../public) | Static media/fonts/brand assets. |
| [`docs`](.) | Maintained handbook plus ignored local evidence. Root README links here; module READMEs own detailed contracts. |

## Where workflows enter

| Work | Entry point → implementation |
| --- | --- |
| Login/session/onboarding | [`api/auth`](../src/app/api/auth), [`onboarding`](../src/app/onboarding) → [`actions/business/onboarding.ts`](../src/lib/server/actions/business/onboarding.ts), [`actions/app/context.ts`](../src/lib/server/actions/app/context.ts) |
| Business/profile/preferences | [`settings`](../src/app/(root)/settings) → [`actions/user/settings.ts`](../src/lib/server/actions/user/settings.ts), [`settingsProfile.ts`](../src/lib/server/actions/user/settingsProfile.ts) |
| Connect/select Meta | [`api/integrations`](../src/app/api/integrations) → [`integrations/service.ts`](../src/lib/server/integrations/service.ts), [`metaSelection.ts`](../src/lib/server/integrations/metaSelection.ts) |
| Refresh/worker | [`api/sync`](../src/app/api/sync), [`process-backfill-jobs`](../src/app/api/integrations/meta/process-backfill-jobs/route.ts) → [`sync/meta/processBackfillJobs.ts`](../src/lib/server/sync/meta/processBackfillJobs.ts) |
| Current Overview | [`dashboard/page.tsx`](../src/app/(root)/dashboard/page.tsx) → [`overview/load.ts`](../src/lib/server/dashboard/overview/load.ts), [`decisionRecords.ts`](../src/lib/server/dashboard/overview/decisionRecords.ts), `model.ts`, `controlModel.ts` |
| Campaigns/explorer | [`campaigns/page.tsx`](../src/app/(root)/campaigns/page.tsx), [`api/campaigns/exploration`](../src/app/api/campaigns/exploration/route.ts) → [`campaigns/exploration/load.ts`](../src/lib/server/campaigns/exploration/load.ts) |
| Decisions/approval | [`decisions/page.tsx`](../src/app/(root)/decisions/page.tsx), [`actions.ts`](../src/app/(root)/decisions/actions.ts) → [`loadSurface.ts`](../src/lib/server/decisions/loadSurface.ts), [`reviewProposal.ts`](../src/lib/server/decisions/reviewProposal.ts) |
| Agency | [`agency/page.tsx`](../src/app/(root)/agency/page.tsx) → existing Overview/Decisions loaders; [`agency/objectives.ts`](../src/lib/server/agency/objectives.ts) supplies evaluation context |
| Assistant question | [`api/intelligence/assistant`](../src/app/api/intelligence/assistant/route.ts) → [`intelligence/assistant`](../src/lib/server/intelligence/assistant) tools, evidence, persistence and drafts |
| Approved advertising action | [`api/decisions/proposals/[proposalId]/execute`](../src/app/api/decisions/proposals/[proposalId]/execute/route.ts) → [`executeMetaProposal.ts`](../src/lib/server/advertising/executeMetaProposal.ts), [`ReviewExecutor.ts`](../src/lib/server/advertising/ReviewExecutor.ts) |
| Reports/export | [`reports/page.tsx`](../src/app/(root)/reports/page.tsx), [`api/reports`](../src/app/api/reports) → [`buildReportPayload.ts`](../src/lib/server/repositories/reports/buildReportPayload.ts), report renderers |
| Calendar/review/archive (dormant) | `/calendar` redirects. [`api/calendar`](../src/app/api/calendar) and review/archive pages remain without links; see the [intelligence README](../src/lib/server/intelligence/README.md) |
| Draft creation/reuse | [`campaigns/create`](../src/app/(root)/campaigns/create), [`api/campaign-drafts`](../src/app/api/campaign-drafts/route.ts), [`api/campaigns/reuse-draft`](../src/app/api/campaigns/reuse-draft/route.ts) → [`campaigns/drafts.ts`](../src/lib/server/campaigns/drafts.ts), `reuse.ts` |

## Webhook addition (`e9bf2cd`)

[src/app/api/meta/webhooks](https://github.com/Yengner/DeepVisor/blob/e9bf2cd1bcc441a3b2ea9ad5c4cb3b5909640b02/src/app/api/meta/webhooks/route.ts) owns gated
GET verification and signed POST ingestion; [server/webhooks](https://github.com/Yengner/DeepVisor/blob/e9bf2cd1bcc441a3b2ea9ad5c4cb3b5909640b02/src/lib/server/webhooks/README.md)
owns delivery deduplication, notices and account subscriptions. The existing resource
worker handles `events:v2` status reads. [useAccountSignals](https://github.com/Yengner/DeepVisor/blob/e9bf2cd1bcc441a3b2ea9ad5c4cb3b5909640b02/src/lib/client/hooks/useAccountSignals.ts)
consumes private Realtime hints; normal polling remains fallback. These are implemented
paths in the pinned revision, not proof of hosted enablement. See [Flows](FLOWS.md#webhook-triggered-status-reads-and-refresh).

## Active, compatibility and development surfaces

The navigation source is [`components/layout/navigation.tsx`](../src/components/layout/navigation.tsx):
Overview, Agency, Decisions, Campaigns, Connections and Settings are primary;
Reports, Profile and Notifications are secondary. Campaigns remains table-first.
Campaign creation, review and archive URLs remain routed.

[`shared/productAvailability.ts`](../src/lib/shared/productAvailability.ts) lists
features whose code is kept but hidden (adding an ad set or ad, alert preferences)
and what each needs before returning. Redirect-only pages keep old links working:
`/calendar`, `/campaigns/organize`, `/campaigns/intelligence/create`,
`/campaigns/intelligence/status`, `/onboarding/preparing` and `/settings/profile`.

Decision previews (`?preview=decisions`) are development-only presentation data.
Meta simulations are explicitly gated and restricted to synthetic
accounts. Reports have an explicit demo path. None is a fallback for missing live
evidence. `*.live.test.ts` and fixture/browser scripts require opt-in configuration;
the default test run skips those live suites.
