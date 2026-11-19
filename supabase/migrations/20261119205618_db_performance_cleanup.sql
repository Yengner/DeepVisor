-- Database performance cleanup (Supabase performance advisor, 2026-11-19).
--
-- 1. Duplicate permissive RLS policies: each pair grants the same rows, so every query paid for
--    both. The older copy is dropped; the remaining policy grants the same access (or, for
--    oauth_states, the stricter "own row in an accessible business" rule that already applied).
-- 2. Policies that call auth.uid() per row are rewritten to (select auth.uid()), which Postgres
--    evaluates once per query. Behavior is unchanged.
-- 3. Indexes for foreign keys that queries filter on, deletions scan (account and Meta data
--    deletion), or that grow with every sync. Low-value keys (audit "by" columns, legacy Calendar
--    tables, the small platforms lookup) are left unindexed on purpose.
begin;

-- 1. Duplicates.
drop policy if exists ad_accounts_select on public.ad_accounts;                         -- = ad_accounts_select_org_members
drop policy if exists oauth_states_select_policy on public.oauth_states;                -- stricter *_own_accessible_business stays
drop policy if exists oauth_states_insert_policy on public.oauth_states;
drop policy if exists oauth_states_delete_policy on public.oauth_states;                -- `false`: added nothing
drop policy if exists "Enable users to view their own data only" on public.organization_memberships; -- own row ⊂ org members
drop policy if exists organizations_select_members on public.organizations;             -- = organizations_select_org_members
drop policy if exists organizations_update_admins on public.organizations;              -- = organizations_update_org_admins
drop policy if exists platforms_select_enabled_authenticated on public.platforms;       -- platforms_select_all already allows all
drop policy if exists users_select_own on public.users;                                 -- = "Enable users to view their own data only"
drop policy if exists users_update_own on public.users;                                 -- = "Enable update for users based on UID"

-- 2. auth.uid() once per query instead of once per row.
do $$
declare
  p record;
  v_using text;
  v_check text;
  pattern constant text := '(?<!select )auth\.uid\(\)';
begin
  for p in
    select schemaname, tablename, policyname, qual, with_check from pg_policies
    where schemaname = 'public'
      and (coalesce(qual, '') ~* pattern or coalesce(with_check, '') ~* pattern)
  loop
    v_using := case when p.qual is null then null else regexp_replace(p.qual, pattern, '(select auth.uid())', 'gi') end;
    v_check := case when p.with_check is null then null else regexp_replace(p.with_check, pattern, '(select auth.uid())', 'gi') end;
    execute format('alter policy %I on %I.%I', p.policyname, p.schemaname, p.tablename)
      || case when v_using is not null then format(' using (%s)', v_using) else '' end
      || case when v_check is not null then format(' with check (%s)', v_check) else '' end;
  end loop;
end $$;

-- 3. Foreign-key indexes that pay for themselves.
create index if not exists account_sync_jobs_business_idx on public.account_sync_jobs (business_id);
create index if not exists account_sync_jobs_integration_idx on public.account_sync_jobs (platform_integration_id);
create index if not exists account_sync_resources_business_idx on public.account_sync_resources (business_id);
create index if not exists ad_entities_integration_idx on public.ad_entities (platform_integration_id);
create index if not exists campaign_drafts_ad_account_idx on public.campaign_drafts (ad_account_id);
create index if not exists campaign_drafts_integration_idx on public.campaign_drafts (platform_integration_id);
create index if not exists insight_reviews_ad_account_idx on public.insight_reviews (ad_account_id);
create index if not exists insight_seen_sources_ad_account_idx on public.insight_seen_sources (ad_account_id);
create index if not exists leads_connection_idx on public.leads (connection_id);
create index if not exists meta_api_request_leases_ad_account_idx on public.meta_api_request_leases (ad_account_id);
create index if not exists meta_webhook_subscriptions_business_idx on public.meta_webhook_subscriptions (business_id);
create index if not exists notifications_business_idx on public.notifications (business_id);
create index if not exists whatsapp_message_receipts_business_idx on public.whatsapp_message_receipts (business_id);
create index if not exists whatsapp_message_receipts_lead_idx on public.whatsapp_message_receipts (lead_id);
-- Account deletion follows these from the user.
create index if not exists assistant_conversations_user_idx on public.assistant_conversations (user_id);
create index if not exists notification_preferences_user_idx on public.notification_preferences (user_id);
create index if not exists report_subscriptions_user_idx on public.report_subscriptions (user_id);
create index if not exists platform_integrations_connected_by_idx on public.platform_integrations (connected_by_user_id);

commit;
