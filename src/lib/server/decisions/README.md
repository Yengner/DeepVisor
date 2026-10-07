# V2 decision persistence

The six tables in `ai` store snapshots, provider decisions, proposed actions,
execution audit records, measured outcomes, and one autonomy policy per business.
`repository.ts` accepts the existing `SupabaseClient<Database>` and requires an
explicit business scope. It does not construct privileged clients, invoke Meta,
evaluate policies, approve work, or execute actions. Callers must authorize the
business before passing a service-role client. Lists are capped at 100 rows.

## Migration

Apply `supabase/migrations/20261006000000_add_v2_decision_persistence.sql` through
the normal reviewed deployment process. It requires the existing `ai` schema,
`public.business_profiles`, `public.platform_integrations`, `public.ad_accounts`,
and `public.is_org_member(uuid)`. This repository has no baseline migrations;
do not reset a production database or attempt to reconstruct its schema from
the generated TypeScript file. No remote migration is applied by these tests.

Foreign keys preserve audit lineage (no cascade deletes). Every child references
its parent's business and ID together. A snapshot trigger validates that its
integration and ad account belong to the business and share a platform. Entity
IDs are opaque platform IDs because entity types may expand beyond Meta ad sets.
The snapshot helper copies identity and schema version from `FeatureSnapshot`.

Authenticated organization members can read their business records through RLS.
Anonymous access and authenticated writes are denied. Writes require a trusted
server/service-role client. These permissions intentionally do not introduce a
browser approval endpoint. Redact credentials/tokens from provider responses,
request metadata and errors before storage; these records are member-readable.

Autonomy defaults to `off`, no allowed actions, and a zero budget-change limit.
Proposals default to requiring approval and unknown risk. Configuration JSON
remains flexible; saving a policy does not enable any execution behavior.
`upsertAutonomyPolicy` supplies the desired policy; omitted fields use database
defaults. Budget boundary currency/period and cooldown/evidence semantics will
be validated by future policy consumers. Confidence is nullable and otherwise
in [0, 1]. Each execution may have one outcome per positive horizon in hours.
Multiple execution records per proposal can record attempts; no execution
idempotency or state-transition engine is implied by these persistence helpers.

## Types and tests

`src/lib/shared/types/decisionPersistence.ts` provides additive local table
bindings composed into `Database.ai.Tables`. Existing generated schema contents
are preserved. After deploying, `npm run types:supabase` can regenerate the full
bindings from the real database; reconcile/remove the overlay only after the six
tables appear in generated output. Do not regenerate from test fixtures.

Run `npm test -- src/lib/server/decisions` for repository transport tests and
PGlite tests of the actual SQL migration. PGlite uses a small test-only fixture
for pre-existing dependencies; it is not a production schema migration. Tests
cover tenant boundaries, RLS/grants, defaults, constraints and error propagation.
They require neither Docker nor live Supabase/Meta credentials.
