-- Every way customers reach the business. preferred_contact_method stays the main one
-- (campaign defaults read it). Additive only: existing rows get '{}' and the app falls
-- back to preferred_contact_method when the list is empty; no existing data is rewritten.
alter table public.business_profiles
  add column if not exists contact_methods text[] not null default '{}'::text[];

comment on column public.business_profiles.contact_methods is
  'All ways customers reach the business (CONTACT_METHOD_OPTIONS values). preferred_contact_method is the main one.';
