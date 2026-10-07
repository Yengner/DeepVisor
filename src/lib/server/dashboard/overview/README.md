# V2 Overview

`/dashboard` reads persisted data only. `LegacyDashboard.tsx` preserves the former
analytics page without exposing a second route. Calendar, Reports, analytics
components, notifications, sync and execution services are unchanged.

## Sources and scope

- Session-authorized business and selected Meta account; verified account shell,
  sync coverage and business profile preference.
- Normalized ad-set daily performance, limited to authorized entity IDs and the
  selected account. Results are leads + messages + calls. CPR uses aggregate
  spend/results; absent facts and zero-result CPR remain unavailable.
- V2 snapshots scope decision runs; runs scope proposals; proposals scope
  executions. Completed outcome measurements are linked through executions or
  shadow decision runs. Shadow/automatic evaluation jobs supply historical mode
  provenance, never the current policy setting.
- All metadata is paginated rather than capped at the latest business-wide runs.
  Full feature JSON is loaded only for latest checks and outstanding proposals.
  This is intentionally read-only; no providers, policy evaluation, Meta actions,
  hourly/breakdown queries or notification generation run when viewing Overview.

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
`npm run build`. The repository's existing `next lint` command is unsupported by
Next 16; validation uses the Next ESLint configuration directly.
# Control-Center Presentation

The Overview uses a single responsive daily chart: integrated with account controls on desktop and below advertising on mobile. It does not render or load the legacy analytical breakdowns. Campaigns remains table-first; the account-scoped exploration loader and lazy drawer are reused for the dashboard's ad-set board.

`controlModel.ts` calculates aggregate CTR and completed-window changes. A comparison requires coverage for every scoped ad set on every day in both windows; an incomplete account day remains a chart gap. Selected totals include partial today and explicitly identify incomplete coverage. No target comparison is inferred from profile preferences.

Featured cards always represent **ad sets**. Comparable positive result leaders are selected first; tied leaders use stable ID ordering only for layout and are labeled "Most results · tied". Fallbacks are priority-ordered unresolved attention, then active ad sets with the latest positive normalized daily activity. Database update timestamps are not used as relevance signals. Strongest measured ad media may represent a set without replacing its metrics with that ad's totals.

Monitoring shows completed checks, HOLD/no-change decisions, creative-review recommendations, and all unresolved attention (not only today's items). These counts overlap. Empty attention is only called stable when every represented unit passes the existing fresh Healthy evidence rule. Configured autonomy is not runtime authorization; there are no approval or execution commands on Overview.

Remaining source limitations: no scheduler heartbeat or authoritative eligible-unit population; no exact target currency/result binding; creative-specific intelligence, reliable playable video URLs, deduplicated multi-day reach, and some historical mode/event timestamps are unavailable. These are not synthesized by presentation code.
