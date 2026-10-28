begin;
-- Keep existing cadences and work payloads. Authenticate existing callers after
-- fail-closed Edge deployment; do not enable the recurring Meta enqueue here.
do $$
declare definition text; rewritten text;
begin
  if not exists(select 1 from vault.secrets where name='CRON_SECRET') then raise exception 'Vault CRON_SECRET is required'; end if;
  if not exists(select 1 from vault.secrets where name='project_url') then
    perform vault.create_secret('https://gkdyyjqepzayjdpvqnja.supabase.co','project_url'); end if;
  if (select decrypted_secret from vault.decrypted_secrets where name='project_url') is distinct from 'https://gkdyyjqepzayjdpvqnja.supabase.co'
    then raise exception 'Unexpected project URL'; end if;
  select pg_get_functiondef('public.invoke_process_calendar_queue_cron()'::regprocedure) into definition;
  rewritten := regexp_replace(definition,
    $pattern$headers[[:space:]]*:=[[:space:]]*jsonb_build_object\([^)]*\)$pattern$,
    $header$headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',
      (select decrypted_secret from vault.decrypted_secrets where name='CRON_SECRET'))$header$);
  if rewritten=definition then raise exception 'Calendar invocation needs review'; end if;
  execute rewritten;
end $$;
select cron.alter_job((select jobid from cron.job where jobname='process-meta-backfill-jobs-every-minute'),
 command := $command$
 select net.http_post(
   url := (select decrypted_secret from vault.decrypted_secrets where name='project_url') || '/functions/v1/process_account_sync_jobs',
   headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',
     (select decrypted_secret from vault.decrypted_secrets where name='CRON_SECRET')),
   body := '{"limit":1}'::jsonb,
   timeout_milliseconds := 300000
 );
$command$);
commit;
