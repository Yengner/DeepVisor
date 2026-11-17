-- Weekly booking check-in: how many appointments the owner says a week's ads produced.
-- One row per ad account per account-local Monday–Sunday week. "skipped" records "not sure"
-- so the week is not asked again; it is unknown, never zero. Counts are owner-reported, not
-- verified bookings. The composite FK keeps the account inside the business.
-- Writes go through the authorized server action (owner/admin, admin client after context
-- checks); members read their business's check-ins. Rows cascade with the ad account.
begin;
create table if not exists public.booking_checkins (
  business_id uuid not null,
  ad_account_id uuid not null,
  week_start date not null check (extract(isodow from week_start) = 1),
  bookings integer check (bookings between 0 and 10000),
  skipped boolean not null default false,
  answered_at timestamptz not null default now(),
  answered_by uuid references auth.users(id) on delete set null,
  primary key (ad_account_id, week_start),
  foreign key (business_id, ad_account_id) references public.ad_accounts(business_id, id) on delete cascade,
  check ((skipped and bookings is null) or (not skipped and bookings is not null))
);
create index if not exists booking_checkins_business_week_idx on public.booking_checkins (business_id, week_start desc);
alter table public.booking_checkins enable row level security;
drop policy if exists booking_checkins_read on public.booking_checkins;
create policy booking_checkins_read on public.booking_checkins
  for select to authenticated using (public.can_access_business(business_id));
revoke all on public.booking_checkins from public, anon, authenticated;
grant select on public.booking_checkins to authenticated;
grant all on public.booking_checkins to service_role;
comment on table public.booking_checkins is
  'Owner-reported weekly bookings per ad account (skipped = not sure). Written only by the server after owner/admin checks.';
commit;
