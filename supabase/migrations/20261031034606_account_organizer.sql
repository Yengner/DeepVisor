-- Read-only Meta organizer. Immutable source snapshots and append-only proposals.
create table public.account_organization_baselines (
 id uuid primary key default gen_random_uuid(),
 business_id uuid not null references public.business_profiles(id) on delete cascade,
 ad_account_id uuid not null references public.ad_accounts(id) on delete cascade,
 created_by uuid not null,
 captured_at timestamptz not null default now(),
 consent_version text not null check(consent_version='organizer-v1'),
 snapshot jsonb not null check(jsonb_typeof(snapshot)='object'),
 foreign key(business_id,ad_account_id) references public.ad_accounts(business_id,id) on delete cascade,
 unique(business_id,ad_account_id), unique(id,business_id,ad_account_id)
);
create table public.account_organization_versions (
 id uuid primary key default gen_random_uuid(),
 baseline_id uuid not null,
 business_id uuid not null,
 ad_account_id uuid not null,
 version integer not null check(version>0),
 created_by uuid not null,
 created_at timestamptz not null default now(),
 source_snapshot jsonb not null check(jsonb_typeof(source_snapshot)='object'),
 proposal jsonb not null check(jsonb_typeof(proposal)='object'),
 foreign key(baseline_id,business_id,ad_account_id) references public.account_organization_baselines(id,business_id,ad_account_id) on delete cascade,
 unique(baseline_id,version)
);
alter table public.account_organization_baselines enable row level security;
alter table public.account_organization_versions enable row level security;
revoke all on public.account_organization_baselines,public.account_organization_versions from anon,authenticated,service_role;
grant select on public.account_organization_baselines,public.account_organization_versions to authenticated;
grant select,insert on public.account_organization_baselines,public.account_organization_versions to service_role;
create policy organizer_baseline_read on public.account_organization_baselines for select to authenticated using(public.can_access_business(business_id));
create policy organizer_version_read on public.account_organization_versions for select to authenticated using(public.can_access_business(business_id));
create function public.prevent_organization_history_update() returns trigger language plpgsql set search_path='' as $$ begin raise exception 'Organization history is immutable'; end $$;
create trigger organizer_baseline_immutable before update on public.account_organization_baselines for each row execute function public.prevent_organization_history_update();
create trigger organizer_version_immutable before update on public.account_organization_versions for each row execute function public.prevent_organization_history_update();
