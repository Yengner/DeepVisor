-- Many client businesses for one operator. Each client is an ordinary organization + business.
-- Operator records (who is a client, fees, which ad account is theirs) are server-only: browser
-- roles get no access. Client businesses are not synced and never receive the operator's token.

alter table public.organization_memberships add column if not exists kind text not null default 'direct';
alter table public.organization_memberships drop constraint if exists organization_memberships_kind_check;
alter table public.organization_memberships add constraint organization_memberships_kind_check check (kind in ('direct','managed'));

-- Workspaces allowed to manage client businesses. Rows are added by hand with the service role.
create table if not exists public.operator_workspaces(
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.client_engagements(
  business_id uuid primary key references public.business_profiles(id) on delete cascade,
  operator_organization_id uuid not null references public.operator_workspaces(organization_id) on delete restrict,
  service_level text not null default 'managed' check (service_level in ('self_serve','assisted','managed','premium')),
  monthly_fee_cents integer check (monthly_fee_cents between 0 and 100000000),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  paid_through date,
  content_addon boolean not null default false,
  note text check (char_length(note) <= 2000),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  updated_at timestamptz not null default now()
);
create index if not exists client_engagements_operator_idx on public.client_engagements(operator_organization_id);

-- Which Meta ad account belongs to which client. The primary key allows one business per account.
-- This is a label for navigation only: it grants no Meta access and starts no sync.
create table if not exists public.client_ad_accounts(
  external_account_id text primary key check (external_account_id ~ '^[0-9]{1,20}$'),
  business_id uuid not null references public.business_profiles(id) on delete cascade,
  name text check (char_length(name) <= 200),
  linked_at timestamptz not null default now()
);
create index if not exists client_ad_accounts_business_idx on public.client_ad_accounts(business_id);

alter table public.operator_workspaces enable row level security;
alter table public.client_engagements enable row level security;
alter table public.client_ad_accounts enable row level security;
revoke all on table public.operator_workspaces, public.client_engagements, public.client_ad_accounts from anon, authenticated;
grant all on table public.operator_workspaces, public.client_engagements, public.client_ad_accounts to service_role;

-- Organization, business, the operator's membership and the engagement, or none of them.
create or replace function public.create_client_business(
  p_user uuid, p_name text, p_location text default null, p_industry text default null, p_language text default 'en'
) returns uuid language plpgsql security definer set search_path = '' as $$
declare operator_org uuid; org_id uuid; business uuid; label text := btrim(coalesce(p_name, ''));
begin
  select m.organization_id into operator_org from public.organization_memberships m
    join public.operator_workspaces o on o.organization_id = m.organization_id
    where m.user_id = p_user and m.role = 'owner' order by m.created_at, m.id limit 1;
  if operator_org is null then raise exception 'CLIENT_NOT_OPERATOR' using errcode = '42501'; end if;
  if char_length(label) not between 1 and 120 then raise exception 'CLIENT_NAME_INVALID' using errcode = '22023'; end if;
  insert into public.organizations(name, type, primary_language)
    values (label, 'business', case when p_language = 'es' then 'es' else 'en' end) returning id into org_id;
  insert into public.business_profiles(organization_id, business_name, business_location, industry, onboarding_step, onboarding_completed)
    values (org_id, label, nullif(btrim(p_location), ''), nullif(btrim(p_industry), ''), 0, true) returning id into business;
  insert into public.organization_memberships(organization_id, user_id, role, kind) values (org_id, p_user, 'owner', 'managed');
  insert into public.client_engagements(business_id, operator_organization_id) values (business, operator_org);
  return business;
end $$;
revoke all on function public.create_client_business(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.create_client_business(uuid, text, text, text, text) to service_role;

-- Deleting a sole member removes that organization and its businesses. An operator is the sole
-- member of every client they created, so refuse while any of those engagements is still active.
-- The body is the live definition with one added check (ACCOUNT_DELETE_ACTIVE_CLIENTS).
create or replace function public.assert_account_deletable(p_user uuid)
 returns void language plpgsql security definer set search_path to '' as $function$
declare membership record; members integer;
begin
  if not exists(select 1 from public.users where id = p_user) then
    raise exception 'ACCOUNT_DELETE_MISSING';
  end if;
  -- Lock parents in stable order. New memberships and child operations cannot
  -- race the cleanup inside the Auth API's deletion transaction.
  perform o.id from public.organizations o
    join public.organization_memberships m on m.organization_id = o.id
    where m.user_id = p_user order by o.id for update of o;
  if exists(
    select 1 from public.organization_memberships mine
      join public.client_engagements e on e.operator_organization_id = mine.organization_id
      where mine.user_id = p_user and mine.role = 'owner' and e.ended_at is null
        and not exists(select 1 from public.organization_memberships other
          where other.organization_id = mine.organization_id and other.user_id <> p_user and other.role = 'owner')
  ) then raise exception 'ACCOUNT_DELETE_ACTIVE_CLIENTS'; end if;
  for membership in select * from public.organization_memberships where user_id = p_user loop
    select count(*) into members from public.organization_memberships where organization_id = membership.organization_id;
    if members > 1 and membership.role = 'owner' and not exists(
      select 1 from public.organization_memberships where organization_id = membership.organization_id and user_id <> p_user and role = 'owner'
    ) then raise exception 'ACCOUNT_DELETE_LAST_OWNER'; end if;
    if members = 1 then
      perform id from public.business_profiles where organization_id = membership.organization_id order by id for update;
      perform j.id from public.account_sync_jobs j join public.business_profiles b on b.id = j.business_id
        where b.organization_id = membership.organization_id for update of j;
      perform j.id from ai.shadow_evaluation_jobs j join public.business_profiles b on b.id = j.business_id
        where b.organization_id = membership.organization_id for update of j;
      if exists(select 1 from public.account_sync_jobs j join public.business_profiles b on b.id = j.business_id
          where b.organization_id = membership.organization_id and j.status = 'running')
        or exists(select 1 from ai.shadow_evaluation_jobs j join public.business_profiles b on b.id = j.business_id
          where b.organization_id = membership.organization_id and j.status = 'running')
        or exists(select 1 from ai.review_execution_claims c join public.business_profiles b on b.id = c.business_id
          where b.organization_id = membership.organization_id and c.active)
        or exists(select 1 from ai.executed_actions e join public.business_profiles b on b.id = e.business_id
          where b.organization_id = membership.organization_id and e.status in ('pending', 'running'))
      then raise exception 'ACCOUNT_DELETE_BUSY'; end if;
    end if;
  end loop;
  -- Former members may still be referenced as a shared resource's creator.
  if exists(
    select 1 from public.business_profiles b where (
      exists(select 1 from public.platform_integrations i where i.business_id = b.id and i.connected_by_user_id = p_user)
      or exists(select 1 from public.campaign_drafts d where d.business_id = b.id and d.created_by_user_id = p_user)
    ) and not exists(select 1 from public.organization_memberships m where m.organization_id = b.organization_id)
  ) then raise exception 'ACCOUNT_DELETE_LAST_OWNER'; end if;
  -- Storage bytes must be removed/transferred through the Storage API, never SQL.
  -- Do not silently remove uploads which could still be used by a shared workspace.
  if exists(select 1 from storage.objects where owner = p_user or owner_id = p_user::text) then
    raise exception 'ACCOUNT_DELETE_STORAGE';
  end if;
end;
$function$;
revoke all on function public.assert_account_deletable(uuid) from public, anon, authenticated;
grant execute on function public.assert_account_deletable(uuid) to service_role;
