-- Meta webhooks are a trigger into the existing account sync queue, never a source of facts.
-- No schedule, deployment, or advertising write is added.

-- 1. Verified deliveries (signal only: field, object id/level and Meta's short notice text).
create table public.meta_webhook_events (
 id uuid primary key default gen_random_uuid(),
 dedupe_key text not null unique,
 external_account_id text not null,
 field text not null,
 object_id text,
 object_level text check (object_level in ('campaign','adset','ad','creative')),
 detail jsonb not null default '{}'::jsonb,
 sent_at timestamptz,
 received_at timestamptz not null default now(),
 matched_accounts integer not null default 0
);
create index meta_webhook_events_account on public.meta_webhook_events(external_account_id,received_at desc);
create index meta_webhook_events_received on public.meta_webhook_events(received_at);
alter table public.meta_webhook_events enable row level security;
revoke all on public.meta_webhook_events from public,anon,authenticated;
grant select,insert,update,delete on public.meta_webhook_events to service_role;

create table public.meta_webhook_subscriptions (
 ad_account_id uuid primary key references public.ad_accounts(id) on delete cascade,
 business_id uuid not null references public.business_profiles(id) on delete cascade,
 status text not null check (status in ('subscribed','failed','unsubscribed')),
 reason text,
 checked_at timestamptz not null default now()
);
alter table public.meta_webhook_subscriptions enable row level security;
revoke all on public.meta_webhook_subscriptions from public,anon,authenticated;
grant select,insert,update,delete on public.meta_webhook_subscriptions to service_role;

-- Duplicate deliveries return null. Old deliveries are pruned here (30 days, bounded), so no schedule is needed.
create function public.record_meta_webhook_event(p_key text,p_account text,p_field text,p_object text,p_level text,p_detail jsonb,p_sent timestamptz)
returns uuid language plpgsql security invoker set search_path=public as $$
declare created uuid;
begin
 if p_key is null or length(p_key)<>64 or p_account is null or p_account !~ '^[0-9]{1,20}$' or p_field is null or length(p_field)>64
  or pg_column_size(coalesce(p_detail,'{}'::jsonb))>4096 then raise exception 'Invalid webhook event'; end if;
 delete from public.meta_webhook_events where id in (select id from public.meta_webhook_events where received_at<now()-interval '30 days' order by received_at limit 500);
 insert into public.meta_webhook_events(dedupe_key,external_account_id,field,object_id,object_level,detail,sent_at)
 values(p_key,p_account,p_field,left(p_object,40),p_level,coalesce(p_detail,'{}'::jsonb),p_sent)
 on conflict(dedupe_key) do nothing returning id into created;
 return created;
end $$;
revoke all on function public.record_meta_webhook_event(text,text,text,text,text,jsonb,timestamptz) from public,anon,authenticated;
grant execute on function public.record_meta_webhook_event(text,text,text,text,text,jsonb,timestamptz) to service_role;

-- 2. "events" resource: a status/issue re-read of the hierarchy. It never touches performance facts.
alter table public.account_sync_resources drop constraint account_sync_resources_kind_check;
alter table public.account_sync_resources add constraint account_sync_resources_kind_check check(kind in ('performance','audience','maintenance','events'));

-- Union of affected objects; null means "read the whole hierarchy" (unknown scope or more than 50 objects).
create function public.merge_event_objects(a jsonb,b jsonb) returns jsonb language sql immutable set search_path=public as $$
 select case when a is null or b is null or jsonb_typeof(a)<>'array' or jsonb_typeof(b)<>'array' then null
  else (select case when count(*)>50 then null else coalesce(jsonb_agg(d.x),'[]'::jsonb) end from (select distinct x from jsonb_array_elements(a||b) x) d) end $$;
revoke all on function public.merge_event_objects(jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.merge_event_objects(jsonb,jsonb) to service_role;

create or replace function public.request_account_resource(p_business uuid,p_integration uuid,p_account uuid,p_kind text,p_query jsonb,
 p_allow_simulation boolean default false) returns jsonb language plpgsql security invoker set search_path=public as $$
declare a public.ad_accounts; i public.platform_integrations; s public.ad_account_sync_state; r public.account_sync_resources;
 k text; j public.account_sync_jobs; since_day date; until_day date; ttl interval; pri integer; last_full timestamptz; simulated boolean; merged jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended('meta-resource:'||p_account::text,0));
 select * into a from public.ad_accounts where id=p_account and business_id=p_business;
 select * into i from public.platform_integrations where id=p_integration and business_id=p_business and platform_id=a.platform_id;
 if a.id is null or i.id is null or not exists(select 1 from public.platforms where id=a.platform_id and key='meta') then
  raise exception 'Invalid account scope' using errcode='42501'; end if;
 if i.status not in ('connected','error') or i.disconnected_at is not null or i.integration_details->>'primary_ad_account_external_id' is distinct from a.external_account_id then
  return jsonb_build_object('status','skipped','reason','not_connected'); end if;
 simulated:=i.integration_details ? 'deepvisor-meta-phase2';
 if simulated and not p_allow_simulation then return jsonb_build_object('status','skipped','reason','simulation_disabled'); end if;
 if not simulated and (i.access_token_secret_id is null or i.token_expires_at<=now()) then
  return jsonb_build_object('status','skipped','reason','reauthentication_required'); end if;
 select * into s from public.ad_account_sync_state where ad_account_id=p_account;
 if not coalesce(s.first_full_sync_completed,false) then return jsonb_build_object('status','skipped','reason','initial_sync_required'); end if;
 if a.timezone is null or not exists(select 1 from pg_timezone_names where name=a.timezone) then
  return jsonb_build_object('status','skipped','reason','timezone_unavailable'); end if;
 if p_kind not in ('performance','audience','maintenance','events') or p_query->>'version' is distinct from '2' then raise exception 'Invalid resource query'; end if;
 since_day:=(p_query->>'since')::date; until_day:=(p_query->>'until')::date;
 if since_day is null or until_day is null or until_day<since_day or until_day-since_day>30 or until_day>(now() at time zone a.timezone)::date then raise exception 'Invalid resource range'; end if;
 if p_kind='audience' and (p_query->>'breakdown' is null or p_query->>'breakdown' not in ('age_gender','country','region','publisher_platform','impression_device')) then raise exception 'Unsupported breakdown'; end if;
 if exists(select 1 from public.business_data_policies p where p.business_id=p_business and
 ((p_kind='audience' and (not ((p_query->>'breakdown')=any(p.allowed_breakdowns)) or since_day<(now() at time zone a.timezone)::date-(p.audience_history_days-1)))
 or (p_kind not in ('audience','events') and since_day<(now() at time zone a.timezone)::date-(p.daily_history_days-1)))) then
  return jsonb_build_object('status','skipped','reason','policy_limit'); end if;
 k:=case when p_kind='events' then 'events:v2' when p_kind='maintenance' then 'maintenance:v2' when p_kind='performance' then 'performance:v2' else 'audience:v2:'||(p_query->>'breakdown')||':'||since_day::text||':'||until_day::text end;
 -- A provider event always asks for a new read: it is never "fresh". Demand coalesces in the queue instead.
 ttl:=case when p_kind='events' then interval '0' when p_kind='maintenance' then case when p_query->>'source'='scheduled_refresh' then interval '6 hours' else interval '60 minutes' end when p_kind='audience' then interval '12 hours' when p_query->>'source'='scheduled_refresh' then interval '90 minutes' else interval '15 minutes' end;
 pri:=case when p_kind='events' then 40 when p_kind='maintenance' then 0 when p_kind='audience' then 20 when p_query->>'source'='scheduled_refresh' then 10 else 30 end;
 if p_query->>'source'='app_visit' then update public.ad_account_sync_state set active_until=now()+interval '10 minutes' where ad_account_id=p_account; end if;
 select * into r from public.account_sync_resources where ad_account_id=p_account and resource_key=k for update;
 if r.availability='blocked' and i.connected_at>r.last_attempt_at then
  update public.account_sync_resources set availability='unknown',failures=0,not_before=now() where ad_account_id=p_account and resource_key=k;
  r.availability:='unknown'; r.failures:=0; r.not_before:=now();
 end if;
 if r.last_success_at>now()-ttl and r.coverage_start<=since_day and r.coverage_end>=until_day then
  return jsonb_build_object('status','skipped','reason','fresh','revision',r.revision); end if;
 if r.availability='blocked' then return jsonb_build_object('status','skipped','reason','retry_limit'); end if;
 if r.not_before>now() then
  -- Deferred event demand widens to a full hierarchy read; the existing worker promotes it after the delay.
  if p_kind='events' and r.pending then update public.account_sync_resources set query=query-'objects' where ad_account_id=p_account and resource_key=k; end if;
  return jsonb_build_object('status','skipped','reason','failure_backoff'); end if;
 -- Recent successful full sync also satisfies the light read; timestamps alone never imply coverage.
 if p_kind in ('performance','maintenance') then
  select max(finished_at) into last_full from public.account_sync_jobs where ad_account_id=p_account and status='completed'
   and sync_type<>'resource_refresh' and requested_start_date<=since_day and requested_end_date>=until_day;
  if last_full>now()-ttl then return jsonb_build_object('status','skipped','reason','fresh'); end if;
 end if;
 if p_kind='audience' and r.resource_key is null and (select count(*) from public.account_sync_resources where ad_account_id=p_account and kind='audience' and requested_at>now()-interval '1 day')>=8 then
  return jsonb_build_object('status','skipped','reason','query_budget'); end if;
 select * into j from public.account_sync_jobs where ad_account_id=p_account and status in ('queued','running') limit 1;
 if p_kind='events' and j.status='queued' and j.sync_type='resource_refresh' and j.metadata->>'resourceKey'=k then
  -- Not started yet: the queued read will observe this change too. Add its objects to that job.
  merged:=public.merge_event_objects(j.metadata#>'{query,objects}',p_query->'objects');
  update public.account_sync_jobs set metadata=metadata||jsonb_build_object('query',((metadata->'query')-'objects')||case when merged is null then '{}'::jsonb else jsonb_build_object('objects',merged) end) where id=j.id;
  return jsonb_build_object('status','queued','reason','existing_job','jobId',j.id);
 end if;
 -- A running event read may already have passed this object, so later demand stays pending behind it.
 if p_kind<>'events' and j.sync_type='resource_refresh' and j.metadata->>'resourceKey'=k and j.requested_start_date<=since_day and j.requested_end_date>=until_day then
  return jsonb_build_object('status',j.status,'reason','existing_job','jobId',j.id); end if;
 insert into public.account_sync_resources(ad_account_id,resource_key,business_id,platform_integration_id,kind,query,priority)
 values(p_account,k,p_business,p_integration,p_kind,p_query,pri)
 on conflict(ad_account_id,resource_key) do update set pending=true,priority=greatest(account_sync_resources.priority,excluded.priority),
 query=case when account_sync_resources.pending and p_kind in ('performance','maintenance') then excluded.query||jsonb_build_object(
 'since',greatest(least((account_sync_resources.query->>'since')::date,(excluded.query->>'since')::date),(excluded.query->>'until')::date-30),'until',greatest(account_sync_resources.query->>'until',excluded.query->>'until'))
 when account_sync_resources.pending and p_kind='events' then (excluded.query-'objects')||case when public.merge_event_objects(account_sync_resources.query->'objects',excluded.query->'objects') is null then '{}'::jsonb
  else jsonb_build_object('objects',public.merge_event_objects(account_sync_resources.query->'objects',excluded.query->'objects')) end
 else excluded.query end;
 -- Noisy accounts: after 20 event reads in an hour, further demand waits five minutes (kept pending, never dropped).
 if p_kind='events' and (select count(*) from public.account_sync_jobs where ad_account_id=p_account and metadata->>'resourceKey'=k and created_at>now()-interval '1 hour')>=20 then
  update public.account_sync_resources set not_before=now()+interval '5 minutes',query=query-'objects' where ad_account_id=p_account and resource_key=k;
  return jsonb_build_object('status','skipped','reason','event_budget');
 end if;
 if j.id is not null then return jsonb_build_object('status','skipped','reason','pending_followup'); end if;
 return public.promote_account_resource(p_account);
end $$;

-- Completion for an events read: no staged rows and no fact tables are involved.
create function public.complete_account_events(p_job uuid,p_generation integer) returns bigint language plpgsql security invoker set search_path=public as $$
declare j public.account_sync_jobs; rev bigint;
begin
 select * into j from public.account_sync_jobs where id=p_job for update;
 if j.id is null or p_generation is null or j.sync_type<>'resource_refresh' or j.metadata->>'resourceKind' is distinct from 'events' or j.status<>'running'
  or j.lease_generation<>p_generation or j.lease_expires_at<=now() then raise exception 'Expired resource lease' using errcode='40001'; end if;
 update public.account_sync_resources set last_success_at=now(),last_attempt_at=now(),coverage_start=j.requested_start_date,coverage_end=j.requested_end_date,
  revision=revision+1,failures=0,not_before=now(),availability='available'
 where ad_account_id=j.ad_account_id and resource_key='events:v2' returning revision into rev;
 update public.account_sync_jobs set status='completed',finished_at=now(),updated_at=now(),actual_start_date=j.requested_start_date,actual_end_date=j.requested_end_date,
  performance_rows_synced=0,lease_expires_at=null where id=p_job;
 return rev;
end $$;
revoke all on function public.complete_account_events(uuid,integer) from public,anon,authenticated;
grant execute on function public.complete_account_events(uuid,integer) to service_role;

-- 3. Live signal. Payload carries no advertising data: clients re-read through their normal authorized APIs.
create function public.signal_account(p_account uuid,p_kind text) returns void language plpgsql security definer set search_path='' as $$
begin
 if to_regprocedure('realtime.send(jsonb,text,text,boolean)') is null then return; end if;
 execute 'select realtime.send($1,$2,$3,true)' using jsonb_build_object('kind',p_kind,'at',now()),'changed','account:'||p_account::text;
exception when others then null; -- A missing/unavailable Realtime service must never fail a sync.
end $$;
revoke all on function public.signal_account(uuid,text) from public,anon,authenticated;

create function public.signal_lifecycle_events() returns trigger language plpgsql security invoker set search_path=public as $$
declare a uuid;
begin for a in select distinct ad_account_id from changed loop perform public.signal_account(a,'insights'); end loop; return null; end $$;
create trigger ad_lifecycle_events_signal after insert on public.ad_lifecycle_events referencing new table as changed for each statement execute function public.signal_lifecycle_events();

create function public.signal_issue_changes() returns trigger language plpgsql security invoker set search_path=public as $$
begin
 if tg_op='INSERT' then perform public.signal_account(new.ad_account_id,'insights');
 elsif old.revision is distinct from new.revision or old.resolved_at is distinct from new.resolved_at then perform public.signal_account(new.ad_account_id,'insights'); end if;
 return null;
end $$;
create trigger insight_issues_signal after insert or update on public.insight_issues for each row execute function public.signal_issue_changes();

create function public.signal_resource_revision() returns trigger language plpgsql security invoker set search_path=public as $$
begin
 if new.revision is distinct from old.revision and new.kind in ('performance','maintenance','events') then perform public.signal_account(new.ad_account_id,'data'); end if;
 return null;
end $$;
create trigger account_sync_resources_signal after update on public.account_sync_resources for each row execute function public.signal_resource_revision();
revoke all on function public.signal_lifecycle_events(),public.signal_issue_changes(),public.signal_resource_revision() from public,anon,authenticated;

-- Only members of the account may join its private topic. Restrictive: it narrows any broader broadcast policy.
do $$ begin
 if to_regclass('realtime.messages') is not null then
  execute $p$create policy account_signal_members on realtime.messages as restrictive for select to authenticated
   using (realtime.topic() not like 'account:%' or (realtime.topic() ~ '^account:[0-9a-f-]{36}$' and public.can_access_ad_account(substring(realtime.topic() from 9)::uuid)))$p$;
  if not exists(select 1 from pg_policies where schemaname='realtime' and tablename='messages' and permissive='PERMISSIVE' and cmd='SELECT') then
   execute $p$create policy account_signal_listen on realtime.messages for select to authenticated using (realtime.topic() like 'account:%')$p$;
  end if;
 end if;
end $$;
