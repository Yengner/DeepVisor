begin;
alter table public.account_organization_versions add constraint organizer_version_scope unique(id,business_id,ad_account_id);
create table public.organization_rename_previews (
 id uuid primary key default gen_random_uuid(), business_id uuid not null references public.business_profiles(id),
 ad_account_id uuid not null, version_id uuid not null references public.account_organization_versions(id),
 actor_id uuid not null, created_at timestamptz not null default now(), expires_at timestamptz not null default (now()+interval '15 minutes'),
 fingerprint text not null, simulated boolean not null, changes jsonb not null check(jsonb_array_length(changes) between 1 and 5),
 restores_run_id uuid, foreign key(business_id,ad_account_id) references public.ad_accounts(business_id,id),unique(id,business_id), foreign key(version_id,business_id,ad_account_id) references public.account_organization_versions(id,business_id,ad_account_id)
);
create table public.organization_rename_approvals (
 id uuid primary key default gen_random_uuid(),business_id uuid not null,preview_id uuid not null unique,
 version_id uuid not null unique references public.account_organization_versions(id),actor_id uuid not null,
 created_at timestamptz not null default now(),fingerprint text not null,
 foreign key(preview_id,business_id) references public.organization_rename_previews(id,business_id),unique(id,business_id)
);
create table public.organization_rename_runs (
 id uuid primary key default gen_random_uuid(),business_id uuid not null,approval_id uuid not null unique,actor_id uuid not null,
 created_at timestamptz not null default now(),execution_deadline timestamptz not null default (now()+interval '3 minutes'),finished_at timestamptz,active boolean not null default true,
 foreign key(approval_id,business_id) references public.organization_rename_approvals(id,business_id),unique(id,business_id)
);
create unique index organization_rename_business_lock on public.organization_rename_runs(business_id) where active;
create table public.organization_rename_events (
 id bigint generated always as identity primary key,business_id uuid not null,run_id uuid not null,actor_id uuid not null,
 created_at timestamptz not null default now(),event jsonb not null,
 foreign key(run_id,business_id) references public.organization_rename_runs(id,business_id)
);
create index organization_rename_events_run on public.organization_rename_events(run_id,id);
create table public.organization_rename_simulation (
 business_id uuid not null,ad_account_id uuid not null,entity_id uuid not null references public.ad_entities(id),state jsonb not null,
 primary key(business_id,ad_account_id,entity_id),foreign key(business_id,ad_account_id) references public.ad_accounts(business_id,id)
);
alter table public.organization_rename_previews add foreign key(restores_run_id,business_id) references public.organization_rename_runs(id,business_id);
-- Immutable proposal lineage for restoration; original Phase 1 snapshots stay untouched.
alter table public.account_organization_versions add column restores_run_id uuid;
alter table public.account_organization_versions add foreign key(restores_run_id,business_id) references public.organization_rename_runs(id,business_id);
do $$ declare t text; begin
 foreach t in array array['organization_rename_previews','organization_rename_approvals','organization_rename_runs','organization_rename_events','organization_rename_simulation'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
 execute format('grant select,insert on public.%I to service_role',t);
 if t<>'organization_rename_simulation' then
 execute format('grant select on public.%I to authenticated',t);
 execute format('create policy business_read on public.%I for select to authenticated using(public.can_access_business(business_id))',t);
 end if;
 if t not in ('organization_rename_runs','organization_rename_simulation') then
 execute format('create trigger immutable before update or delete on public.%I for each row execute function public.prevent_organization_history_update()',t);
 end if;
 end loop;
end $$;
grant update on public.organization_rename_runs,public.organization_rename_simulation to service_role;
grant usage,select on sequence public.organization_rename_events_id_seq to service_role;
create function public.organizer_assert_owner(p_business uuid,p_actor uuid) returns void language plpgsql set search_path='' as $$ begin
 if not exists(select 1 from public.organization_memberships m join public.business_profiles b on b.organization_id=m.organization_id where b.id=p_business and m.user_id=p_actor and m.role in ('owner','admin')) then raise exception 'Organizer owner/admin required';end if;
end $$;
create function public.organizer_approve(p_business uuid,p_actor uuid,p_preview uuid,p_fingerprint text) returns uuid language plpgsql set search_path='' as $$
declare p public.organization_rename_previews; result uuid;
begin
 perform public.organizer_assert_owner(p_business,p_actor);
 select * into p from public.organization_rename_previews where id=p_preview and business_id=p_business for update;
 if p.id is null or p.expires_at<now() or p.fingerprint<>p_fingerprint then raise exception 'Invalid or expired preview';end if;
 if not exists(select 1 from public.account_organization_versions v where v.id=p.version_id and v.business_id=p_business and v.ad_account_id=p.ad_account_id) then raise exception 'Invalid plan scope';end if;
 insert into public.organization_rename_approvals(business_id,preview_id,version_id,actor_id,fingerprint) values(p_business,p.id,p.version_id,p_actor,p_fingerprint) returning id into result;
 return result;
end $$;
-- Bidirectional coordination with existing Review AND Limited Auto claims.
create function public.organizer_execution_lock() returns trigger language plpgsql set search_path='' as $$ begin
 perform pg_advisory_xact_lock(hashtextextended(new.business_id::text,0));
 if new.active then
 if tg_table_schema='ai' then
 if exists(select 1 from public.organization_rename_runs where business_id=new.business_id and active) then raise exception 'Organizer execution unresolved';end if;
 else
 if exists(select 1 from ai.review_execution_claims where business_id=new.business_id and active) then raise exception 'Advertising execution unresolved';end if;
 end if;end if;return new;
end $$;
create trigger organizer_shared_lock before insert or update of active on public.organization_rename_runs for each row execute function public.organizer_execution_lock();
create trigger organizer_shared_lock before insert or update of active on ai.review_execution_claims for each row execute function public.organizer_execution_lock();
create function public.organizer_claim(p_business uuid,p_actor uuid,p_approval uuid) returns jsonb language plpgsql set search_path='' as $$
declare a public.organization_rename_approvals;p public.organization_rename_previews;r public.organization_rename_runs;
begin
 perform public.organizer_assert_owner(p_business,p_actor);
 perform pg_advisory_xact_lock(hashtextextended(p_business::text,0));
 select * into a from public.organization_rename_approvals where id=p_approval and business_id=p_business;
 select * into p from public.organization_rename_previews where id=a.preview_id and business_id=p_business;
 if a.id is null or p.id is null then raise exception 'Approval missing';end if;
 select * into r from public.organization_rename_runs where approval_id=a.id;
 if r.id is not null then return jsonb_build_object('claimed',false,'run',to_jsonb(r),'preview',to_jsonb(p));end if;
 if p.expires_at<now() or a.fingerprint<>p.fingerprint then raise exception 'Approval expired';end if;
 perform public.organizer_assert_owner(p_business,a.actor_id);
 insert into public.organization_rename_runs(business_id,approval_id,actor_id) values(p_business,a.id,p_actor) returning * into r;
 return jsonb_build_object('claimed',true,'run',to_jsonb(r),'preview',to_jsonb(p));
end $$;
do $$ declare f text;begin foreach f in array array['organizer_assert_owner(uuid,uuid)','organizer_approve(uuid,uuid,uuid,text)','organizer_execution_lock()','organizer_claim(uuid,uuid,uuid)'] loop
 execute 'revoke all on function public.'||f||' from public,anon,authenticated';execute 'grant execute on function public.'||f||' to service_role';end loop;end $$;
commit;
