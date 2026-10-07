# Advertising exploration

Read-only visual browsing for Overview and Campaigns. No provider, policy
evaluation, synchronization, advertising execution, or schema changes.

## Data contract

`GET /api/campaigns/exploration?account=...&level=campaign|adset|ad&period=today|7d|30d&parent=...`
requires the authenticated business's currently selected Meta account. Parent
IDs are verified within that business/account/integration before reading children.
The response contains allowlisted presentation fields, never raw creative or
decision JSON. All database page limits are traversed and related IDs are batched.

Overview reuses its request-cached 30-day facts and decision reads. Only five ad
sets receive media strips. Creative pulse measures ads within those five sets;
it is not a claim of the account's best creative. Pulse is omitted above 50 ads
rather than ranking a truncated sample. Drawer detail is loaded on demand.
Requests are aborted on navigation and stale results are discarded. There is no
shared browser cache that could leak another account's data.

Campaigns defaults to visual browsing; the original tables, filters and actions
remain available. Creation and editing flows are unchanged. Media failures do not
hide performance. Explicit Meta preview requests reuse the existing read-only
preview endpoint, rendered inside a sandboxed iframe. Videos use thumbnails;
video IDs are never interpreted as URLs.

## Interpretation

- Results are leads + messages + calls; ratios derive from totals.
- Totals include partial today. Deltas use completed 7/30-day windows against the
  preceding equal window. Today has no delta. Missing days suppress comparisons.
- Most-results labels require positive results, two ads, and complete comparable
  coverage for the whole group. Ties remain ties; this is not predicted health.
- Individual ads never inherit the ad set's persisted health or fatigue signal.
- Creative pulse is measured per ad, not per dynamic asset or every reuse of it.
- Multi-day reach/frequency are unavailable because daily reach is not additive.
- Saved targets stay in Overview with comparison unavailable. No midpoint is made.
- Budgets are last-synced values; ambiguous ownership is unavailable, not guessed.

## Verification and gaps

Run `npx vitest run src/lib/server/campaigns/exploration`, `npm run typecheck`,
and `npm run build`. Fixtures are synthetic and contain no execution paths.

Follow-up data work: creative-level intelligence, playable video availability,
reliable dynamic/carousel asset-level attribution, deduplicated whole-period
audience metrics, explicitly comparable targets, and normalized social engagement.
This task does not expand Meta sync to supply any of these.
