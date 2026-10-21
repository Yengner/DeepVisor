begin;
-- Vault and job mutation RPCs are internal. Their callers authorize business scope
-- before using a service-role client; the legacy functions have no caller checks.
do $$
declare f record;
begin
  for f in select p.oid::regprocedure signature from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in (
      'get_platform_token','store_platform_token','upsert_platform_token',
      'claim_account_sync_job','invoke_process_calendar_queue_cron',
      'invoke_process_meta_backfill_job','invoke_process_meta_backfill_jobs_cron',
      'accept_calendar_queue_workflow')
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.signature);
    execute format('grant execute on function %s to service_role', f.signature);
  end loop;
end $$;

-- Signals use the same organization membership boundary as decision history.
alter table intelligence.ad_account_signals enable row level security;
revoke all on intelligence.ad_account_signals from public, anon, authenticated;
grant usage on schema intelligence to authenticated, service_role;
grant select on intelligence.ad_account_signals to authenticated;
grant all on intelligence.ad_account_signals to service_role;
create policy signals_business_read on intelligence.ad_account_signals
  for select to authenticated using (public.can_access_business(business_id));

-- Browser edits to integration token references could redirect a later privileged
-- token lookup. Integration mutations already go through authorized server routes.
revoke insert, update, delete, truncate, references, trigger
  on public.platform_integrations from public, anon, authenticated;

-- Existing PDF consumers use authenticated server downloads. Public object URLs
-- bypass storage RLS and exposed archived business reports.
update storage.buckets set public=false where id='report-archive-pdfs';
commit;
