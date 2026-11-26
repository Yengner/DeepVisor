-- Browser roles may no longer create or remove tenancy records, or write ad accounts at all.
-- Why: an owner or admin could insert any external ad account id into their own business, and
-- change who belongs to an organization, straight through the API. That becomes unsafe once one
-- Meta connection serves several client businesses. The app already writes these through the
-- service role or SECURITY DEFINER functions (ensure_onboarding_workspace, account cleanup).
-- Kept: SELECT (RLS-scoped) and UPDATE on organizations and business_profiles, which onboarding
-- performs with the signed-in user's session under the existing owner/admin policies.
-- Rollback: grant the same privileges back to authenticated.
revoke insert, update, delete, truncate on table public.ad_accounts from anon, authenticated;
revoke insert, update, delete, truncate on table public.organization_memberships from anon, authenticated;
revoke insert, delete, truncate on table public.organizations from anon, authenticated;
revoke insert, delete, truncate on table public.business_profiles from anon, authenticated;
-- Signed-out visitors never update these either.
revoke update on table public.organizations, public.business_profiles from anon;
