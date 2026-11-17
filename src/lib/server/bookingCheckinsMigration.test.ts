import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, expect, it } from 'vitest';

const A = '00000000-0000-0000-0000-00000000000a';
const B = '00000000-0000-0000-0000-00000000000b';
const ACCT_A = '00000000-0000-0000-0000-0000000000a1';
const ACCT_B = '00000000-0000-0000-0000-0000000000b1';
const USER = '00000000-0000-0000-0000-0000000000f1';
let db: PGlite;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key); insert into auth.users values ('${USER}');
    create table public.ad_accounts(id uuid primary key, business_id uuid not null, unique (business_id, id));
    insert into public.ad_accounts values ('${ACCT_A}', '${A}'), ('${ACCT_B}', '${B}');
    create function public.can_access_business(id uuid) returns boolean language sql
      as $$select id::text = current_setting('test.business', true)$$;`);
  const sql = readFileSync(new URL('../../../supabase/migrations/20261117042757_booking_checkins.sql', import.meta.url), 'utf8');
  await db.exec(sql);
  await db.exec(sql);
  await db.exec(`insert into public.booking_checkins(business_id, ad_account_id, week_start, bookings, answered_by) values
    ('${A}', '${ACCT_A}', '2026-11-09', 7, '${USER}'), ('${B}', '${ACCT_B}', '2026-11-09', 3, null)`);
}, 20000);
afterAll(async () => { await db?.close(); });

const asMember = async (statement: string) => {
  await db.exec(`begin; set local role authenticated; set local test.business = '${A}'`);
  try { return await db.query(statement); } finally { await db.exec('rollback; reset role'); }
};

it('lets members read only their business and never write', async () => {
  expect((await asMember('select ad_account_id, bookings from public.booking_checkins')).rows).toEqual([{ ad_account_id: ACCT_A, bookings: 7 }]);
  await expect(asMember(`insert into public.booking_checkins(business_id, ad_account_id, week_start, bookings) values ('${A}', '${ACCT_A}', '2026-11-02', 1)`))
    .rejects.toMatchObject({ code: '42501' });
  await expect(asMember('update public.booking_checkins set bookings = 0')).rejects.toMatchObject({ code: '42501' });
});

it('keeps the account inside its business and weeks on Mondays', async () => {
  await expect(db.exec(`insert into public.booking_checkins(business_id, ad_account_id, week_start, bookings) values ('${A}', '${ACCT_B}', '2026-11-02', 1)`))
    .rejects.toThrow(/foreign key/);
  await expect(db.exec(`insert into public.booking_checkins(business_id, ad_account_id, week_start, bookings) values ('${A}', '${ACCT_A}', '2026-11-03', 1)`))
    .rejects.toThrow(/week_start/);
  await expect(db.exec(`insert into public.booking_checkins(business_id, ad_account_id, week_start, bookings) values ('${A}', '${ACCT_A}', '2026-11-09', 2)`))
    .rejects.toThrow(/duplicate key/);
});

it('requires a count unless skipped, and bounds it', async () => {
  const insert = (values: string) => db.exec(`insert into public.booking_checkins(business_id, ad_account_id, week_start, bookings, skipped) values ('${A}', '${ACCT_A}', ${values})`);
  await expect(insert(`'2026-10-26', null, false`)).rejects.toThrow(/check/);
  await expect(insert(`'2026-10-26', 3, true`)).rejects.toThrow(/check/);
  await expect(insert(`'2026-10-26', -1, false`)).rejects.toThrow(/check/);
  await insert(`'2026-10-26', null, true`);
  await insert(`'2026-10-19', 0, false`);
});

it('cascades with the ad account and keeps rows when the answering user is removed', async () => {
  await db.exec(`delete from auth.users where id = '${USER}'`);
  expect((await db.query(`select answered_by from public.booking_checkins where week_start = '2026-11-09' and business_id = '${A}'`)).rows).toEqual([{ answered_by: null }]);
  await db.exec(`delete from public.ad_accounts where id = '${ACCT_B}'`);
  expect((await db.query(`select count(*)::int n from public.booking_checkins where business_id = '${B}'`)).rows).toEqual([{ n: 0 }]);
});
