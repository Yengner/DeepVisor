-- Resource-aware reads share account_sync_jobs and its one-active-account constraint.
-- No schedules, secrets, advertising permissions or existing execution gates change.
alter table public.account_sync_jobs drop constraint account_sync_jobs_sync_type_check;
alter table public.account_sync_jobs add constraint account_sync_jobs_sync_type_check check
 (sync_type in ('initial_historical','incremental','manual_refresh','backfill','resource_refresh'));
alter table public.account_sync_jobs add column lease_generation integer not null default 0,
 add column lease_expires_at timestamptz, add column not_before timestamptz not null default now(),
 add column priority integer not null default 0;
alter table public.ad_account_sync_state add column active_until timestamptz;
create index account_sync_resource_claim on public.account_sync_jobs(not_before,priority desc,created_at)
 where sync_type='resource_refresh' and status in ('queued','running');

create table public.account_sync_resources (
 ad_account_id uuid not null references public.ad_accounts(id) on delete cascade,
 resource_key text not null, business_id uuid not null references public.business_profiles(id) on delete cascade,
 platform_integration_id uuid not null references public.platform_integrations(id) on delete cascade,
 kind text not null check(kind in ('performance','audience')),
 query jsonb not null, pending boolean not null default true,
 priority integer not null default 0, requested_at timestamptz not null default now(),
 not_before timestamptz not null default now(), failures integer not null default 0,
 last_attempt_at timestamptz, last_success_at timestamptz, coverage_start date, coverage_end date,
 revision bigint not null default 0, last_job_id uuid references public.account_sync_jobs(id) on delete set null,
 availability text not null default 'unknown' check(availability in ('unknown','available','empty','unsupported','blocked','error')),
 primary key(ad_account_id,resource_key)
);
create index account_sync_resources_pending on public.account_sync_resources(not_before,requested_at) where pending;
alter table public.account_sync_resources enable row level security;
grant select on public.account_sync_resources to authenticated;
create policy resource_scope on public.account_sync_resources for select to authenticated using(public.can_access_ad_account(ad_account_id));
grant all on public.account_sync_resources to service_role;

-- Staged normalized rows are private, bounded, and never visible as partial reporting.
create table public.account_sync_staging (
 job_id uuid not null references public.account_sync_jobs(id) on delete cascade,
 generation integer not null, chunk integer not null check(chunk between 0 and 199),
 rows jsonb not null check(jsonb_typeof(rows)='array' and jsonb_array_length(rows)<=500),
 created_at timestamptz not null default now(), primary key(job_id,generation,chunk)
);
alter table public.account_sync_staging enable row level security;
revoke all on public.account_sync_staging from anon,authenticated;
grant all on public.account_sync_staging to service_role;
create table public.audience_snapshot_batches (
 id uuid primary key default gen_random_uuid(), ad_account_id uuid not null references public.ad_accounts(id) on delete cascade,
 business_id uuid not null references public.business_profiles(id) on delete cascade,
 resource_key text not null, query jsonb not null, coverage_start date, coverage_end date,
 completeness text not null check(completeness in ('complete','legacy_unknown')),
 published_at timestamptz not null default now(), job_id uuid unique references public.account_sync_jobs(id) on delete set null,
 row_count integer not null check(row_count>=0)
);
create index audience_snapshot_lookup on public.audience_snapshot_batches(ad_account_id,resource_key,published_at desc);
create table public.audience_snapshot_rows (
 batch_id uuid not null references public.audience_snapshot_batches(id) on delete cascade,
 row_number integer not null, data jsonb not null, primary key(batch_id,row_number)
);
alter table public.audience_snapshot_batches enable row level security;
alter table public.audience_snapshot_rows enable row level security;
grant select on public.audience_snapshot_batches,public.audience_snapshot_rows to authenticated;
grant all on public.audience_snapshot_batches,public.audience_snapshot_rows to service_role;
create policy snapshot_scope on public.audience_snapshot_batches for select to authenticated using(public.can_access_ad_account(ad_account_id));
create policy snapshot_rows_scope on public.audience_snapshot_rows for select to authenticated using(exists
 (select 1 from public.audience_snapshot_batches b where b.id=batch_id and public.can_access_ad_account(b.ad_account_id)));

