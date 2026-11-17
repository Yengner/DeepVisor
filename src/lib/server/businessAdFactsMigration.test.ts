import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, expect, it } from 'vitest';

const A = '00000000-0000-0000-0000-00000000000a';
const B = '00000000-0000-0000-0000-00000000000b';
const USER = '00000000-0000-0000-0000-0000000000f1';
let db: PGlite;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    insert into auth.users values ('${USER}');
    create table public.business_profiles(id uuid primary key);
    insert into public.business_profiles values ('${A}'), ('${B}');
    create function public.can_access_business(id uuid) returns boolean language sql
      as $$select id::text = current_setting('test.business', true)$$;`);
  const sql = readFileSync(new URL('../../../supabase/migrations/20261117035925_business_ad_facts.sql', import.meta.url), 'utf8');
  await db.exec(sql);
  await db.exec(sql); // re-runnable
  await db.exec(`insert into public.business_ad_facts(business_id, fact_key, value, confirmed_by) values
    ('${A}', 'daily_budget', '{"amountMinor":1000,"currency":"USD"}', '${USER}'),
    ('${B}', 'run_days', '{"days":7}', null)`);
}, 20000);
afterAll(async () => { await db?.close(); });

it('lets members read only their own business and never write', async () => {
  const asMember = async (statement: string) => {
    await db.exec(`begin; set local role authenticated; set local test.business = '${A}'`);
    try { return await db.query(statement); } finally { await db.exec('rollback; reset role'); }
  };
  expect((await asMember('select business_id, fact_key from public.business_ad_facts')).rows)
    .toEqual([{ business_id: A, fact_key: 'daily_budget' }]);
  await expect(asMember(`insert into public.business_ad_facts(business_id, fact_key, value) values ('${A}', 'run_days', '{"days":3}')`))
    .rejects.toMatchObject({ code: '42501' });
  await expect(asMember(`update public.business_ad_facts set value = '{}'`)).rejects.toMatchObject({ code: '42501' });
  for (const role of ['anon', 'authenticated']) {
    const { rows } = await db.query<{ ok: boolean }>(`select has_table_privilege('${role}', 'public.business_ad_facts', 'insert,update,delete') ok`);
    expect(rows[0].ok).toBe(false);
  }
});

it('keeps one value per fact and bounds keys and values', async () => {
  await expect(db.exec(`insert into public.business_ad_facts(business_id, fact_key, value) values ('${A}', 'daily_budget', '{"amountMinor":2000,"currency":"USD"}')`))
    .rejects.toThrow(/duplicate key/);
  await expect(db.exec(`insert into public.business_ad_facts(business_id, fact_key, value) values ('${A}', 'favorite_color', '{}')`))
    .rejects.toThrow(/fact_key/);
  await expect(db.exec(`insert into public.business_ad_facts(business_id, fact_key, value) values ('${A}', 'run_days', '[7]')`))
    .rejects.toThrow(/value/);
  await expect(db.exec(`insert into public.business_ad_facts(business_id, fact_key, value) values ('${A}', 'run_days', jsonb_build_object('t', repeat('x', 3000)))`))
    .rejects.toThrow(/value/);
});

it('cascades with the business and keeps facts when the confirming user is removed', async () => {
  await db.exec(`delete from auth.users where id = '${USER}'`);
  expect((await db.query(`select confirmed_by from public.business_ad_facts where business_id = '${A}'`)).rows).toEqual([{ confirmed_by: null }]);
  await db.exec(`delete from public.business_profiles where id = '${B}'`);
  expect((await db.query(`select count(*)::int n from public.business_ad_facts where business_id = '${B}'`)).rows).toEqual([{ n: 0 }]);
});
