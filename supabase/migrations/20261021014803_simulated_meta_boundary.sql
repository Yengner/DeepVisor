-- Simulations never receive real credential references and cannot lose their designation.
create or replace function public.guard_simulated_meta_integration()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (tg_op = 'UPDATE' and old.integration_details ? 'deepvisor-meta-phase2')
     or new.integration_details ? 'deepvisor-meta-phase2' then
    if not (new.integration_details ? 'deepvisor-meta-phase2')
       or new.integration_details->'deepvisor-meta-phase2'->>'businessId' is distinct from new.business_id::text
       or new.access_token_secret_id is not null or new.refresh_token_secret_id is not null then
      raise exception 'Simulated Meta integrations cannot receive credentials or change scope' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;
create trigger guard_simulated_meta_integration before insert or update on public.platform_integrations
for each row execute function public.guard_simulated_meta_integration();

-- Shared scheduled workers must never claim simulations. Explicit targeted dev workers can.
do $$
declare definition text;
begin
  select pg_get_functiondef('public.claim_account_sync_job(uuid,text[])'::regprocedure) into definition;
  if position('(target_job_id is null or job.id = target_job_id)' in definition) = 0 then
    raise exception 'Unexpected claim_account_sync_job implementation; review migration';
  end if;
  definition := replace(definition,
    '(target_job_id is null or job.id = target_job_id)',
    '(target_job_id is null or job.id = target_job_id)
    and (target_job_id is not null or not exists (
      select 1 from public.platform_integrations integration
      where integration.id = job.platform_integration_id
        and integration.integration_details ? ''deepvisor-meta-phase2''
    ))');
  execute definition;
end $$;