create function public.request_account_resource(p_business uuid,p_integration uuid,p_account uuid,p_kind text,p_query jsonb,
 p_allow_simulation boolean default false) returns jsonb language plpgsql security invoker set search_path=public as $$
declare a public.ad_accounts; i public.platform_integrations; s public.ad_account_sync_state; r public.account_sync_resources;
 k text; j public.account_sync_jobs; since_day date; until_day date; ttl interval; pri integer; last_full timestamptz; simulated boolean;
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
 if p_kind not in ('performance','audience') or p_query->>'version' is distinct from '2' then raise exception 'Invalid resource query'; end if;
 since_day:=(p_query->>'since')::date; until_day:=(p_query->>'until')::date;
 if since_day is null or until_day is null or until_day<since_day or until_day-since_day>30 or until_day>(now() at time zone a.timezone)::date then raise exception 'Invalid resource range'; end if;
 if p_kind='audience' and (p_query->>'breakdown' is null or p_query->>'breakdown' not in ('age_gender','country','region','publisher_platform','impression_device')) then raise exception 'Unsupported breakdown'; end if;
 k:=case when p_kind='performance' then 'performance:v2' else 'audience:v2:'||(p_query->>'breakdown')||':'||since_day::text||':'||until_day::text end;
 ttl:=case when p_kind='audience' then interval '12 hours' when p_query->>'source'='scheduled_refresh' then interval '90 minutes' else interval '15 minutes' end;
 pri:=case when p_kind='audience' then 20 when p_query->>'source'='scheduled_refresh' then 10 else 30 end;
 if p_query->>'source'='app_visit' then update public.ad_account_sync_state set active_until=now()+interval '10 minutes' where ad_account_id=p_account; end if;
 select * into r from public.account_sync_resources where ad_account_id=p_account and resource_key=k for update;
 if r.last_success_at>now()-ttl and r.coverage_start<=since_day and r.coverage_end>=until_day then
  return jsonb_build_object('status','skipped','reason','fresh','revision',r.revision); end if;
 if r.availability='blocked' or r.not_before>now() then return jsonb_build_object('status','skipped','reason',case when r.availability='blocked' then 'retry_limit' else 'failure_backoff' end); end if;
 -- Recent successful full sync also satisfies the light read; timestamps alone never imply coverage.
 if p_kind='performance' then
  select max(finished_at) into last_full from public.account_sync_jobs where ad_account_id=p_account and status='completed'
   and sync_type<>'resource_refresh' and requested_start_date<=since_day and requested_end_date>=until_day;
  if last_full>now()-ttl then return jsonb_build_object('status','skipped','reason','fresh'); end if;
 end if;
 if p_kind='audience' and r.resource_key is null and (select count(*) from public.account_sync_resources where ad_account_id=p_account and kind='audience' and requested_at>now()-interval '1 day')>=8 then
  return jsonb_build_object('status','skipped','reason','query_budget'); end if;
 select * into j from public.account_sync_jobs where ad_account_id=p_account and status in ('queued','running') limit 1;
 if j.sync_type='resource_refresh' and j.metadata->>'resourceKey'=k and j.requested_start_date<=since_day and j.requested_end_date>=until_day then
  return jsonb_build_object('status',j.status,'reason','existing_job','jobId',j.id); end if;
 insert into public.account_sync_resources(ad_account_id,resource_key,business_id,platform_integration_id,kind,query,priority)
 values(p_account,k,p_business,p_integration,p_kind,p_query,pri)
 on conflict(ad_account_id,resource_key) do update set pending=true,priority=greatest(account_sync_resources.priority,excluded.priority),
 query=case when account_sync_resources.pending and p_kind='performance' then excluded.query||jsonb_build_object(
 'since',least(account_sync_resources.query->>'since',excluded.query->>'since'),'until',greatest(account_sync_resources.query->>'until',excluded.query->>'until')) else excluded.query end;
 if j.id is not null then return jsonb_build_object('status','skipped','reason','pending_followup'); end if;
 return public.promote_account_resource(p_account);
