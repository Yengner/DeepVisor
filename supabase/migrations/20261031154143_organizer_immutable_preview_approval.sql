-- Preview rows are immutable; uniqueness on version_id arbitrates approval races.
-- FOR UPDATE unnecessarily required mutation privileges on immutable previews.
create or replace function public.organizer_approve(p_business uuid,p_actor uuid,p_preview uuid,p_fingerprint text) returns uuid language plpgsql set search_path='' as $$
declare p public.organization_rename_previews; result uuid;
begin
 perform public.organizer_assert_owner(p_business,p_actor);
 select * into p from public.organization_rename_previews where id=p_preview and business_id=p_business;
 if p.id is null or p.expires_at<now() or p.fingerprint<>p_fingerprint then raise exception 'Invalid or expired preview';end if;
 if not exists(select 1 from public.account_organization_versions v where v.id=p.version_id and v.business_id=p_business and v.ad_account_id=p.ad_account_id) then raise exception 'Invalid plan scope';end if;
 insert into public.organization_rename_approvals(business_id,preview_id,version_id,actor_id,fingerprint) values(p_business,p.id,p.version_id,p_actor,p_fingerprint) returning id into result;
 return result;
end $$;
