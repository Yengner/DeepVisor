-- Reuse the existing evaluation queue; immutable source policy separates modes.
begin;
create function ai.enqueue_meta_evaluation(p_business uuid, p_integration uuid, p_account uuid, p_sync_job uuid, p_version text, p_mode text)
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
    where e.business_id = p_business and e.ad_account_id = p_account and e.entity_level = 'adset' and e.status = 'ACTIVE'
      and not exists(select 1 from public.account_sync_jobs active_sync where active_sync.ad_account_id = p_account and active_sync.status = 'running')
    on conflict (business_id, ad_account_id, entity_id, evaluation_version, source_hash) do nothing;
  get diagnostics inserted = row_count;
  return inserted;
end;
$$;

create function ai.claim_meta_evaluation(p_mode text)
returns jsonb language plpgsql set search_path = '' as $$
declare job ai.shadow_evaluation_jobs; history jsonb;
begin
  if p_mode not in ('observe','approval_required') then raise exception 'Invalid evaluation mode'; end if;
  -- A crashed inference is uncertain: expire it, never replay the same input.
  update ai.shadow_evaluation_jobs set status = 'expired', error_code = 'WORKER_LOST', completed_at = now()
    where status = 'running' and started_at < now() - interval '10 minutes';
  perform pg_advisory_xact_lock(hashtextextended('deepvisor-shadow-claim', 0));
  select j.* into job from ai.shadow_evaluation_jobs j where j.status = 'queued' and j.source_json->'policy'->>'mode' = p_mode
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


create or replace function ai.enqueue_meta_shadow(p_business uuid,p_integration uuid,p_account uuid,p_sync_job uuid,p_version text)
returns integer language sql set search_path='' as $$ select ai.enqueue_meta_evaluation(p_business,p_integration,p_account,p_sync_job,p_version,'observe') $$;
create or replace function ai.claim_meta_shadow()
returns jsonb language sql set search_path='' as $$ select ai.claim_meta_evaluation('observe') $$;

create or replace function ai.enqueue_meta_review(p_business uuid,p_integration uuid,p_account uuid,p_sync_job uuid,p_version text)
returns integer language sql set search_path='' as $$ select ai.enqueue_meta_evaluation(p_business,p_integration,p_account,p_sync_job,p_version,'approval_required') $$;
create or replace function ai.claim_meta_review()
returns jsonb language sql set search_path='' as $$ select ai.claim_meta_evaluation('approval_required') $$;
create or replace function ai.finish_meta_shadow(p_job uuid, p_result jsonb, p_proposal jsonb, p_error text)
returns void language plpgsql set search_path = '' as $$
declare job ai.shadow_evaluation_jobs;
begin
  select * into job from ai.shadow_evaluation_jobs where id = p_job and status = 'running' for update;
  if job.id is null or job.source_json->'policy'->>'mode' is distinct from 'observe' then raise exception 'Shadow job is no longer running'; end if;
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


-- Fresh Review evaluations only. Shadow proposals cannot enter this finalizer.
create function ai.finish_meta_review(p_job uuid,p_result jsonb,p_proposal jsonb,p_error text)
returns void language plpgsql set search_path='' as $$
declare job ai.shadow_evaluation_jobs; policy ai.autonomy_policies; run ai.decision_runs;
begin
 select * into job from ai.shadow_evaluation_jobs where id=p_job and status='running' for update;
 if job.id is null or job.source_json->'policy'->>'mode' is distinct from 'approval_required' then raise exception 'Review job is no longer running'; end if;
 if p_error is null then
  select * into policy from ai.autonomy_policies where business_id=job.business_id for share;
  if policy.mode is distinct from 'approval_required' or (to_jsonb(policy)-'created_at'-'updated_at') is distinct from job.source_json->'policy' then raise exception 'Review policy changed'; end if;
  if job.source_synced_at < now()-interval '6 hours' or job.source_synced_at > now() then raise exception 'Stale evaluation'; end if;
  select * into run from ai.decision_runs where id=job.decision_run_id and business_id=job.business_id and feature_snapshot_id=job.feature_snapshot_id and status='completed';
  if run.id is null or coalesce(p_result->'policy'->>'outcome','') not in ('REQUIRE_APPROVAL','HOLD','BLOCK') or p_result->>'mode' is distinct from 'REVIEW' then raise exception 'Invalid Review evaluation'; end if;
  if p_proposal is not null then
   if p_result->'policy'->>'outcome' is distinct from 'REQUIRE_APPROVAL' or p_result->'policy'->>'reason' is distinct from 'REVIEW_MODE'
    or coalesce(p_proposal->>'actionType','') not in ('REDUCE_BUDGET','PAUSE_DELIVERY_UNIT')
    or p_proposal->>'actionType' is distinct from run.decision_json->'result'->>'decision'
    or p_proposal->'proposedState' is distinct from p_result->'policy'->'action'
    or p_proposal->'currentState'->'metaState' is null then raise exception 'Review action not permitted'; end if;
   insert into ai.action_proposals(id,business_id,decision_run_id,action_type,target_entity_type,target_entity_id,current_state_json,proposed_state_json,risk_level,policy_result_json,requires_approval,status)
   values(job.action_proposal_id,job.business_id,job.decision_run_id,p_proposal->>'actionType','adset',job.entity_id,p_proposal->'currentState',p_proposal->'proposedState',p_result->'policy'->>'risk',
     (p_result->'policy')||jsonb_build_object('reviewJobId',job.id,'sourceHash',job.source_hash,'evaluatedAt',p_result->'evaluatedAt','simulation',coalesce((p_result->>'simulation')::boolean,false)),true,'pending');
  end if;
  update ai.decision_runs set decision_json=decision_json||jsonb_build_object('review',p_result,'reviewJobId',job.id) where id=run.id and business_id=job.business_id;
 end if;
 update ai.shadow_evaluation_jobs set status=case when p_error is null then 'completed' else 'failed' end,result_json=p_result,error_code=p_error,completed_at=now() where id=job.id;
