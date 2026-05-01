create schema if not exists ai;

create table if not exists ai.trend_findings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.business_profiles (id) on delete cascade,
  platform_integration_id uuid not null references public.platform_integrations (id) on delete cascade,
  ad_account_id uuid not null references public.ad_accounts (id) on delete cascade,
  campaign_id uuid null references public.campaign_dims (id) on delete cascade,
  adset_id uuid null references public.adset_dims (id) on delete cascade,
  ad_id uuid null references public.ad_dims (id) on delete cascade,
  finding_type text not null,
  severity text not null default 'info',
  confidence text not null default 'medium',
  status text not null default 'active',
  source text not null default 'meta_trend_intelligence_v1',
  title text not null,
  summary text not null,
  reason text null,
  metric_snapshot_json jsonb not null default '{}'::jsonb,
  recommended_action_json jsonb not null default '{}'::jsonb,
  snapshot_hash text not null,
  dedupe_key text not null,
  detected_at timestamptz not null default now(),
  first_detected_at timestamptz not null default now(),
  last_detected_at timestamptz not null default now(),
  resolved_at timestamptz null,
  dismissed_at timestamptz null,
  converted_to_queue_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trend_findings_type_check check (
    finding_type = any (
      array[
        'best_time_window'::text,
        'delivery_drop_vs_efficiency'::text,
        'efficiency_drop_vs_delivery'::text,
        'meaningful_crossover'::text,
        'sustained_divergence'::text,
        'stale_live_delivery'::text
      ]
    )
  ),
  constraint trend_findings_severity_check check (
    severity = any (array['info'::text, 'warning'::text, 'critical'::text])
  ),
  constraint trend_findings_confidence_check check (
    confidence = any (array['low'::text, 'medium'::text, 'high'::text])
  ),
  constraint trend_findings_status_check check (
    status = any (
      array[
        'active'::text,
        'dismissed'::text,
        'resolved'::text,
        'converted_to_queue'::text
      ]
    )
  ),
  constraint trend_findings_dedupe_key_check check (length(btrim(dedupe_key)) > 0)
);

create unique index if not exists trend_findings_business_account_dedupe_key
  on ai.trend_findings (business_id, ad_account_id, dedupe_key);

create index if not exists trend_findings_account_status_idx
  on ai.trend_findings (ad_account_id, status, severity, detected_at desc);

create index if not exists trend_findings_adset_status_idx
  on ai.trend_findings (adset_id, status, detected_at desc)
  where adset_id is not null;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.business_profiles (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  source_type text not null default 'system',
  source_id uuid null,
  dedupe_key text null,
  severity text not null default 'info',
  type text not null default 'system',
  title text not null,
  message text not null,
  link text null,
  read boolean not null default false,
  read_at timestamptz null,
  payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notifications_severity_check check (
    severity = any (array['info'::text, 'warning'::text, 'critical'::text])
  )
);

create unique index if not exists notifications_user_dedupe_key_idx
  on public.notifications (user_id, dedupe_key)
  where dedupe_key is not null;

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

create table if not exists public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.business_profiles (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  in_app_enabled boolean not null default true,
  email_enabled boolean not null default true,
  report_ready_enabled boolean not null default true,
  min_severity text not null default 'warning',
  quiet_hours_start smallint null,
  quiet_hours_end smallint null,
  time_zone text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_preferences_severity_check check (
    min_severity = any (array['info'::text, 'warning'::text, 'critical'::text])
  ),
  constraint notification_preferences_quiet_hours_start_check check (
    quiet_hours_start is null or (quiet_hours_start between 0 and 23)
  ),
  constraint notification_preferences_quiet_hours_end_check check (
    quiet_hours_end is null or (quiet_hours_end between 0 and 23)
  )
);

create unique index if not exists notification_preferences_business_user_idx
  on public.notification_preferences (business_id, user_id);

create table if not exists public.notification_delivery_log (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.business_profiles (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  channel text not null,
  source_type text not null,
  source_id uuid null,
  dedupe_key text not null,
  status text not null default 'queued',
  payload_json jsonb not null default '{}'::jsonb,
  sent_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_delivery_log_channel_check check (
    channel = any (array['in_app'::text, 'email'::text])
  ),
  constraint notification_delivery_log_status_check check (
    status = any (array['queued'::text, 'sent'::text, 'skipped'::text, 'failed'::text])
  )
);

create unique index if not exists notification_delivery_log_user_channel_dedupe_idx
  on public.notification_delivery_log (user_id, channel, dedupe_key);

create index if not exists notification_delivery_log_source_idx
  on public.notification_delivery_log (source_type, source_id, created_at desc);

create table if not exists public.report_subscriptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.business_profiles (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  is_enabled boolean not null default true,
  cadence text not null default 'weekly',
  email_enabled boolean not null default true,
  in_app_enabled boolean not null default true,
  time_zone text null,
  last_sent_at timestamptz null,
  next_run_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint report_subscriptions_cadence_check check (
    cadence = any (array['daily'::text, 'weekly'::text, 'monthly'::text])
  )
);

create unique index if not exists report_subscriptions_business_user_idx
  on public.report_subscriptions (business_id, user_id);
