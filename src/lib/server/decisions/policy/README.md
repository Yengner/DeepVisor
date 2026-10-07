# Policy Engine V1

`new PolicyEngine().evaluate(input)` is a pure, synchronous safety check. It
accepts a normalized `BusinessPolicy`, current Meta ad-set state, FeatureSnapshot,
validated DecisionResult, complete business action history, and explicit `now`.
For an actionable decision the caller must also supply a matching proposal.
Decision providers cannot choose execution parameters or invoke this engine's
authorization downstream themselves. This module does not fetch, persist, call
providers, create proposals, or execute platform actions.

## Outcomes and modes

| Mode | Eligible low-risk action | Medium/high-risk action |
| --- | --- | --- |
| OFF | BLOCK | BLOCK |
| SHADOW | SHADOW_ONLY | SHADOW_ONLY |
| REVIEW | REQUIRE_APPROVAL | REQUIRE_APPROVAL |
| LIMITED_AUTO | ALLOW_EXECUTION | REQUIRE_APPROVAL |

Hard gates apply in every enabled mode, including review and shadow. HOLD returns
HOLD. REVIEW_CREATIVE returns HOLD with RECOMMENDATION_ONLY, no executable action.
INSUFFICIENT_DATA blocks. Missing/malformed inputs block. Unsupported decisions
or proposals (increases, audience/creative edits, deletion) block. Decisions
cannot be used to authorize a different action.

Reduction risk is low through 5%, medium through 20%, and high above 20%. Pausing
remains high risk except in LIMITED_AUTO when explicitly allowlisted, daily
ad-set-owned, within a configured pause budget cap and no more than the configured
share of account allocation (hard maximum 5%). These are authorization
classifications, not estimates of business impact. Medium/high risk always requires approval in LIMITED_AUTO. Risk and proposal are returned only
after gates pass (except recommendation-only creative review).

## Units and gates

- Budget values are safe integer minor currency units. Evidence spend uses the
  Feature Engine's account-currency major units. Entity, policy and snapshot must
  agree on business, account, entity and currency; policy/entity budget periods
  must match. Campaign-owned budgets cannot be reduced by an ad-set proposal.
- A reduction must be positive and strictly below the current budget. Both current
  and target budgets must lie within inclusive policy boundaries. The maximum
  reduction percentage supports two decimals, checked with integer basis points.
- Evidence uses the complete seven-day snapshot window: all spend, impressions,
  results and active-day minimums must pass inclusively, with at least four active
  days. Feature sufficiency must be sufficient without missing days/reasons.
- Decision confidence must meet its configured threshold. Low/unknown tracking
  confidence always blocks; policy may require medium or high. Feature tracking
  confidence is still the existing heuristic, not proof of measurement quality.
- Snapshot freshness uses account-local calendar days; current entity state uses
  elapsed minutes. Future-dated state blocks. Locks and inactive entities block.
- All attempts, including failed attempts, count conservatively toward cooldowns
  and daily limits. Pending/running/unknown same-entity attempts block until resolved.
  The entity key is account + ad-set ID. Other-entity history affects daily limits,
  not this entity's cooldown. Exact cooldown expiry permits another evaluation.
- Daily limits count all business attempts on the policy's local calendar date,
  across accounts. At the limit, further changes block. Zero disables changes.
- LIMITED_AUTO requires `limitedAuto.enabled`, `killSwitch: false`, an exact
  account ID and entity allowlist. Current/remaining daily account allocation
  must both satisfy explicit account boundaries. Missing account data blocks.
  Entity budget boundaries apply to pauses as well as reductions. No automatic
  lifetime or campaign-owned target is supported. Other modes retain their
  existing behavior and do not require these new settings.

## Caller contracts

`history.complete` means all business attempts since `history.since`, plus **all
unresolved attempts even if older**, have been loaded. `history.until` must equal
the explicit evaluation timestamp. Coverage must include at least 26 hours (to
cover the business-local day across DST) and the entire configured cooldown,
whichever is longer. Duplicate IDs, future attempts, foreign businesses and
incomplete coverage block. An empty array is valid only with complete coverage.
Do not pass a truncated repository list and label it complete.

The caller must bind a persisted decision to the supplied feature snapshot and
authorize its business context. `DecisionResult` itself has no snapshot ID, so
this module cannot independently verify that relationship. Fetching and any
future executor must preserve this linkage.

The existing persistence mode names are unchanged. Callers translate `off` -> OFF, `observe` -> SHADOW,
`approval_required` -> REVIEW, `autonomous` -> LIMITED_AUTO and populate every
required configuration field. Passing a raw storage row does not enable autonomy;
missing settings block. No existing user is automatically enabled.

Authorization applies only to the exact proposal and observed inputs. It is not
an execution reservation: the [advertising executor](../../advertising/LIMITED_AUTO.md)
rechecks current state/history and reserves business capacity atomically. This
pure policy module never performs advertising writes.

Run `npm test -- src/lib/server/decisions/policy` for deterministic boundary tests.
