import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { expect, it } from 'vitest';

const MIGRATION = 'supabase/migrations/20261115001921_business_profile_contact_methods.sql';

it('adds contact_methods idempotently without touching existing values', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create table public.business_profiles(
      id uuid primary key default gen_random_uuid(),
      preferred_contact_method text
    );
    insert into public.business_profiles(preferred_contact_method) values ('phone_calls');`);
    const sql = readFileSync(MIGRATION, 'utf8');
    await db.exec(sql);
    await db.exec(sql);
    expect((await db.query('select preferred_contact_method, contact_methods from public.business_profiles')).rows)
      .toEqual([{ preferred_contact_method: 'phone_calls', contact_methods: [] }]);
    await expect(db.exec('insert into public.business_profiles(contact_methods) values (null)')).rejects.toThrow();
  } finally {
    await db.close();
  }
}, 20000);
