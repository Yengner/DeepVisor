begin;
-- Operational diagnostics only; never remove application, Auth or execution history.
create function public.maintenance_prune_operational_logs()
returns jsonb language plpgsql set search_path='' as $$
declare cron_removed integer; http_removed integer;
begin
  delete from cron.job_run_details where runid in (
    select runid from cron.job_run_details
    where end_time < now()-interval '7 days'
      and status not in ('running','starting')
    order by end_time,runid limit 5000
  );
  get diagnostics cron_removed=row_count;
  -- pg_net already has a six-hour TTL. This is a bounded safety net if its worker stalls.
  delete from net._http_response where id in (
    select id from net._http_response where created < now()-interval '1 day'
    order by created,id limit 5000
  );
  get diagnostics http_removed=row_count;
  analyze cron.job_run_details;
  analyze net._http_response;
  return jsonb_build_object('cron_removed',cron_removed,'http_removed',http_removed);
end $$;
revoke all on function public.maintenance_prune_operational_logs() from public,anon,authenticated,service_role;
-- postgres owns and invokes it through pg_cron; no Data API caller is permitted.
select cron.schedule('maintenance-prune-operational-logs','17 * * * *',
  'select public.maintenance_prune_operational_logs();');
-- VACUUM is a single top-level command, outside a function/transaction block.
-- Regular vacuum reuses dead pages without the blocking rewrite of VACUUM FULL.
select cron.schedule('maintenance-vacuum-operational-logs','47 3 * * *',
  'vacuum (analyze) cron.job_run_details, net._http_response;');
commit;
