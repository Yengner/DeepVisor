-- Bound pending work in PostgreSQL instead of transferring all previously seen events.
create function public.pending_insight_sources(p_account uuid,p_user uuid) returns jsonb language plpgsql security invoker set search_path=public as $$
declare result jsonb;
begin
 if not exists(select 1 from ad_accounts a join business_profiles b on b.id=a.business_id join organization_memberships m on m.organization_id=b.organization_id where a.id=p_account and m.user_id=p_user) then raise exception 'Forbidden'; end if;
 select jsonb_build_object(
 'issues',coalesce((select jsonb_agg(to_jsonb(i)) from (
 select i.* from insight_issues i where i.ad_account_id=p_account and i.resolved_at is null
 and not exists(select 1 from insight_seen_sources s where s.user_id=p_user and s.ad_account_id=p_account and s.source_key='issue:'||i.id::text||':'||i.revision::text)
 order by i.opened_at desc,i.id desc limit 20) i),'[]'::jsonb),
 'events',coalesce((select jsonb_agg(to_jsonb(e)) from (
 select e.id,e.root_id,e.affected_ids from ad_lifecycle_events e where e.ad_account_id=p_account
 and not exists(select 1 from insight_seen_sources s where s.user_id=p_user and s.ad_account_id=p_account and s.source_key='lifecycle:'||e.id::text)
 and not exists(select 1 from ad_lifecycle_acknowledgements a where a.user_id=p_user and a.event_id=e.id)
 order by e.created_at desc,e.id desc limit 20) e),'[]'::jsonb)) into result;
 return result;
end $$;
revoke all on function public.pending_insight_sources(uuid,uuid) from public,anon,authenticated;
grant execute on function public.pending_insight_sources(uuid,uuid) to service_role;

-- An expired abandoned claim must not indefinitely hide a new urgent issue.
create or replace function public.present_insights(p_business uuid,p_account uuid,p_user uuid,p_token uuid,p_day date,p_expected date,p_payload jsonb,p_keys text[],p_fingerprint text,p_until date,p_urgent boolean) returns uuid language plpgsql security invoker set search_path=public as $$
declare r public.insight_reviews; chosen uuid;
begin
 if not exists(select 1 from ad_accounts a join business_profiles b on b.id=a.business_id join organization_memberships m on m.organization_id=b.organization_id where a.id=p_account and b.id=p_business and m.user_id=p_user) then raise exception 'Forbidden'; end if;
 perform pg_advisory_xact_lock(hashtextextended('insights:'||p_user::text||p_account::text,0));
 insert into insight_reviews(user_id,ad_account_id) values(p_user,p_account) on conflict do nothing;
 select * into r from insight_reviews where user_id=p_user and ad_account_id=p_account for update;
 if r.claim_until>now() and r.claim_token is distinct from p_token then return null; end if;
 -- Do not replace a presentation while it is open. Renew its claim.
 if r.presentation_id is not null and not exists(select 1 from insight_receipts where presentation_id=r.presentation_id)
 and (r.claim_until>now() or not p_urgent or p_keys <@ (select source_keys from insight_presentations where id=r.presentation_id)) then
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

-- A publication watermark avoids rebuilding already-reviewed recaps on every visit.
alter table public.insight_reviews add column checked_revision text;
