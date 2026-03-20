create table if not exists public.ad_accounts_performance_daily (
  ad_account_id uuid not null references public.ad_accounts(id) on delete cascade,
  day date not null,
  currency_code text null,
  spend numeric not null default 0,
  reach integer not null default 0,
  impressions integer not null default 0,
  clicks integer not null default 0,
  inline_link_clicks integer not null default 0,
  leads integer not null default 0,
  messages integer not null default 0,
  source text not null default 'meta',
  status text null,
  created_at timestamptz null default timezone('utc', now()),
  updated_at timestamptz null default timezone('utc', now()),
  primary key (ad_account_id, day)
);

create index if not exists idx_ad_accounts_performance_daily_day
  on public.ad_accounts_performance_daily (day);
