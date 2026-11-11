# Ask DeepVisor

> **Currently hidden:** the floating "Ask DeepVisor" launcher was removed from
> `AiAssistantDrawer.tsx`, so the drawer has no entry point. Restore the launcher button
> to re-enable it.

The existing docked [assistant](../../../../components/layout/AiAssistantDrawer.tsx)
uses the official installed OpenAI SDK and Responses API through
[`openai/conversation.ts`](../../openai/conversation.ts). It replaces the route's
old keyword classifier; the legacy `service.ts` remains for compatibility.

## Configuration

Server-only environment variables:

```dotenv
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-6-luna
OPENAI_REASONING_EFFORT=low
```

`gpt-6.1-terra` is an explicit optional evaluation alternative. There is no automatic
model fallback. Existing assessment/queue model configuration is unchanged.

[`config.ts`](./config.ts) owns the following bounded overrides:

| Variable | Default |
| --- | ---: |
| `OPENAI_ASSISTANT_OUTPUT_TOKENS` | 1800 per response |
| `OPENAI_ASSISTANT_TIMEOUT_MS` | 25000 for the whole inference loop |
| `OPENAI_ASSISTANT_MAX_ROUNDS` | 4 |
| `OPENAI_ASSISTANT_CONVERSATION_REQUESTS` | 40 |
| `OPENAI_ASSISTANT_CONVERSATION_TOKENS` | 300000 |
| `OPENAI_ASSISTANT_BUSINESS_DAILY_REQUESTS` | 200 |
| `OPENAI_ASSISTANT_BUSINESS_DAILY_TOKENS` | 2000000 |
| `OPENAI_ASSISTANT_BUSINESS_REQUESTS_PER_MINUTE` | 10 |

