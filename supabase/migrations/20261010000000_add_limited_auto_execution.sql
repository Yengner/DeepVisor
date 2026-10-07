begin;

-- No existing policy is enabled or converted by this migration.
create table ai.execution_controls (
  singleton boolean primary key default true check(singleton),
  limited_auto_enabled boolean not null default false
);
insert into ai.execution_controls default values;
create table ai.limited_auto_evaluations (
  business_id uuid not null references public.business_profiles(id),
  source_snapshot_id uuid primary key,
  source_hash text not null,
  policy_json jsonb not null,
  decision_run_id uuid,
  action_proposal_id uuid,
  status text not null default 'running' check(status in ('running','hold','blocked','executed')),
  reason text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(business_id,source_hash),
  foreign key(business_id,source_snapshot_id) references ai.feature_snapshots(business_id,id),
  foreign key(business_id,decision_run_id) references ai.decision_runs(business_id,id),
  foreign key(business_id,action_proposal_id) references ai.action_proposals(business_id,id)
);
alter table ai.execution_controls enable row level security;
alter table ai.limited_auto_evaluations enable row level security;
revoke all on ai.execution_controls,ai.limited_auto_evaluations from public,anon,authenticated;
grant select,update on ai.execution_controls to service_role;
grant select,insert,update on ai.limited_auto_evaluations to service_role;

create function ai.limited_auto_history(p_business uuid)
returns jsonb language plpgsql stable set search_path='' as $$
declare history jsonb;
begin
  select coalesce(jsonb_agg(h),'[]'::jsonb) into history from (
    select e.id,e.business_id as "businessId",s.ad_account_id as "adAccountId",p.target_entity_id as "entityId",e.status,coalesce(e.started_at,e.created_at) as "attemptedAt"
    from ai.executed_actions e join ai.action_proposals p on p.id=e.action_proposal_id and p.business_id=e.business_id
    join ai.decision_runs r on r.id=p.decision_run_id and r.business_id=p.business_id
    join ai.feature_snapshots s on s.id=r.feature_snapshot_id and s.business_id=r.business_id
    where e.business_id=p_business and (coalesce(e.started_at,e.created_at)>=now()-interval '367 days' or e.status in ('pending','running'))
    order by e.created_at desc limit 10001
  ) h;
  if jsonb_array_length(history)>10000 then raise exception 'History exceeds execution safety limit'; end if;
  return history;
end;
$$;

create function ai.claim_limited_auto_evaluation(p_business uuid,p_snapshot uuid)
returns jsonb language plpgsql set search_path='' as $$
declare snapshot ai.feature_snapshots; policy ai.autonomy_policies;
begin
  select * into snapshot from ai.feature_snapshots where business_id=p_business and id=p_snapshot;
  select * into policy from ai.autonomy_policies where business_id=p_business;
  if not exists(select 1 from ai.execution_controls where limited_auto_enabled)
    or snapshot.id is null or snapshot.entity_type<>'adset' or snapshot.created_at<now()-interval '6 hours' or snapshot.created_at>now()
    or policy.id is null or policy.mode<>'autonomous'
    or policy.budget_boundaries_json->'executionEnabled' is distinct from 'true'::jsonb
    or policy.budget_boundaries_json->'exclusiveWriterConfirmed' is distinct from 'true'::jsonb
    or policy.budget_boundaries_json #> '{limitedAuto,enabled}' is distinct from 'true'::jsonb
    or policy.budget_boundaries_json #> '{limitedAuto,killSwitch}' is distinct from 'false'::jsonb
    or policy.budget_boundaries_json #>> '{limitedAuto,adAccountId}' is distinct from snapshot.ad_account_id::text then
    raise exception 'Limited auto disabled or stale source';
  end if;
  insert into ai.limited_auto_evaluations(business_id,source_snapshot_id,source_hash,policy_json)
    values(p_business,p_snapshot,encode(sha256(convert_to(jsonb_build_object('account',snapshot.ad_account_id,'entity',snapshot.entity_id,'version',snapshot.feature_schema_version,'features',snapshot.feature_json)::text,'UTF8')),'hex'),to_jsonb(policy));
  return jsonb_build_object('snapshot',to_jsonb(snapshot),'policy',to_jsonb(policy));
end;
$$;

create function ai.finish_limited_auto_evaluation(p_business uuid,p_snapshot uuid,p_status text,p_reason text,p_run uuid default null,p_proposal uuid default null)
returns void language plpgsql set search_path='' as $$
begin
  if p_status not in ('running','hold','blocked','executed') then raise exception 'Invalid evaluation status'; end if;
  update ai.limited_auto_evaluations set status=p_status,reason=p_reason,decision_run_id=p_run,action_proposal_id=p_proposal,
    completed_at=case when p_status='running' then null else now() end
    where business_id=p_business and source_snapshot_id=p_snapshot and status='running';
  if not found then raise exception 'Evaluation already finalized'; end if;
end;
$$;

