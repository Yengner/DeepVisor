begin;
-- One active read-sync per account, across manual, automatic and history requests.
-- Refuse conflicting existing work rather than silently deleting it.
create unique index account_sync_jobs_one_active_account
  on public.account_sync_jobs(ad_account_id) where status in ('queued','running');
drop index public.account_sync_jobs_one_active_type;
alter table public.ad_account_sync_state add column last_visit_sync_check_day date;

create function public.enqueue_automatic_account_sync(
  p_business uuid, p_integration uuid, p_account uuid, p_source text,
  p_stale_minutes integer default 90, p_lookback_days integer default 7,
  p_allow_simulation boolean default false
) returns jsonb language plpgsql set search_path='' as $$
declare
  account public.ad_accounts; integration public.platform_integrations;
  state public.ad_account_sync_state; job public.account_sync_jobs;
  successful_at timestamptz; failed_at timestamptz; failures integer;
  local_day date; checked_today boolean; start_day date;
begin
  if p_source not in ('app_visit','scheduled_refresh') or p_stale_minutes not between 1 and 1440
    or p_lookback_days not between 1 and 30 then raise exception 'Invalid automatic sync options'; end if;
  perform pg_advisory_xact_lock(hashtextextended('meta-auto-sync:' || p_account::text,0));
  select * into account from public.ad_accounts where id=p_account and business_id=p_business;
  select i.* into integration from public.platform_integrations i join public.platforms p on p.id=i.platform_id
    where i.id=p_integration and i.business_id=p_business and p.key='meta' and i.platform_id=account.platform_id;
  if account.id is null or integration.id is null then raise exception 'Account is not authorized' using errcode='42501'; end if;
  if integration.status not in ('connected','error') or integration.disconnected_at is not null
    or integration.integration_details->>'primary_ad_account_external_id' is distinct from account.external_account_id
    then return jsonb_build_object('status','skipped','reason','not_connected_or_selected'); end if;
  if integration.integration_details ? 'deepvisor-meta-phase2' then
    if not p_allow_simulation then return jsonb_build_object('status','skipped','reason','simulation_disabled'); end if;
  elsif integration.access_token_secret_id is null or integration.token_expires_at <= now() then
    return jsonb_build_object('status','skipped','reason','reauthentication_required');
  end if;
  if account.timezone is null or not exists(select 1 from pg_timezone_names where name=account.timezone) then
    return jsonb_build_object('status','skipped','reason','timezone_unavailable'); end if;
  local_day := (now() at time zone account.timezone)::date;
  select * into state from public.ad_account_sync_state where ad_account_id=p_account for update;
  if state.id is null or not state.first_full_sync_completed then
    return jsonb_build_object('status','skipped','reason','initial_sync_required'); end if;
  select finished_at into successful_at from public.account_sync_jobs where id=state.last_successful_sync_job_id
    and business_id=p_business and ad_account_id=p_account and status='completed';
  checked_today := state.last_visit_sync_check_day=local_day;
  if p_source='app_visit' then update public.ad_account_sync_state set last_visit_sync_check_day=local_day
    where ad_account_id=p_account; end if;
  select * into job from public.account_sync_jobs where ad_account_id=p_account and status in ('queued','running') limit 1;
  if job.id is not null then
    return jsonb_build_object('status',job.status,'jobId',job.id,'reason','existing_job','lastSuccessfulAt',successful_at); end if;
  if p_source='app_visit' and checked_today then
    return jsonb_build_object('status','skipped','reason','checked_today','lastSuccessfulAt',successful_at); end if;
  if successful_at > now()-make_interval(mins=>p_stale_minutes) then
    return jsonb_build_object('status','skipped','reason','fresh','lastSuccessfulAt',successful_at); end if;
  -- Persisted successes or reconnection reset the circuit. Manual refresh is independent.
  select count(*),max(coalesce(finished_at,updated_at)) into failures,failed_at from public.account_sync_jobs
    where ad_account_id=p_account and status in ('failed','partial')
      and metadata->>'queuedFrom' in ('app_visit','scheduled_refresh')
      and created_at > greatest(coalesce(successful_at,'epoch'::timestamptz),coalesce(integration.connected_at,'epoch'::timestamptz));
  if failures>=3 then return jsonb_build_object('status','skipped','reason','retry_limit','lastSuccessfulAt',successful_at); end if;
  if failed_at > now()-interval '90 minutes' then
    return jsonb_build_object('status','skipped','reason','failure_backoff','lastSuccessfulAt',successful_at); end if;
  start_day := local_day-(p_lookback_days-1);
  begin
    insert into public.account_sync_jobs(business_id,platform_integration_id,ad_account_id,sync_type,status,
      requested_start_date,requested_end_date,metadata)
    values(p_business,p_integration,p_account,'incremental','queued',start_day,local_day,
      jsonb_build_object('externalAccountId',account.external_account_id,'queuedFrom',p_source,'trigger','cron',
        'syncMode','default','current_step','queued','date_cursor',start_day,'attempt',0,'last_processed_ids','{}'::jsonb))
    returning * into job;
  exception when unique_violation then
    select * into job from public.account_sync_jobs where ad_account_id=p_account and status in ('queued','running') limit 1;
    if job.id is null then raise; end if;
    return jsonb_build_object('status',job.status,'jobId',job.id,'reason','existing_job','lastSuccessfulAt',successful_at);
  end;
  return jsonb_build_object('status',job.status,'jobId',job.id,'reason','enqueued','lastSuccessfulAt',successful_at);
end $$;
revoke all on function public.enqueue_automatic_account_sync(uuid,uuid,uuid,text,integer,integer,boolean) from public,anon,authenticated;
grant execute on function public.enqueue_automatic_account_sync(uuid,uuid,uuid,text,integer,integer,boolean) to service_role;

-- Preserve the existing claim/lease and synthetic isolation. Stop replaying crashed
-- reads after three claims instead of leaving an inaccessible account running forever.
do $$
declare definition text;
begin
  select pg_get_functiondef('public.claim_account_sync_job(uuid,text[])'::regprocedure) into definition;
  if position('  select' in definition)=0 then raise exception 'Unexpected worker claim implementation'; end if;
  definition := replace(definition,'begin' || chr(10) || '  select',
    'begin' || chr(10) || $patch$
  update public.account_sync_jobs set status='failed',finished_at=now(),updated_at=now(),error_message='Worker recovery attempt limit reached'
    where status='running' and updated_at<now()-interval '15 minutes'
      and case when metadata->>'attempt' ~ '^[0-9]+$' then (metadata->>'attempt')::numeric>=3 else false end
      and (target_job_id is null or id=target_job_id);
  select$patch$);
  execute definition;
end $$;
commit;