The service reserves a conservative upper bound before inference, including tool
and output schemas. Successful requests settle to observed input/output tokens;
failed or uncertain requests retain their reservation. Cached input is still part
of token quotas. Usage includes reasoning output tokens and estimated standard USD
cost, not billing guarantees. Prices are pinned estimates verified against the
[Luna](https://developers.openai.com/api/docs/models/gpt-6-luna) and
[Terra](https://developers.openai.com/api/docs/models/gpt-6.1-terra) model pages on
2026-11-04. Regional, cache-write and service-tier charges may differ.

## Boundaries and flow

1. `/api/intelligence/assistant` verifies the session, business membership and
   selected Meta account. The browser cannot choose a different tenant.
2. A service-only `claim_assistant_turn` transaction locks the conversation and
   reserves business/conversation quotas. Revision checks reject competing tabs;
   the five-minute lease recovers abandoned server requests.
3. The Responses loop supplies the latest 12 messages and the current structured
   proposal. Each of the typed [read tools](./tools.ts) independently checks
   authorization and uses bounded, explicitly scoped saved-data queries.
4. Strict JSON-schema output is validated again with Zod. React renders typed
   fields and account-resolved creative cards, never model HTML or supplied URLs.
5. **Keep these edits** persists a modified proposal. **Save draft** requires an
   explicit confirmation checkbox and validates the full submitted proposal,
   source hierarchy, creative ownership, schedule and existing budget guardrails.
6. [`draft.ts`](./draft.ts) reuses the campaign draft repository, scoped reuse source
   lookup and deterministic organizer naming engine. Drafts are `PAUSED` and
   `reviewRequired`; no Meta write/execution code is reachable from these tools.

Existing campaigns/ad sets are represented by native Meta IDs, checked against
the selected account. This is a review draft targeting an existing entity, not a
claim that live configuration has been updated. The current builder supports lead
objectives; unsupported objectives are rejected instead of silently converted.
Missing coordinates, destination setup and media remain explicit review items.
Budget durations use elapsed 24-hour days, matching the existing reuse service;
the start is an explicit offset-bearing timestamp. Naming dates use account time.

## Evidence and limitations

Tools read saved Supabase data, not live Meta Insights. Responses include source
dates and coverage. Defaults require three compatible observations and keep daily
and lifetime budgets separate. Only campaign-owned budgets are sampled; ad-set
budgets are not summed into guessed campaign budgets. Currency scaling is currently
verified for USD/CAD/EUR/GBP/AUD/NZD; other historical budget defaults are unknown.
Comparable objectives and optimization goals are required. Saved monthly ranges
are preferences, not an exact campaign budget or a currency-verified limit.

History is bounded to 50 campaigns, 100 ad sets, 20 recent creatives and 20
highest-spend historical ad summaries. Audiences aggregate repeated known settings.
Different result definitions and historical windows must remain separate; creative
concept quality and causal superiority are not inferred from delivery totals.
Historical creatives returned by analytics tools are resolved by ID within the authorized account.

## Persistence, media and privacy

Migration `20261105050106_assistant_conversations.sql` adds private conversation
and usage tables, a service-only quota RPC, and a private draft-media bucket.
It was applied to development project `gkdyyjqepzayjdpvqnja`; production needs its
normal reviewed migration/deployment. The generated types include these objects.
There are no schedules, advertising changes or production configuration changes.

Conversations are private to user + business + account and survive navigation,
panel closure and reload. Up to 80 messages are retained in application state.
**Clear conversation** removes messages/proposals and unreferenced attachments;
saved campaign drafts and usage counters remain. Clearing does not bypass business
quotas. Account/business deletion cascades conversation and usage rows. Saved media
retention/cleanup after account deletion still needs an operator policy; storage
objects do not cascade with database foreign keys.

OpenAI requests explicitly set `store:false`; application conversation state is
not delegated to OpenAI Conversations or response IDs. Encrypted reasoning items
are replayed only within one tool loop, not persisted. This does **not** imply Zero
Data Retention: [OpenAI abuse-monitoring retention](https://developers.openai.com/api/docs/guides/your-data)
still depends on the organization's data controls. Credentials, raw integration
records, private contact fields and signed creative URLs are not included in prompts.

Private JPEG/PNG/WebP/MP4/WebM attachments are limited to four files, 4 MB each.
The existing builder had no durable media uploader, so a focused Supabase Storage
adapter reuses the existing server client. Signatures and MIME types are checked;
authenticated server downloads verify account and conversation/draft ownership.
Files are retained with the saved draft and linked in the existing builder. They
are not sent to Meta or OpenAI, and no visual analysis is claimed. Large/resumable
video upload is outside this first pass.

## Verification

```sh
npm test -- src/lib/server/intelligence/assistant src/lib/server/openai/conversation.test.ts
npm run typecheck
npm test -- --maxWorkers=4
npm run lint
npm run test:architecture
npm run check:architecture
npm run build
```

Tests use mocked provider/tools and PGlite; no real customer account writes are
needed. Browser check: open Ask DeepVisor, describe an ad, fill missing values,
modify the budget, review the typed preview, confirm and save. Reopen the panel,
navigate, and reload to verify persistence. Switch accounts to verify separation.
Use disposable synthetic accounts for save/upload exercises. Clear only test-owned
conversations. Test desktop docking/keyboard resizing and the mobile overlay.

## Read-only performance intelligence

[`analytics.ts`](./analytics.ts) registers four strict tools alongside the existing
planning tools: `getAccountPerformance`, `getPerformanceRankings`,
`getPerformanceBreakdown`, and `getStoredFindings`. Every invocation reauthorizes
the current user/business/selected account before reading or using the per-turn
memo. There is no cross-tenant/global assistant data cache and no Meta API call.
The existing Responses loop rejects repeated lookups and bounds rounds/output.
Reads use stable paginated queries, at most 10,000 observations per lookup; custom
ranges are limited to 90 days. Model inputs receive compact aggregates, at most
five ranked entities / twenty snapshot segments; the existing output byte cap
omits whole rows with an explicit truncation notice.

Source of truth:
- `report_entity_daily_v`, scoped by business + account + level + dates, feeds
  shared `aggregateReportMetrics`, `reportMetricDelta` and metric formatting.
  Account totals use ad-set observations, matching Overview's saved-data scope.
- `meta_audience_breakdowns_daily` is a **snapshot** view. Exact `first_day`/`last_day` matches are preferred; otherwise the latest valid
  dated snapshot is returned with actual coverage and a visible requested-period
  limitation. Windows are never merged. Publisher/window filtering precedes Reports'
  parent/child level selection and `buildSnapshotBreakdown`. Unknown dates are not inferred.
- `meta_hourly_performance` uses advertiser-local ad-set observations and the
  shared `buildTimeAnalysis`. Missing hours remain absent, not zero.
- Existing trend-finding repository supplies dated, scoped evidence. Saved entity
  raw data supplies native learning state; an individual ad uses its parent ad
  set. No elapsed-time estimate, health score or learning percentage is invented.

Today returns its accumulated totals plus the previous seven completed days'
daily average. Comparisons reuse the dashboard's `todayEligible` and
`DEEPVISOR_KPI_TODAY_CUTOFF` (default `20:00`). They require current observations
within ten minutes, a valid currency and complete observed entity-day coverage.
7D/30D include today and compare with preceding non-overlapping windows, with an
explicit partial-day caveat. Completed historical windows use a 24-hour freshness
gate for comparison indicators. Baseline averages divide additive totals by
calendar days; ratios stay aggregate ratios. Missing coverage disables averages
or changes, not the recorded totals. Coverage describes observed entities and
cannot certify that every account entity has been ingested.

Results follow the existing dashboard contract: leads + conversations + call
actions. Separate fields and aggregate cost per lead are supplied. Mixed outcomes
and objectives cannot form a result-efficiency ranking; explicit leads/messages/
calls metrics are supported. Rank means observed metric ordering, not causal
creative quality or a health verdict. Creative IDs resolve to real account-scoped
previews, including historical creatives beyond the recent-history list.

Known stored-data limits:
- Daily publisher history is **not persisted**. Facebook/Instagram daily metrics,
  baselines and rankings return unavailable instead of combined values. Exact-window
  publisher delivery snapshots remain supported. The UI's period/publisher filters
  are passed as defaults; explicit requests and conversational follow-ups win.
- Snapshot placement/publisher metrics are delivery-only. Audience/geographic
  results are returned only if measurements exist. A demographic snapshot without
  publisher scope cannot answer a Facebook/Instagram-only question.
- Stored hourly observations have no publisher dimension. No missing conversions,
  hours, reach or frequency are reconstructed. Period-unique reach/frequency remain
  unavailable from these overlapping reporting sources.
- No general industry benchmark or minimum-sample health threshold is invented;
  relevant saved findings provide existing intelligence context.

The server derives optional validated [`AnalyticsBlock`](../../../shared/assistant/analytics.ts)
UI data directly from tool results. The model chooses whether to request a visual,
not its numeric values. Cards, change directions, expandable daily spend and
source notes persist with their message. Plain text remains model-generated and
should be evaluated against returned evidence; structured output is not a factual
guarantee. No publishing/execution imports, schema changes, schedules or migrations
were added for this layer.

## Conversational evidence and rendering

The strict model reply now contains `message`, `visuals`, `insights`,
`suggestedFollowUps`, and `metadata`, alongside existing planning fields. Visuals
select a source ID, predefined component kind and metric keys. Insights select
verified observation IDs. Metadata selects source IDs. The server rejects unknown
references and resolves all values itself via [`evidence.ts`](./evidence.ts).
No HTML, chart data or provenance supplied by the model is rendered.

The evidence layer describes existing gated comparisons; it does not calculate
another set of metrics or introduce a new health score. Today requests load a
shared 14-day saved-data window and derive Today and rolling 7D context using the
same `performanceAnswer` function. The main Today calculation still uses only its
own current/baseline window. A preliminary comparison after the existing account
cutoff remains eligible when fresh and complete; partial today alone is not a
reason to reject it. Before cutoff, baseline values remain descriptive context.

Responses aim for 2–4 natural sentences, with longer explanations on request.
Critical limitations remain in the summary; routine technical details live in one
collapsed **Data details** disclosure. Neutral limitation observations are not
repeated as separate insight bullets. The model may select one or two useful KPI
tiles, a baseline comparison, a compact Mantine daily-spend chart, a ranking or
account-resolved creative previews. Source dates/currency/platform remain with the
message. Old persisted text/analytics messages still render without migration.

Message-specific suggested questions call the existing chat endpoint. Prior reply
period/platform scope is included in conversational history, but prior numbers are
explicitly not fresh evidence. Lookup/token/timeout controls are unchanged. The
prose remains generated language: reference validation protects structured
components and observations, not a proof that every free-text claim is correct.
Synthetic scenario tests cover opposite day/week directions, both improving,
insufficient baselines, cutoff eligibility, platform separation and invalid
references. No Meta writes or new migrations are involved.

### Compact analytics presentation

Ordinary performance replies now use a short evidence-derived interpretation;
explicit detailed/causal questions retain the longer model explanation. KPI visuals
show recorded results, spend and aggregate cost per result. Single known result
types receive specific labels; mixed results remain reported results.

`AssistantAnalytics` owns reusable metric-strip and trend-chart rendering. Daily
spend uses a compact zero-based column chart, with Results selectable only when
real daily observations exist. Currency-aware tooltips and an accessible daily
values table use the same validated payload. Missing results remain null. Source
limitations remain visible once; provenance stays in Data details. The Latest
control occupies a separate layout row instead of covering conversation content.

This layer changes presentation only; calculation, provider and synchronization
contracts are unchanged. Legacy persisted replies retain their original text.

Presentation validation (2026-11-06): 52 assistant tests passed, plus targeted
route checks; typecheck, production build and architecture checks passed. Lint
reported zero errors and 45 existing warnings. An authenticated local browser used
intercepted, clearly labeled fixture responses (no provider calls or saved-message
writes) at 320/380/500/650px and a 390px mobile drawer. Weekly bars and Results
switching, daily KPIs, comparisons, creative ranking with missing media, and
unavailable states were captured under `/tmp/dv-chat-visual/`. Real creative-image
loading and a manual screen-reader session were not verified in this iteration.


### Audience snapshot fallback

Audience queries no longer fail solely because the requested dates have no exact
snapshot. They prefer exact coverage, then choose the latest dated snapshot (latest
end date, then latest start date). `requestedRange` preserves the question’s dates;
`range` and `snapshotCoverage` describe the actual returned observations. A visible
coverage notice prevents the fallback from being presented as the requested week.
The assistant can summarize the available segments; comparisons are not invented.
Publisher restrictions, currency validation and overlap checks remain enforced.
Unknown-coverage records cannot be silently assigned dates. No new Meta requests,
daily history, migrations or synchronization behavior were introduced.
