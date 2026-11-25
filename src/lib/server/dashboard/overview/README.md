# V2 Overview

`/dashboard` reads persisted decision evidence and uses a separate, authorized
read-through Meta Insights layer for recent performance. See
[`../insights/README.md`](../insights/README.md) for caching, publisher scope and
unavailable-data behavior.

## Sources and scope

- Session-authorized business and selected Meta account; verified account shell,
  sync coverage and business profile preference.
- Normalized ad-set daily performance, limited to authorized entity IDs and the
  selected account. Results are leads + messages + calls. CPR uses aggregate
  spend/results; absent facts and zero-result CPR remain unavailable.
- Result naming (`shared/performance/resultChannel.ts`): the total is unchanged, but
  KPIs, the trend tab, Agency metrics and ad-set cards rename it ("WhatsApp
  conversations", "Conversations", "Leads", "Calls") only when every row that spent or
  reported anything in the selected period comes from ad sets whose Meta
  `destination_type` produces that result **and** the other counts are known zeros.
  Otherwise cost per result would mix in spend from other destinations, so it stays
  "Results". Unknown destinations or counts are never assumed. Live rows are named in
  `page.tsx`/`advertisingMetrics`, saved rows in `controlPerformance`. "Who and when"
  takeaways keep "results": they come from account-level breakdowns with their own
  windows, which this per-row rule cannot prove.
- V2 snapshots scope decision runs; runs scope proposals; proposals scope
  executions. Completed outcome measurements are linked through executions or
  shadow decision runs. Shadow/automatic evaluation jobs supply historical mode
  provenance, never the current policy setting.
- All metadata is paginated rather than capped at the latest business-wide runs.
  Full feature JSON is loaded only for latest checks and outstanding proposals.
  This is intentionally read-only; no providers, policy evaluation, Meta actions,
  notification generation run in these persisted loaders. The separate Insights
layer may request optional audience/hourly breakdowns when its cache is stale.

React request caching deduplicates sections. Independent Suspense boundaries
separate performance from decisions. Optional provenance/policy/outcome failures
are labeled unavailable. Core decision failures are not rendered as zero counts.
Performance periods are account-local calendar days including partial today.
Today retains a seven-day daily trend. Missing dates stay chart gaps; period
totals explicitly disclose missing recorded days.

## Meaning of counts and states

Today counts completed runs once per category, using completion `updated_at`.
Categories overlap. Checked ad sets are distinct entities actually evaluated,
not an estimate of all eligible or monitored units. Successful executions require
successful execution records. Pending approvals in attention are not date-limited.
Review events require explicit `review.reviewedAt`; generic updates never invent
approval/rejection timestamps. Measurements describe observations, not causation.
Paused and unresolved attention take precedence over health. Healthy requires a
recent, sufficient HOLD with adequate tracking and no conflicting proposal.

## Known backend gaps

- Saved lead-cost ranges lack explicit currency/result-definition binding;
  comparison is unavailable. No midpoint is invented.
- No authoritative eligible-unit population or scheduler heartbeat is available.
  Sync/evaluation timestamps do not claim scheduler liveness.
- Older decisions may lack originating mode or explicit review event timestamps.
  Missing modes are omitted; missing review times do not produce activity events.
- There is no dedicated evaluation-completed timestamp; completed runs use their
  persisted `updated_at`. Outcome events use `measured_at`, executions use
  `completed_at`.

Run `npm test -- src/lib/server/dashboard/overview`, `npm run typecheck` and
`npm run build`. Run `npm run lint` for the installed Next/TypeScript ESLint configuration;
see the [development guide](../../../../../docs/DEVELOPMENT_GUIDE.md) for the
existing-debt baseline.
# Control-Center Presentation

The Overview uses a single responsive daily chart: integrated with account controls on desktop and below advertising on mobile. It does not render or load the legacy analytical breakdowns. Campaigns remains table-first; the account-scoped exploration loader and lazy drawer are reused for the dashboard's ad-set board.

`controlModel.ts` calculates aggregate CTR and completed-window changes. A comparison requires coverage for every scoped ad set on every day in both windows; an incomplete account day remains a chart gap. Selected totals include partial today and explicitly identify incomplete coverage. No target comparison is inferred from profile preferences.

Featured cards always represent **ad sets**. Comparable positive result leaders are selected first; tied leaders use stable ID ordering only for layout and are labeled "Most results · tied". Fallbacks are priority-ordered unresolved attention, then active ad sets with the latest positive normalized daily activity. Database update timestamps are not used as relevance signals. Strongest measured ad media may represent a set without replacing its metrics with that ad's totals.

Monitoring shows completed checks, HOLD/no-change decisions, creative-review recommendations, and all unresolved attention (not only today's items). These counts overlap. Empty attention is only called stable when every represented unit passes the existing fresh Healthy evidence rule. Configured autonomy is not runtime authorization; there are no approval or execution commands on Overview.

Remaining source limitations: no scheduler heartbeat or authoritative eligible-unit population; no exact target currency/result binding; creative-specific intelligence, reliable playable video URLs, deduplicated multi-day reach, and some historical mode/event timestamps are unavailable. These are not synthesized by presentation code.

## Automatic synchronization in the authenticated shell

The shell's `AutomaticMetaSync` independently checks daily visit freshness and
observes existing queue jobs; Overview loaders continue to read persisted data.
Completed synchronization refreshes the visible analytics. While a refresh is queued or
running (automatic or the Refresh button), there is no banner: the KPI cards dim and show
the working spider (`syncActivity.ts`, `TickerNumber.tsx`). When the refreshed values differ,
each number rolls to its new value and glows briefly — green for good news, red for bad,
blue when neither (spend) — by metric polarity (`flashTone`); unchanged values, first loads
and period switches do not animate. Failed/reauthentication
connections retain their selected account and saved history, with honest connection
attention and reconnection guidance. A successful sync is not a decision evaluation
or authorization to execute advertising actions.

## Loader ownership

`load.ts` owns request-cached context, daily/history/sync loads and composition.
`decisionRecords.ts` owns complete business/account-scoped decision lineage reads.
Generic pagination lives in `server/repositories/pagination.ts`; the previous
`load.ts` exports remain compatible. No provider/executor is invoked by either loader.
