begin;

create table ai.shadow_evaluation_jobs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.business_profiles(id),
  platform_integration_id uuid not null references public.platform_integrations(id),
  ad_account_id uuid not null references public.ad_accounts(id),
  entity_id text not null,
  evaluation_version text not null,
  source_hash text not null,
  source_json jsonb not null,
  source_synced_at timestamptz not null,
  source_sync_job_id uuid not null references public.account_sync_jobs(id),
  feature_snapshot_id uuid not null default gen_random_uuid(),
  decision_run_id uuid not null default gen_random_uuid(),
  action_proposal_id uuid not null default gen_random_uuid(),
  status text not null default 'queued' check(status in ('queued','running','completed','failed','expired')),
  result_json jsonb,
  error_code text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  unique(business_id, ad_account_id, entity_id, evaluation_version, source_hash)
);
create unique index shadow_entity_running on ai.shadow_evaluation_jobs(business_id, ad_account_id, entity_id, evaluation_version) where status = 'running';
create index shadow_jobs_queue on ai.shadow_evaluation_jobs(status, created_at);
alter table ai.shadow_evaluation_jobs enable row level security;
revoke all on ai.shadow_evaluation_jobs from public, anon, authenticated;
grant select on ai.shadow_evaluation_jobs to authenticated;
grant select, insert, update on ai.shadow_evaluation_jobs to service_role;
create policy business_read on ai.shadow_evaluation_jobs for select to authenticated using (
  exists(select 1 from public.business_profiles b where b.id = business_id and public.is_org_member(b.organization_id))
);

-- Capture only normalized facts and policy-relevant configuration, not raw tokens,
-- refresh timestamps, targeting PII, or incomplete current-day performance.
create function ai.enqueue_meta_shadow(p_business uuid, p_integration uuid, p_account uuid, p_sync_job uuid, p_version text)
returns integer language plpgsql set search_path = '' as $$
declare account public.ad_accounts; sync public.account_sync_jobs; policy ai.autonomy_policies; cutoff date; inserted integer;
begin
  select * into account from public.ad_accounts where id = p_account and business_id = p_business;
  select * into sync from public.account_sync_jobs where id = p_sync_job and business_id = p_business and ad_account_id = p_account and platform_integration_id = p_integration and status = 'completed';
  select * into policy from ai.autonomy_policies where business_id = p_business and mode = 'observe';
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
    where e.business_id = p_business and e.ad_account_id = p_account and e.entity_level = 'adset' and e.status = 'ACTIVE'
      and not exists(select 1 from public.account_sync_jobs active_sync where active_sync.ad_account_id = p_account and active_sync.status = 'running')
    on conflict (business_id, ad_account_id, entity_id, evaluation_version, source_hash) do nothing;
  get diagnostics inserted = row_count;
  return inserted;
end;
$$;

create function ai.claim_meta_shadow()
returns jsonb language plpgsql set search_path = '' as $$
declare job ai.shadow_evaluation_jobs; history jsonb;
begin
  -- A crashed inference is uncertain: expire it, never replay the same input.
  update ai.shadow_evaluation_jobs set status = 'expired', error_code = 'WORKER_LOST', completed_at = now()
    where status = 'running' and started_at < now() - interval '10 minutes';
  perform pg_advisory_xact_lock(hashtextextended('deepvisor-shadow-claim', 0));
  select j.* into job from ai.shadow_evaluation_jobs j where j.status = 'queued'
    and not exists(select 1 from ai.shadow_evaluation_jobs r where r.business_id = j.business_id and r.ad_account_id = j.ad_account_id and r.entity_id = j.entity_id and r.evaluation_version = j.evaluation_version and r.status = 'running')
    order by j.created_at, j.id for update skip locked limit 1;
  if job.id is null then return null; end if;
  update ai.shadow_evaluation_jobs set status = 'running', started_at = now() where id = job.id returning * into job;
  select coalesce(jsonb_agg(h), '[]'::jsonb) into history from (
    select e.id, e.business_id as "businessId", s.ad_account_id as "adAccountId", p.target_entity_id as "entityId", e.status, coalesce(e.started_at,e.created_at) as "attemptedAt"
    from ai.executed_actions e join ai.action_proposals p on p.business_id = e.business_id and p.id = e.action_proposal_id
    join ai.decision_runs r on r.business_id = p.business_id and r.id = p.decision_run_id
    join ai.feature_snapshots s on s.business_id = r.business_id and s.id = r.feature_snapshot_id
    where e.business_id = job.business_id and (coalesce(e.started_at,e.created_at) >= now() - interval '367 days' or e.status in ('pending','running'))
    order by e.created_at desc limit 10001
  ) h;
  return to_jsonb(job) || jsonb_build_object('history', history);
end;
$$;

create function ai.finish_meta_shadow(p_job uuid, p_result jsonb, p_proposal jsonb, p_error text)
returns void language plpgsql set search_path = '' as $$
declare job ai.shadow_evaluation_jobs;
begin
  select * into job from ai.shadow_evaluation_jobs where id = p_job and status = 'running' for update;
  if job.id is null then raise exception 'Shadow job is no longer running'; end if;
  if p_error is null then
    if coalesce(p_result->'shadowPolicy'->>'outcome','') not in ('SHADOW_ONLY','BLOCK','HOLD') then raise exception 'Invalid shadow policy result'; end if;
    if not exists(select 1 from ai.decision_runs where id = job.decision_run_id and business_id = job.business_id and feature_snapshot_id = job.feature_snapshot_id and status = 'completed') then raise exception 'Missing completed evaluation'; end if;
    if p_proposal is not null then
      insert into ai.action_proposals(id,business_id,decision_run_id,action_type,target_entity_type,target_entity_id,current_state_json,proposed_state_json,risk_level,policy_result_json,requires_approval,status)
      values(job.action_proposal_id,job.business_id,job.decision_run_id,p_proposal->>'actionType','adset',job.entity_id,
        p_proposal->'currentState',p_proposal->'proposedState',coalesce(p_proposal->>'risk','unknown'),
        (p_result->'shadowPolicy') || jsonb_build_object('shadowOnly',true,'shadowJobId',job.id,'reviewPolicy',p_result->'reviewPolicy'),true,'pending');
    end if;
    update ai.decision_runs set decision_json = decision_json || jsonb_build_object('shadow',p_result,'shadowJobId',job.id) where id = job.decision_run_id and business_id = job.business_id;
  end if;
  update ai.shadow_evaluation_jobs set status = case when p_error is null then 'completed' else 'failed' end,
    result_json = p_result, error_code = p_error, completed_at = now() where id = p_job;
end;
$$;

revoke all on function ai.enqueue_meta_shadow(uuid,uuid,uuid,uuid,text) from public,anon,authenticated;
revoke all on function ai.claim_meta_shadow() from public,anon,authenticated;
revoke all on function ai.finish_meta_shadow(uuid,jsonb,jsonb,text) from public,anon,authenticated;
grant execute on function ai.enqueue_meta_shadow(uuid,uuid,uuid,uuid,text) to service_role;
grant execute on function ai.claim_meta_shadow() to service_role;
grant execute on function ai.finish_meta_shadow(uuid,jsonb,jsonb,text) to service_role;
commit;
