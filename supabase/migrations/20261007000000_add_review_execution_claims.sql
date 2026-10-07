begin;

-- One attempt per proposal, and one unresolved execution per business. No expiring
-- lease: a worker crash after a Meta write must never allow an automatic replay.
create table ai.review_execution_claims (
  proposal_id uuid primary key,
  business_id uuid not null references public.business_profiles(id),
  execution_id uuid not null unique,
  active boolean not null default true,
  context_json jsonb not null,
  created_at timestamptz not null default now(),
  foreign key (business_id, proposal_id) references ai.action_proposals(business_id, id),
  foreign key (business_id, execution_id) references ai.executed_actions(business_id, id)
);
create unique index review_execution_business_lock on ai.review_execution_claims(business_id) where active;
alter table ai.review_execution_claims enable row level security;
revoke all on ai.review_execution_claims from public, anon, authenticated;
grant select, insert, update on ai.review_execution_claims to service_role;

create function ai.claim_review_execution(p_business uuid, p_proposal uuid, p_execution uuid)
returns jsonb language plpgsql set search_path = '' as $$
declare
  proposal ai.action_proposals;
  run ai.decision_runs;
  snapshot ai.feature_snapshots;
  policy ai.autonomy_policies;
  context jsonb;
  history jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_business::text, 0));
  select * into proposal from ai.action_proposals where business_id = p_business and id = p_proposal for update;
  select * into policy from ai.autonomy_policies where business_id = p_business for update;
  if proposal.id is null or policy.id is null or proposal.status <> 'approved' or not proposal.requires_approval
    or policy.mode <> 'approval_required'
    or coalesce(policy.budget_boundaries_json->>'executionEnabled', '') <> 'true'
    or proposal.action_type not in ('REDUCE_BUDGET', 'PAUSE_DELIVERY_UNIT')
    or not (proposal.action_type = any(policy.allowed_action_classes))
    or coalesce(proposal.policy_result_json->>'outcome', '') <> 'REQUIRE_APPROVAL'
    or coalesce(proposal.policy_result_json->>'reason', '') <> 'REVIEW_MODE'
    or coalesce(proposal.policy_result_json #>> '{review,choice}', '') <> 'approve'
    or coalesce(proposal.policy_result_json #>> '{review,fingerprint}', '') = '' then
    raise exception 'Execution is not authorized';
  end if;
  if exists(select 1 from ai.executed_actions where business_id = p_business and (action_proposal_id = p_proposal or status in ('pending', 'running')))
    or exists(select 1 from ai.review_execution_claims where proposal_id = p_proposal or (business_id = p_business and active)) then
    raise exception 'Execution already attempted or business locked';
  end if;
  select * into run from ai.decision_runs where business_id = p_business and id = proposal.decision_run_id;
  select * into snapshot from ai.feature_snapshots where business_id = p_business and id = run.feature_snapshot_id;
  if run.id is null or run.status <> 'completed' or snapshot.id is null
    or snapshot.entity_type <> 'adset' or snapshot.entity_id <> proposal.target_entity_id
    or proposal.target_entity_type <> 'adset' then raise exception 'Invalid execution lineage'; end if;
  context := jsonb_build_object('proposal', to_jsonb(proposal), 'run', to_jsonb(run), 'snapshot', to_jsonb(snapshot), 'policy', to_jsonb(policy));
  -- Policy cooldown is bounded to one year. Include every unresolved attempt,
  -- regardless of age, and fail closed rather than silently truncate history.
  select coalesce(jsonb_agg(h), '[]'::jsonb) into history from (
    select e.id, e.business_id as "businessId", s.ad_account_id as "adAccountId",
      p.target_entity_id as "entityId", e.status, coalesce(e.started_at, e.created_at) as "attemptedAt"
    from ai.executed_actions e
    join ai.action_proposals p on p.business_id = e.business_id and p.id = e.action_proposal_id
    join ai.decision_runs r on r.business_id = p.business_id and r.id = p.decision_run_id
    join ai.feature_snapshots s on s.business_id = r.business_id and s.id = r.feature_snapshot_id
    where e.business_id = p_business and (coalesce(e.started_at, e.created_at) >= now() - interval '367 days' or e.status in ('pending', 'running'))
    order by e.created_at desc limit 10001
  ) h;
  if jsonb_array_length(history) > 10000 then raise exception 'History exceeds execution safety limit'; end if;
  insert into ai.executed_actions(id, business_id, action_proposal_id, status, request_metadata_json)
    values(p_execution, p_business, p_proposal, 'pending', '{"executorVersion":1}'::jsonb);
  insert into ai.review_execution_claims(proposal_id, business_id, execution_id, context_json)
    values(p_proposal, p_business, p_execution, context);
  return context || jsonb_build_object('history', history);
end;
$$;

create function ai.checkpoint_review_execution(p_business uuid, p_execution uuid, p_before jsonb, p_request jsonb)
returns void language plpgsql set search_path = '' as $$
declare claim ai.review_execution_claims; current_context jsonb;
begin
  select * into claim from ai.review_execution_claims where business_id = p_business and execution_id = p_execution and active for update;
  if claim.execution_id is null then raise exception 'Missing execution claim'; end if;
  select jsonb_build_object('proposal', to_jsonb(p), 'run', to_jsonb(r), 'snapshot', to_jsonb(s), 'policy', to_jsonb(a)) into current_context
    from ai.action_proposals p join ai.decision_runs r on r.id = p.decision_run_id and r.business_id = p.business_id
    join ai.feature_snapshots s on s.id = r.feature_snapshot_id and s.business_id = r.business_id
    join ai.autonomy_policies a on a.business_id = p.business_id
    where p.id = claim.proposal_id and p.business_id = p_business for share of p, r, s, a;
  if current_context is distinct from claim.context_json then raise exception 'Approval, evidence or policy changed'; end if;
  if jsonb_typeof(p_before) is distinct from 'object' or jsonb_typeof(p_request) is distinct from 'object' then raise exception 'Missing audit data'; end if;
  update ai.executed_actions set state_before_json = p_before, request_metadata_json = p_request,
    status = 'running', started_at = now() where id = p_execution and business_id = p_business and status = 'pending';
  if not found then raise exception 'Execution already started'; end if;
end;
$$;

create function ai.finish_review_execution(p_business uuid, p_execution uuid, p_success boolean, p_after jsonb, p_error jsonb)
returns void language plpgsql set search_path = '' as $$
declare old_status text;
begin
  perform 1 from ai.review_execution_claims where business_id = p_business and execution_id = p_execution and active for update;
  if not found then raise exception 'Missing execution claim'; end if;
  select status into old_status from ai.executed_actions where business_id = p_business and id = p_execution for update;
  if old_status not in ('pending', 'running') then raise exception 'Execution already finalized'; end if;
  if p_success and (old_status <> 'running' or jsonb_typeof(p_after) is distinct from 'object') then raise exception 'Missing verified after-state'; end if;
  update ai.executed_actions set status = case when p_success then 'succeeded' else 'failed' end,
    state_after_json = p_after,
    error_json = case when p_success then null else coalesce(p_error, '{}'::jsonb) || jsonb_build_object('reconciliationRequired', old_status = 'running') end,
    started_at = coalesce(started_at, created_at), completed_at = now()
    where business_id = p_business and id = p_execution;
  -- Every post-checkpoint failure is uncertain and requires operator reconciliation.
  if p_success or old_status = 'pending' then
    update ai.review_execution_claims set active = false where execution_id = p_execution and business_id = p_business;
  end if;
end;
$$;

revoke all on function ai.claim_review_execution(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function ai.checkpoint_review_execution(uuid, uuid, jsonb, jsonb) from public, anon, authenticated;
revoke all on function ai.finish_review_execution(uuid, uuid, boolean, jsonb, jsonb) from public, anon, authenticated;
grant execute on function ai.claim_review_execution(uuid, uuid, uuid) to service_role;
grant execute on function ai.checkpoint_review_execution(uuid, uuid, jsonb, jsonb) to service_role;
grant execute on function ai.finish_review_execution(uuid, uuid, boolean, jsonb, jsonb) to service_role;
commit;
