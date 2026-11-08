-- Complete pending-demand recovery without enabling schedules or advertising writes.
alter table public.account_sync_resources drop constraint account_sync_resources_kind_check;
alter table public.account_sync_resources add constraint account_sync_resources_kind_check check(kind in ('performance','audience','maintenance'));
create index audience_snapshot_dimension on public.audience_snapshot_batches(ad_account_id,(query->>'breakdown'),coverage_end desc,published_at desc);
create or replace function public.request_account_resource(p_business uuid,p_integration uuid,p_account uuid,p_kind text,p_query jsonb,
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
 if p_kind not in ('performance','audience','maintenance') or p_query->>'version' is distinct from '2' then raise exception 'Invalid resource query'; end if;
 since_day:=(p_query->>'since')::date; until_day:=(p_query->>'until')::date;
 if since_day is null or until_day is null or until_day<since_day or until_day-since_day>30 or until_day>(now() at time zone a.timezone)::date then raise exception 'Invalid resource range'; end if;
 if p_kind='audience' and (p_query->>'breakdown' is null or p_query->>'breakdown' not in ('age_gender','country','region','publisher_platform','impression_device')) then raise exception 'Unsupported breakdown'; end if;
 if exists(select 1 from public.business_data_policies p where p.business_id=p_business and
 ((p_kind='audience' and (not ((p_query->>'breakdown')=any(p.allowed_breakdowns)) or since_day<(now() at time zone a.timezone)::date-p.audience_history_days))
 or (p_kind<>'audience' and since_day<(now() at time zone a.timezone)::date-p.daily_history_days))) then
  return jsonb_build_object('status','skipped','reason','policy_limit'); end if;
 k:=case when p_kind='maintenance' then 'maintenance:v2' when p_kind='performance' then 'performance:v2' else 'audience:v2:'||(p_query->>'breakdown')||':'||since_day::text||':'||until_day::text end;
 ttl:=case when p_kind='maintenance' then case when p_query->>'source'='scheduled_refresh' then interval '6 hours' else interval '60 minutes' end when p_kind='audience' then interval '12 hours' when p_query->>'source'='scheduled_refresh' then interval '90 minutes' else interval '15 minutes' end;
 pri:=case when p_kind='maintenance' then 0 when p_kind='audience' then 20 when p_query->>'source'='scheduled_refresh' then 10 else 30 end;
 if p_query->>'source'='app_visit' then update public.ad_account_sync_state set active_until=now()+interval '10 minutes' where ad_account_id=p_account; end if;
 select * into r from public.account_sync_resources where ad_account_id=p_account and resource_key=k for update;
 if r.availability='blocked' and i.connected_at>r.last_attempt_at then
  update public.account_sync_resources set availability='unknown',failures=0,not_before=now() where ad_account_id=p_account and resource_key=k;
  r.availability:='unknown'; r.failures:=0; r.not_before:=now();
 end if;
 if r.last_success_at>now()-ttl and r.coverage_start<=since_day and r.coverage_end>=until_day then
  return jsonb_build_object('status','skipped','reason','fresh','revision',r.revision); end if;
 if r.availability='blocked' or r.not_before>now() then return jsonb_build_object('status','skipped','reason',case when r.availability='blocked' then 'retry_limit' else 'failure_backoff' end); end if;
 -- Recent successful full sync also satisfies the light read; timestamps alone never imply coverage.
 if p_kind in ('performance','maintenance') then
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
 query=case when account_sync_resources.pending and p_kind in ('performance','maintenance') then excluded.query||jsonb_build_object(
 'since',least(account_sync_resources.query->>'since',excluded.query->>'since'),'until',greatest(account_sync_resources.query->>'until',excluded.query->>'until')) else excluded.query end;
 if j.id is not null then return jsonb_build_object('status','skipped','reason','pending_followup'); end if;
 return public.promote_account_resource(p_account);
end $$;
create or replace function public.promote_account_resource(p_account uuid) returns jsonb language plpgsql security invoker set search_path=public as $$
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
 values(r.business_id,r.platform_integration_id,p_account,case when r.kind='maintenance' then 'incremental' else 'resource_refresh' end,'queued',(r.query->>'since')::date,(r.query->>'until')::date,r.priority,
 jsonb_build_object('resourceKey',r.resource_key,'resourceKind',r.kind,'query',r.query,'queuedFrom',case when r.kind='maintenance' then 'resource_maintenance' else 'resource_coordinator' end,'attempt',0)) returning id into j;
 update public.account_sync_resources set pending=false,last_job_id=j where ad_account_id=p_account and resource_key=r.resource_key;
 return jsonb_build_object('status','queued','reason','enqueued','jobId',j);
exception when unique_violation then return jsonb_build_object('status','skipped','reason','pending_followup');
end $$;
create or replace function public.claim_account_resource(p_job uuid default null) returns setof public.account_sync_jobs language plpgsql security invoker set search_path=public as $$
declare selected uuid;
begin
 -- Exhausted crashed jobs release the account slot, retaining the old published revision.
 with expired as (update public.account_sync_jobs set status='failed',finished_at=now(),error_message='Refresh worker lease expired'
 where sync_type='resource_refresh' and status='running' and lease_expires_at<now() and lease_generation>=3 returning ad_account_id,metadata)
 update public.account_sync_resources r set availability='blocked',pending=false,failures=3,last_attempt_at=now()
 from expired e where r.ad_account_id=e.ad_account_id and r.resource_key=e.metadata->>'resourceKey';
 select j.id into selected from public.account_sync_jobs j join public.platform_integrations i on i.id=j.platform_integration_id
 where j.sync_type='resource_refresh' and (p_job is null or j.id=p_job) and j.not_before<=now()
 and (p_job is not null or not (i.integration_details ? 'deepvisor-meta-phase2'))
 and (j.status='queued' or (j.status='running' and j.lease_expires_at<now()))
 order by j.priority+least(100,extract(epoch from now()-j.created_at)/300) desc,j.created_at for update of j skip locked limit 1;
 return query update public.account_sync_jobs set status='running',started_at=coalesce(started_at,now()),updated_at=now(),
 lease_generation=lease_generation+1,lease_expires_at=now()+interval '5 minutes' where id=selected returning *;
end $$;
create or replace function public.publish_account_resource(p_job uuid,p_generation integer,p_chunks integer) returns bigint language plpgsql security invoker set search_path=public as $$
declare j public.account_sync_jobs; payload jsonb; n integer; rev bigint; batch uuid;
begin
 select * into j from public.account_sync_jobs where id=p_job for update;
 if j.sync_type<>'resource_refresh' or j.status<>'running' or j.lease_generation<>p_generation or j.lease_expires_at<=now() or j.id is null then raise exception 'Expired resource lease' using errcode='40001'; end if;
 if not exists(select 1 from public.platform_integrations i join public.ad_accounts a on a.id=j.ad_account_id where i.id=j.platform_integration_id
 and (i.integration_details ? 'deepvisor-meta-phase2' or (i.access_token_secret_id is not null and (i.token_expires_at is null or i.token_expires_at>now()))) and i.business_id=j.business_id and i.status in ('connected','error') and i.disconnected_at is null and i.integration_details->>'primary_ad_account_external_id'=a.external_account_id) then raise exception 'Account connection changed'; end if;
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

create function public.request_resource_followup(p_job uuid,p_business uuid,p_integration uuid,p_account uuid,p_since date,p_until date)
returns setof public.account_sync_jobs language plpgsql security invoker set search_path=public as $$
declare j public.account_sync_jobs;
begin
 perform pg_advisory_xact_lock(hashtextextended('meta-resource:'||p_account::text,0));
 select * into j from public.account_sync_jobs where id=p_job and business_id=p_business and platform_integration_id=p_integration
 and ad_account_id=p_account and status in ('queued','running') and sync_type='resource_refresh' for update;
 if j.id is null then return; end if;
 if p_since is null or p_until is null or p_until<p_since or p_until-p_since>30 then raise exception 'Invalid manual window'; end if;
 return query update public.account_sync_jobs set metadata=metadata||jsonb_build_object('manualFollowup',jsonb_build_object('since',p_since,'until',p_until))
 where id=p_job returning *;
end $$;

-- A manual request arriving during a light refresh becomes its own exact, durable full job.
-- The original job retains a link so existing client polling follows the authorized request.
create function public.finish_resource_followup() returns trigger language plpgsql security invoker set search_path=public as $$
declare followup uuid; q jsonb;
begin
 if new.status not in ('completed','failed','partial') or old.status not in ('queued','running') then return new; end if;
 if new.sync_type='resource_refresh' and new.metadata ? 'manualFollowup' then
  q:=new.metadata->'manualFollowup';
  insert into public.account_sync_jobs(business_id,platform_integration_id,ad_account_id,sync_type,status,requested_start_date,requested_end_date,priority,metadata)
  values(new.business_id,new.platform_integration_id,new.ad_account_id,'manual_refresh','queued',(q->>'since')::date,(q->>'until')::date,50,
   jsonb_build_object('queuedFrom','manual_refresh','trigger','manual_refresh','syncMode','default','attempt',0)) returning id into followup;
  update public.account_sync_jobs set metadata=metadata||jsonb_build_object('followupJobId',followup) where id=new.id;
 end if;
 if new.metadata->>'resourceKind'='maintenance' then
  update public.account_sync_resources set last_attempt_at=now(),last_success_at=case when new.status='completed' then new.finished_at else last_success_at end,
   coverage_start=case when new.status='completed' then new.requested_start_date else coverage_start end,
   coverage_end=case when new.status='completed' then new.requested_end_date else coverage_end end,
   revision=revision+case when new.status='completed' then 1 else 0 end,
   failures=case when new.status='completed' then 0 else failures+1 end,
   availability=case when new.status='completed' then 'available' when failures>=2 then 'blocked' else 'error' end,
   pending=case when new.status='completed' then pending else failures<2 end,
   not_before=case when new.status='completed' then now() else now()+interval '90 minutes' end
  where ad_account_id=new.ad_account_id and resource_key='maintenance:v2';
 end if;
 return new;
end $$;
create trigger account_resource_followup after update of status on public.account_sync_jobs for each row execute function public.finish_resource_followup();
revoke all on function public.request_resource_followup(uuid,uuid,uuid,uuid,date,date),public.finish_resource_followup() from public,anon,authenticated;
grant execute on function public.request_resource_followup(uuid,uuid,uuid,uuid,date,date),public.finish_resource_followup() to service_role;
