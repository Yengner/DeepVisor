-- Structured business location and per-field value provenance for onboarding.
-- Additive only: existing rows keep business_location, and field_sources starts empty.
-- RLS is unchanged (columns on the existing business_profiles table).
alter table public.business_profiles
  add column if not exists location_mode text,
  add column if not exists location_street text,
  add column if not exists location_city text,
  add column if not exists location_region text,
  add column if not exists location_postal_code text,
  add column if not exists location_country text,
  add column if not exists field_sources jsonb not null default '{}'::jsonb,
  add column if not exists onboarding_completed_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'business_profiles_location_mode_check') then
    alter table public.business_profiles
      add constraint business_profiles_location_mode_check
      check (location_mode is null or location_mode in ('storefront', 'service_area'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'business_profiles_location_country_check') then
    alter table public.business_profiles
      add constraint business_profiles_location_country_check
      check (location_country is null or location_country ~ '^[A-Z]{2}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'business_profiles_field_sources_object_check') then
    alter table public.business_profiles
      add constraint business_profiles_field_sources_object_check
      check (jsonb_typeof(field_sources) = 'object');
  end if;
end $$;

comment on column public.business_profiles.location_mode is
  'storefront (customers visit) or service_area (business travels to customers).';
comment on column public.business_profiles.field_sources is
  'Per-column provenance: {"<column>": {"source": "user|default|google_places|website_ai|meta_page", "updated_at": ISO}}.';
comment on column public.business_profiles.onboarding_completed_at is
  'First time onboarding was completed; null for workspaces that have not finished.';
