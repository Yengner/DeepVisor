-- Account deletion (Auth Admin "Delete user" and in-app "Delete my account") runs
-- public.cleanup_deleted_user() before public.users rows are removed. Tables added after
-- that function (ad lifecycle, insights, Organizer rename history) were never cleaned up,
-- so deleting a sole-owner workspace failed on NO ACTION foreign keys, e.g.
-- ad_lifecycle_observations_job_id_fkey. Foreign keys stay strict; cleanup handles order.

-- 1. Organizer history stays immutable except while an account is being deleted.
--    The flag is transaction-local and only set by the security-definer cleanup below.
create or replace function public.prevent_organization_history_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' and current_setting('deepvisor.account_deletion', true) = 'on' then
    return old;
  end if;
  raise exception 'Organization history is immutable';
end
$$;

-- 2. Safety net: remove any remaining rows scoped to a workspace's business or ad
--    accounts, retrying rows blocked by other rows. Raises with the blocking tables
--    instead of silently leaving data behind, so a future table cannot quietly break
--    account deletion again.
create or replace function public.delete_workspace_scoped_rows(p_business uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_accounts uuid[];
  v_pending text[];
  v_next text[];
  v_table text;
  v_has_business boolean;
  v_has_account boolean;
begin
  select coalesce(array_agg(a.id), '{}') into v_accounts
  from public.ad_accounts a where a.business_id = p_business;

  select coalesce(array_agg(t.qualified order by t.qualified), '{}') into v_pending
  from (
    select distinct format('%I.%I', n.nspname, k.relname) as qualified
    from pg_catalog.pg_attribute a
    join pg_catalog.pg_class k on k.oid = a.attrelid
    join pg_catalog.pg_namespace n on n.oid = k.relnamespace
    where k.relkind = 'r'
      and n.nspname in ('public', 'ai', 'intelligence')
      and a.attnum > 0 and not a.attisdropped
      and a.attname in ('business_id', 'ad_account_id')
      and format_type(a.atttypid, a.atttypmod) = 'uuid'
      and k.relname not in ('business_profiles', 'ad_accounts')
  ) t;

  while cardinality(v_pending) > 0 loop
    v_next := '{}';
    foreach v_table in array v_pending loop
      select bool_or(a.attname = 'business_id'), bool_or(a.attname = 'ad_account_id')
      into v_has_business, v_has_account
      from pg_catalog.pg_attribute a
      where a.attrelid = v_table::regclass and a.attnum > 0 and not a.attisdropped
        and a.attname in ('business_id', 'ad_account_id');
      begin
        execute format('delete from %s where %s', v_table, concat_ws(' or ',
          case when v_has_business then 'business_id = $1' end,
          case when v_has_account then 'ad_account_id = any($2)' end))
          using p_business, v_accounts;
      exception when foreign_key_violation then
        v_next := v_next || v_table;
      end;
    end loop;
    if cardinality(v_next) = cardinality(v_pending) then
      raise exception 'ACCOUNT_DELETE_BLOCKED: %', array_to_string(v_next, ', ')
        using errcode = '23503';
    end if;
    v_pending := v_next;
  end loop;
end
$$;

-- 3. Same behavior and guards as before, plus the newer tables and the safety net.
create or replace function public.cleanup_deleted_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare membership record; business uuid; replacement uuid; organizer_rows bigint;
begin
  -- Supported Auth Admin deletion cascades here; direct profile deletion is unsafe.
  if exists(select 1 from auth.users where id = old.id) then
    raise exception 'Use the Auth administration API to delete an account';
  end if;
  perform public.assert_account_deletable(old.id);
  for membership in select * from public.organization_memberships where user_id = old.id loop
    select user_id into replacement from public.organization_memberships
      where organization_id = membership.organization_id and user_id <> old.id
      order by case role when 'owner' then 0 when 'admin' then 1 else 2 end, created_at, user_id limit 1;
    if replacement is null then
      perform set_config('deepvisor.account_deletion', 'on', true);
      for business in select id from public.business_profiles where organization_id = membership.organization_id loop
        -- Delete only this business's credential references; shared Vault secrets survive.
        delete from vault.secrets s where exists(
          select 1 from public.platform_integrations i where i.business_id = business
            and (i.access_token_secret_id = s.id::text or i.refresh_token_secret_id = s.id)
        ) and not exists(
          select 1 from public.platform_integrations i where i.business_id <> business
            and (i.access_token_secret_id = s.id::text or i.refresh_token_secret_id = s.id)
        );
        -- Ad lifecycle: events point at observations; observations point at sync jobs.
        delete from public.ad_lifecycle_briefs x using public.ad_lifecycle_events e
          where x.event_id = e.id and e.business_id = business;
        delete from public.ad_lifecycle_acknowledgements x using public.ad_lifecycle_events e
          where x.event_id = e.id and e.business_id = business;
        delete from public.ad_lifecycle_events where business_id = business;
        delete from public.ad_lifecycle_observations where business_id = business;
        -- Insights: receipts reference presentations only.
        delete from public.insight_receipts x using public.insight_presentations p
          where x.presentation_id = p.id and p.business_id = business;
        -- Organizer history references itself in a cycle (runs <-> previews/versions), so it is
        -- removed in one statement; NO ACTION keys are checked when the statement ends.
        with events as (delete from public.organization_rename_events where business_id = business returning 1),
          runs as (delete from public.organization_rename_runs where business_id = business returning 1),
          approvals as (delete from public.organization_rename_approvals where business_id = business returning 1),
          previews as (delete from public.organization_rename_previews where business_id = business returning 1),
          versions as (delete from public.account_organization_versions where business_id = business returning 1),
          simulation as (delete from public.organization_rename_simulation where business_id = business returning 1)
        select (select count(*) from events) + (select count(*) from runs) + (select count(*) from approvals)
          + (select count(*) from previews) + (select count(*) from versions) + (select count(*) from simulation)
          into organizer_rows;
        -- Existing NO ACTION FKs deliberately remain intact. Remove in dependency order.
        delete from ai.review_execution_claims where business_id = business;
        delete from ai.action_outcomes where business_id = business;
        delete from ai.limited_auto_evaluations where business_id = business;
        delete from ai.shadow_evaluation_jobs where business_id = business;
        delete from ai.executed_actions where business_id = business;
        delete from ai.action_proposals where business_id = business;
        delete from ai.decision_runs where business_id = business;
        delete from ai.feature_snapshots where business_id = business;
        delete from ai.autonomy_policies where business_id = business;
        delete from public.account_sync_jobs where business_id = business;
        delete from public.oauth_states where business_id = business;
        -- Anything added later that is scoped to this business or its ad accounts.
        perform public.delete_workspace_scoped_rows(business);
      end loop;
      delete from public.organizations where id = membership.organization_id;
      perform set_config('deepvisor.account_deletion', '', true);
    end if;
  end loop;
  -- Keep shared resources even if the user had already left their organization.
  update public.platform_integrations i set connected_by_user_id = (
    select m.user_id from public.organization_memberships m where m.organization_id = b.organization_id and m.user_id <> old.id
    order by case m.role when 'owner' then 0 when 'admin' then 1 else 2 end, m.created_at, m.user_id limit 1
  ) from public.business_profiles b where b.id = i.business_id and i.connected_by_user_id = old.id;
  update public.campaign_drafts d set created_by_user_id = (
    select m.user_id from public.organization_memberships m where m.organization_id = b.organization_id and m.user_id <> old.id
    order by case m.role when 'owner' then 0 when 'admin' then 1 else 2 end, m.created_at, m.user_id limit 1
  ) from public.business_profiles b where b.id = d.business_id and d.created_by_user_id = old.id;
  return old;
end;
$$;

revoke all on function public.cleanup_deleted_user(), public.delete_workspace_scoped_rows(uuid)
  from public, anon, authenticated;