end $$;

create function public.promote_account_resource(p_account uuid) returns jsonb language plpgsql security invoker set search_path=public as $$
declare r public.account_sync_resources; j uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended('meta-resource:'||p_account::text,0));
 if exists(select 1 from public.account_sync_jobs where ad_account_id=p_account and status in ('queued','running')) then
  return jsonb_build_object('status','skipped','reason','existing_job'); end if;
 select * into r from public.account_sync_resources where ad_account_id=p_account and pending and not_before<=now() and availability<>'blocked'
 order by priority+least(100,extract(epoch from now()-requested_at)/300) desc,requested_at limit 1 for update;
 if r.resource_key is null then return jsonb_build_object('status','skipped','reason','no_demand'); end if;
 -- Recheck connection on delayed demand, including a changed primary account.
 if not exists(select 1 from public.platform_integrations i join public.ad_accounts a on a.id=r.ad_account_id
 where i.id=r.platform_integration_id and i.business_id=r.business_id and i.status in ('connected','error') and i.disconnected_at is null
 and i.integration_details->>'primary_ad_account_external_id'=a.external_account_id
 and (i.integration_details ? 'deepvisor-meta-phase2' or (i.access_token_secret_id is not null and (i.token_expires_at is null or i.token_expires_at>now())))) then
 update public.account_sync_resources set pending=false,availability='blocked' where ad_account_id=p_account and resource_key=r.resource_key;
 return jsonb_build_object('status','skipped','reason','not_connected'); end if;
 insert into public.account_sync_jobs(business_id,platform_integration_id,ad_account_id,sync_type,status,requested_start_date,requested_end_date,priority,metadata)
 values(r.business_id,r.platform_integration_id,p_account,'resource_refresh','queued',(r.query->>'since')::date,(r.query->>'until')::date,r.priority,
 jsonb_build_object('resourceKey',r.resource_key,'resourceKind',r.kind,'query',r.query,'queuedFrom','resource_coordinator','attempt',0)) returning id into j;
 update public.account_sync_resources set pending=false,last_job_id=j where ad_account_id=p_account and resource_key=r.resource_key;
 return jsonb_build_object('status','queued','reason','enqueued','jobId',j);
exception when unique_violation then return jsonb_build_object('status','skipped','reason','pending_followup');
end $$;

create function public.claim_account_resource(p_job uuid default null) returns setof public.account_sync_jobs language plpgsql security invoker set search_path=public as $$
declare selected uuid;
begin
 -- Exhausted crashed jobs release the account slot, retaining the old published revision.
 update public.account_sync_jobs set status='failed',finished_at=now(),error_message='Refresh worker lease expired'
 where sync_type='resource_refresh' and status='running' and lease_expires_at<now() and lease_generation>=3;
 select j.id into selected from public.account_sync_jobs j join public.platform_integrations i on i.id=j.platform_integration_id
 where j.sync_type='resource_refresh' and (p_job is null or j.id=p_job) and j.not_before<=now()
 and (p_job is not null or not (i.integration_details ? 'deepvisor-meta-phase2'))
 and (j.status='queued' or (j.status='running' and j.lease_expires_at<now()))
 order by j.priority+least(100,extract(epoch from now()-j.created_at)/300) desc,j.created_at for update of j skip locked limit 1;
 return query update public.account_sync_jobs set status='running',started_at=coalesce(started_at,now()),updated_at=now(),
 lease_generation=lease_generation+1,lease_expires_at=now()+interval '5 minutes' where id=selected returning *;
