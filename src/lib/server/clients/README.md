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
- **Linked accounts:** `client_ad_accounts` records which ad account is a client's. Only an account
  saved on the operator's own connection can be linked, and an account belongs to one client.
- **Client sync (`sharedSync.ts`):** the client gets its own `platform_integrations` row, marked
  `integration_details.shared_from_business_id`, holding the **same Vault secret id** as the
  operator's connection (the token is not read or copied), and an `ad_accounts` row for the linked
  account only. The normal sync, freshness and dashboard paths then apply. One account syncs per
  client; "Sync now" on Business details switches or retries. Rows are written with the service role.
- **Limits on a borrowed connection** (`shared/integrations/sharedConnection.ts`): the operator's
  login sees more than the client's account, so Facebook Pages are refused, WhatsApp detection reads
  only the account's own ads, and live execution is refused (`SHARED_CONNECTION_READ_ONLY`). A client
  can't start Meta sign-in (`isManagedClient`), use Connections or call account selection. Any new
  code that reads user-wide Meta data or writes to Meta must check `sharedFromBusiness`.
- **Lifecycle:** unlinking the synced account stops it first. The operator's Disconnect and "Delete
  Meta data" call `stopSharedConnections` before their own, otherwise the token would survive.
  Signing in again calls `refreshSharedConnections`; after a disconnect, use "Sync this account".
  Stopping keeps the client's saved data. Meta's deletion callback matches client rows by
  `meta_user_id`. A deployment without this code does not stop client rows on disconnect.
- **Meta access:** reading other advertisers' accounts needs access the app has not been granted
  (see the Meta app's access level before adding clients). A successful read is not permission.
- **All businesses (`/clients`):** `load.ts` reads saved data only. Ordering and ad schedules are
  pure rules in `shared/clients/model.ts`; delivery comes from `deliveryStatuses`. Unsynced,
  stale or unreadable data is never shown as healthy.
- **Deletion:** the sole owner of an operator workspace with active clients can't delete their
  account (`ACCOUNT_DELETE_ACTIVE_CLIENTS`), which would otherwise delete those businesses.

- **Login health:** client connections borrow the operator's login, so one broken login stops them
  all. The daily check (`integrations/connectionHealth.ts`) checks only the operator's own
  connection, marks it and every borrowing client `needs_reauth` when Meta rejects it, and sends
  one alert naming how many clients stopped. All businesses shows the login's state at the top and
  "the last refresh failed" on a card whose newest refresh failed.
- **Scheduled refresh:** once the cron job in `supabase/cron/automatic_meta_refresh.sql` is on,
  client accounts refresh every 2 hours like any connected account.

Not built: ending or transferring a client, client or team logins.
Migration: `supabase/migrations/20261126033445_client_businesses.sql` (applied 2026-11-25). On a
database without it, or without an `operator_workspaces` row, the feature stays hidden.