end;
$$;
create or replace function ai.process_action_outcomes(p_limit integer default 100)
returns jsonb language plpgsql set search_path = '' as $$
declare
  source record; outcome ai.action_outcomes; zone text; currency text; local_anchor timestamp;
  before_end timestamptz; after_start timestamptz; after_end timestamptz; before_start timestamptz;
  baseline jsonb; following jsonb; interpretation jsonb; status text; reason text;
  seeded integer := 0; processed integer := 0; inserted integer;
begin
  if p_limit is null or p_limit<1 or p_limit>500 then raise exception 'Invalid outcome batch limit'; end if;
  -- One coordinator avoids duplicate seeding; existing unique horizon keys remain
  -- the final idempotency guard. Never overwrite a measured or legacy outcome.
  if not pg_try_advisory_xact_lock(hashtextextended('deepvisor-action-outcomes-v1',0)) then return '{"busy":true}'::jsonb; end if;
  for source in
    with sources as (
      select e.business_id,e.id as execution_id,null::uuid as shadow_id,r.id as run_id,p.id as proposal_id,
        s.id as snapshot_id,s.feature_json,s.ad_account_id,s.entity_id,e.completed_at as anchor,
        e.state_before_json #>> '{account,timezone_name}' as zone,'executed'::text as kind
      from ai.executed_actions e join ai.action_proposals p on p.business_id=e.business_id and p.id=e.action_proposal_id
      join ai.decision_runs r on r.business_id=p.business_id and r.id=p.decision_run_id
      join ai.feature_snapshots s on s.business_id=r.business_id and s.id=r.feature_snapshot_id
      where e.status='succeeded' and e.completed_at is not null and s.entity_type='adset'
      union all
      select j.business_id,null::uuid,r.id,r.id,p.id,s.id,s.feature_json,s.ad_account_id,s.entity_id,
        j.completed_at,j.source_json->>'timeZone','shadow'::text
      from ai.shadow_evaluation_jobs j join ai.decision_runs r on r.business_id=j.business_id and r.id=j.decision_run_id
      join ai.feature_snapshots s on s.business_id=r.business_id and s.id=r.feature_snapshot_id
      left join ai.action_proposals p on p.business_id=j.business_id and p.id=j.action_proposal_id
      where j.source_json->'policy'->>'mode'='observe' and j.status='completed' and r.status='completed' and j.completed_at is not null and s.entity_type='adset'
    )
    select s.*,h.hours from sources s cross join (values(1),(6),(24),(72)) h(hours)
    where not exists(select 1 from ai.action_outcomes o where o.business_id=s.business_id and o.measurement_horizon_hours=h.hours
      and ((s.execution_id is not null and o.executed_action_id=s.execution_id) or (s.shadow_id is not null and o.shadow_decision_run_id=s.shadow_id)))
    order by s.anchor,h.hours limit p_limit
  loop
    zone:=source.zone; currency:=source.feature_json #>> '{deliveryUnit,currency}'; reason:=null;
    before_start:=null; before_end:=null; after_start:=null; after_end:=null;
    baseline:=null;
    if zone is null or not exists(select 1 from pg_catalog.pg_timezone_names where name=zone) then reason:='missing_or_invalid_time_zone';
    elsif source.anchor>now() then reason:='future_anchor';
    elsif currency is null then reason:='missing_currency';
    else
      local_anchor:=source.anchor at time zone zone;
      before_end:=date_trunc('hour',local_anchor) at time zone zone;
      after_start:=(date_trunc('hour',local_anchor)+case when local_anchor=date_trunc('hour',local_anchor) then interval '0' else interval '1 hour' end) at time zone zone;
      before_start:=before_end-make_interval(hours=>source.hours);
      after_end:=after_start+make_interval(hours=>source.hours);
      if (before_start at time zone zone)-(before_start at time zone 'UTC') is distinct from
         (after_end at time zone zone)-(after_end at time zone 'UTC') then reason:='daylight_saving_transition';
      else
        baseline:=ai.measure_outcome_window(source.ad_account_id,source.entity_id,currency,zone,before_start,before_end);
      end if;
    end if;
    interpretation:=jsonb_build_object('schemaVersion',1,'interpretation','observational_correlation','causalEffectEstimated',false,
      'sourceKind',source.kind,'reason',reason,'windowAlignment','full_advertiser_hours_excluding_event_hour',
      'anchorMeaning',case when source.kind='executed' then 'execution_confirmed_at' else 'shadow_evaluation_completed_at' end);
    insert into ai.action_outcomes(business_id,executed_action_id,shadow_decision_run_id,source_kind,measurement_horizon_hours,
      anchor_at,measurement_due_at,measurement_status,next_attempt_at,metrics_before_json,metrics_after_json,calculated_change_json)
    values(source.business_id,source.execution_id,source.shadow_id,source.kind,source.hours,source.anchor,after_end,
      case when reason is null then 'pending' else 'unavailable' end,after_end,
      jsonb_build_object('featureSnapshotId',source.snapshot_id,'decisionRunId',source.run_id,'actionProposalId',source.proposal_id,
        'adAccountId',source.ad_account_id,'entityId',source.entity_id,'referenceSnapshot',source.feature_json,
        'window',baseline,'beforeStart',before_start,'beforeEnd',before_end,'afterStart',after_start,'afterEnd',after_end,'timeZone',zone,'currency',currency),
      '{}'::jsonb,interpretation)
    on conflict do nothing;
    get diagnostics inserted=row_count; seeded:=seeded+inserted;
  end loop;

  for outcome in select * from ai.action_outcomes where measurement_status='pending'
    and measurement_due_at<=now() and next_attempt_at<=now() order by next_attempt_at,id for update skip locked limit p_limit
  loop
    baseline:=outcome.metrics_before_json->'window';
    -- Preserve the first complete comparison baseline, plus the original immutable
    -- feature snapshot. Incomplete baseline observations may await later syncs.
    if coalesce((baseline->>'complete')::boolean,false)=false then
      baseline:=ai.measure_outcome_window((outcome.metrics_before_json->>'adAccountId')::uuid,outcome.metrics_before_json->>'entityId',
        outcome.metrics_before_json->>'currency',outcome.metrics_before_json->>'timeZone',
        (outcome.metrics_before_json->>'beforeStart')::timestamptz,(outcome.metrics_before_json->>'beforeEnd')::timestamptz);
    end if;
    following:=ai.measure_outcome_window((outcome.metrics_before_json->>'adAccountId')::uuid,outcome.metrics_before_json->>'entityId',
      outcome.metrics_before_json->>'currency',outcome.metrics_before_json->>'timeZone',
      (outcome.metrics_before_json->>'afterStart')::timestamptz,(outcome.metrics_before_json->>'afterEnd')::timestamptz);
    status:=case when (baseline->>'complete')::boolean and (following->>'complete')::boolean then 'complete'
      when now()>=outcome.measurement_due_at+interval '7 days' then 'insufficient_data' else 'pending' end;
    update ai.action_outcomes set
      metrics_before_json=jsonb_set(outcome.metrics_before_json,'{window}',baseline),
      metrics_after_json=following,measurement_status=status,measured_at=now(),next_attempt_at=now()+interval '1 hour',
      calculated_change_json=outcome.calculated_change_json || jsonb_build_object('dataStatus',status,
        'reason',case when status='complete' then null else 'missing_stale_or_invalid_hourly_data' end,
        'observedChanges',case when status='complete' then ai.outcome_observed_changes(baseline->'metrics',following->'metrics') else '{}'::jsonb end)
      where id=outcome.id;
    processed:=processed+1;
  end loop;
  return jsonb_build_object('seeded',seeded,'processed',processed);
end;
$$;

revoke all on function ai.enqueue_meta_evaluation(uuid,uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function ai.enqueue_meta_evaluation(uuid,uuid,uuid,uuid,text,text) to service_role;
revoke all on function ai.claim_meta_evaluation(text) from public,anon,authenticated;
grant execute on function ai.claim_meta_evaluation(text) to service_role;
revoke all on function ai.enqueue_meta_review(uuid,uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function ai.enqueue_meta_review(uuid,uuid,uuid,uuid,text) to service_role;
revoke all on function ai.claim_meta_review() from public,anon,authenticated;
grant execute on function ai.claim_meta_review() to service_role;
revoke all on function ai.finish_meta_review(uuid,jsonb,jsonb,text) from public,anon,authenticated;
grant execute on function ai.finish_meta_review(uuid,jsonb,jsonb,text) to service_role;
commit;
