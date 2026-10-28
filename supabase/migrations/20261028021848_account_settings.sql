begin;

-- Clients may edit contact fields, never account status, identity, or a verified email.
revoke all on public.users from anon;
revoke update, delete, truncate on public.users from public, authenticated;
revoke update (id, first_name, last_name, phone_number, email, status, created_at, updated_at)
  on public.users from public, authenticated;
grant update (first_name, last_name, phone_number) on public.users to authenticated;

create function public.normalize_user_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    -- Also protects the existing authenticated profile-repair insert path.
    select email into new.email from auth.users where id = new.id;
    new.status := 'active';
    new.created_at := now();
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger normalize_user_profile before insert or update on public.users
  for each row execute function public.normalize_user_profile();

create function public.sync_verified_user_email() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.users set email = new.email where id = new.id;
  return new;
end;
$$;
-- Auth only changes this column after its configured email-verification flow.
create trigger sync_verified_user_email after update of email on auth.users
  for each row when (old.email is distinct from new.email and new.email is not null)
  execute function public.sync_verified_user_email();

create function public.assert_account_deletable(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare membership record; members integer;
begin
  if not exists(select 1 from public.users where id = p_user) then
    raise exception 'ACCOUNT_DELETE_MISSING';
  end if;
  -- Lock parents in stable order. New memberships and child operations cannot
  -- race the cleanup inside the Auth API's deletion transaction.
  perform o.id from public.organizations o
    join public.organization_memberships m on m.organization_id = o.id
    where m.user_id = p_user order by o.id for update of o;
  for membership in select * from public.organization_memberships where user_id = p_user loop
    select count(*) into members from public.organization_memberships where organization_id = membership.organization_id;
    if members > 1 and membership.role = 'owner' and not exists(
      select 1 from public.organization_memberships where organization_id = membership.organization_id and user_id <> p_user and role = 'owner'
    ) then raise exception 'ACCOUNT_DELETE_LAST_OWNER'; end if;
    if members = 1 then
      perform id from public.business_profiles where organization_id = membership.organization_id order by id for update;
      perform j.id from public.account_sync_jobs j join public.business_profiles b on b.id = j.business_id
        where b.organization_id = membership.organization_id for update of j;
      perform j.id from ai.shadow_evaluation_jobs j join public.business_profiles b on b.id = j.business_id
        where b.organization_id = membership.organization_id for update of j;
      if exists(select 1 from public.account_sync_jobs j join public.business_profiles b on b.id = j.business_id
          where b.organization_id = membership.organization_id and j.status = 'running')
        or exists(select 1 from ai.shadow_evaluation_jobs j join public.business_profiles b on b.id = j.business_id
          where b.organization_id = membership.organization_id and j.status = 'running')
        or exists(select 1 from ai.review_execution_claims c join public.business_profiles b on b.id = c.business_id
          where b.organization_id = membership.organization_id and c.active)
        or exists(select 1 from ai.executed_actions e join public.business_profiles b on b.id = e.business_id
          where b.organization_id = membership.organization_id and e.status in ('pending', 'running'))
      then raise exception 'ACCOUNT_DELETE_BUSY'; end if;
    end if;
  end loop;
  -- Former members may still be referenced as a shared resource's creator.
  if exists(
    select 1 from public.business_profiles b where (
      exists(select 1 from public.platform_integrations i where i.business_id = b.id and i.connected_by_user_id = p_user)
      or exists(select 1 from public.campaign_drafts d where d.business_id = b.id and d.created_by_user_id = p_user)
    ) and not exists(select 1 from public.organization_memberships m where m.organization_id = b.organization_id)
  ) then raise exception 'ACCOUNT_DELETE_LAST_OWNER'; end if;
  -- Storage bytes must be removed/transferred through the Storage API, never SQL.
  -- Do not silently remove uploads which could still be used by a shared workspace.
  if exists(select 1 from storage.objects where owner = p_user or owner_id = p_user::text) then
    raise exception 'ACCOUNT_DELETE_STORAGE';
  end if;
end;
$$;

create function public.cleanup_deleted_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare membership record; business uuid; replacement uuid;
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
      for business in select id from public.business_profiles where organization_id = membership.organization_id loop
        -- Delete only this business's credential references; shared Vault secrets survive.
        delete from vault.secrets s where exists(
          select 1 from public.platform_integrations i where i.business_id = business
            and (i.access_token_secret_id = s.id::text or i.refresh_token_secret_id = s.id)
        ) and not exists(
          select 1 from public.platform_integrations i where i.business_id <> business
            and (i.access_token_secret_id = s.id::text or i.refresh_token_secret_id = s.id)
        );
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
      end loop;
      delete from public.organizations where id = membership.organization_id;
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
create trigger cleanup_deleted_user before delete on public.users
  for each row execute function public.cleanup_deleted_user();

revoke all on function public.normalize_user_profile(), public.sync_verified_user_email(),
  public.assert_account_deletable(uuid), public.cleanup_deleted_user() from public, anon, authenticated;
grant execute on function public.assert_account_deletable(uuid) to service_role;
commit;