end $$;

create function public.stage_account_resource(p_job uuid,p_generation integer,p_chunk integer,p_rows jsonb) returns void language plpgsql security invoker set search_path=public as $$
begin
 perform 1 from public.account_sync_jobs where id=p_job and sync_type='resource_refresh' and status='running' and lease_generation=p_generation and lease_expires_at>now() for update;
 if not found then raise exception 'Expired resource lease' using errcode='40001'; end if;
 insert into public.account_sync_staging(job_id,generation,chunk,rows) values(p_job,p_generation,p_chunk,p_rows)
 on conflict(job_id,generation,chunk) do update set rows=excluded.rows;
end $$;

create function public.publish_account_resource(p_job uuid,p_generation integer,p_chunks integer) returns bigint language plpgsql security invoker set search_path=public as $$
declare j public.account_sync_jobs; payload jsonb; n integer; rev bigint; batch uuid;
begin
 select * into j from public.account_sync_jobs where id=p_job for update;
 if j.sync_type<>'resource_refresh' or j.status<>'running' or j.lease_generation<>p_generation or j.lease_expires_at<=now() or j.id is null then raise exception 'Expired resource lease' using errcode='40001'; end if;
 if not exists(select 1 from public.platform_integrations i join public.ad_accounts a on a.id=j.ad_account_id where i.id=j.platform_integration_id
 and i.business_id=j.business_id and i.status in ('connected','error') and i.disconnected_at is null and i.integration_details->>'primary_ad_account_external_id'=a.external_account_id) then raise exception 'Account connection changed'; end if;
 select count(*),coalesce(sum(jsonb_array_length(rows)),0) into n,rev from public.account_sync_staging where job_id=p_job and generation=p_generation;
 if n<>p_chunks or p_chunks<1 then raise exception 'Incomplete staged resource'; end if;
 select coalesce(jsonb_agg(x.value),'[]') into payload from public.account_sync_staging s cross join lateral jsonb_array_elements(s.rows) x where s.job_id=p_job and s.generation=p_generation;
 if exists(select 1 from jsonb_array_elements(payload) x left join public.ad_entities e on e.id=(x->>'entity_id')::uuid
 where e.id is null or e.ad_account_id<>j.ad_account_id or e.business_id<>j.business_id or e.entity_level<>x->>'entity_level') then raise exception 'Resource entity scope mismatch' using errcode='42501'; end if;
 if j.metadata->>'resourceKind'='performance' then
  if exists(select 1 from jsonb_array_elements(payload) x where (x->>'day')::date not between j.requested_start_date and j.requested_end_date) then raise exception 'Resource date mismatch'; end if;
  -- Complete authoritative queried window only; older history is untouched. Absence is not a zero row.
  delete from public.ad_entity_performance_daily where ad_account_id=j.ad_account_id and day between j.requested_start_date and j.requested_end_date;
  insert into public.ad_entity_performance_daily(entity_id,ad_account_id,entity_level,day,spend,impressions,reach,clicks,inline_link_clicks,leads,messages,calls,currency_code,objective,status,source,updated_at)
  select x.entity_id,j.ad_account_id,x.entity_level,x.day,x.spend,x.impressions,x.reach,x.clicks,x.inline_link_clicks,x.leads,x.messages,x.calls,x.currency_code,x.objective,x.status,'api',now()
  from jsonb_to_recordset(payload) as x(entity_id uuid,entity_level text,day date,spend numeric,impressions bigint,reach bigint,clicks bigint,inline_link_clicks bigint,leads bigint,messages bigint,calls bigint,currency_code text,objective text,status text);
 else
  insert into public.audience_snapshot_batches(ad_account_id,business_id,resource_key,query,coverage_start,coverage_end,completeness,job_id,row_count)
  values(j.ad_account_id,j.business_id,j.metadata->>'resourceKey',j.metadata->'query',j.requested_start_date,j.requested_end_date,'complete',p_job,rev) returning id into batch;
  insert into public.audience_snapshot_rows select batch,(ordinality-1)::integer,value from jsonb_array_elements(payload) with ordinality;
 end if;
 update public.account_sync_resources set last_success_at=now(),last_attempt_at=now(),coverage_start=j.requested_start_date,coverage_end=j.requested_end_date,
 revision=revision+1,failures=0,not_before=now(),availability=case when rev=0 then 'empty' else 'available' end
 where ad_account_id=j.ad_account_id and resource_key=j.metadata->>'resourceKey' returning revision into rev;
 update public.account_sync_jobs set status='completed',finished_at=now(),updated_at=now(),actual_start_date=j.requested_start_date,actual_end_date=j.requested_end_date,
 performance_rows_synced=jsonb_array_length(payload),lease_expires_at=null where id=p_job;
 delete from public.account_sync_staging where job_id=p_job;
 return rev;
