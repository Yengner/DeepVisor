import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, afterAll, it, expect } from 'vitest';
let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema intelligence; create schema storage;
    create table public.platform_integrations(id uuid);
    grant all on public.platform_integrations to authenticated,anon;
    create table intelligence.ad_account_signals(business_id uuid);
    insert into intelligence.ad_account_signals values ('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002');
    create function public.can_access_business(id uuid) returns boolean language sql as $$select id::text=current_setting('test.business',true)$$;
    create function public.get_platform_token(secret_id uuid) returns text language sql security definer as $$select 'test-only'::text$$;
    grant execute on function public.get_platform_token(uuid) to anon, authenticated;
    create table storage.buckets(id text, public boolean);
    insert into storage.buckets values('report-archive-pdfs',true),('business-media',true);
  `);
  await db.exec(readFileSync(new URL('../../../supabase/migrations/20261020231659_beta_access_hardening.sql', import.meta.url), 'utf8'));
}, 20000);
afterAll(async () => { await db?.close(); });
it('restricts internal RPCs and integration writes, retains service access', async () => {
  const r = await db.query<{ allowed: boolean }>(`select has_function_privilege('authenticated','public.get_platform_token(uuid)','execute') allowed`);
  expect(r.rows[0].allowed).toBe(false);
  for (const role of ['anon','authenticated']) {
    expect((await db.query<{ allowed: boolean }>(`select has_function_privilege('${role}','public.get_platform_token(uuid)','execute') allowed`)).rows[0].allowed).toBe(false);
    expect((await db.query<{ allowed: boolean }>(`select has_table_privilege('${role}','public.platform_integrations','update') allowed`)).rows[0].allowed).toBe(false);
  }
  expect((await db.query<{ allowed: boolean }>(`select has_function_privilege('service_role','public.get_platform_token(uuid)','execute') allowed`)).rows[0].allowed).toBe(true);
});
it('enforces business RLS for signals and makes archived reports private', async () => {
  await db.exec(`begin; set local role authenticated; set local test.business='00000000-0000-0000-0000-000000000001'`);
  expect((await db.query('select * from intelligence.ad_account_signals')).rows).toHaveLength(1);
  await expect(db.query(`insert into intelligence.ad_account_signals values ('00000000-0000-0000-0000-000000000001')`)).rejects.toMatchObject({ code: '42501' });
  await db.exec('rollback; reset role');
  expect((await db.query(`select public from storage.buckets where id='report-archive-pdfs'`)).rows).toEqual([{ public: false }]);
  expect((await db.query(`select public from storage.buckets where id='business-media'`)).rows).toEqual([{ public: true }]);
});
it('enforces account/entity composite integrity and blocks fixture credentials and sync', async () => {
  await db.exec(`
    create table public.ad_accounts(id uuid primary key,business_id uuid);
    create table public.ad_entities(id uuid primary key,business_id uuid,ad_account_id uuid,entity_level text);
    create table public.ad_creatives(id uuid primary key,business_id uuid,ad_account_id uuid);
    alter table public.platform_integrations add column integration_details jsonb default '{}', add column access_token_secret_id text, add column refresh_token_secret_id uuid;
    create table public.account_sync_jobs(id uuid,platform_integration_id uuid,status text);
  `);
  for (const table of ['ad_entity_performance_daily','ad_entity_performance_summary','ad_entity_performance_monthly','ad_entity_performance_hourly','ad_audience_breakdowns_summary']) await db.exec(`create table public.${table}(entity_id uuid,ad_account_id uuid,entity_level text)`);
  await db.exec(readFileSync(new URL('../../../supabase/migrations/20261020231922_beta_scope_integrity.sql', import.meta.url), 'utf8'));
  const a = '00000000-0000-0000-0000-000000000001', b = '00000000-0000-0000-0000-000000000002';
  await db.exec(`insert into public.ad_accounts values('${a}','${a}'),('${b}','${b}'); insert into public.ad_entities values('${a}','${a}','${a}','adset');
    insert into public.platform_integrations(id,integration_details) values('${a}','{"synthetic_fixture":"deepvisor-beta-v1"}');`);
  await expect(db.exec(`insert into public.ad_creatives values('${a}','${b}','${a}')`)).rejects.toMatchObject({code:'23503'});
  await expect(db.exec(`insert into public.ad_entity_performance_daily values('${a}','${b}','adset')`)).rejects.toMatchObject({code:'23503'});
  await expect(db.exec(`insert into public.ad_entity_performance_daily values('${a}','${a}','ad')`)).rejects.toMatchObject({code:'23503'});
  await expect(db.exec(`update public.platform_integrations set access_token_secret_id='test-only' where id='${a}'`)).rejects.toMatchObject({code:'23514'});
  await expect(db.exec(`update public.platform_integrations set integration_details='{}' where id='${a}'`)).rejects.toMatchObject({code:'23514'});
  await expect(db.exec(`insert into public.account_sync_jobs values('${a}','${a}','queued')`)).rejects.toMatchObject({code:'23514'});
  await db.exec(`insert into public.account_sync_jobs values('${a}','${a}','completed')`);
});
