# Meta Agency MVP

`/agency` is an authenticated, read-only composition of the existing selected-account
Overview loaders and Decisions feed. Approval/rejection uses the existing server
action, business role checks, fingerprints and concurrency protection. The Agency loader
never invokes a provider, creates a sync job, or executes an ad change; existing
application-shell automatic synchronization behavior is unchanged.

`loadBusinessObjectives` reads only the authenticated/job business profile.
`businessObjectives` v1 maps known onboarding choices; unknown legacy strings stay
unavailable. Budget/target ranges are not exact amounts and have no explicit stored
currency. Goals are intent; Meta leads/messages/calls are not verified appointments.
Descriptive safety preferences never modify autonomy policies.

Shadow and Review workers append this context to their saved/provider questions.
Question version is now **2**, so existing queued v1 jobs fail closed on version
mismatch; subsequent eligible syncs enqueue v2 jobs. Feature schema and Jev's
choice vocabulary/model/response schema are unchanged. A context read failure
fails the evaluation, rather than silently evaluating without the business goal.
Saved questions retain the preferences actually used, independently of future edits.
Existing historical evaluations are not rewritten or re-evaluated on page render.

Account filtering uses the snapshot relationship before pagination (20 records).
Business-wide findings are intentionally excluded from this selected-account feed.
The full business Decisions page remains available. No new execution endpoint,
scheduler, tables, dependencies or framework was added.

Mascot: scanning while the actual server content loads; attention for stale,
missing, failed or reviewable evidence; idle otherwise. Historic successful actions
do not imply a currently running/successful agent. Review buttons show real pending
and saved states. The page does not simulate analysis with timers.

See `scripts/agency/README.md` for the guarded persisted demo and browser checks.

## Changed files

- `src/app/(root)/agency/page.tsx`, `Agency.module.css`, `error.tsx`
- `src/lib/server/agency/objectives.ts`, `loadObjectives.ts`, `objectives.test.ts`, `README.md`
- `src/lib/server/decisions/loadSurface.ts`, `loadSurface.test.ts`, `surface.ts`
- `src/lib/server/decisions/shadow/service.ts`, `shadow/evaluate.ts`
- `src/lib/server/decisions/review/service.ts`, `review/service.test.ts`
- `src/app/(root)/decisions/actions.ts`, `Decisions.module.css`
- `src/components/layout/navigation.tsx`, `src/components/product/Product.module.css`
- `src/lib/server/betaPhase4.live.test.ts`
- `scripts/agency/demo.mjs`, `browser.mjs`, `clean.sql`, `README.md`
- `docs/beta-readiness/STATUS.md`

Development data only: synthetic Business A profile/preferences and primary account
selection; isolated Agency account/dimensions/daily observations/sync fixture;
feature snapshots, decision runs, evaluation jobs, proposals, execution claims/audits,
and pending outcomes through existing services/RPCs. No schema changes. The prior
synthetic policy was restored; SQL verified `executionEnabled=false` afterward.
