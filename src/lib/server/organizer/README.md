# Account Organizer: retired

The Organizer application code (inspection, naming proposals, rename approval,
execution and restoration) was removed in November 2026. Its page had already been
withdrawn; `/campaigns/organize` redirects to `/campaigns`. Git history has the code.

**Preserved:** the database tables (`account_organization_*`,
`organization_rename_*`), their rows, RLS, immutability triggers, execution locks
and migrations (`20261031034606`, `20261031152423`, `20261031154143`). No
application code reads or writes them now. Do not drop them as part of code cleanup.

The two tests here run those migrations and protect the preserved rules:

- `history.test.ts`: immutable history, duplicate rejection, business RLS.
- `executionSchema.persistence.test.ts`: single-use approvals, shared execution
  locks, audit and RLS boundaries.

The naming templates the assistant still uses live in
`src/lib/shared/campaigns/naming.ts`.
