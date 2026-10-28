import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from 'vitest';

// In-memory Auth stub only. Live fixtures use the official Auth Admin API.
const a = '00000000-0000-4000-8000-000000000001';
const b = '00000000-0000-4000-8000-000000000002';
let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth; create schema storage; create schema ai; create schema vault;
    create table auth.users(id uuid primary key,email text);
    create function auth.uid() returns uuid language sql stable as $$ select current_setting('request.jwt.claim.sub',true)::uuid $$;
    grant usage on schema auth to authenticated;
    create table public.users(id uuid primary key references auth.users on delete cascade,email text not null,first_name text not null,last_name text not null,phone_number text,status text,created_at timestamptz,updated_at timestamptz);
    alter table public.users enable row level security;
    create policy own on public.users to authenticated using(id=auth.uid()) with check(id=auth.uid());
    grant all on public.users to anon,authenticated;
    create table public.organizations(id uuid primary key);
    create table public.organization_memberships(id uuid default gen_random_uuid(),organization_id uuid references public.organizations on delete cascade,user_id uuid references public.users on delete cascade,role text,created_at timestamptz default now());
    create table public.business_profiles(id uuid primary key,organization_id uuid references public.organizations on delete cascade);
    create table public.platform_integrations(id uuid primary key default gen_random_uuid(),business_id uuid references public.business_profiles on delete cascade,connected_by_user_id uuid references public.users on delete cascade,access_token_secret_id text,refresh_token_secret_id uuid);
    create table public.campaign_drafts(id uuid primary key default gen_random_uuid(),business_id uuid references public.business_profiles on delete cascade,created_by_user_id uuid references public.users on delete cascade);
    create table public.oauth_states(business_id uuid references public.business_profiles);
    create table public.account_sync_jobs(id uuid primary key,business_id uuid references public.business_profiles,status text);
    create table storage.objects(owner uuid,owner_id text);
    create table vault.secrets(id uuid primary key);
  `);
  for (const table of ['feature_snapshots','decision_runs','action_proposals','executed_actions','action_outcomes','review_execution_claims','limited_auto_evaluations','shadow_evaluation_jobs','autonomy_policies']) {
    await db.exec(`create table ai.${table}(id uuid primary key default gen_random_uuid(), business_id uuid references public.business_profiles, status text, active boolean default false)`);
  }
  await db.exec(`
    alter table ai.decision_runs add column feature_snapshot_id uuid references ai.feature_snapshots;
    alter table ai.action_proposals add column decision_run_id uuid references ai.decision_runs;
    alter table ai.executed_actions add column action_proposal_id uuid references ai.action_proposals;
    alter table ai.action_outcomes add column executed_action_id uuid references ai.executed_actions;
    alter table ai.review_execution_claims add column execution_id uuid references ai.executed_actions;
    alter table ai.shadow_evaluation_jobs add column source_sync_job_id uuid references public.account_sync_jobs;
    alter table ai.limited_auto_evaluations add column source_snapshot_id uuid references ai.feature_snapshots;
  `);
  await db.exec(readFileSync('supabase/migrations/20261028021848_account_settings.sql','utf8'));
}, 20000);
beforeEach(async () => {
  await db.exec(`begin;
    insert into auth.users values('${a}','a@example.test'),('${b}','b@example.test');
    insert into public.users(id,email,first_name,last_name) values('${a}','forged','A','User'),('${b}','forged','B','User');
    insert into public.organizations values('${a}'),('${b}');
    insert into public.organization_memberships(organization_id,user_id,role) values('${a}','${a}','owner'),('${b}','${b}','owner');
    insert into public.business_profiles values('${a}','${a}'),('${b}','${b}');
    insert into public.platform_integrations(business_id,connected_by_user_id,access_token_secret_id) values('${a}','${a}','${a}'),('${b}','${b}','${b}');
    insert into public.campaign_drafts(business_id,created_by_user_id) values('${a}','${a}'),('${b}','${b}');
    insert into vault.secrets values('${a}'),('${b}');
    insert into public.account_sync_jobs values('${a}','${a}','completed'),('${b}','${b}','completed');
    insert into ai.feature_snapshots(id,business_id) values('${a}','${a}');
    insert into ai.decision_runs(id,business_id,feature_snapshot_id) values('${a}','${a}','${a}');
    insert into ai.action_proposals(id,business_id,decision_run_id) values('${a}','${a}','${a}');
    insert into ai.executed_actions(id,business_id,status,action_proposal_id) values('${a}','${a}','succeeded','${a}');
    insert into ai.action_outcomes(business_id,executed_action_id) values('${a}','${a}');
    insert into ai.review_execution_claims(business_id,execution_id) values('${a}','${a}');
    insert into ai.shadow_evaluation_jobs(business_id,status,source_sync_job_id) values('${a}','completed','${a}');
    insert into ai.limited_auto_evaluations(business_id,source_snapshot_id) values('${a}','${a}');
  `);
});
afterEach(async () => { await db.exec('rollback; reset role'); });
afterAll(() => db?.close());

it('enforces column permissions and tenant RLS for normal authenticated profile edits', async () => {
  await db.exec(`set local role authenticated; set local request.jwt.claim.sub='${a}'`);
  expect((await db.query('select id,email from public.users')).rows).toEqual([{ id:a,email:'a@example.test' }]);
  expect((await db.query(`update public.users set first_name='Updated' where id='${a}' returning first_name,updated_at`)).rows[0]).toMatchObject({ first_name:'Updated' });
  expect((await db.query(`update public.users set first_name='Hacked' where id='${b}' returning id`)).rows).toEqual([]);
});
it.each(['email','status','id','updated_at'])('rejects privileged column update: %s', async column => {
  await db.exec(`set local role authenticated; set local request.jwt.claim.sub='${a}'`);
  await expect(db.query(`update public.users set ${column}=${column} where id='${a}'`)).rejects.toMatchObject({ code:'42501' });
});
it('synchronizes only the confirmed Auth email', async () => {
  await db.query(`update auth.users set email='verified@example.test' where id='${a}'`);
  expect((await db.query(`select email from public.users where id='${a}'`)).rows).toEqual([{ email:'verified@example.test' }]);
});
it('atomically removes the solo workspace and its decision graph while preserving another business and secrets', async () => {
  await db.query(`delete from auth.users where id='${a}'`);
  for (const table of ['users','organizations','business_profiles']) expect((await db.query(`select id from public.${table}`)).rows).toEqual([{ id:b }]);
  for (const table of ['feature_snapshots','decision_runs','action_proposals','executed_actions','action_outcomes','review_execution_claims','limited_auto_evaluations','shadow_evaluation_jobs']) expect((await db.query(`select count(*)::integer n from ai.${table}`)).rows).toEqual([{ n:0 }]);
  expect((await db.query('select id from vault.secrets')).rows).toEqual([{ id:b }]);
});
it('blocks deleting a shared workspace last owner and rolls the entire Auth deletion back', async () => {
  await db.exec(`insert into public.organization_memberships(organization_id,user_id,role) values('${a}','${b}','member'); savepoint guard`);
  await expect(db.query(`delete from auth.users where id='${a}'`)).rejects.toThrow('ACCOUNT_DELETE_LAST_OWNER');
  await db.exec('rollback to savepoint guard');
  expect((await db.query(`select id from auth.users where id='${a}'`)).rows).toEqual([{ id:a }]);
});
it('preserves shared integrations, drafts, and secrets by assigning their creator to a remaining owner', async () => {
  await db.exec(`insert into public.organization_memberships(organization_id,user_id,role) values('${a}','${b}','owner'); delete from auth.users where id='${a}'`);
  expect((await db.query(`select connected_by_user_id from public.platform_integrations where business_id='${a}'`)).rows).toEqual([{ connected_by_user_id:b }]);
  expect((await db.query(`select created_by_user_id from public.campaign_drafts where business_id='${a}'`)).rows).toEqual([{ created_by_user_id:b }]);
  expect((await db.query('select count(*)::integer n from vault.secrets')).rows).toEqual([{ n:2 }]);
});
it('preserves shared resources created before the user left that organization', async () => {
  await db.exec(`update public.platform_integrations set connected_by_user_id='${a}' where business_id='${b}'; delete from auth.users where id='${a}'`);
  expect((await db.query(`select connected_by_user_id from public.platform_integrations where business_id='${b}'`)).rows).toEqual([{ connected_by_user_id:b }]);
});
it.each([
  `update public.account_sync_jobs set status='running' where id='${a}'`,
  `update ai.review_execution_claims set active=true where business_id='${a}'`,
  `update ai.shadow_evaluation_jobs set status='running' where business_id='${a}'`,
])('blocks deletion while work is unresolved: %s', async setup => {
  await db.exec(setup);
  await expect(db.query(`select public.assert_account_deletable('${a}')`)).rejects.toThrow('ACCOUNT_DELETE_BUSY');
});
it('requires supported Storage cleanup instead of removing file metadata in SQL', async () => {
  await db.exec(`insert into storage.objects(owner_id) values('${a}')`);
  await expect(db.query(`select public.assert_account_deletable('${a}')`)).rejects.toThrow('ACCOUNT_DELETE_STORAGE');
});
it('rejects direct profile deletion while the Auth account still exists', async () => {
  await expect(db.query(`delete from public.users where id='${a}'`)).rejects.toThrow('Use the Auth administration API');
});
it('does not expose deletion checks to ordinary clients', async () => {
  await db.exec('set local role authenticated');
  await expect(db.query(`select public.assert_account_deletable('${b}')`)).rejects.toMatchObject({ code:'42501' });
});