end $$;

create function public.fail_account_resource(p_job uuid,p_generation integer,p_reason text,p_retry_seconds integer default 60) returns void language plpgsql security invoker set search_path=public as $$
declare j public.account_sync_jobs;
begin
 select * into j from public.account_sync_jobs where id=p_job and sync_type='resource_refresh' and status='running' and lease_generation=p_generation and lease_expires_at>now() for update;
 if j.id is null then return; end if;
 update public.account_sync_jobs set status='failed',finished_at=now(),updated_at=now(),error_message=left(p_reason,120),lease_expires_at=null where id=p_job;
 update public.account_sync_resources set failures=failures+1,last_attempt_at=now(),
 availability=case when p_reason='unsupported' then 'unsupported' when p_reason='reauthentication_required' or failures>=2 then 'blocked' else 'error' end,
 pending=case when p_reason in ('unsupported','reauthentication_required') or failures>=2 then false else true end,
 not_before=now()+make_interval(secs=>case when p_reason='unsupported' then 86400 else greatest(60,least(86400,p_retry_seconds)) end)
 where ad_account_id=j.ad_account_id and resource_key=j.metadata->>'resourceKey';
 delete from public.account_sync_staging where job_id=p_job;
end $$;

-- Shared admission across app processes; leases expire even after a process crash.
create table public.meta_api_budget_state(bucket text primary key,cooldown_until timestamptz,usage_percent numeric,observed_at timestamptz);
create table public.meta_api_request_leases(id uuid primary key default gen_random_uuid(),ad_account_id uuid not null references public.ad_accounts(id) on delete cascade,expires_at timestamptz not null);
create index meta_api_request_expiry on public.meta_api_request_leases(expires_at);
alter table public.meta_api_budget_state enable row level security;
alter table public.meta_api_request_leases enable row level security;
revoke all on public.meta_api_budget_state,public.meta_api_request_leases from anon,authenticated;
grant all on public.meta_api_budget_state,public.meta_api_request_leases to service_role;
create function public.admit_meta_read(p_account uuid) returns uuid language plpgsql security invoker set search_path=public as $$
declare lease uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended('meta-read-budget',0));
 delete from public.meta_api_request_leases where expires_at<=now();
 if exists(select 1 from public.meta_api_budget_state where bucket in ('app',p_account::text) and cooldown_until>now())
 or (select count(*) from public.meta_api_request_leases)>=6 or (select count(*) from public.meta_api_request_leases where ad_account_id=p_account)>=3 then return null; end if;
 insert into public.meta_api_request_leases(ad_account_id,expires_at) values(p_account,now()+interval '40 seconds') returning id into lease;
 return lease;