create function ai.claim_limited_auto_execution(p_business uuid,p_proposal uuid,p_execution uuid)
returns jsonb language plpgsql set search_path='' as $$
declare proposal ai.action_proposals; run ai.decision_runs; snapshot ai.feature_snapshots; policy ai.autonomy_policies; context jsonb; history jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_business::text,0));
  select * into proposal from ai.action_proposals where business_id=p_business and id=p_proposal for update;
  select * into policy from ai.autonomy_policies where business_id=p_business for update;
  select * into run from ai.decision_runs where business_id=p_business and id=proposal.decision_run_id;
  select * into snapshot from ai.feature_snapshots where business_id=p_business and id=run.feature_snapshot_id;
  if not exists(select 1 from ai.execution_controls where limited_auto_enabled)
    or proposal.id is null or policy.id is null or run.id is null or snapshot.id is null
    or policy.mode<>'autonomous' or proposal.status<>'pending' or proposal.requires_approval or proposal.risk_level<>'low'
    or proposal.action_type not in ('REDUCE_BUDGET','PAUSE_DELIVERY_UNIT') or not(proposal.action_type=any(policy.allowed_action_classes))
    or policy.budget_boundaries_json->'executionEnabled' is distinct from 'true'::jsonb
    or policy.budget_boundaries_json->'exclusiveWriterConfirmed' is distinct from 'true'::jsonb
    or policy.budget_boundaries_json #> '{limitedAuto,enabled}' is distinct from 'true'::jsonb
    or policy.budget_boundaries_json #> '{limitedAuto,killSwitch}' is distinct from 'false'::jsonb
    or proposal.policy_result_json->>'outcome' is distinct from 'ALLOW_EXECUTION'
    or proposal.policy_result_json->>'reason' is distinct from 'POLICY_PASSED'
    or coalesce(proposal.policy_result_json #>> '{automaticAuthorization,fingerprint}','')=''
    or run.status<>'completed' or run.updated_at<now()-interval '2 minutes' or run.updated_at>now()
    or snapshot.entity_type<>'adset' or proposal.target_entity_type<>'adset' or snapshot.entity_id<>proposal.target_entity_id
    or not exists(select 1 from ai.limited_auto_evaluations j join ai.feature_snapshots s on s.id=j.source_snapshot_id and s.business_id=j.business_id
      where j.business_id=p_business and j.decision_run_id=run.id and j.action_proposal_id=proposal.id and j.status='running'
        and j.policy_json=to_jsonb(policy) and s.feature_json=snapshot.feature_json and s.ad_account_id=snapshot.ad_account_id
        and s.platform_integration_id=snapshot.platform_integration_id and s.entity_id=snapshot.entity_id) then
    raise exception 'Limited auto execution not authorized';
  end if;
  if exists(select 1 from ai.executed_actions where business_id=p_business and (action_proposal_id=p_proposal or status in ('pending','running')))
    or exists(select 1 from ai.review_execution_claims where proposal_id=p_proposal or (business_id=p_business and active)) then
    raise exception 'Execution already attempted or business locked';
  end if;
  context:=jsonb_build_object('proposal',to_jsonb(proposal),'run',to_jsonb(run),'snapshot',to_jsonb(snapshot),'policy',to_jsonb(policy));
  history:=ai.limited_auto_history(p_business);
  insert into ai.executed_actions(id,business_id,action_proposal_id,request_metadata_json)
    values(p_execution,p_business,p_proposal,'{"executionMode":"LIMITED_AUTO"}');
  -- Share the existing non-expiring lock with REVIEW, never create a second lane.
  insert into ai.review_execution_claims(proposal_id,business_id,execution_id,context_json) values(p_proposal,p_business,p_execution,context);
  return context||jsonb_build_object('history',history);
end;
$$;

create function ai.authorize_limited_auto_execution(p_business uuid,p_execution uuid)
returns void language plpgsql set search_path='' as $$
declare claim ai.review_execution_claims; current_context jsonb;
begin
  if not exists(select 1 from ai.execution_controls where limited_auto_enabled) then raise exception 'Global limited auto kill switch'; end if;
  select * into claim from ai.review_execution_claims where business_id=p_business and execution_id=p_execution and active;
  select jsonb_build_object('proposal',to_jsonb(p),'run',to_jsonb(r),'snapshot',to_jsonb(s),'policy',to_jsonb(a)) into current_context
    from ai.action_proposals p join ai.decision_runs r on r.id=p.decision_run_id and r.business_id=p.business_id
    join ai.feature_snapshots s on s.id=r.feature_snapshot_id and s.business_id=r.business_id
    join ai.autonomy_policies a on a.business_id=p.business_id
    where p.id=claim.proposal_id and p.business_id=p_business and a.mode='autonomous' and r.updated_at>=now()-interval '2 minutes'
      and a.budget_boundaries_json #> '{limitedAuto,enabled}'='true'::jsonb
      and a.budget_boundaries_json #> '{limitedAuto,killSwitch}'='false'::jsonb;
  if claim.execution_id is null or current_context is null or current_context is distinct from claim.context_json then
    raise exception 'Limited auto policy, evidence or authorization changed';
  end if;
end;
$$;

create function ai.checkpoint_limited_auto_execution(p_business uuid,p_execution uuid,p_before jsonb,p_request jsonb)
returns void language plpgsql set search_path='' as $$
begin
  perform ai.authorize_limited_auto_execution(p_business,p_execution);
  perform ai.checkpoint_review_execution(p_business,p_execution,p_before,p_request);
end;
$$;

revoke all on function ai.claim_limited_auto_evaluation(uuid,uuid),ai.finish_limited_auto_evaluation(uuid,uuid,text,text,uuid,uuid),ai.claim_limited_auto_execution(uuid,uuid,uuid),ai.authorize_limited_auto_execution(uuid,uuid),ai.checkpoint_limited_auto_execution(uuid,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function ai.claim_limited_auto_evaluation(uuid,uuid),ai.finish_limited_auto_evaluation(uuid,uuid,text,text,uuid,uuid),ai.claim_limited_auto_execution(uuid,uuid,uuid),ai.authorize_limited_auto_execution(uuid,uuid),ai.checkpoint_limited_auto_execution(uuid,uuid,jsonb,jsonb) to service_role;
revoke all on function ai.limited_auto_history(uuid) from public,anon,authenticated;
grant execute on function ai.limited_auto_history(uuid) to service_role;
commit;
