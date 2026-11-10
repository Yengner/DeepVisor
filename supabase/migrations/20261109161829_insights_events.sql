-- Internal evidence and immutable, user-specific presentations. No Meta actions.
create table public.insight_issues (
 id uuid primary key default gen_random_uuid(), business_id uuid not null references public.business_profiles(id),
 ad_account_id uuid not null references public.ad_accounts(id), source text not null, issue_key text not null,
 revision integer not null default 1, evidence jsonb not null, observed_at timestamptz not null,
 opened_at timestamptz not null default now(), resolved_at timestamptz
);
create unique index insight_issue_open on public.insight_issues(ad_account_id,source,issue_key) where resolved_at is null;
create index insight_issue_history on public.insight_issues(ad_account_id,opened_at desc,id);
create index insight_issue_business on public.insight_issues(business_id);
create table public.insight_reviews (
 user_id uuid not null references auth.users(id) on delete cascade, ad_account_id uuid not null references public.ad_accounts(id),
 reviewed_through date, routine_day date, claim_token uuid, claim_until timestamptz, presentation_id uuid,
 primary key(user_id,ad_account_id)
);
create table public.insight_presentations (
 id uuid primary key default gen_random_uuid(), business_id uuid not null references public.business_profiles(id),
 ad_account_id uuid not null references public.ad_accounts(id), user_id uuid not null references auth.users(id) on delete cascade,
 fingerprint text not null, payload jsonb not null, source_keys text[] not null, recap_until date,
 created_at timestamptz not null default now(), unique(user_id,ad_account_id,fingerprint)
);
create index insight_presentation_history on public.insight_presentations(user_id,ad_account_id,created_at desc,id);
create index insight_presentation_business on public.insight_presentations(business_id);
create index insight_presentation_account on public.insight_presentations(ad_account_id);
create table public.insight_receipts (
 presentation_id uuid primary key references public.insight_presentations(id), reviewed_at timestamptz not null default now()
);
create table public.insight_seen_sources (
 user_id uuid not null references auth.users(id) on delete cascade, ad_account_id uuid not null references public.ad_accounts(id),
 source_key text not null, primary key(user_id,ad_account_id,source_key)
);
alter table public.insight_issues enable row level security;
alter table public.insight_reviews enable row level security;
alter table public.insight_presentations enable row level security;
alter table public.insight_receipts enable row level security;
alter table public.insight_seen_sources enable row level security;
revoke all on public.insight_issues,public.insight_reviews,public.insight_presentations,public.insight_receipts,public.insight_seen_sources from public,anon,authenticated,service_role;
grant select on public.insight_issues,public.insight_reviews,public.insight_presentations,public.insight_receipts,public.insight_seen_sources to authenticated,service_role;
grant insert on public.insight_presentations,public.insight_receipts,public.insight_seen_sources to service_role;
grant insert,update on public.insight_issues,public.insight_reviews to service_role;
create policy insight_issue_read on public.insight_issues for select to authenticated using(public.can_access_ad_account(ad_account_id));
create policy insight_review_read on public.insight_reviews for select to authenticated using(user_id=(select auth.uid()) and public.can_access_ad_account(ad_account_id));
create policy insight_presentation_read on public.insight_presentations for select to authenticated using(user_id=(select auth.uid()) and public.can_access_ad_account(ad_account_id));
create policy insight_receipt_read on public.insight_receipts for select to authenticated using(exists(select 1 from public.insight_presentations p where p.id=presentation_id and p.user_id=(select auth.uid()) and public.can_access_ad_account(p.ad_account_id)));
create policy insight_seen_read on public.insight_seen_sources for select to authenticated using(user_id=(select auth.uid()) and public.can_access_ad_account(ad_account_id));

-- Source watermarks also preserve successful empty observations.
create table public.insight_issue_sources (
 ad_account_id uuid not null references public.ad_accounts(id), source text not null, observed_at timestamptz not null,
 primary key(ad_account_id,source)
);
alter table public.insight_issue_sources enable row level security;
revoke all on public.insight_issue_sources from public,anon,authenticated,service_role;
grant select,insert,update on public.insight_issue_sources to service_role;

-- Only complete successful observations may resolve an episode. Older observations never revert newer evidence.
create function public.observe_insight_issues(p_business uuid,p_account uuid,p_source text,p_at timestamptz,p_issues jsonb) returns void language plpgsql security invoker set search_path=public as $$
declare issue jsonb; prior public.insight_issues;
begin
 if not exists(select 1 from ad_accounts where id=p_account and business_id=p_business) then raise exception 'Invalid scope'; end if;
 perform pg_advisory_xact_lock(hashtextextended('issues:'||p_account::text||p_source,0));
 if exists(select 1 from insight_issue_sources where ad_account_id=p_account and source=p_source and observed_at>=p_at) then return; end if;
 insert into insight_issue_sources values(p_account,p_source,p_at) on conflict(ad_account_id,source) do update set observed_at=excluded.observed_at;
 for issue in select value from jsonb_array_elements(p_issues) loop
 select * into prior from insight_issues where ad_account_id=p_account and source=p_source and issue_key=issue->>'key' and resolved_at is null;
 if prior.id is null then
 insert into insight_issues(business_id,ad_account_id,source,issue_key,evidence,observed_at) values(p_business,p_account,p_source,issue->>'key',issue,p_at);
 else
 update insight_issues set revision=revision+case when evidence is distinct from issue then 1 else 0 end,evidence=issue,observed_at=p_at where id=prior.id;
 end if;
 end loop;
 update insight_issues set resolved_at=p_at,observed_at=p_at where ad_account_id=p_account and source=p_source and resolved_at is null and not exists(select 1 from jsonb_array_elements(p_issues) i where i->>'key'=issue_key);
