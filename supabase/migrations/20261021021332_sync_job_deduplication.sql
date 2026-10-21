-- Concurrent requests must share one active job for an account and sync type.
-- Existing duplicates cause migration failure rather than deleting shared work.
create unique index account_sync_jobs_one_active_type
  on public.account_sync_jobs(ad_account_id,sync_type)
  where status in ('queued','running');
create index account_sync_jobs_pending_created
  on public.account_sync_jobs(created_at)
  where status in ('queued','running');
