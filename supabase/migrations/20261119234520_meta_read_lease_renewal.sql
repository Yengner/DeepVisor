-- Fewer database round trips per Meta read, same limits. Today every Meta request is admitted
-- (admit_meta_read) and then finished (finish_meta_read). renew_meta_read records the finished
-- request exactly like finish_meta_read but keeps the lease for the same job's next request,
-- unless a cooldown now applies or the lease has expired, in which case it is released.
-- A held lease still counts toward the 6-global / 3-per-account limits; the worker releases its
-- remaining leases with finish_meta_read when its job ends (or they expire after 40 seconds).
create or replace function public.renew_meta_read(
  p_lease uuid,
  p_account uuid,
  p_app_usage numeric default null,
  p_account_usage numeric default null,
  p_retry_seconds integer default 0
) returns boolean language plpgsql security invoker set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('meta-read-budget', 0));
  if not exists (select 1 from public.meta_api_request_leases where id = p_lease and ad_account_id = p_account) then
    return false;
  end if;
  insert into public.meta_api_budget_state(bucket, usage_percent, observed_at, cooldown_until)
  values ('app', p_app_usage, now(), case when p_app_usage >= 80 then now() + interval '5 minutes' else now() end),
    (p_account::text, p_account_usage, now(), now() + make_interval(secs => greatest(case when p_account_usage >= 80 then 300 else 0 end, least(86400, greatest(0, p_retry_seconds)))))
  on conflict (bucket) do update set usage_percent = coalesce(excluded.usage_percent, meta_api_budget_state.usage_percent),
    observed_at = now(), cooldown_until = greatest(excluded.cooldown_until, meta_api_budget_state.cooldown_until);
  if exists (select 1 from public.meta_api_request_leases where id = p_lease and expires_at <= now())
    or exists (select 1 from public.meta_api_budget_state where bucket in ('app', p_account::text) and cooldown_until > now()) then
    delete from public.meta_api_request_leases where id = p_lease;
    return false;
  end if;
  update public.meta_api_request_leases set expires_at = now() + interval '40 seconds' where id = p_lease;
  return true;
end $$;

revoke all on function public.renew_meta_read(uuid, uuid, numeric, numeric, integer) from public, anon, authenticated;
grant execute on function public.renew_meta_read(uuid, uuid, numeric, numeric, integer) to service_role;
