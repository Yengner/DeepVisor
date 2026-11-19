-- Scheduled job cleanup, approved by the owner (2026-11-19).
-- 1. Pause the legacy Calendar queue job. It ran every minute (one HTTP call per run) for a
--    legacy feature and produced most of cron's run history. Paused, not removed, so it can be
--    resumed with cron.alter_job(<jobid>, active := true) if Calendar is ever revived.
-- 2. Remove six old jobs that were already inactive (superseded sync/queue workers).
-- Active jobs left untouched: Meta backfill worker and the two log maintenance jobs.
-- Matched by name; missing jobs are skipped, so this is safe to run again.
do $$
declare
  v_job bigint;
  v_name text;
begin
  select jobid into v_job from cron.job where jobname = 'process-calendar-queue-every-5-minutes';
  if v_job is not null then
    perform cron.alter_job(v_job, active := false);
  end if;

  foreach v_name in array array['cron_sync_ad_metrics', 'sync_all_ad_data', 'cron_dispatch_queue',
    'cron_materialize_daily_tasks', 'dv_enqueue_due_jobs', 'dv_worker_tick'] loop
    if exists (select 1 from cron.job where jobname = v_name and not active) then
      perform cron.unschedule(v_name);
    end if;
  end loop;
end $$;
