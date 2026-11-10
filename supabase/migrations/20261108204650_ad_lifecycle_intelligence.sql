create table public.ad_lifecycle_observations (
 id uuid primary key default gen_random_uuid(), business_id uuid not null references public.business_profiles(id),
 ad_account_id uuid not null references public.ad_accounts(id), job_id uuid unique references public.account_sync_jobs(id),
 observed_at timestamptz not null default now(), entities jsonb not null check(jsonb_typeof(entities)='array')
);
create index lifecycle_observation_account on public.ad_lifecycle_observations(ad_account_id,observed_at desc);
create table public.ad_lifecycle_events (
 id uuid primary key default gen_random_uuid(),business_id uuid not null references public.business_profiles(id),ad_account_id uuid not null references public.ad_accounts(id),
 before_id uuid references public.ad_lifecycle_observations(id),after_id uuid not null references public.ad_lifecycle_observations(id),
 event_key text not null,kind text not null,root_id text not null,affected_ids text[] not null,explanation text not null,
 provenance text not null default 'observed' check(provenance in ('observed','reconstructed')),created_at timestamptz not null default now(),unique(after_id,event_key)
);
create index lifecycle_event_account on public.ad_lifecycle_events(ad_account_id,created_at desc);
create table public.ad_lifecycle_briefs (
 id uuid primary key default gen_random_uuid(),event_id uuid not null references public.ad_lifecycle_events(id),
 revision integer not null,payload jsonb not null,created_at timestamptz not null default now(),unique(event_id,revision)
);
create table public.ad_lifecycle_acknowledgements (
 event_id uuid not null references public.ad_lifecycle_events(id),user_id uuid not null references auth.users(id) on delete cascade,
 acknowledged_at timestamptz not null default now(),primary key(event_id,user_id)
);
alter table public.ad_lifecycle_observations enable row level security;
alter table public.ad_lifecycle_events enable row level security;
alter table public.ad_lifecycle_briefs enable row level security;
alter table public.ad_lifecycle_acknowledgements enable row level security;
revoke all on public.ad_lifecycle_observations,public.ad_lifecycle_events,public.ad_lifecycle_briefs,public.ad_lifecycle_acknowledgements from public,anon,authenticated,service_role;
grant select on public.ad_lifecycle_observations,public.ad_lifecycle_events,public.ad_lifecycle_briefs,public.ad_lifecycle_acknowledgements to authenticated;
grant insert on public.ad_lifecycle_acknowledgements to authenticated;
grant select,insert on public.ad_lifecycle_observations,public.ad_lifecycle_events,public.ad_lifecycle_briefs,public.ad_lifecycle_acknowledgements to service_role;
create policy lifecycle_observation_read on public.ad_lifecycle_observations for select to authenticated using(public.can_access_ad_account(ad_account_id));
create policy lifecycle_event_read on public.ad_lifecycle_events for select to authenticated using(public.can_access_ad_account(ad_account_id));
create policy lifecycle_brief_read on public.ad_lifecycle_briefs for select to authenticated using(exists(select 1 from public.ad_lifecycle_events e where e.id=event_id and public.can_access_ad_account(e.ad_account_id)));
create policy lifecycle_ack_read on public.ad_lifecycle_acknowledgements for select to authenticated using(user_id=(select auth.uid()));
create policy lifecycle_ack_insert on public.ad_lifecycle_acknowledgements for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.ad_lifecycle_events e where e.id=event_id and public.can_access_ad_account(e.ad_account_id)));
create function public.publish_ad_lifecycle(p_job uuid,p_generation integer,p_previous uuid,p_entities jsonb,p_events jsonb) returns uuid language plpgsql security invoker set search_path=public as $$
declare j public.account_sync_jobs; previous uuid; snapshot uuid; e jsonb;
begin
 select * into j from public.account_sync_jobs where id=p_job for update;
 if j.id is null or p_generation is null or j.lease_generation<>p_generation or j.status not in ('running','completed') then raise exception 'Invalid lifecycle lease'; end if;
 if j.status='running' and (j.lease_expires_at is null or j.lease_expires_at<=now()) then raise exception 'Expired lifecycle lease'; end if;
 perform pg_advisory_xact_lock(hashtextextended('lifecycle:'||j.ad_account_id::text,0));
 select id into snapshot from public.ad_lifecycle_observations where job_id=p_job;
 if snapshot is not null then return snapshot; end if;
 select id into previous from public.ad_lifecycle_observations where ad_account_id=j.ad_account_id order by observed_at desc,id desc limit 1;
 if previous is distinct from p_previous then raise exception 'Lifecycle baseline changed' using errcode='40001'; end if;
 insert into public.ad_lifecycle_observations(business_id,ad_account_id,job_id,entities) values(j.business_id,j.ad_account_id,p_job,p_entities) returning id into snapshot;
 if previous is not null then
 for e in select value from jsonb_array_elements(p_events) loop
 insert into public.ad_lifecycle_events(business_id,ad_account_id,before_id,after_id,event_key,kind,root_id,affected_ids,explanation)
 values(j.business_id,j.ad_account_id,previous,snapshot,(e->>'kind')||':'||(e->>'root'),e->>'kind',e->>'root',array(select jsonb_array_elements_text(e->'affected')),e->>'explanation');
 end loop;
 end if;
 return snapshot;
end $$;
revoke all on function public.publish_ad_lifecycle(uuid,integer,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.publish_ad_lifecycle(uuid,integer,uuid,jsonb,jsonb) to service_role;

create index lifecycle_event_before on public.ad_lifecycle_events(before_id);
create index lifecycle_event_after on public.ad_lifecycle_events(after_id);
create index lifecycle_ack_user on public.ad_lifecycle_acknowledgements(user_id);
create index lifecycle_event_business on public.ad_lifecycle_events(business_id);
create index lifecycle_observation_business on public.ad_lifecycle_observations(business_id);
