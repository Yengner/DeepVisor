-- Saved "run this ad again" plans: a new daily budget and number of days for an existing ad set,
-- kept only in DeepVisor (nothing is sent to Meta). One plan per ad set: saving again updates it,
-- so a later approved write can change that same ad set in Meta instead of creating copies.
create table public.ad_set_plans (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.business_profiles(id) on delete cascade,
  ad_account_id uuid not null references public.ad_accounts(id) on delete cascade,
  adset_external_id text not null check (adset_external_id ~ '^\d{1,30}$'),
  campaign_external_id text not null check (campaign_external_id ~ '^\d{1,30}$'),
  adset_name text,
  currency_code text not null check (currency_code ~ '^[A-Z]{3}$'),
  daily_budget numeric(12, 2) not null check (daily_budget >= 1 and daily_budget <= 10000),
  days integer not null check (days between 1 and 90),
  -- Account-local days when the plan was saved: starts the next day, last day inclusive.
  start_day date not null,
  end_day date not null check (end_day >= start_day),
  -- People can be deleted; their saved plans stay with the business.
  created_by_user_id uuid references public.users(id) on delete set null,
  updated_by_user_id uuid references public.users(id) on delete set null,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ad_set_plans_one_per_ad_set unique (ad_account_id, adset_external_id)
);

create index ad_set_plans_business_idx on public.ad_set_plans (business_id);
create index ad_set_plans_created_by_idx on public.ad_set_plans (created_by_user_id);
create index ad_set_plans_updated_by_idx on public.ad_set_plans (updated_by_user_id);

-- Members of the business can read; writes go through the server after owner/admin checks.
alter table public.ad_set_plans enable row level security;
create policy ad_set_plans_select_by_business on public.ad_set_plans
  for select to authenticated using (public.can_access_business(business_id));
