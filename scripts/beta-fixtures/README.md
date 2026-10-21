# Development beta fixtures

These commands target **only** `gkdyyjqepzayjdpvqnja` at
`https://gkdyyjqepzayjdpvqnja.supabase.co`. They reject production mode, another
project URL, or an unmarked organization/user at a fixture identity. Use Node 24.
Keep the existing Supabase URL, anon key, and server-only service-role key in
`.env.local`. No Meta or Jev credential is needed.

```sh
export DEEPVISOR_FIXTURES=gkdyyjqepzayjdpvqnja
node --env-file=.env.local scripts/beta-fixtures/run.mjs seed
node --env-file=.env.local scripts/beta-fixtures/run.mjs verify
node --env-file=.env.local node_modules/vitest/vitest.mjs run src/lib/server/betaFixtures.live.test.ts
# Remove only marked fixture businesses/users/assets, then restore them:
node --env-file=.env.local scripts/beta-fixtures/run.mjs clean
node --env-file=.env.local scripts/beta-fixtures/run.mjs seed
node --env-file=.env.local scripts/beta-fixtures/run.mjs verify
```

The seed command creates confirmed Auth users through `auth.admin.createUser`,
using deterministic UUIDs and random passwords that meet the project's policy.
Emails are `deepvisor-beta-a@example.test` and `deepvisor-beta-b@example.test`.
Credentials are saved locally in **`.env.beta-fixtures.json`**, mode 0600, covered
by `.gitignore`. Open that file locally to sign in; never paste or commit it.
Cleanup retains this private file so reseeding restores the same credentials.
An existing Auth user without this file is not taken over: recover the file or
run cleanup first. No email is sent by the admin create-user path.

The SQL migrations must already be applied. Seed is rerunnable and overwrites only
marked synthetic fixture facts. Its API batches are not one database transaction:
if interrupted, rerun seed and require verify to pass before using the data.
Concurrent seed/clean commands are unsupported; use one operator at a time.
Cleanup removes sync imports before business cascades and refuses businesses with
AI decisions, policies, or execution history. It does not erase audit records.

## Dataset and interpretation

- A: Aurora Salon & Aesthetics; 3 campaigns, 5 ad sets, 12 ads. One active set,
  three paused historical sets, one paused low-data set with only two observed days.
- B: Birch Beauty Studio; 1 campaign, 2 ad sets, 4 ads; separate owner and organization.
- Stable clock: **2026-10-20 12:00 America/New_York** (16:00 UTC).
  Daily coverage spans July 23–October 20 (90 calendar days, with intentional holes).
  Hourly coverage is October 14–20, at ad-set level only.
- Rates derive from totals. The active A set has $420 / 84 results = **$5 CPR** in
  October 13–19 versus $294 / 42 = **$7 CPR** in October 6–12. The facial set's
  CPR rises from $18 to $36. Brows spend $120 with zero results in October 13–19.
- Business A's last completed 7D: **$994, 99,400 impressions, 2,982 clicks,
  109 results**. B: **$780, 78,000 impressions, 2,340 clicks, 94 results**.
- Explicit zero rows represent no delivery on October 20 for covered entities.
  The low-data set has no October 20 row: absence stays absence, not a zero.
- Campaign totals derive from ad sets; ads partition their parent's additive
  metrics. Daily reach uses a known synthetic cohort. Each entity reuses that
  cohort across days; its period union is the maximum daily cohort, never the sum.
  Campaign cohorts are nested. Reports still mark aggregate period reach and
  frequency unavailable, as they should for real observations.
- Age, gender, age×gender, country, region, publisher, placement and device use
  the existing summary structure. Even-index sets cover October 13–19; odd-index
  sets cover August 21–September 19. These are **snapshots**, not daily audience
  observations. Delivery-only breakdowns do not claim attributed results.
- Six self-authored SVGs are uploaded under
  `business-media/beta-fixtures/deepvisor-beta-v1/`. Variants cover landscape,
  portrait, square, video poster, missing image and 64×64 fallback. Video fixtures
  contain only a poster, not a playable video. All media is clearly synthetic.

Account names and creatives visibly say SYNTHETIC. The imported integration uses
`connected` solely to exercise existing selection/data-loading paths; no live
Meta connection is claimed. Database guards prohibit tokens, marker removal, and
queued/running sync jobs. Do not click OAuth Connect for fixture businesses.
Manual refresh is deliberately blocked; reseed with the command above. Existing
cron schedules are unchanged. No autonomy policy/evaluation/execution is seeded;
absence of evaluation is not a HOLD or a healthy decision.

The application uses the real clock. For reproducible relative-date UI tests,
set the browser test clock to October 20, 2026; use explicit dates for Reports.
On later real dates the fixture is correctly historical/stale. There is no global
application clock override or production fixture switch.

## Schema audit and bindings

The Phase 1 audit used live MCP catalogs. `audit-contract.mjs` reconstructs only
five additive AI migrations in PGlite and compares them to MCP-exported
`/tmp/dv-audit-{columns,constraints,functions,indexes,policies}.json` files. It is
not a baseline migration and never writes to Supabase. The comparison checked
10 tables, 63 constraints (nullability checked in columns), 17 functions,
31 indexes and 7 RLS policies. Result: zero differences. The five missing ledger
entries were then recorded with the exact repository SQL; their DDL was not replayed.
The historical May baseline still exists only in the remote migration ledger;
this repository does not support building a complete fresh stack with `db reset`.

`npm run types:supabase` requires Supabase CLI login/access token and a linked
project. It now preserves existing bindings on failure and includes intelligence.
The CLI access token was unavailable during Phase 1. Public types were generated
through MCP instead, with ai/intelligence generated from live catalog metadata
using `reconcile-types.mjs public-types.ts catalog.json output.ts`. Function
arguments permit SQL NULL; defaults determine optional arguments. Catalog input
includes columns, FK relationships, unique keys and function signatures. Never
regenerate bindings from the minimal PGlite test dependency tables.

Read `docs/beta-readiness/STATUS.md` for exact migrations, findings and validation.

Run `supabase/tests/beta_fixture_rls.sql` with MCP `execute_sql` after seeding to
verify positive and negative RLS on the six decision tables and signals. This SQL
uses the stable fixture Auth IDs and always rolls back its temporary records.
