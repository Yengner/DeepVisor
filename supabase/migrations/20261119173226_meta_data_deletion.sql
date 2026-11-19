-- Meta data deletion: what runs when a person removes DeepVisor in their Facebook settings (Meta's
-- data deletion callback) or an owner/admin clicks "Delete Meta data" on Connections.
--
-- Deletes everything DeepVisor synced from Meta for one connection's ad accounts (campaigns, ads,
-- results, creatives, status history, insights, decisions, Organizer history, drafts built from
-- them), the business's WhatsApp connections, tokens and WhatsApp leads, and the connection's
-- tokens. Keeps the DeepVisor account, the business profile, owner-entered data (weekly booking
-- answers, phone-call leads, settings) and a bare ad account row those answers belong to.
begin;

create table if not exists public.meta_data_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  -- Shown to the person and to Meta; the only way to look a request up.
  confirmation_code text not null unique check (confirmation_code ~ '^[A-Z0-9]{12}$'),
  source text not null check (source in ('meta_callback', 'owner')),
  -- Meta's app-scoped user id from the signed request (callback only). Kept to answer status checks.
  meta_user_id text check (meta_user_id ~ '^[0-9]{1,30}$'),
  business_id uuid references public.business_profiles(id) on delete set null,
  status text not null default 'received' check (status in ('received', 'completed', 'no_data', 'failed')),
  connections integer not null default 0 check (connections >= 0),
  error text check (char_length(error) <= 200),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
alter table public.meta_data_deletion_requests enable row level security;
revoke all on public.meta_data_deletion_requests from public, anon, authenticated;
grant all on public.meta_data_deletion_requests to service_role;

/**
 * Deletes the Meta data of one connection (see header). Service role only; callers have already
 * verified who is asking (Meta's signed request, or an owner/admin session). Returns counts.
 */
