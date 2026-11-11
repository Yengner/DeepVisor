## Resource-aware mode

With `DEEPVISOR_RESOURCE_REFRESH=true`, Dashboard rendering makes **no Meta calls**.
`loadInsights` reads business/account-scoped `account_insight_snapshots`, published
by existing initial/manual/maintenance jobs under the shared API budget. Each
optional dataset is replaced atomically after a complete validated response;
failures preserve its previous payload and actual retrieval timestamp. The
worker obeys business history policy, caps daily publisher history at 60 days,
audience/hourly at 30, and limits each dataset to 100,000 observations. It does not
turn summary audience snapshots into daily rows. Daily audience and hourly charts
show independent retrieval times in Source & coverage.

Combined KPIs, trends and ad-set cards use canonical saved ad-set daily facts,
the same source level used by the assistant. Facebook/Instagram views retain their
own persisted publisher observations and retrieval time; they may be older than
combined metrics. Optional datasets refresh with maintenance (at most hourly for
active accounts, six-hour eligibility for background work) or explicit manual sync,
not on every light performance refresh. Comparisons retain existing evidence gates.
No new client provider path or independent queue is introduced.

The remainder describes the compatibility path when the feature gate is off.

# Overview read-through Meta Insights

`loadInsights(context)` receives the existing authorized Overview context. It uses
Next's Data Cache (`unstable_cache`, 300-second revalidation) and process-local
in-flight deduplication. Keys include business, internal/external account,
integration, account-local cutoff/timezone, currency and versioned breakdown scope.
Tokens are resolved only inside the server read and never appear in cache arguments
or browser DTOs. The source integration/account is verified before provider calls.

One daily 60-account-calendar-day window feeds Today/7D/30D and all publisher
controls. Publisher rows are selected directly; combined includes all returned
Meta publishers. This is delivery platform, not conversion destination. This path
performs read requests only, does not synchronize entities, and does not invoke
assessment/decision providers or execution. Existing shell synchronization remains.

Separate queries request:

- ad-set daily `publisher_platform`, including reported action families;
- account daily `publisher_platform,age,gender`;
- account daily `publisher_platform,hourly_stats_aggregated_by_advertiser_time_zone`,
  requesting delivery metrics and reported actions;
- native ad-set `learning_stage_info`.

Meta can reject these combinations or omit metrics. Each optional dataset fails
independently. Rejected publisher combinations try their combined-only age/gender
or hourly alternative. Those rows carry an explicit combined-only scope and are
excluded from Facebook/Instagram selections. Never substitute a combined query
in a filtered view. Missing actions are unknown; explicit empty action lists mean
no reported actions. Hourly Results uses reported leads, messaging conversations and calls. If Meta explicitly rejects the actions field, the hourly query retries with delivery fields only. Hourly cost per result divides total spend by reported results for each time cell. It requires a known currency and a positive result count.
Reach/frequency are not summed. Ratios are recomputed from compatible totals.
Learning recognizes native LEARNING/LEARNING_LIMITED/SUCCESS only; no progress or
elapsed-day estimate is invented. Advertising health remains the existing
persisted decision-evidence classification for the whole Meta ad set.

Next may serve previous cached data during revalidation; retrieval timestamps are
preserved and older responses say previously retrieved. Failed daily reads fall
back to labeled stored combined history. Filtered fallback is unavailable because
stored normalized daily facts lack publisher granularity. Failures cached for the
five-minute window provide backoff; the existing Meta client owns bounded transport
retries. Recovery/manual sync remains in freshness details and Connections.

The docked assistant reuses the existing authenticated assistant endpoint. It
analyzes saved context; it does not consume this publisher filter or execute account
changes. Filtered cards intentionally do not open the combined-history drawer;
Campaigns remains the route to inspect that history.

Validation: `npm test -- src/lib/server/dashboard/insights`, `npm run typecheck`,
`npm run lint`, `npm run check:architecture`, `npm run build`. Model tests cover
account-local DST boundaries, isolated publishers, ratios, gaps, unknown conversions,
native learning and sidebar limits. Loader tests use mocked providers/cache and
scoped clients. No synthetic actions or customer writes are used.

## Demographic and hourly charts

`charts.ts` adapts **selected daily observations** to the narrow shared Reports
contracts; it never reads historical report snapshots. The page selects publisher
and account-local period before adapting data and preserves each hourly date.
Multi-day API rows are rejected rather than relabeled as one day's observations.
Optional-query retrieval timestamps survive even when the daily KPI query fails.

`shared/reports/audience.ts` extracts the legacy dashboard's gender normalization
and age sorting. The compact chart groups Unknown values, offers age/gender views,
and uses `snapshotMetric` for compatible sums and recomputed ratios. Ratios use
grouped bars, never additive stacks. Exact segment values are expandable.
`buildTimeAnalysis` accepts nullable delivery observations as well as existing
Reports points. It counts distinct dates for averages, retains missing cells, and
never infers conversion actions. The legacy hourly intensity scale and hour labels
are shared with the new heatmap. Today uses 24 hourly bars; 7D/30D use weekday/hour
cells with a keyboard-accessible inspector. High intensity does not imply quality.

Presentation lives in `dashboard/components/intelligence/`; card heights are
independent, and only the hourly plot scrolls horizontally on small screens.
Unsupported publisher combinations offer an explicit Combined Meta link preserving
the selected period, not a silent fallback. Coverage and retrieval time are
available in each card's Source & coverage disclosure.

KPI comparisons use `comparisons.ts` and the existing `delta()` rules. The daily
window covers both selected and previous non-overlapping 7/30-day periods; optional
audience/hourly queries remain 30 days. Cache scope version v3 isolates the expanded
window. Current periods include partial today, explicitly disclosed in tooltips.
Today comparisons become eligible at `DEEPVISOR_KPI_TODAY_CUTOFF` (server-only
`HH:mm`, default `20:00`) in the verified selected account timezone. Invalid cutoff
or timezone settings fail closed. Before cutoff and after account-local midnight,
indicators are omitted. No historical hourly data is required: after cutoff the
preliminary comparison uses accumulated Today totals against seven completed days
excluding today. Spend/results use baseline totals divided by seven; CTR and cost
per result use aggregate baseline ratios. Tooltips disclose preliminary reporting.
Both retrieval and request timestamps must belong to the current account-local day. Comparisons require every calendar date, matching currency,
unique observations and retrieval within ten minutes. Missing actions remain
unknown; zero percentage baselines are omitted. Stored fallbacks do not reuse the
legacy completed-day deltas, which would describe a different KPI window.