end $$;
create function public.finish_meta_read(p_lease uuid,p_account uuid,p_app_usage numeric default null,p_account_usage numeric default null,p_retry_seconds integer default 0) returns void language plpgsql security invoker set search_path=public as $$
begin
 delete from public.meta_api_request_leases where id=p_lease and ad_account_id=p_account;
 if not found then return; end if;
 insert into public.meta_api_budget_state(bucket,usage_percent,observed_at,cooldown_until)
 values('app',p_app_usage,now(),case when p_app_usage>=80 then now()+interval '5 minutes' else now() end),
 (p_account::text,p_account_usage,now(),now()+make_interval(secs=>greatest(case when p_account_usage>=80 then 300 else 0 end,least(86400,greatest(0,p_retry_seconds)))))
 on conflict(bucket) do update set usage_percent=coalesce(excluded.usage_percent,meta_api_budget_state.usage_percent),observed_at=now(),cooldown_until=greatest(excluded.cooldown_until,meta_api_budget_state.cooldown_until);
end $$;
-- Operational cache retention, invoked by the existing worker (no extra cron).
create function public.prune_account_resources() returns void language sql security invoker set search_path=public as $$
 delete from public.account_sync_staging where created_at<now()-interval '1 day';
 delete from public.meta_api_request_leases where expires_at<=now();
 delete from public.audience_snapshot_batches where published_at<now()-interval '90 days';
 delete from public.account_sync_resources where kind='audience' and not pending and requested_at<now()-interval '90 days';
$$;

-- Internal RPCs are service-only. Authenticated clients use authorized application routes.
revoke all on function public.request_account_resource(uuid,uuid,uuid,text,jsonb,boolean),public.promote_account_resource(uuid),public.claim_account_resource(uuid),
 public.stage_account_resource(uuid,integer,integer,jsonb),public.publish_account_resource(uuid,integer,integer),public.fail_account_resource(uuid,integer,text,integer),
 public.admit_meta_read(uuid),public.finish_meta_read(uuid,uuid,numeric,numeric,integer),public.prune_account_resources() from public,anon,authenticated;
grant execute on function public.request_account_resource(uuid,uuid,uuid,text,jsonb,boolean),public.promote_account_resource(uuid),public.claim_account_resource(uuid),
 public.stage_account_resource(uuid,integer,integer,jsonb),public.publish_account_resource(uuid,integer,integer),public.fail_account_resource(uuid,integer,text,integer),
 public.admit_meta_read(uuid),public.finish_meta_read(uuid,uuid,numeric,numeric,integer),public.prune_account_resources() to service_role;

-- Preserve existing snapshots without claiming that their original fetch was complete.
insert into public.audience_snapshot_batches(ad_account_id,business_id,resource_key,query,coverage_start,coverage_end,completeness,row_count)
select s.ad_account_id,a.business_id,
 'legacy:'||s.entity_level||':'||s.breakdown_type||':'||coalesce(s.first_day::text,'unknown')||':'||coalesce(s.last_day::text,'unknown'),
 jsonb_build_object('breakdown',s.breakdown_type,'level',s.entity_level,'source','legacy'),s.first_day,s.last_day,'legacy_unknown',count(*)
from public.ad_audience_breakdowns_summary s join public.ad_accounts a on a.id=s.ad_account_id
 group by s.ad_account_id,a.business_id,s.entity_level,s.breakdown_type,s.first_day,s.last_day;
insert into public.audience_snapshot_rows(batch_id,row_number,data)
select b.id,(row_number() over(partition by b.id order by s.entity_id,s.dimension_1_value,s.dimension_2_value)-1)::integer,
 to_jsonb(s)-'raw'-'actions_json'-'cost_per_action_type_json'
from public.ad_audience_breakdowns_summary s join public.audience_snapshot_batches b on b.ad_account_id=s.ad_account_id and b.completeness='legacy_unknown'
 and b.query->>'breakdown'=s.breakdown_type and b.query->>'level'=s.entity_level
 and b.coverage_start is not distinct from s.first_day and b.coverage_end is not distinct from s.last_day;
