begin;

alter table ai.action_outcomes
  alter column executed_action_id drop not null,
  add column source_kind text not null default 'executed' check(source_kind in ('executed','shadow')),
  add column shadow_decision_run_id uuid,
  add column anchor_at timestamptz,
  add column measurement_due_at timestamptz,
  add column measurement_status text not null default 'complete' check(measurement_status in ('pending','complete','insufficient_data','unavailable')),
  add column next_attempt_at timestamptz,
  add column measured_at timestamptz,
  add constraint action_outcomes_source_check check (
    (source_kind = 'executed' and executed_action_id is not null and shadow_decision_run_id is null)
    or (source_kind = 'shadow' and executed_action_id is null and shadow_decision_run_id is not null)
  ),
  add constraint action_outcomes_shadow_run_fkey foreign key (business_id,shadow_decision_run_id) references ai.decision_runs(business_id,id);
create unique index action_outcomes_shadow_horizon on ai.action_outcomes(business_id,shadow_decision_run_id,measurement_horizon_hours) where source_kind = 'shadow';
create index action_outcomes_pending on ai.action_outcomes(next_attempt_at,measurement_due_at) where measurement_status = 'pending';

-- Stored hourly facts use account-local day/hour keys, not a UTC timestamp.
-- Missing rows cannot be assumed to mean zero (especially after a pause).
create function ai.measure_outcome_window(p_account uuid,p_entity text,p_currency text,p_zone text,p_start timestamptz,p_end timestamptz)
returns jsonb language sql stable set search_path = '' as $$
  with expected as (
    select t, (t at time zone p_zone)::date as day, extract(hour from t at time zone p_zone)::integer as hour
    from generate_series(p_start,p_end-interval '1 hour',interval '1 hour') t
  ), facts as (
    select x.t,d.*,e.external_id from expected x
    left join public.ad_entities e on e.ad_account_id=p_account and e.external_id=p_entity and e.entity_level='adset'
    left join public.ad_entity_performance_hourly d on d.entity_id=e.id and d.ad_account_id=p_account and d.entity_level='adset' and d.day=x.day and d.hour_of_day=x.hour
  ), totals as (
    select count(*) as expected, count(entity_id) as observed,
      coalesce(bool_and(coalesce(entity_id is not null and updated_at >= p_end and updated_at <= now() and currency_code = p_currency
        and spend >= 0 and spend < 1e30 and impressions >= 0 and impressions < 1e30 and clicks >= 0 and clicks < 1e30
        and leads >= 0 and leads < 1e30 and messages >= 0 and messages < 1e30 and calls >= 0 and calls < 1e30,false)),false) as valid,
      sum(spend) as spend,sum(impressions) as impressions,sum(clicks) as clicks,
      sum(leads+messages+calls) as results,
      count(*) filter(where impressions>0 or spend>0) as active_hours,
      max(updated_at) as latest_sync
    from facts
  ), ready as (
    select *, valid and expected=extract(epoch from p_end-p_start)/3600
      and observed=expected and expected>0 as complete from totals
  )
  select jsonb_build_object('start',p_start,'end',p_end,'timeZone',p_zone,'currency',p_currency,
    'expectedHours',extract(epoch from p_end-p_start)/3600,'observedHours',observed,'complete',complete,
    'capturedAt',now(),'latestSourceSyncAt',latest_sync,'resultDefinition','leads_plus_messages_plus_calls',
    'metrics',case when complete then jsonb_build_object('spend',spend,'results',results,'impressions',impressions,'clicks',clicks,
      'costPerResult',spend/nullif(results,0),'ctr',clicks*100.0/nullif(impressions,0),
      'cpc',spend/nullif(clicks,0),'cpm',spend*1000.0/nullif(impressions,0),
      'activeHours',active_hours,'deliveryImpressionsPerHour',impressions*1.0/nullif(expected,0)) else 'null'::jsonb end)
  from ready;
$$;

create function ai.outcome_observed_changes(p_before jsonb,p_after jsonb)
returns jsonb language sql immutable set search_path = '' as $$
  select coalesce(jsonb_object_agg(key,jsonb_build_object(
    'before',before_value,'after',after_value,
    'absoluteChange',after_value-before_value,
    'relativeChangePercent',case when before_value>0 then (after_value-before_value)*100.0/before_value else null end,
    'absoluteUnit',case when key='ctr' then 'percentage_points' else 'metric_units' end
  )),'{}'::jsonb) from (
    select key,(p_before->>key)::numeric as before_value,(p_after->>key)::numeric as after_value
    from unnest(array['spend','results','costPerResult','ctr','cpc','cpm','impressions','clicks','activeHours','deliveryImpressionsPerHour']) key
  ) values_to_compare;
$$;

create function ai.process_action_outcomes(p_limit integer default 100)
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
      where j.status='completed' and r.status='completed' and j.completed_at is not null and s.entity_type='adset'
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

revoke all on function ai.measure_outcome_window(uuid,text,text,text,timestamptz,timestamptz) from public,anon,authenticated;
revoke all on function ai.outcome_observed_changes(jsonb,jsonb) from public,anon,authenticated;
revoke all on function ai.process_action_outcomes(integer) from public,anon,authenticated;
grant execute on function ai.measure_outcome_window(uuid,text,text,text,timestamptz,timestamptz) to service_role;
grant execute on function ai.outcome_observed_changes(jsonb,jsonb) to service_role;
grant execute on function ai.process_action_outcomes(integer) to service_role;
commit;
