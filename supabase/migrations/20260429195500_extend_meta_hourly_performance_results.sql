alter table if exists public.meta_hourly_performance
  add column if not exists reach bigint not null default 0,
  add column if not exists leads bigint not null default 0,
  add column if not exists messages bigint not null default 0,
  add column if not exists calls bigint not null default 0,
  add column if not exists cost_per_action_type_json jsonb not null default '[]'::jsonb;
