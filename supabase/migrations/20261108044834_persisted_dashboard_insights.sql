-- Optional daily delivery datasets belong to the existing sync worker, never page render.
create table public.account_insight_snapshots (
 ad_account_id uuid not null references public.ad_accounts(id) on delete cascade,
 business_id uuid not null references public.business_profiles(id) on delete cascade,
 dataset text not null check(dataset in ('daily','audience','hourly','learning')),
 payload jsonb not null,
 coverage_start date not null, coverage_end date not null,
 retrieved_at timestamptz not null default now(),
 job_id uuid references public.account_sync_jobs(id) on delete set null,
 primary key(ad_account_id,dataset),
 check(coverage_end>=coverage_start),
 check(jsonb_typeof(payload) in ('array','object'))
);
create index account_insight_snapshots_business_idx on public.account_insight_snapshots(business_id);
create index account_insight_snapshots_job_idx on public.account_insight_snapshots(job_id);
alter table public.account_insight_snapshots enable row level security;
revoke all on public.account_insight_snapshots from public,anon,authenticated;
grant select on public.account_insight_snapshots to authenticated;
grant all on public.account_insight_snapshots to service_role;
create policy account_insight_snapshots_read on public.account_insight_snapshots for select to authenticated
 using(public.can_access_ad_account(ad_account_id));

create function public.publish_account_insights(p_job uuid,p_generation integer,p_dataset text,p_payload jsonb,p_since date,p_until date)
returns void language plpgsql security invoker set search_path=public as $$
declare j public.account_sync_jobs;
begin
 select * into j from public.account_sync_jobs where id=p_job for update;
 if j.id is null or p_generation is null or j.status<>'running' or j.lease_generation<>p_generation or j.lease_expires_at is null or j.lease_expires_at<=now() then
  raise exception 'Expired resource lease' using errcode='40001'; end if;
 if p_dataset is null or p_dataset not in ('daily','audience','hourly','learning') or p_since is null or p_until is null or p_until<p_since or p_until-p_since>59 or p_payload is null then raise exception 'Invalid insight snapshot'; end if;
 if (p_dataset='learning' and jsonb_typeof(p_payload)<>'object') or
 (p_dataset<>'learning' and (jsonb_typeof(p_payload)<>'array' or jsonb_array_length(p_payload)>100000)) then raise exception 'Invalid insight payload'; end if;
 if p_dataset<>'learning' and exists(select 1 from jsonb_array_elements(p_payload) r where r->>'day' is null or (r->>'day')::date not between p_since and p_until) then raise exception 'Invalid insight dates'; end if;
 insert into public.account_insight_snapshots(ad_account_id,business_id,dataset,payload,coverage_start,coverage_end,job_id)
 values(j.ad_account_id,j.business_id,p_dataset,p_payload,p_since,p_until,j.id)
 on conflict(ad_account_id,dataset) do update set payload=excluded.payload,coverage_start=excluded.coverage_start,
 coverage_end=excluded.coverage_end,retrieved_at=now(),job_id=excluded.job_id;
end $$;
revoke all on function public.publish_account_insights(uuid,integer,text,jsonb,date,date) from public,anon,authenticated;
grant execute on function public.publish_account_insights(uuid,integer,text,jsonb,date,date) to service_role;
