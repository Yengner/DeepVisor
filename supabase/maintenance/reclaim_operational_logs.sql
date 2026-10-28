-- Authorized one-time development maintenance. Preserve recent diagnostics while
-- releasing allocated heap/index pages immediately; no advertising/Auth data touched.
-- The short exclusive locks prevent new logger rows from being lost during copying.
begin;
set local lock_timeout='3s';
set local statement_timeout='45s';
lock table cron.job_run_details in access exclusive mode;
create temporary table retained_cron_runs on commit drop as
  select * from cron.job_run_details where end_time is null or end_time>=now()-interval '7 days';
truncate table cron.job_run_details;
insert into cron.job_run_details select * from retained_cron_runs;
analyze cron.job_run_details;
commit;

begin;
set local lock_timeout='3s';
set local statement_timeout='45s';
lock table net._http_response in access exclusive mode;
create temporary table retained_http_responses on commit drop as
  select * from net._http_response where created>=now()-interval '1 day';
truncate table net._http_response;
insert into net._http_response select * from retained_http_responses;
analyze net._http_response;
commit;
