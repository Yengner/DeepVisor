import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { expect, it } from 'vitest';
it('creates a single owned workspace atomically and rejects anonymous creation', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated;
      create schema auth;
      create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create type public.organization_type as enum ('business','partner');
      create table organizations(id uuid primary key default gen_random_uuid(),name text,type organization_type,primary_language text);
      create table organization_memberships(id uuid primary key default gen_random_uuid(),organization_id uuid references organizations,user_id uuid,role text,created_at timestamptz default now());
      create table business_profiles(id uuid primary key default gen_random_uuid(),organization_id uuid references organizations,business_name text,onboarding_step int,onboarding_completed boolean,created_at timestamptz default now());
      create function create_organization_with_owner(org_name text,org_type organization_type,org_primary_language text) returns uuid language plpgsql set search_path=public as $$declare id uuid;begin
        insert into organizations(name,type,primary_language) values(org_name,org_type,org_primary_language) returning organizations.id into id;
        insert into organization_memberships(organization_id,user_id,role) values(id,auth.uid(),'owner');return id;end$$;`);
    await db.exec(readFileSync('supabase/migrations/20261021014607_atomic_onboarding_workspace.sql','utf8'));
    await expect(db.query('select ensure_onboarding_workspace()')).rejects.toThrow('Not authenticated');
    await db.exec("set request.jwt.claim.sub='a0000000-0000-4000-8000-000000000001'");
    const one = await db.query('select ensure_onboarding_workspace() as id');
    expect((await db.query('select ensure_onboarding_workspace() as id')).rows).toEqual(one.rows);
    expect((await db.query('select count(*)::int as n from organizations')).rows).toEqual([{n:1}]);
    await db.exec("set request.jwt.claim.sub='b0000000-0000-4000-8000-000000000002'");
    expect((await db.query('select ensure_onboarding_workspace() as id')).rows).not.toEqual(one.rows);
    expect((await db.query('select role from organization_memberships')).rows).toEqual([{role:'owner'},{role:'owner'}]);
  } finally { await db.close(); }
});
