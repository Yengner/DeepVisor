-- Quota contention is deferred work, not an inaccessible-account failure.
create or replace function public.fail_account_resource(p_job uuid,p_generation integer,p_reason text,p_retry_seconds integer default 60) returns void language plpgsql security invoker set search_path=public as $$
declare j public.account_sync_jobs;
begin
 select * into j from public.account_sync_jobs where id=p_job and sync_type='resource_refresh' and status='running' and lease_generation=p_generation and lease_expires_at>now() for update;
 if j.id is null then return; end if;
 update public.account_sync_jobs set status='failed',finished_at=now(),updated_at=now(),error_message=left(p_reason,120),lease_expires_at=null where id=p_job;
 update public.account_sync_resources set failures=failures+case when p_reason='provider_cooldown' then 0 else 1 end,last_attempt_at=now(),
 availability=case when p_reason='provider_cooldown' then 'error' when p_reason='unsupported' then 'unsupported' when p_reason='reauthentication_required' or failures>=2 then 'blocked' else 'error' end,
 pending=case when p_reason='provider_cooldown' then true when p_reason in ('unsupported','reauthentication_required') or failures>=2 then false else true end,
 not_before=now()+make_interval(secs=>case when p_reason='unsupported' then 86400 else greatest(60,least(86400,p_retry_seconds)) end)
 where ad_account_id=j.ad_account_id and resource_key=j.metadata->>'resourceKey';
 delete from public.account_sync_staging where job_id=p_job;
end $$;

create or replace function public.finish_resource_followup() returns trigger language plpgsql security invoker set search_path=public as $$
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
 if new.status='completed' and new.sync_type<>'resource_refresh' then
  -- A completed full/manual job satisfies covered pending work and recovers its circuit.
  update public.account_sync_resources set pending=false,failures=0,availability='available',not_before=now(),
   last_attempt_at=now(),last_success_at=new.finished_at,coverage_start=new.requested_start_date,coverage_end=new.requested_end_date,
   last_job_id=new.id,revision=revision+1
  where ad_account_id=new.ad_account_id and kind in ('performance','maintenance')
   and (query->>'since')::date>=new.requested_start_date and (query->>'until')::date<=new.requested_end_date;
 end if;
 if new.metadata->>'resourceKind'='maintenance' and new.status<>'completed' and new.error_message like '%provider_cooldown%' then
  update public.account_sync_resources set pending=true,availability='error',last_attempt_at=now(),not_before=now()+interval '5 minutes'
  where ad_account_id=new.ad_account_id and resource_key='maintenance:v2';
  return new;
 end if;
 if new.metadata->>'resourceKind'='maintenance' and new.status<>'completed' then
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