create or replace function public.delete_meta_connection_data(p_business uuid, p_integration uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_platform uuid;
  v_accounts uuid[];
  v_pending text[];
  v_next text[];
  v_table text;
  v_rows bigint := 0;
  v_count bigint;
begin
  select platform_id into v_platform from public.platform_integrations
    where id = p_integration and business_id = p_business for update;
  if not found then
    raise exception 'META_CONNECTION_NOT_FOUND' using errcode = 'P0002';
  end if;
  select coalesce(array_agg(id), '{}') into v_accounts from public.ad_accounts
    where business_id = p_business and platform_id = v_platform;

  -- Organizer history is immutable except during deletion (transaction-local, as in account deletion).
  perform set_config('deepvisor.account_deletion', 'on', true);

  -- Decisions built from these accounts' snapshots, in dependency order.
  create temporary table _snapshots on commit drop as
    select business_id, id from ai.feature_snapshots where business_id = p_business and ad_account_id = any(v_accounts);
  create temporary table _runs on commit drop as
    select r.business_id, r.id from ai.decision_runs r join _snapshots s on s.business_id = r.business_id and s.id = r.feature_snapshot_id;
  create temporary table _proposals on commit drop as
    select p.business_id, p.id from ai.action_proposals p join _runs r on r.business_id = p.business_id and r.id = p.decision_run_id;
  create temporary table _executions on commit drop as
    select e.business_id, e.id from ai.executed_actions e join _proposals p on p.business_id = e.business_id and p.id = e.action_proposal_id;
  delete from ai.review_execution_claims c where c.business_id = p_business
    and (c.proposal_id in (select id from _proposals) or c.execution_id in (select id from _executions));
  delete from ai.action_outcomes o where o.business_id = p_business
    and (o.executed_action_id in (select id from _executions) or o.shadow_decision_run_id in (select id from _runs));
  delete from ai.limited_auto_evaluations l where l.business_id = p_business
    and (l.source_snapshot_id in (select id from _snapshots) or l.decision_run_id in (select id from _runs) or l.action_proposal_id in (select id from _proposals));
  delete from ai.executed_actions where business_id = p_business and id in (select id from _executions);
  delete from ai.action_proposals where business_id = p_business and id in (select id from _proposals);
  delete from ai.decision_runs where business_id = p_business and id in (select id from _runs);

  -- Organizer rename history for these accounts. Runs and versions reference each other, so one statement.
  create temporary table _versions on commit drop as
    select id from public.account_organization_versions where business_id = p_business and ad_account_id = any(v_accounts);
  create temporary table _previews on commit drop as
    select id from public.organization_rename_previews where business_id = p_business and ad_account_id = any(v_accounts);
  create temporary table _approvals on commit drop as
    select id from public.organization_rename_approvals where business_id = p_business
      and (preview_id in (select id from _previews) or version_id in (select id from _versions));
  create temporary table _rename_runs on commit drop as
    select id from public.organization_rename_runs where business_id = p_business and approval_id in (select id from _approvals);
  with e as (delete from public.organization_rename_events where business_id = p_business and run_id in (select id from _rename_runs) returning 1),
    r as (delete from public.organization_rename_runs where business_id = p_business and id in (select id from _rename_runs) returning 1),
    a as (delete from public.organization_rename_approvals where business_id = p_business and id in (select id from _approvals) returning 1),
    p as (delete from public.organization_rename_previews where business_id = p_business and id in (select id from _previews) returning 1),
    v as (delete from public.account_organization_versions where business_id = p_business and id in (select id from _versions) returning 1)
  select (select count(*) from e) + (select count(*) from r) + (select count(*) from a) + (select count(*) from p) + (select count(*) from v)
    into v_count;
  v_rows := v_rows + v_count;

  -- Children that only reference account-scoped parents.
  delete from public.ad_lifecycle_briefs x using public.ad_lifecycle_events e
    where x.event_id = e.id and e.business_id = p_business and e.ad_account_id = any(v_accounts);
  delete from public.ad_lifecycle_acknowledgements x using public.ad_lifecycle_events e
    where x.event_id = e.id and e.business_id = p_business and e.ad_account_id = any(v_accounts);
  delete from public.insight_receipts x using public.insight_presentations p
    where x.presentation_id = p.id and p.business_id = p_business and p.ad_account_id = any(v_accounts);

  -- Every other table scoped to these ad accounts (including ones added later), retrying rows blocked
  -- by other account rows. Owner-entered weekly booking answers are kept.
  select coalesce(array_agg(t.qualified order by t.qualified), '{}') into v_pending
  from (
    select distinct format('%I.%I', n.nspname, k.relname) as qualified
    from pg_catalog.pg_attribute a
    join pg_catalog.pg_class k on k.oid = a.attrelid
    join pg_catalog.pg_namespace n on n.oid = k.relnamespace
    where k.relkind = 'r' and n.nspname in ('public', 'ai', 'intelligence')
      and a.attnum > 0 and not a.attisdropped and a.attname = 'ad_account_id'
      and format_type(a.atttypid, a.atttypmod) = 'uuid'
      and k.relname not in ('ad_accounts', 'booking_checkins')
  ) t;
  while cardinality(v_pending) > 0 loop
    v_next := '{}';
    foreach v_table in array v_pending loop
      begin
        execute format('delete from %s where ad_account_id = any($1)', v_table) using v_accounts;
        get diagnostics v_count = row_count;
        v_rows := v_rows + v_count;
      exception when foreign_key_violation then
        v_next := v_next || v_table;
      end;
    end loop;
    if cardinality(v_next) = cardinality(v_pending) then
      raise exception 'META_DELETE_BLOCKED: %', array_to_string(v_next, ', ') using errcode = '23503';
    end if;
    v_pending := v_next;
  end loop;

  -- WhatsApp: tokens, de-duplication receipts, chats from WhatsApp, and the connections.
  delete from vault.secrets s where s.id in (
    select token_secret_id from public.whatsapp_connections where business_id = p_business and token_secret_id is not null);
  delete from public.whatsapp_message_receipts where business_id = p_business;
  delete from public.leads where business_id = p_business and channel = 'whatsapp';
  get diagnostics v_count = row_count;
  v_rows := v_rows + v_count;
  delete from public.whatsapp_connections where business_id = p_business;

  -- The connection itself: tokens removed (unless another business shares the secret), marked disconnected.
  delete from vault.secrets s where exists(
    select 1 from public.platform_integrations i where i.id = p_integration
      and (i.access_token_secret_id = s.id::text or i.refresh_token_secret_id = s.id)
  ) and not exists(
    select 1 from public.platform_integrations i where i.id <> p_integration
      and (i.access_token_secret_id = s.id::text or i.refresh_token_secret_id = s.id)
  );
  update public.platform_integrations set
    status = 'disconnected', disconnected_at = now(), access_token_secret_id = null, refresh_token_secret_id = null,
    token_expires_at = null, last_error = null, updated_at = now(),
    integration_details = jsonb_build_object('status', 'disconnected', 'disconnected_at', now(), 'meta_data_deleted_at', now())
  where id = p_integration;

  perform set_config('deepvisor.account_deletion', '', true);
  return jsonb_build_object('accounts', cardinality(v_accounts), 'rows', v_rows);
end $$;

/**
 * Disconnect: removes a connection's stored token from Vault (its reference is cleared by the
 * caller). A secret still referenced by another connection is kept. Service role only.
 */
create or replace function public.delete_integration_secret(p_integration uuid, p_secret text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_deleted integer;
begin
  if p_secret is null or p_secret !~ '^[0-9a-f-]{36}$' then return false; end if;
  if not exists(select 1 from public.platform_integrations i where i.id = p_integration
    and (i.access_token_secret_id = p_secret or i.refresh_token_secret_id::text = p_secret)) then
    return false;
  end if;
  delete from vault.secrets s where s.id::text = p_secret and not exists(
    select 1 from public.platform_integrations i where i.id <> p_integration
      and (i.access_token_secret_id = p_secret or i.refresh_token_secret_id::text = p_secret));
  get diagnostics v_deleted = row_count;
  return v_deleted > 0;
end $$;
revoke all on function public.delete_integration_secret(uuid, text) from public, anon, authenticated;
grant execute on function public.delete_integration_secret(uuid, text) to service_role;

revoke all on function public.delete_meta_connection_data(uuid, uuid) from public, anon, authenticated;
grant execute on function public.delete_meta_connection_data(uuid, uuid) to service_role;

commit;
