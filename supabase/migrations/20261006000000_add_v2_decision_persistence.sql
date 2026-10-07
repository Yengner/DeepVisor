-- Forward-only V2 additions. Existing production tables/functions must already exist.
begin;

grant usage on schema ai to authenticated, service_role;

create table ai.feature_snapshots (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.business_profiles(id),
  platform_integration_id uuid not null references public.platform_integrations(id),
  ad_account_id uuid not null references public.ad_accounts(id),
  entity_type text not null,
  entity_id text not null,
  feature_schema_version integer not null check (feature_schema_version > 0),
  feature_json jsonb not null check (jsonb_typeof(feature_json) = 'object'),
  created_at timestamptz not null default now(),
  unique (business_id, id)
);

create table ai.decision_runs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.business_profiles(id),
  feature_snapshot_id uuid not null,
  provider text not null,
  provider_model text,
  provider_version text,
  model_version text,
  decision_json jsonb not null default '{}'::jsonb,
  confidence double precision check (confidence >= 0 and confidence <= 1),
  provider_response_json jsonb,
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id),
  foreign key (business_id, feature_snapshot_id) references ai.feature_snapshots(business_id, id)
);

create table ai.action_proposals (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.business_profiles(id),
  decision_run_id uuid not null,
  action_type text not null,
  target_entity_type text not null,
  target_entity_id text not null,
  current_state_json jsonb not null default '{}'::jsonb,
  proposed_state_json jsonb not null default '{}'::jsonb,
  risk_level text not null default 'unknown' check (risk_level in ('unknown', 'low', 'medium', 'high')),
  policy_result_json jsonb not null default '{}'::jsonb,
  requires_approval boolean not null default true,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id),
  foreign key (business_id, decision_run_id) references ai.decision_runs(business_id, id)
);

create table ai.executed_actions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.business_profiles(id),
  action_proposal_id uuid not null,
  status text not null default 'pending' check (status in ('pending', 'running', 'succeeded', 'failed')),
  request_metadata_json jsonb not null default '{}'::jsonb,
  state_before_json jsonb,
  state_after_json jsonb,
  error_json jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (completed_at is null or (started_at is not null and completed_at >= started_at)),
  unique (business_id, id),
  foreign key (business_id, action_proposal_id) references ai.action_proposals(business_id, id)
);

create table ai.action_outcomes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.business_profiles(id),
  executed_action_id uuid not null,
  measurement_horizon_hours integer not null check (measurement_horizon_hours > 0),
  metrics_before_json jsonb not null,
  metrics_after_json jsonb not null,
  calculated_change_json jsonb not null,
  created_at timestamptz not null default now(),
  unique (business_id, executed_action_id, measurement_horizon_hours),
  foreign key (business_id, executed_action_id) references ai.executed_actions(business_id, id)
);

create table ai.autonomy_policies (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null unique references public.business_profiles(id),
  mode text not null default 'off' check (mode in ('off', 'observe', 'approval_required', 'autonomous')),
  allowed_action_classes text[] not null default '{}',
  max_budget_change_percent numeric not null default 0 check (max_budget_change_percent >= 0 and max_budget_change_percent <= 100),
  budget_boundaries_json jsonb not null default '{}'::jsonb check (jsonb_typeof(budget_boundaries_json) = 'object'),
  cooldown_config_json jsonb not null default '{}'::jsonb check (jsonb_typeof(cooldown_config_json) = 'object'),
  minimum_evidence_json jsonb not null default '{}'::jsonb check (jsonb_typeof(minimum_evidence_json) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Existing tables lack composite tenant keys; validate ownership without altering them.
create function ai.validate_v2_snapshot_scope() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not exists (
    select 1 from public.ad_accounts a
    join public.platform_integrations i on i.platform_id = a.platform_id
    where a.id = new.ad_account_id and i.id = new.platform_integration_id
      and a.business_id = new.business_id and i.business_id = new.business_id
  ) then
    raise exception 'Snapshot business, integration and ad account must share scope' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger validate_v2_snapshot_scope before insert or update on ai.feature_snapshots
for each row execute function ai.validate_v2_snapshot_scope();

create function ai.touch_v2_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create index feature_snapshots_entity_idx on ai.feature_snapshots (business_id, ad_account_id, entity_type, entity_id, created_at desc);
create index feature_snapshots_integration_idx on ai.feature_snapshots (platform_integration_id);
create index feature_snapshots_account_idx on ai.feature_snapshots (ad_account_id);
create index decision_runs_snapshot_idx on ai.decision_runs (business_id, feature_snapshot_id, created_at desc);
create index action_proposals_run_idx on ai.action_proposals (business_id, decision_run_id);
create index action_proposals_status_idx on ai.action_proposals (business_id, status, created_at desc);
create index executed_actions_proposal_idx on ai.executed_actions (business_id, action_proposal_id, created_at desc);

do $$
declare table_name text;
begin
  foreach table_name in array array['feature_snapshots', 'decision_runs', 'action_proposals', 'executed_actions', 'action_outcomes', 'autonomy_policies'] loop
    execute format('alter table ai.%I enable row level security', table_name);
    -- Browser sessions may read their business history but cannot forge decisions or executions.
    execute format('revoke all on ai.%I from public, anon, authenticated', table_name);
    execute format('grant select on ai.%I to authenticated', table_name);
    execute format('grant select, insert, update on ai.%I to service_role', table_name);
    execute format(
      'create policy business_read on ai.%I for select to authenticated using (exists (select 1 from public.business_profiles b where b.id = business_id and public.is_org_member(b.organization_id)))',
      table_name
    );
  end loop;
  foreach table_name in array array['decision_runs', 'action_proposals', 'executed_actions', 'autonomy_policies'] loop
    execute format('create trigger touch_v2_updated_at before update on ai.%I for each row execute function ai.touch_v2_updated_at()', table_name);
  end loop;
end;
$$;

commit;
