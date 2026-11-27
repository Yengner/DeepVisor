-- Turns on automatic Meta refresh: every 2 hours, queue a refresh for each eligible account
-- (own and client businesses) whose data is more than 90 minutes old. The existing worker job
-- (`process-meta-backfill-jobs-every-minute`, really every 10 minutes, limit 1) then runs them
-- one at a time and is left unchanged here.
--
-- APPROVAL REQUIRED: this database also serves the live site. Run only after the app code with
-- the daily login check is deployed, and with the owner's go-ahead (given 2026-11-27, after merge).
-- Rollback: select cron.unschedule('queue-account-sync-jobs-every-2-hours');
-- No secret values are written into the cron command; they are read from Vault at run time.
begin;
do $$
begin
  if not exists(select 1 from vault.decrypted_secrets where name='CRON_SECRET' and length(trim(decrypted_secret))>0)
    then raise exception 'Vault CRON_SECRET must match the deployed Edge CRON_SECRET'; end if;
  if (select decrypted_secret from vault.decrypted_secrets where name='project_url') is distinct from 'https://gkdyyjqepzayjdpvqnja.supabase.co'
    then raise exception 'Unexpected Vault project URL'; end if;
  if not exists(select 1 from cron.job where jobname='process-meta-backfill-jobs-every-minute' and active and schedule='*/10 * * * *')
    then raise exception 'Review the existing worker schedule before activation'; end if;
end $$;
-- Five past every second hour, so it never lands on the same minute as a worker tick.
-- cron.schedule replaces a job with the same name, so running this twice is safe.
select cron.schedule('queue-account-sync-jobs-every-2-hours','5 */2 * * *',$command$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='project_url') || '/functions/v1/queue_account_sync_jobs',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',
      (select decrypted_secret from vault.decrypted_secrets where name='CRON_SECRET')),
    body := '{"limit":25,"lookbackDays":7,"staleAfterMinutes":90}'::jsonb,
    timeout_milliseconds := 60000
  );
$command$);
commit;
