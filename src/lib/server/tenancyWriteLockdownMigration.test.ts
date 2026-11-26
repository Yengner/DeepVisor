import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, expect, it } from 'vitest';

const TABLES = ['ad_accounts', 'organization_memberships', 'organizations', 'business_profiles'];
let db: PGlite;

beforeAll(async () => {
  db = new PGlite();
  // Starts from the live grants: both browser roles held every table privilege.
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;`);
  for (const table of TABLES) {
    await db.exec(`create table public.${table}(id int primary key, name text);
      grant all on public.${table} to anon, authenticated, service_role;`);
  }
  const sql = readFileSync(new URL('../../../supabase/migrations/20261126024258_tenancy_write_lockdown.sql', import.meta.url), 'utf8');
  await db.exec(sql);
  await db.exec(sql); // re-runnable
}, 20000);
afterAll(async () => { await db?.close(); });

const allowed = async (role: string, table: string) => {
  const result: string[] = [];
  for (const privilege of ['select', 'insert', 'update', 'delete', 'truncate']) {
    const { rows } = await db.query<{ ok: boolean }>(`select has_table_privilege('${role}', 'public.${table}', '${privilege}') ok`);
    if (rows[0].ok) result.push(privilege);
  }
  return result;
};

it('leaves signed-in users read-only on ad accounts and memberships', async () => {
  expect(await allowed('authenticated', 'ad_accounts')).toEqual(['select']);
  expect(await allowed('authenticated', 'organization_memberships')).toEqual(['select']);
});

it('keeps the updates onboarding needs, without create or delete', async () => {
  expect(await allowed('authenticated', 'organizations')).toEqual(['select', 'update']);
  expect(await allowed('authenticated', 'business_profiles')).toEqual(['select', 'update']);
});

it('gives signed-out visitors no writes, and leaves the server role untouched', async () => {
  for (const table of TABLES) {
    expect(await allowed('anon', table)).toEqual(['select']);
    expect(await allowed('service_role', table)).toEqual(['select', 'insert', 'update', 'delete', 'truncate']);
  }
});

it('rejects a direct browser write', async () => {
  await db.exec('begin; set local role authenticated');
  try {
    await expect(db.query(`insert into public.ad_accounts values (1, 'someone else''s account')`)).rejects.toMatchObject({ code: '42501' });
  } finally {
    await db.exec('rollback; reset role');
  }
});
