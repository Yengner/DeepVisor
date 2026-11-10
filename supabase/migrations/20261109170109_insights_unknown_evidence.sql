-- Preserve the original evidence timestamp when an entity is missing or its issue cannot be revalidated.
create or replace function public.observe_insight_issues(p_business uuid,p_account uuid,p_source text,p_at timestamptz,p_issues jsonb) returns void language plpgsql security invoker set search_path=public as $$
declare issue jsonb; prior public.insight_issues;
begin
 if not exists(select 1 from ad_accounts where id=p_account and business_id=p_business) then raise exception 'Invalid scope'; end if;
 perform pg_advisory_xact_lock(hashtextextended('issues:'||p_account::text||p_source,0));
 if exists(select 1 from insight_issue_sources where ad_account_id=p_account and source=p_source and observed_at>=p_at) then return; end if;
 insert into insight_issue_sources values(p_account,p_source,p_at) on conflict(ad_account_id,source) do update set observed_at=excluded.observed_at;
 for issue in select value from jsonb_array_elements(p_issues) loop
 if issue->>'_unobserved'='true' then continue; end if;
 select * into prior from insight_issues where ad_account_id=p_account and source=p_source and issue_key=issue->>'key' and resolved_at is null;
 if prior.id is null then
 insert into insight_issues(business_id,ad_account_id,source,issue_key,evidence,observed_at) values(p_business,p_account,p_source,issue->>'key',issue,p_at);
 else
 update insight_issues set revision=revision+case when evidence is distinct from issue then 1 else 0 end,evidence=issue,observed_at=p_at where id=prior.id;
 end if;
 end loop;
 update insight_issues set resolved_at=p_at,observed_at=p_at where ad_account_id=p_account and source=p_source and resolved_at is null and not exists(select 1 from jsonb_array_elements(p_issues) i where i->>'key'=issue_key);
end $$;