end $$;

-- Called only with authenticated server context. Atomic per-user/account ownership and exact-presentation acknowledgement.
create function public.present_insights(p_business uuid,p_account uuid,p_user uuid,p_token uuid,p_day date,p_expected date,p_payload jsonb,p_keys text[],p_fingerprint text,p_until date,p_urgent boolean) returns uuid language plpgsql security invoker set search_path=public as $$
declare r public.insight_reviews; chosen uuid;
begin
 if not exists(select 1 from ad_accounts a join business_profiles b on b.id=a.business_id join organization_memberships m on m.organization_id=b.organization_id where a.id=p_account and b.id=p_business and m.user_id=p_user) then raise exception 'Forbidden'; end if;
 perform pg_advisory_xact_lock(hashtextextended('insights:'||p_user::text||p_account::text,0));
 insert into insight_reviews(user_id,ad_account_id) values(p_user,p_account) on conflict do nothing;
 select * into r from insight_reviews where user_id=p_user and ad_account_id=p_account for update;
 if r.claim_until>now() and r.claim_token is distinct from p_token then return null; end if;
 -- Do not replace a presentation while it is open. Renew its claim.
 if r.presentation_id is not null and not exists(select 1 from insight_receipts where presentation_id=r.presentation_id) then
 update insight_reviews set claim_token=p_token,claim_until=now()+interval '5 minutes' where user_id=p_user and ad_account_id=p_account;
 return r.presentation_id;
 end if;
 if r.reviewed_through is distinct from p_expected then return null; end if;
 if p_until is not null and r.routine_day=p_day and not p_urgent then return null; end if;
 if exists(select 1 from insight_seen_sources where user_id=p_user and ad_account_id=p_account and source_key=any(p_keys)) then return null; end if;
 if cardinality(p_keys)=0 and p_until is null then return null; end if;
 insert into insight_presentations(business_id,ad_account_id,user_id,fingerprint,payload,source_keys,recap_until)
 values(p_business,p_account,p_user,p_fingerprint,p_payload,p_keys,p_until)
 on conflict(user_id,ad_account_id,fingerprint) do nothing returning id into chosen;
 if chosen is null then select id into chosen from insight_presentations where user_id=p_user and ad_account_id=p_account and fingerprint=p_fingerprint; end if;
 if exists(select 1 from insight_receipts where presentation_id=chosen) then return null; end if;
 update insight_reviews set presentation_id=chosen,claim_token=p_token,claim_until=now()+interval '5 minutes',routine_day=case when p_until is not null then p_day else routine_day end where user_id=p_user and ad_account_id=p_account;
 return chosen;
end $$;
create function public.acknowledge_insights(p_account uuid,p_user uuid,p_id uuid,p_token uuid) returns boolean language plpgsql security invoker set search_path=public as $$
declare p public.insight_presentations;
begin
 perform pg_advisory_xact_lock(hashtextextended('insights:'||p_user::text||p_account::text,0));
 select * into p from insight_presentations where id=p_id and user_id=p_user and ad_account_id=p_account;
 if p.id is null or not exists(select 1 from business_profiles b join organization_memberships m on m.organization_id=b.organization_id where b.id=p.business_id and m.user_id=p_user) then raise exception 'Forbidden'; end if;
 if exists(select 1 from insight_receipts where presentation_id=p_id) then return true; end if;
 if not exists(select 1 from insight_reviews where user_id=p_user and ad_account_id=p_account and presentation_id=p_id and claim_token=p_token and claim_until>now()) then return false; end if;
 insert into insight_receipts(presentation_id) values(p_id) on conflict do nothing;
 insert into insight_seen_sources(user_id,ad_account_id,source_key) select p_user,p_account,unnest(p.source_keys) on conflict do nothing;
 update insight_reviews set reviewed_through=greatest(reviewed_through,p.recap_until),claim_until=null,presentation_id=null where user_id=p_user and ad_account_id=p_account;
 return true;
end $$;
revoke all on function public.observe_insight_issues(uuid,uuid,text,timestamptz,jsonb),public.present_insights(uuid,uuid,uuid,uuid,date,date,jsonb,text[],text,date,boolean),public.acknowledge_insights(uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.observe_insight_issues(uuid,uuid,text,timestamptz,jsonb),public.present_insights(uuid,uuid,uuid,uuid,date,date,jsonb,text[],text,date,boolean),public.acknowledge_insights(uuid,uuid,uuid,uuid) to service_role;
