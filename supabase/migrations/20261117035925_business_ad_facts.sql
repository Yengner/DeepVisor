-- What a business owner has told DeepVisor about how they advertise: usual daily budget,
-- how long ads run, a monthly ceiling, the WhatsApp greeting, client languages, slow days.
-- One current value per fact with who confirmed it and when, so the assistant asks once
-- and knows when an answer is old. Facts derived from ad history are computed on read and
-- are not stored here. Value shapes are validated by the server (shared/agent/facts.ts);
-- the database bounds keys and size. Writes go through the authorized server action
-- (owner/admin, admin client after context checks); members read their business's facts.
-- Account deletion: the FK cascades with the business, and delete_workspace_scoped_rows
-- also covers business_id tables.
begin;
create table if not exists public.business_ad_facts (
  business_id uuid not null references public.business_profiles(id) on delete cascade,
  fact_key text not null check (fact_key in (
    'daily_budget', 'run_days', 'monthly_ceiling', 'whatsapp_greeting', 'client_languages', 'slow_days'
  )),
  value jsonb not null check (jsonb_typeof(value) = 'object' and octet_length(value::text) <= 2048),
  confirmed_at timestamptz not null default now(),
  confirmed_by uuid references auth.users(id) on delete set null,
  primary key (business_id, fact_key)
);
alter table public.business_ad_facts enable row level security;
drop policy if exists business_ad_facts_read on public.business_ad_facts;
create policy business_ad_facts_read on public.business_ad_facts
  for select to authenticated using (public.can_access_business(business_id));
revoke all on public.business_ad_facts from public, anon, authenticated;
grant select on public.business_ad_facts to authenticated;
grant all on public.business_ad_facts to service_role;
comment on table public.business_ad_facts is
  'Owner-confirmed advertising facts (one per key). Written only by the server after owner/admin checks.';
commit;
