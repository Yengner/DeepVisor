# Weekly booking check-in

Meta reports conversations; only the owner knows how many became appointments. Overview asks
once a week and turns the answers into an owner-reported cost per appointment.

| Piece | Location |
| --- | --- |
| Week math, totals, when to ask, summary (pure) | `src/lib/shared/bookings/checkin.ts` |
| Account-timezone day helpers (pure) | `src/lib/shared/time/zone.ts` |
| Persistence and loading | `src/lib/server/bookings/checkins.ts` (`server-only`) |
| Owner/admin write | `src/app/(root)/dashboard/checkinActions.ts` |
| Question form (shared) | `src/components/bookings/CheckinAsk.tsx` |
| Insights popup question | `src/components/bookings/PopupCheckin.tsx` (`pendingCheckinAction`) |
| Overview card (fallback) | `src/app/(root)/dashboard/components/BookingCheckin.tsx` |
| Table | `public.booking_checkins`, migration `20261117042757_booking_checkins.sql` |

## Rules

- **Popup first.** While a week with spend is unanswered, the Insights popup asks it (owners/admins,
  read live, not saved in popup history). The Overview card stays as the fallback; an answer in
  either place hides both.
- Weeks are account-local Monday–Sunday. Only the **last completed week** is asked, only if the
  ads spent money that week, and only until it is answered or skipped ("Not sure").
- A skipped or unanswered week is unknown. It is left out of **both** spend and bookings;
  it is never counted as zero bookings.
- The summary covers the last 4 completed weeks: "You reported N appointments in X of the last
  Y weeks with ads · about $Z per appointment". Cost is spend of answered weeks ÷ their
  bookings, and is unavailable when bookings are 0.
- Answers can be corrected for up to 8 completed weeks (upsert per account/week).
- The card is hidden when there is nothing to ask or report, when the account has no timezone,
  in decision preview, and when loading fails (logged, never blocks Overview).

## Access

Members read through RLS (`can_access_business`); `anon`/`authenticated` have no write grants.
The action resolves the business from the session (owner/admin via
`server/actions/business/manager.ts`) and the account from the validated selection. A composite
FK keeps each row's ad account inside its business; rows cascade with the account.

## Not yet

The optional appointment list (client name, service, time) waits until owners say they will use
it. Translation follows the i18n foundation.

Tests: `npm test -- src/lib/shared/bookings src/lib/server/bookings src/lib/server/bookingCheckinsMigration.test.ts`.
