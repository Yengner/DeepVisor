create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.business_data_policies (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null unique references public.business_profiles(id) on delete cascade,
  plan_key text not null default 'trial',
  max_ad_accounts integer not null default 1,
  daily_history_days integer not null default 30,
  hourly_history_days integer not null default 7,
  audience_history_days integer not null default 14,
  allowed_breakdowns text[] not null default array[
    'publisher_platform',
    'platform_position',
    'impression_device'
  ]::text[],
  allow_ad_level_hourly boolean not null default false,
  allow_ad_level_audience boolean not null default false,
  manual_refresh_limit_per_day integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists business_data_policies_set_updated_at on public.business_data_policies;

create trigger business_data_policies_set_updated_at
before update on public.business_data_policies
for each row execute function public.set_updated_at();

create table if not exists public.ad_entities (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.business_profiles(id) on delete cascade,
  ad_account_id uuid not null references public.ad_accounts(id) on delete cascade,
  platform_id uuid not null references public.platforms(id) on delete restrict,
  platform_integration_id uuid references public.platform_integrations(id) on delete set null,
  entity_level text not null check (entity_level in ('campaign', 'adset', 'ad')),
  external_id text not null,
  parent_id uuid references public.ad_entities(id) on delete set null,
  parent_external_id text,
  campaign_id uuid references public.ad_entities(id) on delete set null,
  adset_id uuid references public.ad_entities(id) on delete set null,
  name text,
  objective text,
  optimization_goal text,
  status text,
  creative_external_id text,
  created_time timestamptz,
  updated_time timestamptz,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ad_account_id, entity_level, external_id)
);

create index if not exists ad_entities_ad_account_level_idx
  on public.ad_entities(ad_account_id, entity_level);

create index if not exists ad_entities_parent_id_idx
  on public.ad_entities(parent_id);

create index if not exists ad_entities_campaign_id_idx
  on public.ad_entities(campaign_id);

create index if not exists ad_entities_adset_id_idx
  on public.ad_entities(adset_id);

create index if not exists ad_entities_business_account_idx
  on public.ad_entities(business_id, ad_account_id);

drop trigger if exists ad_entities_set_updated_at on public.ad_entities;

create trigger ad_entities_set_updated_at
before update on public.ad_entities
for each row execute function public.set_updated_at();

create table if not exists public.ad_entity_performance_daily (
  entity_id uuid not null references public.ad_entities(id) on delete cascade,
  ad_account_id uuid not null references public.ad_accounts(id) on delete cascade,
  entity_level text not null check (entity_level in ('campaign', 'adset', 'ad')),
  day date not null,
  spend numeric not null default 0,
  impressions bigint not null default 0,
  reach bigint not null default 0,
  clicks bigint not null default 0,
  inline_link_clicks bigint not null default 0,
  leads bigint not null default 0,
  messages bigint not null default 0,
  calls bigint not null default 0,
  currency_code text,
  objective text,
  status text,
  source text not null default 'api',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (entity_id, day)
);

create index if not exists ad_entity_performance_daily_account_day_idx
  on public.ad_entity_performance_daily(ad_account_id, day);

create index if not exists ad_entity_performance_daily_account_level_day_idx
  on public.ad_entity_performance_daily(ad_account_id, entity_level, day);

create index if not exists ad_entity_performance_daily_entity_day_idx
  on public.ad_entity_performance_daily(entity_id, day);

drop trigger if exists ad_entity_performance_daily_set_updated_at on public.ad_entity_performance_daily;

create trigger ad_entity_performance_daily_set_updated_at
before update on public.ad_entity_performance_daily
for each row execute function public.set_updated_at();

