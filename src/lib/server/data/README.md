# Server data facade

`data` is an existing compatibility facade, not a replacement persistence layer.
The repository/normalizer/query modules mostly re-export implementations under
[`../repositories`](../repositories). `types.ts` also re-exports repository DTOs.
`queries/components.query.ts` exposes the existing async campaign-detail actions;
`queries/recommendations.query.ts` wraps the recommendation repository.

Before adding a query, follow the export to its implementation. Extend the
appropriate entity repository in `server/repositories`, or a domain-owned
repository such as `decisions/repository.ts` or `intelligence/repositories`.
Keep this facade for existing callers; do not add another data abstraction or
assume the implementation paths are obsolete.

Authorization remains at the request/service boundary and in scoped repository
queries. Generic paginated reads live in
[`../repositories/pagination.ts`](../repositories/pagination.ts); callers retain
business/account filters and stable ordering.

See [Architecture](../../../../docs/ARCHITECTURE.md) and
[Codebase map](../../../../docs/CODEBASE_MAP.md).
