# Client businesses

One operator manages many businesses. Each client is an ordinary organization and business;
the operator is its owner through a membership marked `kind = 'managed'`.

- **Active business:** `active_business_id` cookie, accepted only when it matches a membership
  (`actions/business/context.ts`, read every request). Switching reloads the page; other tabs reload
  through `components/clients/BusinessTabSync.tsx`. That tab reload runs in the browser: server
  routes authorize the active business, they don't receive the business a form was opened in.
- **Operator:** an owner of a workspace listed in `operator_workspaces`. Rows are added by hand
  with the service role. `operator_workspaces`, `client_engagements` (service level, fee, paid
  through) and `client_ad_accounts` have no browser access.
- **Not synced:** `client_ad_accounts` only records which ad account is a client's, for the Ads
  Manager link. No token is copied and nothing is synced. A business with an active engagement
  cannot start or finish Meta sign-in (`isManagedClient`), because that would save every account
  the operator can see into the client's workspace. Syncing client accounts waits on Meta access
  that covers other advertisers' accounts.
- **All businesses (`/clients`):** `load.ts` reads saved data only. Ordering and ad schedules are
  pure rules in `shared/clients/model.ts`; delivery comes from `deliveryStatuses`. Unsynced,
  stale or unreadable data is never shown as healthy.
- **Deletion:** the sole owner of an operator workspace with active clients can't delete their
  account (`ACCOUNT_DELETE_ACTIVE_CLIENTS`), which would otherwise delete those businesses.

Not built: ending or transferring a client, client or team logins, client sync.
Migration: `supabase/migrations/20261126033445_client_businesses.sql` (applied 2026-11-25). On a
database without it, or without an `operator_workspaces` row, the feature stays hidden.
