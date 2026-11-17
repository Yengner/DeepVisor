import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, expect, it } from 'vitest';

const ME = '00000000-0000-0000-0000-0000000000a1';
const OTHER = '00000000-0000-0000-0000-0000000000b1';
let db: PGlite;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role authenticated;
    create table public.users(id uuid primary key, first_name text, email text);
    alter table public.users enable row level security;
    create policy own on public.users for all to authenticated
      using (id::text = current_setting('test.uid', true)) with check (id::text = current_setting('test.uid', true));
    grant select on public.users to authenticated;
    grant update (first_name) on public.users to authenticated;
    insert into public.users values ('${ME}', 'Ada', 'a@x.test'), ('${OTHER}', 'Bo', 'b@x.test');`);
  const sql = readFileSync(new URL('../../../supabase/migrations/20261117054602_user_preferred_locale.sql', import.meta.url), 'utf8');
  await db.exec(sql);
  await db.exec(sql); // re-runnable
}, 20000);
afterAll(async () => { await db?.close(); });

const asMe = async (statement: string) => {
  await db.exec(`begin; set local role authenticated; set local test.uid = '${ME}'`);
  try { return await db.query(statement); } finally { await db.exec('commit; reset role'); }
};

it('lets users set only their own language, only to supported values', async () => {
  expect((await db.query('select preferred_locale from public.users order by id')).rows).toEqual([{ preferred_locale: null }, { preferred_locale: null }]);
  await asMe(`update public.users set preferred_locale = 'es'`);
  expect((await db.query('select id, preferred_locale from public.users order by id')).rows)
    .toEqual([{ id: ME, preferred_locale: 'es' }, { id: OTHER, preferred_locale: null }]);
  await expect(asMe(`update public.users set preferred_locale = 'fr'`)).rejects.toThrow(/preferred_locale/);
  await asMe(`update public.users set preferred_locale = null`);
  expect((await db.query(`select preferred_locale from public.users where id = '${ME}'`)).rows).toEqual([{ preferred_locale: null }]);
});

it('does not widen other column permissions', async () => {
  await expect(asMe(`update public.users set email = 'z@x.test'`)).rejects.toMatchObject({ code: '42501' });
});
