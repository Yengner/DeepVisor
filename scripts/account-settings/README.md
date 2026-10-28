# Account settings verification

Settings (`/settings` and `/settings/profile`) edits the authenticated user's
first name, last name, and optional contact phone through normal RLS. Roles,
account status, IDs, and verified email cannot be edited through that table.
Email changes use Supabase Auth confirmation; the database copies only the
confirmed Auth email into `public.users`. Email changes and deletion require a
sign-in within ten minutes (refreshing a token does not count).

Permanent deletion uses the official server-only Auth Admin API. The migration
`20261028021848_account_settings.sql` must be applied before using these actions.
Its trigger atomically removes solo-member workspaces and their dependent data.
Shared workspaces survive, with integration/draft creator references transferred
to a remaining member, preferring owners. The last shared-workspace owner must
transfer ownership before deleting their account. Existing RLS stays enabled.

Owned Storage uploads require removal/transfer through the Storage API before
deletion; the application blocks and directs the user to support. Running syncs,
running evaluations, and unresolved advertising executions also block deletion.
No Meta calls, advertising changes, billing operations, or autonomous execution
are performed by account deletion.

Using Node.js 24:

```sh
npm test -- src/lib/server/actions/user/settingsProfile.test.ts src/lib/server/actions/user/settingsProfile.persistence.test.ts
npm run typecheck
# Start the app first. Default browser target is localhost:3000.
DEEPVISOR_ACCOUNT_SETTINGS_TEST=gkdyyjqepzayjdpvqnja node --env-file=.env.local scripts/account-settings/verify.mjs
```

The last command requires local Supabase service credentials and Playwright in
`/tmp/deepvisor-auto-tools` (the existing beta verification tools). Set
`ACCOUNT_SETTINGS_BASE_URL` to use a different local port. It creates disposable,
clearly tagged users using Auth Admin, exercises real database isolation and the
authenticated desktop/mobile UI, then deletes those users and their workspaces
in `finally`. Existing fixture users are never reused or edited. No screenshots
or credentials are saved. Inbox delivery and email confirmation links still
require a controlled manual test with a real mailbox.
