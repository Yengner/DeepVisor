-- Fence legacy hierarchy/creative/hourly writers as well as atomic resource publication.
-- Headers are internal service-client context, not a grant of write permission.
create function public.guard_sync_job_write() returns trigger language plpgsql security invoker set search_path=public as $$
declare h jsonb; job uuid; generation integer;
begin
 h:=coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb;
 if h ? 'x-deepvisor-sync-job' then
  job:=(h->>'x-deepvisor-sync-job')::uuid; generation:=(h->>'x-deepvisor-sync-generation')::integer;
  if old.id<>job or old.lease_generation<>generation or old.status<>'running' or old.lease_expires_at<=now() then
   raise exception 'Expired sync writer lease' using errcode='40001'; end if;
 end if;
 if new.sync_type<>'resource_refresh' and new.status='running' and
 (old.status='queued' or (new.metadata->>'claimed_at' is not null and new.metadata->>'claimed_at' is distinct from old.metadata->>'claimed_at')) then
  new.lease_generation:=old.lease_generation+1;
 end if;
 if new.sync_type<>'resource_refresh' and new.status='running' then new.lease_expires_at:=now()+interval '15 minutes'; end if;
 return new;
end $$;
create trigger sync_job_writer_guard before update on public.account_sync_jobs for each row execute function public.guard_sync_job_write();
create function public.guard_sync_fact_write() returns trigger language plpgsql security invoker set search_path=public as $$
declare h jsonb; account uuid;
begin
 h:=coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb;
 if h ? 'x-deepvisor-sync-job' then
  account:=case when tg_op='DELETE' then old.ad_account_id else new.ad_account_id end;
  perform 1 from public.account_sync_jobs where id=(h->>'x-deepvisor-sync-job')::uuid
   and lease_generation=(h->>'x-deepvisor-sync-generation')::integer and status='running' and lease_expires_at>now() and ad_account_id=account for share;
  if not found then raise exception 'Expired or mismatched sync writer lease' using errcode='40001'; end if;
 end if;
 if tg_op='DELETE' then return old; end if; return new;
end $$;
do $$declare t text;begin
 foreach t in array array['ad_entities','ad_entity_performance_daily','ad_entity_performance_summary','ad_entity_performance_hourly','ad_audience_breakdowns_summary','ad_creatives'] loop
  execute format('create trigger sync_fact_writer_guard before insert or update or delete on public.%I for each row execute function public.guard_sync_fact_write()',t);
 end loop;
end $$;
revoke all on function public.guard_sync_job_write(),public.guard_sync_fact_write() from public,anon,authenticated;
grant execute on function public.guard_sync_job_write(),public.guard_sync_fact_write() to service_role;
