# Server Data Layer

This namespace standardizes database access in `lib/server`:

- `repositories/`: persistence operations scoped to core entities/tables.
  - Examples: platform integrations, ad account selections.
- `queries/`: read models and reporting joins/views.
  - Examples: campaign/ad/adset lifetime metrics and recommendation reads.
- `normalizers/`: JSON and schema normalization helpers for typed DTOs.
- `types.ts`: canonical data contracts shared by repositories/queries.

## Usage Rule

When building root pages and API routes:

1. Use `repositories/` for entity lookups and business-scoped validation.
2. Use `queries/` for analytics/reporting fetches.
3. Use `services/` only for orchestration and cross-provider workflows.

Legacy `lib/server/repositories/*` paths remain as compatibility exports while callers migrate.
