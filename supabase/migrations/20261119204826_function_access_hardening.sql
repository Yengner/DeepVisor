-- Function access hardening (Supabase security advisor, 2026-11-19).
--
-- 1. SECURITY DEFINER functions were executable by `anon` (signed-out visitors) through
--    /rest/v1/rpc because Postgres grants EXECUTE to PUBLIC by default.
--    - RLS helpers: every policy that calls them is `to authenticated`, so signed-in users keep
--      EXECUTE (policies need it) and anon loses it.
--    - ensure_onboarding_workspace: called by signed-in users during onboarding; anon loses it.
--    - Functions no client calls (unused helpers, a trigger function, an event-trigger function)
--      lose EXECUTE for both anon and authenticated. Triggers and event triggers still run:
--      Postgres does not check EXECUTE when firing them. The service role keeps every grant.
-- 2. Functions without a fixed search_path get `public, pg_temp`, which keeps their current name
--    resolution (two of them use unqualified table names) without honoring a caller's path.
begin;

do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as signature, p.proname
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (
      'can_access_ad_account', 'can_access_business', 'can_manage_business', 'is_org_admin', 'is_org_member',
      'ensure_onboarding_workspace',
      'can_access_account', 'create_organization_with_owner', 'get_org_role', 'is_admin', 'handle_new_user', 'rls_auto_enable')
  loop
    execute format('revoke execute on function %s from public, anon', f.signature);
    if f.proname in ('can_access_ad_account', 'can_access_business', 'can_manage_business', 'is_org_admin', 'is_org_member', 'ensure_onboarding_workspace') then
      execute format('grant execute on function %s to authenticated', f.signature);
    else
      execute format('revoke execute on function %s from authenticated', f.signature);
    end if;
    execute format('grant execute on function %s to service_role', f.signature);
  end loop;

  for f in
    select p.oid::regprocedure as signature
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (
      'touch_updated_at', 'safe_div', 'obj_code', 'obj_label', 'touch_updated_at_ads_perf', 'set_updated_at',
      'set_scheduled_on', 'log_task_events', 'trigger_sync_functions', 'update_campaigns_updated_at',
      'update_modified_column', 'update_platform_aggregated_metrics')
      and p.proconfig is null
  loop
    execute format('alter function %s set search_path = public, pg_temp', f.signature);
  end loop;
end $$;

commit;
