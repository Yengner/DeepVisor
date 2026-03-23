create extension if not exists pgcrypto;

create table if not exists public.ad_account_assessments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.business_profiles(id) on delete cascade,
  platform_integration_id uuid not null references public.platform_integrations(id) on delete cascade,
  ad_account_id uuid not null references public.ad_accounts(id) on delete cascade,
  state text not null,
  history_days integer not null default 0,
  has_delivery boolean not null default false,
  has_conversion_signal boolean not null default false,
  tracking_confidence text not null default 'low',
  maturity_score numeric not null default 0,
  digest_json jsonb not null default '{}'::jsonb,
  assessment_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists ad_account_assessments_business_created_idx
  on public.ad_account_assessments (business_id, created_at desc);

create index if not exists ad_account_assessments_integration_created_idx
  on public.ad_account_assessments (platform_integration_id, created_at desc);

create index if not exists ad_account_assessments_account_created_idx
  on public.ad_account_assessments (ad_account_id, created_at desc);

create table if not exists public.business_assessments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.business_profiles(id) on delete cascade,
  scope text not null default 'business',
  digest_json jsonb not null default '{}'::jsonb,
  assessment_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists business_assessments_business_created_idx
  on public.business_assessments (business_id, created_at desc);
