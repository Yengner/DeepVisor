# Meta data deletion

Required by Meta for Live mode and App Review: a public **Data deletion** page and a **data
deletion callback**. Both delete the same thing.

| Piece | Location |
| --- | --- |
| Public page (EN/ES) + status lookup by confirmation code | `src/app/(public)/data-deletion/` (public route) |
| Meta callback (`signed_request`, HMAC-SHA256 with `META_APP_SECRET`) | `POST /api/meta/data-deletion` → `{ url, confirmation_code }` |
| Signature check (pure) | `signedRequest.ts` |
| Requests, codes, status | `metaDeletion.ts`, table `meta_data_deletion_requests` (service role only) |
| Owner/admin "Delete Meta data" on Connections | `actions/privacy/metaData.ts`, `DeleteMetaDataModal.tsx` |
| What is deleted (one transaction) | `public.delete_meta_connection_data` (migrations `20261119173226`, `20261119173514`) |

**Deleted** for the connection's ad accounts: every table scoped to `ad_account_id` (entities,
performance, creatives, sync state, insights, lifecycle, decisions and their snapshots, Organizer
history, drafts, assistant conversations, webhook subscriptions), the business's WhatsApp
connections + tokens + WhatsApp leads, and the connection's tokens (Vault). New account-scoped
tables are included automatically; a blocking foreign key raises `META_DELETE_BLOCKED` instead
of leaving data behind.

**Kept:** the DeepVisor account, business profile, owner-entered data (`booking_checkins`,
phone-call leads, settings), a bare `ad_accounts` row those answers belong to, and the
connection row (disconnected, token fields and `meta_user_id` removed; other details kept).

**Matching Meta's request.** The callback carries Meta's app-scoped user id. It is saved as
`integration_details.meta_user_id` at connect (`validateMetaAccessToken`), and filled in for older
connections on their next sync (`rememberMetaUserId`). A request that matches nothing is recorded
as `no_data` and still gets a code.

**Disconnect** now also deletes the stored token from Vault (`delete_integration_secret`) but keeps
synced data, as the page explains.

**Meta dashboard:** App settings → Basic → Data deletion → "Data deletion callback URL"
`https://www.deepvisor.com/api/meta/data-deletion` (works only after deploy).

Tests: `npm test -- src/lib/server/privacy`. The database function was exercised against the
development project's fixture business (deleted account data; kept booking answer, call lead and
ad account row; connection disconnected, token removed). Decision and Organizer chains were empty
in that fixture.
