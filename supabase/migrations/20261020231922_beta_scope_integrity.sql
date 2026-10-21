begin;
-- Single-column FKs allowed valid entity IDs to be paired with another account.
-- Composite FKs also protect service-role imports, which bypass RLS.
alter table public.ad_accounts add constraint ad_accounts_business_id_id_key unique (business_id,id);
alter table public.ad_entities add constraint ad_entities_scope_key unique(id,ad_account_id,entity_level);
alter table public.ad_entities add constraint ad_entities_business_account_fkey
 foreign key(business_id,ad_account_id) references public.ad_accounts(business_id,id) on delete cascade;
alter table public.ad_creatives add constraint ad_creatives_business_account_fkey
 foreign key(business_id,ad_account_id) references public.ad_accounts(business_id,id) on delete cascade;
do $$ declare t text; begin
 foreach t in array array['ad_entity_performance_daily','ad_entity_performance_summary','ad_entity_performance_monthly','ad_entity_performance_hourly','ad_audience_breakdowns_summary'] loop
  execute format('alter table public.%I add constraint %I foreign key(entity_id,ad_account_id,entity_level) references public.ad_entities(id,ad_account_id,entity_level) on delete cascade',t,t||'_scope_fkey');
 end loop;
end $$;

-- Synthetic imported connections are selectable by existing app loaders but can
-- never carry credentials or queue real synchronization work, even on older app deployments.
create function public.guard_synthetic_integration() returns trigger
language plpgsql set search_path='' as $$
begin
 if new.integration_details->>'synthetic_fixture'='deepvisor-beta-v1' then
   if new.access_token_secret_id is not null or new.refresh_token_secret_id is not null then
     raise exception 'Synthetic integrations cannot contain credentials' using errcode='23514';
   end if;
 end if;
 if tg_op='UPDATE' and old.integration_details->>'synthetic_fixture'='deepvisor-beta-v1'
    and new.integration_details->>'synthetic_fixture' is distinct from 'deepvisor-beta-v1' then
   raise exception 'Synthetic integration marker cannot be removed' using errcode='23514';
 end if;
 return new;
end $$;
create trigger guard_synthetic_integration before insert or update on public.platform_integrations
 for each row execute function public.guard_synthetic_integration();
create function public.guard_synthetic_sync_job() returns trigger
language plpgsql set search_path='' as $$
begin
 if new.status in ('queued','running') and exists(select 1 from public.platform_integrations i
   where i.id=new.platform_integration_id and i.integration_details->>'synthetic_fixture'='deepvisor-beta-v1') then
   raise exception 'Synthetic fixture imports cannot run Meta sync; use the fixture seed command' using errcode='23514';
 end if;
 return new;
end $$;
create trigger guard_synthetic_sync_job before insert or update on public.account_sync_jobs
 for each row execute function public.guard_synthetic_sync_job();
revoke all on function public.guard_synthetic_integration(),public.guard_synthetic_sync_job() from public,anon,authenticated;
commit;
