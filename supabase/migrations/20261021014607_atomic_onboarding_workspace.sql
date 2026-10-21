-- Serialize first-use workspace creation across tabs/requests using the real JWT subject.
create or replace function public.ensure_onboarding_workspace()
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  subject uuid := auth.uid();
  org_id uuid;
  org_kind public.organization_type;
  org_label text;
  business_id uuid;
begin
  if subject is null then raise exception 'Not authenticated' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(subject::text, 72026));
  select m.organization_id into org_id from public.organization_memberships m
    where m.user_id = subject order by m.created_at, m.id limit 1;
  if org_id is null then
    org_id := public.create_organization_with_owner('Business setup', 'business', 'en');
  end if;
  select o.type, o.name into org_kind, org_label from public.organizations o where o.id = org_id for update;
  select b.id into business_id from public.business_profiles b
    where b.organization_id = org_id order by b.created_at, b.id limit 1;
  if business_id is null then
    if org_kind <> 'business' then
      raise exception 'Partner organizations do not get an automatic business profile';
    end if;
    insert into public.business_profiles(organization_id,business_name,onboarding_step,onboarding_completed)
      values(org_id,org_label,0,false) returning id into business_id;
  end if;
  return business_id;
end $$;
revoke all on function public.ensure_onboarding_workspace() from public, anon;
grant execute on function public.ensure_onboarding_workspace() to authenticated;
