-- Sync normalizes dimension status to lowercase; retain historical uppercase compatibility.
-- Replace only eligibility matching; preserve privileges, source evidence, and approval gates.
begin;
create or replace function ai.enqueue_meta_evaluation(p_business uuid, p_integration uuid, p_account uuid, p_sync_job uuid, p_version text, p_mode text)
returns integer language plpgsql set search_path = '' as $$
declare account public.ad_accounts; sync public.account_sync_jobs; policy ai.autonomy_policies; cutoff date; inserted integer;
begin
  if p_mode not in ('observe','approval_required') then raise exception 'Invalid evaluation mode'; end if;
  select * into account from public.ad_accounts where id = p_account and business_id = p_business;
  select * into sync from public.account_sync_jobs where id = p_sync_job and business_id = p_business and ad_account_id = p_account and platform_integration_id = p_integration and status = 'completed';
  select * into policy from ai.autonomy_policies where business_id = p_business and mode = p_mode;
  if account.id is null or sync.id is null or policy.id is null or account.timezone is null or account.currency_code is null then return 0; end if;
  if not exists(select 1 from public.platform_integrations i join public.platforms p on p.id = i.platform_id
    where i.id = p_integration and i.business_id = p_business and i.platform_id = account.platform_id and p.key = 'meta') then return 0; end if;
  if sync.finished_at is null or sync.finished_at < now() - interval '6 hours' or sync.finished_at > now() then return 0; end if;
  if exists(select 1 from public.account_sync_jobs where ad_account_id = p_account and status = 'running') then return 0; end if;
  cutoff := (now() at time zone account.timezone)::date - 1;
  if not exists(select 1 from public.ad_account_sync_state where ad_account_id = p_account and insights_synced_through >= cutoff) then return 0; end if;
  insert into ai.shadow_evaluation_jobs(business_id, platform_integration_id, ad_account_id, entity_id, evaluation_version, source_hash, source_json, source_synced_at, source_sync_job_id)
    select p_business, p_integration, p_account, e.external_id, p_version,
      encode(sha256(convert_to(source.payload::text, 'UTF8')), 'hex'), source.payload, sync.finished_at, p_sync_job
    from public.ad_entities e
    left join public.ad_entities c on c.id = e.campaign_id and c.ad_account_id = p_account and c.business_id = p_business and c.entity_level = 'campaign'
    cross join lateral (select jsonb_build_object(
      'asOfDay', cutoff, 'currency', account.currency_code, 'timeZone', account.timezone,
      'entity', jsonb_build_object('id', e.external_id, 'status', e.status, 'effectiveStatus', e.raw->>'effective_status', 'campaignId', c.external_id,
        'dailyBudget', e.raw->>'daily_budget', 'lifetimeBudget', e.raw->>'lifetime_budget',
        'campaignDailyBudget', c.raw->>'daily_budget', 'campaignLifetimeBudget', c.raw->>'lifetime_budget', 'campaignStatus', c.status),
      'policy', to_jsonb(policy) - 'created_at' - 'updated_at',
      'rows', coalesce((select jsonb_agg(jsonb_build_object('adset_id', e.external_id, 'day', d.day,
        'spend', d.spend, 'reach', d.reach, 'impressions', d.impressions, 'clicks', d.clicks, 'inline_link_clicks', d.inline_link_clicks,
        'leads', d.leads, 'messages', d.messages, 'calls', d.calls) order by d.day)
        from public.ad_entity_performance_daily d where d.entity_id = e.id and d.ad_account_id = p_account and d.entity_level = 'adset' and d.day between cutoff - 59 and cutoff), '[]'::jsonb)
    ) as payload) source
    where e.business_id = p_business and e.ad_account_id = p_account and e.entity_level = 'adset' and upper(btrim(e.status)) = 'ACTIVE'
      and not exists(select 1 from public.account_sync_jobs active_sync where active_sync.ad_account_id = p_account and active_sync.status = 'running')
    on conflict (business_id, ad_account_id, entity_id, evaluation_version, source_hash) do nothing;
  get diagnostics inserted = row_count;
  return inserted;
end;
$$;

commit;
