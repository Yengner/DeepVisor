-- Saved Reports views: a named, sanitized /reports query shared with everyone in the business.
-- Writes go through the authorized server route (admin client after context checks);
-- members can read their business's views directly.
begin;
create table public.report_saved_views (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.business_profiles(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  query text not null check (char_length(query) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index report_saved_views_business_idx on public.report_saved_views (business_id, created_at desc);
alter table public.report_saved_views enable row level security;
create policy report_saved_views_read on public.report_saved_views
  for select to authenticated using (public.can_access_business(business_id));
revoke insert, update, delete, truncate, references, trigger on public.report_saved_views from public, anon, authenticated;
grant select on public.report_saved_views to authenticated;
grant all on public.report_saved_views to service_role;
commit;
