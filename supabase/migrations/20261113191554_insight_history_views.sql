begin;
-- Opening a saved update from the Insights & Events history marks it read for that person.
-- Kept separate from insight_receipts, which record popup review and drive catch-up windows.
create table public.insight_history_views (
  presentation_id uuid primary key references public.insight_presentations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  viewed_at timestamptz not null default now()
);
create index insight_history_views_user_idx on public.insight_history_views (user_id);
alter table public.insight_history_views enable row level security;
create policy insight_history_views_own on public.insight_history_views
  for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete, truncate, references, trigger on public.insight_history_views from public, anon, authenticated;
grant select on public.insight_history_views to authenticated;
grant all on public.insight_history_views to service_role;
commit;
