-- Interface language per person (not per workspace): an owner may use Spanish while staff use
-- English. NULL means "follow the browser". Users already update their own row under RLS;
-- this only adds the column and lets them update it.
begin;
alter table public.users
  add column if not exists preferred_locale text
  constraint users_preferred_locale_check check (preferred_locale in ('en', 'es'));
grant update (preferred_locale) on public.users to authenticated;
comment on column public.users.preferred_locale is 'Interface language chosen by the user (en, es); NULL follows the browser.';
commit;
