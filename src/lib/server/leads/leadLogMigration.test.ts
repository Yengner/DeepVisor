import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';

const A = '00000000-0000-0000-0000-00000000000a';
const B = '00000000-0000-0000-0000-00000000000b';
const PHONE_A = '1111', PHONE_B = '2222';
const KEY = (n: number) => n.toString(16).padStart(64, '0');
const MSG = (n: number) => `f${n.toString(16).padStart(63, '0')}`;
let db: PGlite;
let seq = 0;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create table public.business_profiles(id uuid primary key);
    insert into public.business_profiles values ('${A}'), ('${B}');
    create function public.can_access_business(id uuid) returns boolean language sql
      as $$select id::text = current_setting('test.business', true)$$;`);
  const sql = readFileSync(new URL('../../../../supabase/migrations/20261118034046_whatsapp_lead_log.sql', import.meta.url), 'utf8');
  await db.exec(sql);
  await db.exec(sql);
  const connect = readFileSync(new URL('../../../../supabase/migrations/20261118054831_whatsapp_connect.sql', import.meta.url), 'utf8');
  await db.exec(connect);
  await db.exec(connect);
  await db.exec(`insert into public.whatsapp_connections(business_id, phone_number_id) values ('${A}', '${PHONE_A}'), ('${B}', '${PHONE_B}')`);
}, 20000);
afterAll(async () => { await db?.close(); });
beforeEach(async () => { await db.exec('delete from public.whatsapp_message_receipts; delete from public.leads'); });

type Result = { status: string; lead_id?: string; created?: boolean };
async function message(o: { phone?: string; dir?: 'in' | 'out'; contact?: number; at: string; ad?: string | null; clid?: string | null; name?: string; key?: string }): Promise<Result> {
  const { rows } = await db.query<{ r: Result }>(
    'select public.record_whatsapp_message($1,$2,$3,$4,$5,$6,$7,$8,$9) as r',
    [o.phone ?? PHONE_A, o.key ?? MSG(++seq), o.dir ?? 'in', KEY(o.contact ?? 1), o.name ?? 'Ana', '4567', o.at, o.ad ?? null, o.clid ?? null],
  );
  return rows[0].r;
}
const leads = async () => (await db.query<Record<string, unknown>>(
  `select business_id, source, ad_external_id, ctwa_clid, messages_in, messages_out,
     to_char(first_message_at at time zone 'UTC', 'MM-DD HH24:MI') as first, to_char(first_reply_at at time zone 'UTC', 'MM-DD HH24:MI') as reply
   from public.leads order by first_message_at`)).rows;

it('opens a lead from an ad and joins later messages and the first reply to it', async () => {
  expect(await message({ at: '2026-11-10T10:00:00Z', ad: '777', clid: 'clk' })).toMatchObject({ status: 'recorded', created: true });
  expect(await message({ at: '2026-11-10T10:02:00Z' })).toMatchObject({ status: 'recorded', created: false });
  await message({ dir: 'out', at: '2026-11-10T10:12:00Z' });
  await message({ dir: 'out', at: '2026-11-10T10:30:00Z' });
  expect(await leads()).toEqual([{ business_id: A, source: 'ad', ad_external_id: '777', ctwa_clid: 'clk', messages_in: 2, messages_out: 2, first: '11-10 10:00', reply: '11-10 10:12' }]);
});

it('counts a retried delivery once', async () => {
  await message({ at: '2026-11-10T10:00:00Z', key: MSG(9000) });
  expect(await message({ at: '2026-11-10T10:00:00Z', key: MSG(9000) })).toEqual({ status: 'duplicate' });
  expect((await leads())[0]).toMatchObject({ messages_in: 1 });
});

it('starts a new lead for a different ad or after 30 quiet days, and keeps organic chats separate from ads', async () => {
  await message({ at: '2026-10-01T10:00:00Z' });
  await message({ at: '2026-10-05T10:00:00Z', ad: '777' });
  await message({ at: '2026-10-06T10:00:00Z', ad: '777' });
  await message({ at: '2026-11-20T10:00:00Z' });
  expect((await leads()).map(l => [l.source, l.ad_external_id, l.messages_in])).toEqual([
    ['organic', null, 1], ['ad', '777', 2], ['organic', null, 1],
  ]);
});

it('ignores conversations the business starts and numbers that are not connected', async () => {
  expect(await message({ dir: 'out', at: '2026-11-10T10:00:00Z' })).toEqual({ status: 'ignored' });
  expect(await message({ phone: '9999', at: '2026-11-10T10:00:00Z' })).toEqual({ status: 'unknown_number' });
  expect(await leads()).toEqual([]);
});

it('handles messages arriving out of order', async () => {
  await message({ at: '2026-11-10T10:05:00Z', ad: '777' });
  await message({ dir: 'out', at: '2026-11-10T10:20:00Z' });
  await message({ at: '2026-11-10T10:01:00Z' });
  await message({ dir: 'out', at: '2026-11-10T09:00:00Z' });
  expect(await leads()).toEqual([expect.objectContaining({ first: '11-10 10:01', reply: '11-10 10:20', messages_in: 2, messages_out: 2 })]);
});

it('keeps each number inside its own business', async () => {
  await message({ phone: PHONE_A, at: '2026-11-10T10:00:00Z' });
  await message({ phone: PHONE_B, at: '2026-11-10T10:00:00Z' });
  expect((await leads()).map(l => l.business_id).sort()).toEqual([A, B]);
});

it('lets members read only their business, never write, and never see receipts', async () => {
  await message({ phone: PHONE_A, at: '2026-11-10T10:00:00Z' });
  await message({ phone: PHONE_B, at: '2026-11-10T10:00:00Z' });
  const asMember = async (statement: string) => {
    await db.exec(`begin; set local role authenticated; set local test.business = '${A}'`);
    try { return await db.query(statement); } finally { await db.exec('rollback; reset role'); }
  };
  expect((await asMember('select business_id from public.leads')).rows).toEqual([{ business_id: A }]);
  expect((await asMember('select business_id from public.whatsapp_connections')).rows).toEqual([{ business_id: A }]);
  await expect(asMember(`update public.leads set outcome = 'booked', outcome_at = now()`)).rejects.toMatchObject({ code: '42501' });
  await expect(asMember('select * from public.whatsapp_message_receipts')).rejects.toMatchObject({ code: '42501' });
  await expect(asMember(`select public.record_whatsapp_message('1111','${MSG(1)}','in','${KEY(1)}',null,null,now(),null,null)`)).rejects.toMatchObject({ code: '42501' });
});

it('rejects inconsistent rows', async () => {
  const insert = (values: string) => db.exec(`insert into public.leads(business_id, channel, source, contact_key, ad_external_id, first_message_at, last_message_at, outcome, outcome_at) values ('${A}', ${values})`);
  await expect(insert(`'whatsapp', 'ad', '${KEY(1)}', null, now(), now(), null, null`)).rejects.toThrow(/check/);
  await expect(insert(`'call', 'manual', '${KEY(1)}', null, now(), now(), null, null`)).rejects.toThrow(/check/);
  await expect(insert(`'call', 'manual', null, null, now(), now(), 'booked', null`)).rejects.toThrow(/check/);
  await insert(`'call', 'manual', null, null, now(), now(), 'booked', now()`);
});

it('keeps one lead when WhatsApp sends a placeholder before the real first message from an ad', async () => {
  // 131060 "unsupported" placeholder (no referral), then the real message with the ad a few seconds later.
  expect(await message({ at: '2026-11-10T10:00:00Z' })).toMatchObject({ created: true });
  expect(await message({ at: '2026-11-10T10:00:04Z', ad: '777', clid: 'click-1' })).toMatchObject({ status: 'recorded', created: false });
  expect(await leads()).toEqual([expect.objectContaining({ source: 'ad', ad_external_id: '777', ctwa_clid: 'click-1', messages_in: 2, first: '11-10 10:00' })]);
});

it('still opens a new lead for an ad chat long after an organic one', async () => {
  await message({ at: '2026-11-10T10:00:00Z' });
  await message({ at: '2026-11-10T11:00:00Z', ad: '777' });
  expect((await leads()).map(l => l.source)).toEqual(['organic', 'ad']);
});

it('never lets members read the token reference or sync errors', async () => {
  const asMember = async (statement: string) => {
    await db.exec(`begin; set local role authenticated; set local test.business = '${A}'`);
    try { return await db.query(statement); } finally { await db.exec('rollback; reset role'); }
  };
  expect((await asMember('select display_phone, onboarded_via, sync_requested_at from public.whatsapp_connections')).rows).toHaveLength(1);
  await expect(asMember('select token_secret_id from public.whatsapp_connections')).rejects.toMatchObject({ code: '42501' });
  await expect(asMember('select sync_error from public.whatsapp_connections')).rejects.toMatchObject({ code: '42501' });
});
