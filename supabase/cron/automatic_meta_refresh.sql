-- APPROVAL REQUIRED: deploy the application and all three corrected Edge handlers
-- (queue_account_sync_jobs, process_account_sync_jobs, process_meta_backfill_jobs),
-- verify their unauthorized-request rejection, then run this script on development.
-- No secret values are written into cron commands or returned to the client.
begin;
do $$
begin
  if not exists(select 1 from vault.decrypted_secrets where name='CRON_SECRET' and length(trim(decrypted_secret))>0)
    then raise exception 'Vault CRON_SECRET must match the deployed Edge CRON_SECRET'; end if;
  if not exists(select 1 from vault.secrets where name='project_url') then
    perform vault.create_secret('https://gkdyyjqepzayjdpvqnja.supabase.co','project_url'); end if;
  if (select decrypted_secret from vault.decrypted_secrets where name='project_url') is distinct from 'https://gkdyyjqepzayjdpvqnja.supabase.co'
    then raise exception 'Unexpected Vault project URL'; end if;
  if not exists(select 1 from cron.job where jobname='process-meta-backfill-jobs-every-minute' and active and schedule='*/10 * * * *')
    then raise exception 'Review the existing worker schedule before activation'; end if;
end $$;
-- Reuse the inactive legacy enqueue job name; cron.schedule replaces it idempotently.
select cron.schedule('cron_sync_ad_metrics','0 */2 * * *',$command$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='project_url') || '/functions/v1/queue_account_sync_jobs',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',
      (select decrypted_secret from vault.decrypted_secrets where name='CRON_SECRET')),
    body := '{"limit":100,"lookbackDays":7,"staleAfterMinutes":90}'::jsonb,
    timeout_milliseconds := 60000
  );
$command$);
select cron.alter_job((select jobid from cron.job where jobname='cron_sync_ad_metrics'), active := true);
-- Same worker job ID, cadence and active state; canonical alias and Vault credentials.
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