create table if not exists public.ad_entity_performance_summary (
  entity_id uuid primary key references public.ad_entities(id) on delete cascade,
  ad_account_id uuid not null references public.ad_accounts(id) on delete cascade,
  entity_level text not null check (entity_level in ('campaign', 'adset', 'ad')),
  spend numeric not null default 0,
  impressions bigint not null default 0,
  reach bigint not null default 0,
  clicks bigint not null default 0,
  inline_link_clicks bigint not null default 0,
  leads bigint not null default 0,
  messages bigint not null default 0,
  calls bigint not null default 0,
  ctr numeric,
  cpc numeric,
  cpm numeric,
  frequency numeric,
  cost_per_result numeric,
  first_day date,
  last_day date,
  best_day date,
  worst_day date,
  summary_source text not null default 'aggregated_daily',
  history_status text not null default 'not_started',
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ad_entity_performance_summary_account_level_idx
  on public.ad_entity_performance_summary(ad_account_id, entity_level);

create index if not exists ad_entity_performance_summary_account_spend_idx
  on public.ad_entity_performance_summary(ad_account_id, spend);

create index if not exists ad_entity_performance_summary_account_leads_idx
  on public.ad_entity_performance_summary(ad_account_id, leads);

create index if not exists ad_entity_performance_summary_account_cpr_idx
  on public.ad_entity_performance_summary(ad_account_id, cost_per_result);

drop trigger if exists ad_entity_performance_summary_set_updated_at on public.ad_entity_performance_summary;

create trigger ad_entity_performance_summary_set_updated_at
before update on public.ad_entity_performance_summary
for each row execute function public.set_updated_at();

create table if not exists public.ad_entity_performance_monthly (
  entity_id uuid not null references public.ad_entities(id) on delete cascade,
  ad_account_id uuid not null references public.ad_accounts(id) on delete cascade,
  entity_level text not null check (entity_level in ('campaign', 'adset', 'ad')),
  month_start date not null,
  spend numeric not null default 0,
  impressions bigint not null default 0,
  reach bigint not null default 0,
  clicks bigint not null default 0,
  inline_link_clicks bigint not null default 0,
  leads bigint not null default 0,
  messages bigint not null default 0,
  calls bigint not null default 0,
  ctr numeric,
  cpc numeric,
  cpm numeric,
  frequency numeric,
  cost_per_result numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (entity_id, month_start)
);

create index if not exists ad_entity_performance_monthly_account_month_idx
  on public.ad_entity_performance_monthly(ad_account_id, month_start);

create index if not exists ad_entity_performance_monthly_account_level_month_idx
  on public.ad_entity_performance_monthly(ad_account_id, entity_level, month_start);

drop trigger if exists ad_entity_performance_monthly_set_updated_at on public.ad_entity_performance_monthly;

create trigger ad_entity_performance_monthly_set_updated_at
before update on public.ad_entity_performance_monthly
for each row execute function public.set_updated_at();

create table if not exists public.ad_account_performance_monthly (
  ad_account_id uuid not null references public.ad_accounts(id) on delete cascade,
  month_start date not null,
  spend numeric not null default 0,
  impressions bigint not null default 0,
  reach bigint not null default 0,
  clicks bigint not null default 0,
  inline_link_clicks bigint not null default 0,
  leads bigint not null default 0,
  messages bigint not null default 0,
  calls bigint not null default 0,
  ctr numeric,
  cpc numeric,
  cpm numeric,
  frequency numeric,
  cost_per_result numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (ad_account_id, month_start)
);

drop trigger if exists ad_account_performance_monthly_set_updated_at on public.ad_account_performance_monthly;

create trigger ad_account_performance_monthly_set_updated_at
before update on public.ad_account_performance_monthly
for each row execute function public.set_updated_at();

create table if not exists public.ad_entity_performance_hourly (
  entity_id uuid not null references public.ad_entities(id) on delete cascade,
  ad_account_id uuid not null references public.ad_accounts(id) on delete cascade,
  entity_level text not null check (entity_level in ('adset', 'ad')),
  day date not null,
  week_start date,
  day_of_week smallint,
  hour_of_day smallint not null,
  spend numeric not null default 0,
  impressions bigint not null default 0,
  reach bigint not null default 0,
  clicks bigint not null default 0,
  inline_link_clicks bigint not null default 0,
  leads bigint not null default 0,
  messages bigint not null default 0,
  calls bigint not null default 0,
  ctr numeric not null default 0,
  cpc numeric not null default 0,
  cpm numeric not null default 0,
  currency_code text,
  objective text,
  source text not null default 'meta_hourly_insights',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (entity_id, day, hour_of_day)
);

create index if not exists ad_entity_performance_hourly_account_day_idx
  on public.ad_entity_performance_hourly(ad_account_id, day);

create index if not exists ad_entity_performance_hourly_account_level_day_hour_idx
  on public.ad_entity_performance_hourly(ad_account_id, entity_level, day, hour_of_day);

drop trigger if exists ad_entity_performance_hourly_set_updated_at on public.ad_entity_performance_hourly;

create trigger ad_entity_performance_hourly_set_updated_at
before update on public.ad_entity_performance_hourly
for each row execute function public.set_updated_at();

create table if not exists public.ad_audience_breakdowns_summary (
  ad_account_id uuid not null references public.ad_accounts(id) on delete cascade,
  entity_id uuid not null references public.ad_entities(id) on delete cascade,
  entity_level text not null check (entity_level in ('adset', 'ad')),
  breakdown_type text not null,
  dimension_1_key text not null,
  dimension_1_value text not null,
  dimension_2_key text not null default '',
  dimension_2_value text not null default '',
  publisher_platform text,
  platform_position text,
  impression_device text,
  spend numeric not null default 0,
  impressions bigint not null default 0,
  reach bigint not null default 0,
  clicks bigint not null default 0,
  inline_link_clicks bigint not null default 0,
  leads bigint not null default 0,
  messages bigint not null default 0,
  calls bigint not null default 0,
  currency_code text,
  objective text,
  source text not null default 'meta_insights_summary',
  first_day date,
  last_day date,
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (
    entity_id,
    breakdown_type,
    dimension_1_key,
    dimension_1_value,
    dimension_2_key,
    dimension_2_value
  )
);

create index if not exists ad_audience_breakdowns_summary_account_type_idx
  on public.ad_audience_breakdowns_summary(ad_account_id, breakdown_type);

create index if not exists ad_audience_breakdowns_summary_account_level_type_idx
  on public.ad_audience_breakdowns_summary(ad_account_id, entity_level, breakdown_type);

create index if not exists ad_audience_breakdowns_summary_entity_type_idx
  on public.ad_audience_breakdowns_summary(entity_id, breakdown_type);

drop trigger if exists ad_audience_breakdowns_summary_set_updated_at on public.ad_audience_breakdowns_summary;

create trigger ad_audience_breakdowns_summary_set_updated_at
before update on public.ad_audience_breakdowns_summary
for each row execute function public.set_updated_at();

create table if not exists public.ad_account_intelligence_snapshots (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.business_profiles(id) on delete cascade,
  ad_account_id uuid not null references public.ad_accounts(id) on delete cascade,
  snapshot_type text not null check (
    snapshot_type in ('weekly', 'monthly', 'pre_retention_rollup', 'manual')
  ),
  period_start date not null,
  period_end date not null,
  summary_text text,
  winners_json jsonb not null default '{}'::jsonb,
  losers_json jsonb not null default '{}'::jsonb,
  anomalies_json jsonb not null default '{}'::jsonb,
  recommendations_json jsonb not null default '{}'::jsonb,
  key_metrics_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ad_account_intelligence_snapshots_account_period_idx
  on public.ad_account_intelligence_snapshots(ad_account_id, period_start, period_end);

create index if not exists ad_account_intelligence_snapshots_business_type_created_idx
  on public.ad_account_intelligence_snapshots(business_id, snapshot_type, created_at);

create or replace view public.ad_entity_report_daily_v as
select
  accounts.business_id,
  entity.platform_id,
  daily.ad_account_id,
  daily.day,
  entity.entity_level,
  entity.id as entity_id,
  entity.external_id as entity_external_id,
  entity.name as entity_name,
  campaign.id as campaign_id,
  campaign.external_id as campaign_external_id,
  campaign.name as campaign_name,
  case when entity.entity_level = 'adset' then entity.id else adset.id end as adset_id,
  case when entity.entity_level = 'adset' then entity.external_id else adset.external_id end as adset_external_id,
  case when entity.entity_level = 'adset' then entity.name else adset.name end as adset_name,
  case when entity.entity_level = 'ad' then entity.id else null end as ad_id,
  case when entity.entity_level = 'ad' then entity.external_id else null end as ad_external_id,
  case when entity.entity_level = 'ad' then entity.name else null end as ad_name,
  coalesce(daily.objective, entity.objective, campaign.objective) as objective,
  coalesce(daily.status, entity.status) as status,
  daily.currency_code,
  daily.spend,
  daily.reach,
  daily.impressions,
  daily.clicks,
  daily.inline_link_clicks,
  daily.leads,
  daily.messages,
  daily.calls,
  daily.leads + daily.messages + daily.calls as results,
  case when daily.impressions > 0 then daily.clicks::numeric / daily.impressions * 100 else 0 end as ctr,
  case when daily.clicks > 0 then daily.spend / daily.clicks else null end as cpc,
  case when daily.impressions > 0 then daily.spend / (daily.impressions::numeric / 1000) else null end as cpm,
  case when daily.reach > 0 then daily.impressions::numeric / daily.reach else null end as frequency,
  case
    when daily.leads + daily.messages + daily.calls > 0
      then daily.spend / (daily.leads + daily.messages + daily.calls)
    else null
  end as cost_per_result,
  daily.source,
  daily.created_at,
  daily.updated_at
from public.ad_entity_performance_daily daily
join public.ad_entities entity on entity.id = daily.entity_id
join public.ad_accounts accounts on accounts.id = daily.ad_account_id
left join public.ad_entities campaign on campaign.id = entity.campaign_id
left join public.ad_entities adset on adset.id = entity.adset_id;
