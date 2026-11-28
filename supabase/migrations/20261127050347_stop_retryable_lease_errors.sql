-- PostgREST 14 retries any request whose function raises SQLSTATE 40001, with no limit. These
-- errors can never succeed on retry (the lease or baseline has already moved on), so one expired
-- sync write kept a connection rolling back for days. Raise the ordinary P0001 instead.
-- https://supabase.com/docs/guides/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions-77326b
-- Never raise 40001 from a function. Only the error code changes: each function is recreated from
-- its current definition, which keeps its body, settings and grants.
do $$
declare target record;
begin
  for target in
    select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosrc like '%errcode=''40001''%'
  loop
    execute replace(pg_get_functiondef(target.oid), 'errcode=''40001''', 'errcode=''P0001''');
  end loop;
  if exists(select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'ai', 'intelligence') and p.prosrc like '%40001%') then
    raise exception 'A function still raises 40001';
  end if;
end $$;
