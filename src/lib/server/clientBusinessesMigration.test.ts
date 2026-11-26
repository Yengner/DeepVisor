import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, expect, it } from 'vitest';

const OPERATOR = '00000000-0000-0000-0000-0000000000f1';
const OWNER = '00000000-0000-0000-0000-0000000000f2';
const OPERATOR_ORG = '00000000-0000-0000-0000-00000000000a';
const OWNER_ORG = '00000000-0000-0000-0000-00000000000b';
let db: PGlite;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema ai; create schema storage;
    create table public.users(id uuid primary key);
    create table public.organizations(id uuid primary key default gen_random_uuid(), name text not null, type text not null, primary_language text);
    create table public.business_profiles(id uuid primary key default gen_random_uuid(), organization_id uuid unique references public.organizations(id) on delete cascade,
      business_name text not null, business_location text, industry text, onboarding_step int, onboarding_completed boolean);
    create table public.organization_memberships(id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
      user_id uuid not null references public.users(id), role text, created_at timestamptz default now());
    create table public.account_sync_jobs(id uuid, business_id uuid, status text);
    create table public.platform_integrations(id uuid, business_id uuid, connected_by_user_id uuid);
    create table public.campaign_drafts(id uuid, business_id uuid, created_by_user_id uuid);
    create table ai.shadow_evaluation_jobs(id uuid, business_id uuid, status text);
    create table ai.review_execution_claims(business_id uuid, active boolean);
    create table ai.executed_actions(business_id uuid, status text);
    create table storage.objects(owner uuid, owner_id text);
    insert into public.users values ('${OPERATOR}'), ('${OWNER}');
    insert into public.organizations(id, name, type) values ('${OPERATOR_ORG}', 'Operator', 'business'), ('${OWNER_ORG}', 'Someone else', 'business');
    insert into public.organization_memberships(organization_id, user_id, role) values ('${OPERATOR_ORG}', '${OPERATOR}', 'owner'), ('${OWNER_ORG}', '${OWNER}', 'owner');`);
  const sql = readFileSync(new URL('../../../supabase/migrations/20261126033445_client_businesses.sql', import.meta.url), 'utf8');
  await db.exec(sql);
  await db.exec(sql); // re-runnable
  await db.exec(`insert into public.operator_workspaces(organization_id) values ('${OPERATOR_ORG}')`);
}, 20000);
afterAll(async () => { await db?.close(); });

const create = (user: string, name: string) => db.query<{ id: string }>(`select public.create_client_business($1, $2, '  Tampa, FL ', 'hair_salon', 'es') id`, [user, name]);

it('refuses anyone who is not an operator and blank names', async () => {
  await expect(create(OWNER, 'Salon')).rejects.toThrow(/CLIENT_NOT_OPERATOR/);
  await expect(create(OPERATOR, '   ')).rejects.toThrow(/CLIENT_NAME_INVALID/);
  expect((await db.query('select 1 from public.client_engagements')).rows).toHaveLength(0);
});

it('creates the workspace, the managed membership and the engagement together', async () => {
  const business = (await create(OPERATOR, ' Salon One ')).rows[0].id;
  const { rows } = await db.query<Record<string, unknown>>(`select b.business_name, b.business_location, b.onboarding_completed, o.primary_language, m.role, m.kind, m.user_id, e.operator_organization_id, e.service_level
    from public.business_profiles b join public.organizations o on o.id = b.organization_id
    join public.organization_memberships m on m.organization_id = o.id join public.client_engagements e on e.business_id = b.id where b.id = $1`, [business]);
  expect(rows).toEqual([{ business_name: 'Salon One', business_location: 'Tampa, FL', onboarding_completed: true, primary_language: 'es',
    role: 'owner', kind: 'managed', user_id: OPERATOR, operator_organization_id: OPERATOR_ORG, service_level: 'managed' }]);
});

it('lets one ad account belong to one business only', async () => {
  const [a, b] = [(await create(OPERATOR, 'A')).rows[0].id, (await create(OPERATOR, 'B')).rows[0].id];
  await db.query(`insert into public.client_ad_accounts(external_account_id, business_id) values ('123', $1)`, [a]);
  await expect(db.query(`insert into public.client_ad_accounts(external_account_id, business_id) values ('123', $1)`, [b])).rejects.toThrow(/duplicate key/);
  await expect(db.query(`insert into public.client_ad_accounts(external_account_id, business_id) values ('act_9', $1)`, [b])).rejects.toThrow(/check/);
});

it('keeps operator records and functions away from browser roles', async () => {
  for (const role of ['anon', 'authenticated']) {
    for (const table of ['operator_workspaces', 'client_engagements', 'client_ad_accounts']) {
      const { rows } = await db.query<{ ok: boolean }>(`select has_table_privilege('${role}', 'public.${table}', 'select,insert,update,delete') ok`);
      expect(rows[0].ok).toBe(false);
    }
    for (const fn of ['create_client_business(uuid,text,text,text,text)', 'assert_account_deletable(uuid)']) {
      const { rows } = await db.query<{ ok: boolean }>(`select has_function_privilege('${role}', 'public.${fn}', 'execute') ok`);
      expect(rows[0].ok).toBe(false);
    }
  }
});

it('blocks deleting the operator while clients are active, and no one else', async () => {
  await expect(db.query('select public.assert_account_deletable($1)', [OPERATOR])).rejects.toThrow(/ACCOUNT_DELETE_ACTIVE_CLIENTS/);
  await expect(db.query('select public.assert_account_deletable($1)', [OWNER])).resolves.toBeTruthy();
  await db.exec('update public.client_engagements set ended_at = now()');
  await expect(db.query('select public.assert_account_deletable($1)', [OPERATOR])).resolves.toBeTruthy();
});
