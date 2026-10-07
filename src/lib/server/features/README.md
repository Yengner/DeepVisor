# Feature Engine V1

`buildFeatureSnapshot({ deliveryUnit, asOfDay, rows })` is a pure, synchronous
calculation over normalized Meta ad-set daily facts. It does not fetch data,
persist anything, call an LLM, or execute advertising actions. Existing product
paths do not consume these snapshots yet.

Supply one unsplit row per day for one ad set, scoped to the given business and
ad account by the caller. Dates are account-calendar `YYYY-MM-DD` labels; UTC
arithmetic preserves these labels without consulting the machine clock/timezone.
The cutoff is inclusive. Supply 60 days for full 30-day comparisons; future and
older rows do not contribute. Duplicate days, mismatched ad sets, invalid dates,
negative and non-finite metrics are rejected. Input is never mutated.

The JSON-only `FeatureSnapshot` carries schema version 1, identity, currency,
cutoff, 7/30-day windows and equal-length preceding windows. Bump the schema
version when changing formulas, thresholds or meanings. No generated timestamp
is included, so identical facts and cutoff produce identical snapshots.

Daily aggregation and rates reuse repository calculations. Results mean leads +
messages + calls, matching repository semantics, not deduplicated customers.
Supply explicit zeroes for known absent action types. Null or omitted metrics
mean unknown; rates with zero denominators are null. Totals for incomplete windows
describe observed rows only, with missing-day counts exposed. Missing days are
never filled with assumed zeroes.

Sufficiency requires full daily coverage, known spend/impressions/clicks/results,
at least four active days, and one existing trend signal floor (40 spend in account
currency, 600 impressions, or 2 results). These inherited floors are heuristics,
not statistical confidence or permission to change spend. Comparisons require
both windows to be sufficient. Delivery direction uses spend; efficiency uses
cost per result (lower is better). Zero baselines have null percentage changes.

Tracking confidence reuses the assessment conversion-signal heuristic on 30 days;
it is not a measurement audit. Insufficient inputs return unknown. Frequency is
impressions divided by summed daily reach, as in existing assessments, not Meta's
deduplicated whole-window frequency. Elevated frequency (>= 3.5 over seven days)
is the initial fatigue indicator. Creative freshness/testing context is not
available in daily facts, so this engine does not invent a full fatigue score.

The extracted assessment helpers preserve legacy assessment behavior, including
its zero-baseline trend convention. Only new snapshots use null percentages for
zero baselines and unknown values for missing evidence.
